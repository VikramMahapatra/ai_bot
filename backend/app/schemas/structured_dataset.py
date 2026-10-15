"""Strict bounded request contracts; decimals travel as strings, never floats."""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, StrictStr, field_validator

MAX_ROWS = 2000
MAX_COLUMNS = 50
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_SAFE_INTEGER = 2**53 - 1
Scalar = StrictStr | StrictInt | StrictBool | None
ColumnKey = Annotated[StrictStr, Field(min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9_]*$")]
Alias = Annotated[StrictStr, Field(max_length=200)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*")
    @classmethod
    def postgres_safe_strings(cls, value):
        # PostgreSQL JSONB cannot represent NUL or unpaired Unicode surrogates.
        def check(item):
            if isinstance(item, str):
                if "\x00" in item:
                    raise ValueError("NUL characters are unsupported")
                item.encode("utf-8")
            elif isinstance(item, dict):
                for key, child in item.items():
                    check(key)
                    check(child)
            elif isinstance(item, list):
                for child in item:
                    check(child)
        check(value)
        return value


class Column(StrictModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")
    label: str = Field(min_length=1, max_length=200)
    data_type: Literal["text", "integer", "decimal", "boolean", "date"]
    aliases: list[Alias] = Field(default_factory=list, max_length=20)
    unit: str | None = Field(default=None, max_length=32)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    public: StrictBool = False
    queryable: StrictBool = False


class VersionCreate(StrictModel):
    sheet_name: str = Field(min_length=1, max_length=200)
    columns: list[Column] = Field(min_length=1, max_length=MAX_COLUMNS)
    rows: list[dict[str, Scalar]] = Field(max_length=MAX_ROWS)
    required_filters: list[ColumnKey] = Field(default_factory=list, max_length=MAX_COLUMNS)

    @field_validator("rows")
    @classmethod
    def bounded_cells(cls, rows):
        for row in rows:
            if len(row) > MAX_COLUMNS or any(len(k) > 64 for k in row):
                raise ValueError("Row key/column limits exceeded")
            if any(v is not None and len(str(v)) > 4000 for v in row.values()):
                raise ValueError("Cell text exceeds 4000 characters")
            if any(type(v) is int and abs(v) > MAX_SAFE_INTEGER for v in row.values()):
                raise ValueError("Large integers must be sent as exact strings")
        return rows


class DatasetCreate(VersionCreate):
    widget_id: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)


class DatasetPatch(StrictModel):
    status: Literal["inactive", "active"] | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)


class QueryFilter(StrictModel):
    column: ColumnKey
    operator: Literal["eq", "lt", "lte", "gt", "gte"]
    value: Scalar

    @field_validator("value")
    @classmethod
    def bounded_value(cls, value):
        if value is not None and len(str(value)) > 4000:
            raise ValueError("Filter value exceeds 4000 characters")
        if type(value) is int and abs(value) > MAX_SAFE_INTEGER:
            raise ValueError("Large integers must be sent as exact strings")
        return value


class QueryPlan(StrictModel):
    dataset_id: StrictInt = Field(gt=0)
    version_id: StrictInt | None = Field(default=None, gt=0)
    operation: Literal["lookup", "count", "sum", "min", "max"]
    filters: list[QueryFilter] = Field(default_factory=list, max_length=MAX_COLUMNS)
    select: list[ColumnKey] = Field(default_factory=list, max_length=MAX_COLUMNS)
    aggregate_column: ColumnKey | None = None
    limit: StrictInt = Field(default=20, ge=1, le=20)