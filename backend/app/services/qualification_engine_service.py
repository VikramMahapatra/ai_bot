from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.utils.qualification_engine_client import QualificationEngineClient
from app.models.qualification_engine_integrations import QualificationEngineIntegration
from app.models.qualification_templates import QualificationTemplate

POLICY_MAP = {
    "essential_supporting": "essential_plus_supporting",
    "any_selected": "any_selected",
    "all_selected": "all_selected",
}

DEFAULT_QUALIFICATION_RULES = {
    "genuine_need": {
        "any_of": [
            "need",
            "needs",
            "we need",
            "looking for",
            "requirement",
            "looking to solve",
        ],
    },
    "relevant_use_case": {
        "any_of": [
            "use case",
            "for our business",
            "for our company",
            "for our team",
        ],
    },
    "product_service_interest": {
        "any_of": [
            "interested in",
            "interest in",
            "tell me more",
            "want to know more",
            "looking at your product",
            "looking at your service",
        ],
    },
    "purchase_use_intention": {
        "any_of": [
            "want to buy",
            "looking to buy",
            "planning to buy",
            "want to use",
            "planning to use",
            "going to purchase",
        ],
    },
    "specific_requirement": {
        "any_of": [
            "we need",
            "we require",
            "specifically need",
            "looking for",
            "requirement is",
        ],
    },
    "future_requirement": {
        "any_of": [
            "in the future",
            "next month",
            "next quarter",
            "this quarter",
            "upcoming",
            "planning",
            "later this year",
        ],
    },
    "further_discussion": {
        "any_of": [
            "let's discuss",
            "lets discuss",
            "happy to discuss",
            "can discuss",
            "schedule a call",
            "book a call",
            "talk further",
        ],
    },
    "problem_solving_intent": {
        "any_of": [
            "solve this",
            "solve the problem",
            "looking for a solution",
            "need a solution",
            "fix this problem",
            "address this problem",
        ],
    },
    "offering_match": {
        "any_of": [
            "does this support",
            "can you help",
            "can your product",
            "can your service",
            "will this work for us",
        ],
    },
    "target_customer": {
        "any_of": [
            "our company",
            "our business",
            "our team",
            "we are a",
            "we have",
        ],
    },
}

ATTRIBUTE_TYPE_MAP = {
    "text": "text",
    "number": "number",
    "currency": "number",
    "quantity": "number",
    "boolean": "boolean",
    "select": "enum",
    "multi_select": "enum",
    "date": "text",
    "date_range": "text",
    "location": "text",
    "percentage": "number",
}

DEFAULT_ATTRIBUTE_PRESENCE_RULES = {
    "decision_maker": {
        "any_of": [
            "i am the founder",
            "i am the owner",
            "i make the decision",
            "i lead operations",
        ]
    },
}

DEFAULT_ATTRIBUTE_EXTRACTION_PATTERNS = {
    "employee_count": [
        r"([0-9]+)\s+employees",
        r"team of\s+([0-9]+)",
    ],
}

DEFAULT_POSITIVE_SIGNAL_RULES = {
    # ------------------------------------------------------------------
    # Interest
    # ------------------------------------------------------------------
    "expresses_interest": {
        "any_of": [
            "interested",
            "we are interested",
            "sounds interesting",
            "this looks interesting",
            "i'm interested",
        ],
    },
    "asks_more_information": {
        "any_of": [
            "tell me more",
            "more information",
            "more details",
            "can you explain",
            "give me more information",
            "send me details",
        ],
    },
    "describes_requirement": {
        "any_of": [
            "we need",
            "our requirement",
            "we require",
            "looking for",
            "what we need is",
            "our requirement is",
        ],
    },
    "asks_suitability": {
        "any_of": [
            "is this suitable",
            "will this work for us",
            "is this right for us",
            "does this meet our requirement",
            "can this work for us",
            "is this suitable for our",
        ],
    },
    "asks_options": {
        "any_of": [
            "what options",
            "what are the options",
            "other options",
            "alternatives",
            "what alternatives",
            "do you have other options",
        ],
    },
    # ------------------------------------------------------------------
    # Commercial Interest
    # ------------------------------------------------------------------
    "price_enquiry": {
        "any_of": [
            "price",
            "pricing",
            "how much",
            "what does it cost",
            "cost",
        ],
    },
    "quotation_request": {
        "any_of": [
            "quotation",
            "quote",
            "send a quote",
            "send quotation",
            "get a quotation",
        ],
    },
    "availability_enquiry": {
        "any_of": [
            "is it available",
            "availability",
            "when is it available",
            "do you have availability",
            "available now",
        ],
    },
    "budget_discussion": {
        "any_of": [
            "budget",
            "our budget",
            "budget is",
            "within our budget",
            "budget range",
        ],
    },
    "quantity_discussion": {
        "any_of": [
            "how many",
            "quantity",
            "number of units",
            "number of",
            "we need 10",
        ],
    },
    "package_plan_discussion": {
        "any_of": [
            "package",
            "plan",
            "plans",
            "which package",
            "which plan",
            "available packages",
        ],
    },
    "payment_terms_discussion": {
        "any_of": [
            "payment terms",
            "payment options",
            "payment schedule",
            "credit terms",
            "terms of payment",
        ],
    },
    # ------------------------------------------------------------------
    # Next Step
    # ------------------------------------------------------------------
    "callback_request": {
        "any_of": [
            "call me back",
            "callback",
            "call back",
            "please call me",
            "contact me",
        ],
    },
    "meeting_request": {
        "any_of": [
            "meeting",
            "schedule a meeting",
            "book a meeting",
            "set up a meeting",
            "meet with you",
        ],
    },
    "demo_request": {
        "any_of": [
            "demo",
            "demonstration",
            "show me",
            "show us",
            "see the product",
        ],
    },
    "visit_request": {
        "any_of": [
            "visit",
            "site visit",
            "come to our office",
            "visit our location",
            "schedule a visit",
        ],
    },
    "catalogue_details_request": {
        "any_of": [
            "catalogue",
            "catalog",
            "product details",
            "send details",
            "send the brochure",
            "brochure",
        ],
    },
    "sample_request": {
        "any_of": [
            "sample",
            "send a sample",
            "sample product",
            "trial sample",
            "can we get a sample",
        ],
    },
    "proposal_request": {
        "any_of": [
            "proposal",
            "send a proposal",
            "prepare a proposal",
            "business proposal",
            "send us the proposal",
        ],
    },
    "purchase_order_intention": {
        "any_of": [
            "purchase order",
            "raise a purchase order",
            "issue a purchase order",
            "we will place an order",
            "place an order",
        ],
    },
    "booking_signup_intention": {
        "any_of": [
            "book",
            "booking",
            "sign up",
            "signup",
            "register",
            "want to register",
        ],
    },
    # ------------------------------------------------------------------
    # Timing
    # ------------------------------------------------------------------
    "immediate_requirement": {
        "any_of": [
            "immediately",
            "asap",
            "urgent",
            "right away",
            "as soon as possible",
        ],
    },
    "defined_period": {
        "any_of": [
            "within a week",
            "within two weeks",
            "within a month",
            "this month",
            "this quarter",
            "next month",
            "next quarter",
        ],
    },
    "future_requirement": {
        "any_of": [
            "in the future",
            "future requirement",
            "later this year",
            "next year",
            "upcoming requirement",
            "planning for next year",
        ],
    },
    "specific_date": {
        "any_of": [
            "on 15th",
            "on the 15th",
            "by 15th",
            "on september",
            "on october",
            "specific date",
        ],
    },
}

POSITIVE_SIGNAL_CATEGORY_MAP = {
    "Interest": "interest",
    "Commercial Interest": "commercial",
    "Next Step": "next_step",
    "Timing": "timing",
}

DEFAULT_DISQUALIFICATION_RULES = {
    "explicitly_not_interested": {
        "any_of": [
            "not interested",
            "not interested in this",
            "we are not interested",
            "no interest",
        ],
    },
    "no_requirement": {
        "any_of": [
            "no requirement",
            "don't need",
            "do not need",
            "no need",
            "not looking for",
            "nothing needed",
        ],
    },
    "wrong_customer_profile": {
        "any_of": [
            "not our type of customer",
            "not the right customer",
            "we are not your target customer",
            "doesn't fit your customer profile",
        ],
    },
    "outside_offering": {
        "any_of": [
            "you don't provide",
            "you do not provide",
            "not a service you offer",
            "outside your services",
            "you don't offer",
            "you do not offer",
        ],
    },
    "outside_service_area": {
        "any_of": [
            "outside your service area",
            "outside your territory",
            "you don't service this area",
            "you do not service this area",
            "not available in our location",
        ],
    },
    "not_intended_customer": {
        "any_of": [
            "not the intended customer",
            "this is for a different audience",
            "not meant for our type of business",
            "we are not the intended customer",
        ],
    },
    "offering_mismatch": {
        "any_of": [
            "doesn't match your offering",
            "does not match your offering",
            "your solution won't work for us",
            "your product doesn't meet our requirement",
            "your service doesn't meet our requirement",
        ],
    },
    "no_further_contact": {
        "any_of": [
            "do not contact me",
            "don't contact me",
            "stop contacting me",
            "remove me from your list",
            "no further contact",
            "don't call me again",
        ],
    },
}


class QualificationEngineService:

    def __init__(self):
        self.client = QualificationEngineClient()

    async def connect(
        self,
        db: Session,
        organization_id: int,
        organization_name: str,
    ) -> dict:

        # Check existing integration
        integration = (
            db.query(QualificationEngineIntegration)
            .filter(QualificationEngineIntegration.organization_id == organization_id)
            .first()
        )

        # Already connected
        if integration and integration.enabled:
            return self._serialize(integration)

        # If existing but disabled, reconnect existing tenant
        if integration and not integration.enabled:
            integration.enabled = True

            db.commit()
            db.refresh(integration)

            return self._serialize(integration)

        # Create tenant in external service
        try:
            qualification_tenant_slug = f"org-{organization_id}"
            tenant = await self.client.create_tenant(
                name=organization_name, slug=qualification_tenant_slug
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=("Unable to connect to Qualification Engine: " f"{str(exc)}"),
            ) from exc

        tenant_id = tenant.get("id")
        api_key = tenant.get("api_key")

        if not tenant_id or not api_key:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=("Qualification Engine returned an invalid " "tenant response."),
            )

        # Store API key encrypted
        integration = QualificationEngineIntegration(
            organization_id=organization_id,
            tenant_id=str(tenant_id),
            api_key=api_key,
            enabled=True,
        )

        db.add(integration)
        db.commit()
        db.refresh(integration)

        return self._serialize(integration)

    async def test_connection(
        self,
        db: Session,
        organization_id: int,
    ) -> dict:

        integration = self._get_integration(
            db,
            organization_id,
        )

        try:
            connected = await self.client.test_tenant_connection(
                api_key=integration.api_key,
            )

        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=("Qualification Engine connection failed: " f"{str(exc)}"),
            ) from exc

        return {
            "connected": connected,
            "tenant_id": integration.tenant_id,
        }

    def disconnect(
        self,
        db: Session,
        organization_id: int,
    ) -> dict:

        integration = self._get_integration(
            db,
            organization_id,
        )

        # IMPORTANT:
        # Don't delete the tenant.
        # Historical evaluations must remain available.
        integration.enabled = False

        db.commit()
        db.refresh(integration)

        return {
            "status": "disconnected",
            "tenant_id": integration.tenant_id,
        }

    def get_status(
        self,
        db: Session,
        organization_id: int,
    ) -> dict | None:

        integration = (
            db.query(QualificationEngineIntegration)
            .filter(QualificationEngineIntegration.organization_id == organization_id)
            .first()
        )

        if not integration:
            return None

        return self._serialize(integration)

    def get_api_key(
        self,
        db: Session,
        organization_id: int,
    ) -> str:

        integration = self._get_integration(
            db,
            organization_id,
        )

        if not integration.enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Qualification Engine integration is disabled.",
            )

        return integration.api_key

    def _get_integration(
        self,
        db: Session,
        organization_id: int,
    ) -> QualificationEngineIntegration:

        integration = (
            db.query(QualificationEngineIntegration)
            .filter(QualificationEngineIntegration.organization_id == organization_id)
            .first()
        )

        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Qualification Engine is not connected.",
            )

        return integration

    async def create_template(
        self,
        db: Session,
        organization_id: int,
        template: QualificationTemplate,
    ) -> dict:

        integration = (
            db.query(QualificationEngineIntegration)
            .filter(
                QualificationEngineIntegration.organization_id == organization_id,
                QualificationEngineIntegration.enabled.is_(True),
            )
            .first()
        )

        if not integration:
            raise RuntimeError("Qualification Engine is not connected")

        # Decrypt the tenant API key
        api_key = integration.api_key

        # Convert AI Bot template -> Qualification Engine template
        engine_template = self.build_engine_template_payload(template)

        # Qualification Engine expects:
        # {
        #     "project_id": "...",
        #     "template": {...}
        # }
        payload = {
            "project_id": f"org_{organization_id}_qualification",
            "template": engine_template,
        }

        return await self.client.create_template(
            api_key=api_key,
            payload=payload,
        )

    async def update_template(
        self,
        db: Session,
        organization_id: int,
        template: QualificationTemplate,
    ) -> dict:

        integration = (
            db.query(QualificationEngineIntegration)
            .filter(
                QualificationEngineIntegration.organization_id == organization_id,
                QualificationEngineIntegration.enabled.is_(True),
            )
            .first()
        )

        if not integration:
            raise RuntimeError("Qualification Engine is not connected")

        if not template.engine_template_id:
            raise RuntimeError("Template has not been synced with Qualification Engine")

        api_key = integration.api_key

        # Create a new Engine version
        template.version += 1

        engine_template = self.build_engine_template_payload(template)

        payload = {
            "project_id": f"org_{organization_id}_qualification",
            "template": engine_template,
        }

        result = await self.client.create_template(
            api_key=api_key,
            payload=payload,
        )

        return result

    async def delete_template(
        self,
        *,
        api_key: str,
        engine_template_id: str,
    ) -> None:

        await self.client.delete_template(
            api_key=api_key,
            template_id=engine_template_id,
        )

    async def evaluate(
        self,
        *,
        api_key: str,
        project_id: str,
        conversation_transcript_id: str,
        transcript: dict[str, Any],
        template_id: str,
        template: dict | None = None,
    ) -> dict[str, Any]:

        payload = {
            "project_id": project_id,
            "conversation_transcript_id": conversation_transcript_id,
            "transcript": transcript,
            "template_id": template_id,
            "template": template,
        }

        evaluation = await self.client.evaluate(
            api_key=api_key,
            project_id=project_id,
            conversation_transcript_id=conversation_transcript_id,
            transcript=transcript,
            template_id=template_id,
        )

        return {
            "request": payload,
            "response": evaluation,
        }

    @staticmethod
    def _normalize_rule(rule: dict) -> dict:
        return {
            "any_of": rule.get("any_of", []),
            "all_of": rule.get("all_of", []),
            "none_of": rule.get("none_of", []),
            "regex": rule.get("regex", []),
            "min_any": rule.get("min_any", 1),
            "case_sensitive": rule.get("case_sensitive", False),
            "speakers": rule.get("speakers", ["customer"]),
        }

    @staticmethod
    def build_qualified_lead_requirements(
        template: QualificationTemplate,
    ) -> dict:

        policy = POLICY_MAP.get(
            template.qualification_mode,
            "essential_plus_supporting",
        )

        requirements = []

        for criterion in template.criteria:
            key = criterion.criterion_key or f"criterion_{criterion.id}"

            rule = criterion.rule

            # Existing DB rule takes precedence.
            if not rule:
                rule = DEFAULT_QUALIFICATION_RULES.get(key)

            if not rule:
                raise ValueError(
                    f"No MatchRule configured for qualification criterion "
                    f"'{criterion.name}' ({key})"
                )

            requirements.append(
                {
                    "key": key,
                    "label": criterion.name,
                    "description": criterion.description or "",
                    "kind": (
                        "essential"
                        if criterion.importance.lower() == "essential"
                        else "supporting"
                    ),
                    "rule": {
                        "any_of": rule.get("any_of", []),
                        "all_of": rule.get("all_of", []),
                        "none_of": rule.get("none_of", []),
                        "regex": rule.get("regex", []),
                        "min_any": rule.get("min_any", 1),
                        "case_sensitive": rule.get(
                            "case_sensitive",
                            False,
                        ),
                        "speakers": rule.get(
                            "speakers",
                            ["customer"],
                        ),
                    },
                }
            )

        return {
            "policy": policy,
            "requirements": requirements,
            "min_supporting": 0,
            "min_any": 1,
        }

    @staticmethod
    def build_attribute_options(attribute) -> list[dict]:
        if attribute.data_type not in {"select", "multi_select"}:
            return []

        return [
            {
                "value": option.strip(),
                "rule": {
                    "any_of": [option.strip()],
                },
                "fit_score": 1.0,
            }
            for option in (attribute.options or [])
            if option and option.strip()
        ]

    @staticmethod
    def build_attribute_presence_rule(attribute) -> dict | None:
        if attribute.data_type != "boolean":
            return None

        rule = DEFAULT_ATTRIBUTE_PRESENCE_RULES.get(attribute.key)

        if not rule:
            raise ValueError(
                f"No presence rule configured for boolean "
                f"attribute '{attribute.label}' ({attribute.key})"
            )

        return rule

    @staticmethod
    def build_attribute_range(attribute) -> dict | None:
        if not attribute.is_qualification_relevant:
            return None

        if attribute.value_rule == "any":
            return None

        if attribute.value_rule == "minimum":
            if attribute.min_value is None:
                raise ValueError(f"Minimum value is required for '{attribute.label}'")

            return {
                "minimum": float(attribute.min_value),
            }

        if attribute.value_rule == "maximum":
            if attribute.max_value is None:
                raise ValueError(f"Maximum value is required for '{attribute.label}'")

            return {
                "maximum": float(attribute.max_value),
            }

        if attribute.value_rule == "range":
            if attribute.min_value is None or attribute.max_value is None:
                raise ValueError(
                    f"Both minimum and maximum values are required "
                    f"for '{attribute.label}'"
                )

            return {
                "minimum": float(attribute.min_value),
                "maximum": float(attribute.max_value),
            }

        return None

    @staticmethod
    def build_business_attributes(
        template: QualificationTemplate,
    ) -> dict:

        attributes = []

        for attribute in template.attributes:

            engine_type = ATTRIBUTE_TYPE_MAP.get(attribute.data_type)

            if not engine_type:
                raise ValueError(
                    f"Unsupported attribute type "
                    f"'{attribute.data_type}' for "
                    f"'{attribute.label}'"
                )

            attributes.append(
                {
                    "key": attribute.key,
                    "label": attribute.label,
                    "type": engine_type,
                    "qualification_relevant": (attribute.is_qualification_relevant),
                    "importance": attribute.importance.lower(),
                    "options": (
                        QualificationEngineService.build_attribute_options(attribute)
                    ),
                    "extraction_patterns": (
                        DEFAULT_ATTRIBUTE_EXTRACTION_PATTERNS.get(attribute.key, [])
                    ),
                    "presence_rule": (
                        QualificationEngineService.build_attribute_presence_rule(
                            attribute
                        )
                    ),
                    "acceptable_range": (
                        QualificationEngineService.build_attribute_range(attribute)
                    ),
                }
            )

        return {"attributes": attributes}

    @staticmethod
    def build_positive_signals(
        template: QualificationTemplate,
    ) -> dict:
        signals = []

        for signal in template.positive_signals:
            key = signal.signal_key or f"signal_{signal.id}"

            rule = signal.rule

            if not rule:
                rule = DEFAULT_POSITIVE_SIGNAL_RULES.get(key)

            if not rule and signal.source == "custom":
                text = signal.name.strip()

                if not text:
                    raise ValueError(
                        "Custom positive signal description cannot be empty"
                    )

                rule = {
                    "any_of": [text],
                }

            if not rule:
                raise ValueError(
                    f"No MatchRule configured for positive signal "
                    f"'{signal.name}' ({key})"
                )

            category = POSITIVE_SIGNAL_CATEGORY_MAP.get(signal.category)

            if not category:
                raise ValueError(
                    f"Unsupported positive signal category "
                    f"'{signal.category}' for '{signal.name}'"
                )

            signals.append(
                {
                    "key": key,
                    "label": signal.name,
                    "category": category,
                    "rule": QualificationEngineService._normalize_rule(rule),
                }
            )

        return {
            "signals": signals,
        }

    @staticmethod
    def build_disqualification_criteria(
        template: QualificationTemplate,
    ) -> dict:
        criteria = []

        for criterion in template.disqualification_criteria:
            key = criterion.criterion_key or f"disqualifier_{criterion.id}"

            rule = criterion.rule

            if not rule:
                rule = DEFAULT_DISQUALIFICATION_RULES.get(key)

            if not rule and criterion.source == "custom":
                text = criterion.name.strip()

                if not text:
                    raise ValueError("Custom disqualification reason cannot be empty")

                rule = {
                    "any_of": [text],
                }

            if not rule:
                raise ValueError(
                    f"No MatchRule configured for disqualification "
                    f"criterion '{criterion.name}' ({key})"
                )

            severity = "hard" if criterion.action.lower() == "disqualify" else "soft"

            criteria.append(
                {
                    "key": key,
                    "label": criterion.name,
                    "severity": severity,
                    "rule": QualificationEngineService._normalize_rule(rule),
                }
            )

        return {"criteria": criteria}

    @staticmethod
    def build_temperature_ranges(
        template: QualificationTemplate,
    ) -> dict:
        if not template.lead_temperatures:
            raise ValueError("At least one temperature range is required.")

        bands = [
            {
                "name": temperature.name,
                "min_score": temperature.min_score,
                "max_score": temperature.max_score,
            }
            for temperature in template.lead_temperatures
        ]

        return {
            "bands": bands,
        }

    @staticmethod
    def build_engine_template_payload(
        template: QualificationTemplate,
    ) -> dict:
        return {
            "name": template.name,
            "version": str(template.version),
            "campaign_objective": {
                "objective": template.objective,
                "agent_persona": None,
                "target_audience": None,
                "desired_outcome": None,
                "industry": None,
                "notes": template.description,
            },
            "qualified_lead_requirements": QualificationEngineService.build_qualified_lead_requirements(
                template
            ),
            "business_attributes": QualificationEngineService.build_business_attributes(
                template
            ),
            "positive_signals": QualificationEngineService.build_positive_signals(
                template
            ),
            "disqualification_criteria": QualificationEngineService.build_disqualification_criteria(
                template
            ),
            "temperature_ranges": QualificationEngineService.build_temperature_ranges(
                template
            ),
            "evidence": {
                "qualify_on_insufficient_evidence": False,
                "allow_overall_conversation_assessment": False,
            },
        }

    @staticmethod
    def _serialize(
        integration: QualificationEngineIntegration,
    ) -> dict:

        return {
            "id": integration.id,
            "organization_id": integration.organization_id,
            "tenant_id": integration.tenant_id,
            "enabled": integration.enabled,
            "created_at": integration.created_at,
            "updated_at": integration.updated_at,
        }
