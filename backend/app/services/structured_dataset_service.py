"""Structured datasets v1: tenant-first persistence and bounded exact evaluation.

Queries scan at most 2000 validated rows in Python, not arbitrary SQL. No joins,
LLMs, recalculation, async jobs, or KnowledgeSource coupling. Decimal arithmetic
uses a bounded high-precision context; published versions have no edit endpoint.
This bounds application evaluation, not database lock/statement wait time. A
deployment SQL statement timeout is a separate operational control, not set here.
"""
import json
import re
from datetime import date
from decimal import Decimal, InvalidOperation, localcontext
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.config import settings
from app.models import Organization, WidgetConfig
from app.models.structured_dataset import StructuredDataset as Dataset, StructuredDatasetVersion as Version, StructuredDatasetRow as Row
from app.schemas.structured_dataset import QueryPlan, VersionCreate, MAX_ROWS, MAX_FILE_BYTES

MAX_VERSIONS = 10
MAX_TENANT_DATASETS = 50
MAX_TENANT_ROWS = 20000


def is_structured_enabled(organization_id: int) -> bool:
    allowed = {v.strip() for v in settings.STRUCTURED_DATASETS_ORGANIZATION_IDS.split(",")}
    return bool(settings.STRUCTURED_DATASETS_ENABLED and str(organization_id) in allowed)


def require_enabled(organization_id: int) -> None:
    if not is_structured_enabled(organization_id):
        raise HTTPException(403, "Structured datasets are disabled for this organization")


def require_widget(db: Session, organization_id: int, widget_id: str) -> WidgetConfig:
    widget = db.query(WidgetConfig).filter(WidgetConfig.organization_id == organization_id,
                                         WidgetConfig.widget_id == widget_id).first()
    if widget is None:
        raise HTTPException(404, "Agent not found in this organization")
    return widget


def get_dataset(db: Session, organization_id: int, dataset_id: int, widget_id: str | None = None,
                lock: bool = False) -> Dataset:
    require_enabled(organization_id)
    query = db.query(Dataset).filter(Dataset.organization_id == organization_id,
                                    Dataset.id == dataset_id, Dataset.is_deleted.is_(False))
    if widget_id is not None:
        query = query.filter(Dataset.widget_id == widget_id)
    if lock:
        query = query.with_for_update()
    dataset = query.first()
    if dataset is None:
        raise HTTPException(404, "Dataset not found")
    require_widget(db, organization_id, dataset.widget_id)
    return dataset


def versions_query(db: Session, dataset: Dataset):
    return db.query(Version).filter(Version.organization_id == dataset.organization_id,
                                    Version.widget_id == dataset.widget_id, Version.dataset_id == dataset.id)


def rows_query(db: Session, version: Version):
    return db.query(Row).filter(Row.organization_id == version.organization_id,
                               Row.widget_id == version.widget_id, Row.dataset_id == version.dataset_id,
                               Row.version_id == version.id).order_by(Row.row_number)


def get_version(db: Session, dataset: Dataset, version_id: int, lock: bool = False) -> Version:
    query = versions_query(db, dataset).filter(Version.id == version_id)
    version = (query.with_for_update() if lock else query).first()
    if version is None:
        raise HTTPException(404, "Dataset version not found")
    return version


def normalize(value, kind: str):
    if value is None:
        return None
    if isinstance(value, float):
        raise ValueError("Floating point is unsupported; send exact decimal strings")
    if len(str(value)) > 4000:
        raise ValueError("Cell exceeds 4000 characters")
    if kind == "text":
        if not isinstance(value, str):
            raise ValueError("Expected text string")
        return value
    if kind == "boolean":
        if isinstance(value, bool):
            return value
        if isinstance(value, str) and value.lower() in {"true", "false"}:
            return value.lower() == "true"
        raise ValueError("Expected boolean or true/false string")
    if kind == "date":
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("Expected ISO date YYYY-MM-DD")
        return date.fromisoformat(value).isoformat()
    if isinstance(value, bool) or not isinstance(value, (str, int, Decimal)):
        raise ValueError("Expected exact numeric string or integer")
    text = str(value)
    if kind == "integer":
        if not re.fullmatch(r"[+-]?\d{1,100}", text):
            raise ValueError("Expected integer (maximum 100 digits)")
        value = int(text)
        # Preserve exact JSON/JavaScript round trips beyond Number's safe range.
        return value if abs(value) <= 2**53 - 1 else str(value)
    if not re.fullmatch(r"[+-]?\d{1,100}(?:\.\d{1,100})?", text):
        raise ValueError("Expected finite decimal string (maximum 100 digits per part)")
    return format(Decimal(text), "f")


def validate_payload(payload: VersionCreate) -> tuple[list[dict], dict]:
    errors, warnings = [], []
    columns = {c.key: c for c in payload.columns}
    if len(columns) != len(payload.columns):
        errors.append("Duplicate column keys")
    if len({c.label.strip().casefold() for c in payload.columns}) != len(payload.columns):
        errors.append("Duplicate column labels")
    if any(not c.label.strip() for c in payload.columns):
        errors.append("Column labels cannot be blank")
    if not any(c.public for c in payload.columns):
        errors.append("At least one public output column is required")
    for c in payload.columns:
        if (c.currency or c.unit) and c.data_type not in {"decimal", "integer"}:
            errors.append(f"{c.key}: currency/unit requires numeric type")
        if any(len(a) > 200 for a in c.aliases):
            errors.append(f"{c.key}: alias exceeds 200 characters")
    if len(set(payload.required_filters)) != len(payload.required_filters):
        errors.append("Duplicate required filters")
    for key in payload.required_filters:
        if key not in columns or not columns[key].public or not columns[key].queryable:
            errors.append(f"Required filter {key} must be a public queryable column")
    normalized = []
    for number, row in enumerate(payload.rows, 1):
        result = dict(row)
        for key, value in row.items():
            if key not in columns:
                errors.append(f"Row {number}: unknown column {key}")
                continue
            try:
                result[key] = normalize(value, columns[key].data_type)
            except (ValueError, InvalidOperation) as exc:
                errors.append(f"Row {number}, {key}: {exc}")
        for key in columns:
            result.setdefault(key, None)
        normalized.append(result)
    if not payload.rows:
        errors.append("At least one row is required")
    if len(json.dumps(payload.model_dump(), ensure_ascii=False).encode("utf-8")) > MAX_FILE_BYTES:
        errors.append("Dataset payload exceeds 5 MB")
    # Repeated records can make lookups ambiguous, but are legitimate for sums/counts.
    if len({json.dumps(r, sort_keys=True) for r in normalized}) < len(normalized):
        warnings.append("Duplicate rows present; aggregates count each stored row")
    return normalized, dict(valid=not errors, errors=errors[:100], warnings=warnings)


def add_version(db: Session, dataset: Dataset, payload: VersionCreate) -> Version:
    # Caller holds tenant + dataset lock. All mutation endpoints serialize per tenant.
    existing = versions_query(db, dataset).all()
    if len(existing) >= MAX_VERSIONS:
        raise HTTPException(409, "Dataset version limit is 10 (including drafts)")
    total = db.query(func.count(Row.id)).filter(Row.organization_id == dataset.organization_id).scalar() or 0
    if total + len(payload.rows) > MAX_TENANT_ROWS:
        raise HTTPException(409, "Organization stored-row limit is 20000 (including history)")
    normalized, validation = validate_payload(payload)
    # Structural/resource violations are rejected rather than stored unbounded.
    if any(len(str(v)) > 4000 for r in payload.rows for v in r.values()) or any(len(k) > 64 for r in payload.rows for k in r):
        raise HTTPException(422, "Cell/key length limit exceeded")
    if len(json.dumps(payload.model_dump(), ensure_ascii=False).encode("utf-8")) > MAX_FILE_BYTES:
        raise HTTPException(413, "Dataset payload exceeds 5 MB")
    if len(json.dumps(normalized, ensure_ascii=False).encode("utf-8")) > MAX_FILE_BYTES:
        raise HTTPException(413, "Normalized dataset exceeds 5 MB")
    version = Version(dataset_id=dataset.id, organization_id=dataset.organization_id,
                      widget_id=dataset.widget_id, version_number=max([v.version_number for v in existing], default=0) + 1,
                      status="draft", sheet_name=payload.sheet_name,
                      columns=[c.model_dump() for c in payload.columns], required_filters=payload.required_filters,
                      validation=validation, row_count=len(normalized))
    db.add(version)
    db.flush()
    for n, values in enumerate(normalized, 1):
        db.add(Row(dataset_id=dataset.id, version_id=version.id, organization_id=dataset.organization_id,
                   widget_id=dataset.widget_id, row_number=n, values=values))
    db.flush()
    return version


def lock_tenant(db: Session, organization_id: int) -> None:
    require_enabled(organization_id)
    if db.query(Organization.id).filter(Organization.id == organization_id).with_for_update().first() is None:
        raise HTTPException(404, "Organization not found")


def create_dataset(db: Session, organization_id: int, payload) -> tuple[Dataset, Version]:
    lock_tenant(db, organization_id)
    require_widget(db, organization_id, payload.widget_id)
    # Include soft-deleted records in quota: deletion cannot bypass storage bounds.
    if db.query(Dataset).filter(Dataset.organization_id == organization_id).count() >= MAX_TENANT_DATASETS:
        raise HTTPException(409, "Organization dataset limit is 50")
    dataset = Dataset(organization_id=organization_id, widget_id=payload.widget_id,
                      name=payload.name, description=payload.description, status="draft")
    db.add(dataset)
    db.flush()
    version = add_version(db, dataset, VersionCreate.model_validate(payload.model_dump(include={"sheet_name", "columns", "rows", "required_filters"})))
    return dataset, version


def validate_version(db: Session, version: Version) -> dict:
    rows = rows_query(db, version).limit(MAX_ROWS + 1).all()
    try:
        payload = VersionCreate(sheet_name=version.sheet_name, columns=version.columns,
                                required_filters=version.required_filters, rows=[r.values for r in rows])
        _, report = validate_payload(payload)
        if version.row_count != len(rows):
            report["errors"].append("Stored row_count does not match actual rows")
            report["valid"] = False
        return report
    except ValueError as exc:
        return dict(valid=False, errors=[str(exc)], warnings=[])


def publish_version(db: Session, organization_id: int, dataset_id: int, version_id: int) -> Dataset:
    lock_tenant(db, organization_id)
    dataset = get_dataset(db, organization_id, dataset_id, lock=True)
    version = get_version(db, dataset, version_id, lock=True)
    if version.status == "published":
        raise HTTPException(409, "Published versions are immutable; create a new draft")
    report = validate_version(db, version)
    if not report["valid"]:
        raise HTTPException(422, report)
    # Re-normalize actual stored draft data, not the cached validation report.
    stored = rows_query(db, version).limit(MAX_ROWS).all()
    payload = VersionCreate(sheet_name=version.sheet_name, columns=version.columns,
                            required_filters=version.required_filters, rows=[r.values for r in stored])
    normalized, _ = validate_payload(payload)
    for row, values in zip(stored, normalized):
        if row.values != values:
            row.values = values
    db.flush()  # rows are still draft here; publication guard follows
    version.validation = report
    version.status = "published"
    dataset.active_version_id = version.id
    dataset.status = "active"
    db.flush()
    return dataset


def serialize_dataset(db: Session, dataset: Dataset, detail: bool = True, draft: Version | None = None) -> dict:
    result = dict(id=dataset.id, widget_id=dataset.widget_id, name=dataset.name,
                  description=dataset.description, status=dataset.status, active_version_id=dataset.active_version_id)
    if detail:
        versions = []
        for v in versions_query(db, dataset).order_by(Version.version_number).limit(MAX_VERSIONS).all():
            versions.append(dict(id=v.id, version_number=v.version_number, status=v.status,
                                 sheet_name=v.sheet_name, columns=v.columns, required_filters=v.required_filters,
                                 rows=[r.values for r in rows_query(db, v).limit(MAX_ROWS).all()],
                                 row_count=v.row_count, validation=v.validation))
        result["versions"] = versions
        if draft:
            result["draft_version"] = next(v for v in versions if v["id"] == draft.id)
    return result


def get_active_catalog(db: Session, organization_id: int, widget_id: str) -> list[dict]:
    if not is_structured_enabled(organization_id) or not settings.STRUCTURED_DATASETS_CHAT_ENABLED:
        return []
    require_widget(db, organization_id, widget_id)
    datasets = db.query(Dataset).filter(Dataset.organization_id == organization_id,
        Dataset.widget_id == widget_id, Dataset.is_deleted.is_(False), Dataset.status == "active").limit(MAX_TENANT_DATASETS).all()
    catalog = []
    for dataset in datasets:
        version = get_version(db, dataset, dataset.active_version_id)
        if version.status == "published":
            catalog.append(dict(dataset_id=dataset.id, version_id=version.id, name=dataset.name,
                description=dataset.description, columns=[c for c in version.columns if c["public"]],
                required_filters=version.required_filters))
    return catalog


def get_public_catalog_values(db: Session, organization_id: int, widget_id: str,
                              entry: dict, keys: list[str]) -> list[dict]:
    """Bounded public text projection for deterministic conversational context.

    Authorization/schema/version checks precede row IO. No private fields, price
    facts or rows are passed to a model; callers receive only requested text keys.
    """
    dataset = get_dataset(db, organization_id, entry["dataset_id"], widget_id)
    if dataset.status != "active" or dataset.active_version_id != entry["version_id"]:
        raise HTTPException(409, "Catalog version changed")
    version = get_version(db, dataset, entry["version_id"])
    public = [c for c in version.columns if c["public"]]
    if (version.status != "published" or public != entry["columns"]
            or version.required_filters != entry["required_filters"]):
        raise HTTPException(409, "Catalog schema changed")
    columns = {c["key"]: c for c in public}
    if (not keys or len(keys) > 50 or len(set(keys)) != len(keys)
            or any(k not in columns or not columns[k]["queryable"]
                   or columns[k]["data_type"] != "text" for k in keys)):
        raise HTTPException(422, "Unknown, private or unsupported catalog field")
    stored = rows_query(db, version).limit(MAX_ROWS + 1).all()
    if len(stored) > MAX_ROWS:
        raise HTTPException(409, "Active version exceeds v1 row bounds")
    return [{key: row.values.get(key) for key in keys
             if isinstance(row.values.get(key), str) and row.values[key].strip()}
            for row in stored]


def get_public_location_listing(db: Session, organization_id: int, widget_id: str,
                                entry: dict, city_key: str, city: str, area_key: str) -> dict:
    """Read-only discovery, not a lookup/required-filter bypass.

    The same authorized public text projection validates scope/schema and bounds.
    Read immutable pinned rows for exact citations; never switch to a new version.
    """
    get_public_catalog_values(db, organization_id, widget_id, entry, [city_key, area_key])
    dataset = get_dataset(db, organization_id, entry["dataset_id"], widget_id)
    if dataset.status != "active" or dataset.active_version_id != entry["version_id"]:
        raise HTTPException(409, "Catalog version changed")
    version = get_version(db, dataset, entry["version_id"])
    if (version.status != "published" or [c for c in version.columns if c["public"]] != entry["columns"]
            or version.required_filters != entry["required_filters"]):
        raise HTTPException(409, "Catalog schema changed")
    stored = rows_query(db, version).limit(MAX_ROWS + 1).all()
    if len(stored) > MAX_ROWS:
        raise HTTPException(409, "Active version exceeds v1 row bounds")
    matching = [r for r in stored if r.values.get(city_key) == city
                and isinstance(r.values.get(area_key), str) and r.values[area_key].strip()]
    values = sorted({r.values[area_key] for r in matching}, key=lambda v: (v.casefold(), v))
    shown = values[:10]
    citations = [dict(dataset_id=dataset.id, version_id=version.id, name=dataset.name,
                      sheet_name=version.sheet_name,
                      row_numbers=[r.row_number for r in matching if r.values[area_key] in shown])] if shown else []
    return dict(values=shown, total_values=len(values), citations=citations)


def resolve_text_filter_values(db: Session, organization_id: int, widget_id: str, plan: dict) -> dict:
    """Resolve only unique whole-phrase text values in the submitted filter.

    Stored spellings are returned verbatim. No aliases, fuzzy matching, numeric
    conversion, other-column inference, or database writes are involved.
    """
    require_enabled(organization_id)
    try:
        request = QueryPlan.model_validate(plan)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    dataset = get_dataset(db, organization_id, request.dataset_id, widget_id)
    if dataset.status != "active" or dataset.active_version_id is None:
        raise HTTPException(409, "Dataset has no active published version")
    if request.version_id is not None and request.version_id != dataset.active_version_id:
        raise HTTPException(409, "Only the current active version may be queried")
    version = get_version(db, dataset, dataset.active_version_id)
    if version.status != "published":
        raise HTTPException(409, "Version is not published")
    columns = {c["key"]: c for c in version.columns}

    def allowed(key: str, queryable: bool = False) -> dict:
        column = columns.get(key)
        if column is None or not column["public"] or (queryable and not column["queryable"]):
            raise HTTPException(422, "Unknown, private or nonqueryable column")
        return column

    for key in request.select:
        allowed(key)
    text_filters = []
    for item in request.filters:
        column = allowed(item.column, True)
        if item.operator != "eq" and column["data_type"] not in {"decimal", "integer", "date"}:
            raise HTTPException(422, "Range operators require numeric or date columns")
        if item.operator == "eq" and column["data_type"] == "text" and isinstance(item.value, str):
            text_filters.append(item)
    if request.operation in {"sum", "min", "max"}:
        if not request.aggregate_column:
            raise HTTPException(422, "aggregate_column is required")
        if allowed(request.aggregate_column, True)["data_type"] not in {"decimal", "integer"}:
            raise HTTPException(422, "Aggregation requires a numeric column")
    elif request.aggregate_column is not None:
        raise HTTPException(422, "aggregate_column is not applicable to lookup/count")
    if not text_filters:
        return request.model_dump()
    stored = rows_query(db, version).limit(MAX_ROWS + 1).all()
    if len(stored) > MAX_ROWS:
        raise HTTPException(409, "Active version exceeds v1 row bounds")
    for item in text_filters:
        values = {row.values.get(item.column) for row in stored
                  if isinstance(row.values.get(item.column), str)}
        if item.value in values:
            continue
        phrase = item.value.casefold()
        candidates = [value for value in values if value.strip() and re.search(
            r"(?<!\w)" + re.escape(value.casefold()) + r"(?!\w)", phrase)]
        if len(candidates) == 1:
            item.value = candidates[0]
    return request.model_dump()


def resolve_explicit_price_lookup(db: Session, organization_id: int, widget_id: str,
                                  message: str, catalog: list[dict]) -> dict | None:
    """Read-only, exact public evidence; never expose scanned rows to a planner.

    Every required text field must have one independently supplied stored value,
    and their tuple must exist together in a row. Across the whole scoped catalog
    exactly one dataset may qualify. No fuzzy aliases, prior-turn guesses, numeric
    filters, aggregates, negations or compound document questions are supported.
    """
    require_enabled(organization_id)
    text = " ".join(message.casefold().split())
    if (len(message) > 8000 or not re.search(r"\b(?:prices?|pricing|rates?|rent|costs?|fees?|charges?|quotes?|tariffs?)\b|\bhow much\b", text)
            or re.search(r"\d|[<>=]|\b(?:count|many|total|sum|min|minimum|max|maximum|average|cheapest|highest|lowest|"
                         r"less|greater|lower|higher|cheaper|expensive|least|most|under|over|below|above|between|"
                         r"not|except|exclude|without|compare|versus|vs|"
                         r"policy|policies|returns?|refunds?|operate|owns?|who|why|about|discounts?|availability|"
                         r"services?|ownership|founders?|documents?|shipping|warranty|support|contact|"
                         r"filters?|equals?|rows?|records?|columns?|fields?|select|only)\b|\bmore than\b", text)):
        return None

    def words(value: str) -> str:
        return " ".join(re.findall(r"\w+", value.casefold()))

    question = words(message)
    candidates = []
    scanned = 0
    for entry in catalog:
        columns = {c["key"]: c for c in entry["columns"]}
        required = entry["required_filters"]
        if not required or any(k not in columns or not columns[k]["public"]
                               or not columns[k]["queryable"] or columns[k]["data_type"] != "text"
                               for k in required):
            continue
        price_columns = [k for k, c in columns.items() if c["public"] and any(
            re.search(r"\b(?:prices?|pricing|rates?|rent|costs?|fees?|charges?|quotes?|tariffs?)\b",
                      words(re.sub(r"([a-z])([A-Z])", r"\1 \2", term).replace("_", " ")))
            for term in [k, c["label"], *c.get("aliases", [])])]
        if not price_columns:
            continue
        # Explicit non-price output requests must remain with the strict planner.
        if any(k not in required and k not in price_columns and any(
                words(term) and re.search(r"(?<!\w)" + re.escape(words(term)) + r"(?!\w)", question)
                for term in [k, c["label"], *c.get("aliases", [])]) for k, c in columns.items()):
            return None
        dataset = get_dataset(db, organization_id, entry["dataset_id"], widget_id)
        if dataset.status != "active" or dataset.active_version_id != entry["version_id"]:
            raise HTTPException(409, "Catalog version changed")
        version = get_version(db, dataset, entry["version_id"])
        public = [c for c in version.columns if c["public"]]
        if (version.status != "published" or public != entry["columns"]
                or version.required_filters != required):
            raise HTTPException(409, "Catalog schema changed")
        stored = rows_query(db, version).limit(MAX_ROWS + 1).all()
        scanned += len(stored)
        if len(stored) > MAX_ROWS or scanned > MAX_TENANT_ROWS:
            raise HTTPException(409, "Catalog row bound exceeded")
        filters = []
        spans = []
        for key in required:
            values = {r.values.get(key) for r in stored if isinstance(r.values.get(key), str)}
            matches = [v for v in values if words(v) and re.search(
                r"(?<!\w)" + re.escape(words(v)) + r"(?!\w)", question)]
            if len(matches) != 1:
                break
            evidence = re.search(r"(?<!\w)" + re.escape(words(matches[0])) + r"(?!\w)", question)
            if any(evidence.start() < end and start < evidence.end() for start, end in spans):
                break
            spans.append(evidence.span())
            filters.append(dict(column=key, operator="eq", value=matches[0]))
        if len(filters) != len(required):
            continue
        if not any(all(r.values.get(f["column"]) == f["value"] for f in filters) for r in stored):
            continue
        candidates.append(dict(dataset_id=dataset.id, version_id=version.id, operation="lookup",
                               filters=filters, select=price_columns))
    return candidates[0] if len(candidates) == 1 else None


def execute_query(db: Session, organization_id: int, widget_id: str, plan: dict) -> dict:
    require_enabled(organization_id)
    try:
        request = QueryPlan.model_validate(plan)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    dataset = get_dataset(db, organization_id, request.dataset_id, widget_id)
    if dataset.status != "active" or dataset.active_version_id is None:
        raise HTTPException(409, "Dataset has no active published version")
    if request.version_id is not None and request.version_id != dataset.active_version_id:
        raise HTTPException(409, "Only the current active version may be queried")
    version = get_version(db, dataset, dataset.active_version_id)
    if version.status != "published":
        raise HTTPException(409, "Version is not published")
    columns = {c["key"]: c for c in version.columns}

    def allowed(key: str, queryable: bool = False) -> dict:
        c = columns.get(key)
        if c is None or not c["public"] or (queryable and not c["queryable"]):
            raise HTTPException(422, "Unknown, private or nonqueryable column")
        return c

    select = request.select or [key for key, c in columns.items() if c["public"]]
    for key in select:
        allowed(key)
    filters = []
    for f in request.filters:
        c = allowed(f.column, True)
        if f.operator != "eq" and c["data_type"] not in {"decimal", "integer", "date"}:
            raise HTTPException(422, "Range operators require numeric or date columns")
        try:
            value = normalize(f.value, c["data_type"])
        except (ValueError, InvalidOperation) as exc:
            raise HTTPException(422, str(exc)) from exc
        if value is None:
            raise HTTPException(422, "Null filter values are unsupported")
        if c["data_type"] == "decimal":
            value = Decimal(value)
        elif c["data_type"] == "integer":
            value = int(value)
        filters.append((f.column, f.operator, value))
    aggregate = None
    if request.operation in {"sum", "min", "max"}:
        if not request.aggregate_column:
            raise HTTPException(422, "aggregate_column is required")
        aggregate = allowed(request.aggregate_column, True)
        if aggregate["data_type"] not in {"decimal", "integer"}:
            raise HTTPException(422, "Aggregation requires a numeric column")
    elif request.aggregate_column is not None:
        raise HTTPException(422, "aggregate_column is not applicable to lookup/count")
    specified = {key for key, op, value in filters
                 if op == "eq" and not (isinstance(value, str) and not value.strip())}
    missing = [k for k in version.required_filters if k not in specified]
    result = dict(status="matched", response="", citations=[], rows=[], total_matches=0)
    if missing:
        result.update(status="clarify", response="Please specify: " + ", ".join(columns[k]["label"] for k in missing))
        return result
    stored = rows_query(db, version).limit(MAX_ROWS + 1).all()
    if len(stored) > MAX_ROWS:
        raise HTTPException(409, "Active version exceeds v1 row bounds")
    matches = []
    for row in stored:
        matched = True
        for key, op, expected in filters:
            actual = row.values.get(key)
            if actual is None:
                matched = False
                break
            if columns[key]["data_type"] == "decimal":
                actual = Decimal(actual)
            elif columns[key]["data_type"] == "integer":
                actual = int(actual)
            if not {"eq": lambda: actual == expected, "lt": lambda: actual < expected,
                    "lte": lambda: actual <= expected, "gt": lambda: actual > expected,
                    "gte": lambda: actual >= expected}[op]():
                matched = False
                break
        if matched:
            matches.append(row)
    result["total_matches"] = len(matches)
    if not matches:
        result.update(status="no_match", response="No matching rows were found.")
        return result
    cited = matches[:request.limit] if request.operation == "lookup" else matches
    result["citations"] = [dict(dataset_id=dataset.id, version_id=version.id, name=dataset.name,
                                sheet_name=version.sheet_name, row_numbers=[r.row_number for r in cited])]
    source = f"Source: {dataset.name} / {version.sheet_name}, version {version.version_number}."

    def render(key: str, value) -> str:
        c = columns[key]
        suffix = " ".join(v for v in [c.get("unit"), c.get("currency")] if v)
        return f"{c['label']}: {value if value is not None else 'not available'}" + (f" {suffix}" if suffix else "")

    if request.operation == "lookup":
        result["rows"] = [{k: r.values.get(k) for k in select} for r in cited]
        text = [f"Row {r.row_number}: " + "; ".join(render(k, r.values.get(k)) for k in select) for r in cited]
        if len(matches) > request.limit:
            text.append(f"Showing {request.limit} of {len(matches)} matches; narrow filters for a specific answer.")
        result["response"] = "\n".join(text + [source])
    elif request.operation == "count":
        result["rows"] = [{"count": len(matches)}]
        result["response"] = f"Count: {len(matches)}. {source}"
    else:
        key = aggregate["key"]
        values = [Decimal(str(r.values[key])) for r in matches if r.values.get(key) is not None]
        if not values:
            result.update(status="no_match", response="Matching rows contain no numeric values to aggregate. " + source)
            return result
        with localcontext() as ctx:
            ctx.prec = 256  # bounded 100 integer + 100 fractional digits plus row-count headroom
            value = sum(values, Decimal(0)) if request.operation == "sum" else (min(values) if request.operation == "min" else max(values))
        exact = format(value, "f")
        result["rows"] = [{"operation": request.operation, "column": key, "value": exact,
                           "unit": aggregate.get("unit"), "currency": aggregate.get("currency")}]
        result["response"] = f"{request.operation.capitalize()} — {render(key, exact)}. {source}"
    return result