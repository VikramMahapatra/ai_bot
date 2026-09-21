import unittest
import importlib.util
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.qualification_templates import (
    DisqualificationCriterion,
    LeadTemperatureRule,
    QualificationAttribute,
    QualificationCriterion,
    QualificationPositiveSignal,
    QualificationTemplate,
)
from app.models.user import Organization
from app.models.campaign_contacts import CampaignContact  # noqa: F401
from app.models.call_logs import CallLog  # noqa: F401
from app.schemas.qualification_template import QualificationTemplatePayload


def load_qualification_template_service():
    service_path = (
        Path(__file__).resolve().parent
        / "app"
        / "services"
        / "qualification_template_service.py"
    )
    spec = importlib.util.spec_from_file_location(
        "qualification_template_service_test_module", service_path
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load module spec from {service_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


qualification_template_service = load_qualification_template_service()


def build_payload(name: str = "Inbound sales") -> QualificationTemplatePayload:
    return QualificationTemplatePayload.model_validate(
        {
            "name": name,
            "description": "Qualification for inbound sales conversations",
            "objective": "Identify decision-ready buyers and route them to sales.",
            "status": "Active",
            "qualification_mode": "essential_supporting",
            "temperature_mode": "standard",
            "criteria": [
                {
                    "name": "Has an active need",
                    "criterion_key": "genuine_need",
                    "source": "predefined",
                    "importance": "Supporting",
                    "description": "The lead describes a current business problem.",
                    "is_required": False,
                    "weight": 25,
                }
            ],
            "attributes": [
                {
                    "key": "budget",
                    "label": "Budget",
                    "description": "Customer's expected budget for the purchase.",
                    "data_type": "currency",
                    "currency": "INR",
                    "is_required": True,
                    "is_qualification_relevant": True,
                    "importance": "Essential",
                    "value_rule": "range",
                    "min_value": 100000,
                    "max_value": 500000,
                }
            ],
            "positive_signals": [
                {
                    "name": "Demo request",
                    "signal_key": "demo_request",
                    "category": "Next Step",
                    "source": "predefined",
                    "score": 20,
                },
                {
                    "name": "Customer asks us to contact them after discussing internally.",
                    "signal_key": "custom_internal_discussion",
                    "category": "Other / Custom",
                    "source": "custom",
                    "score": 10,
                },
            ],
            "disqualification_criteria": [
                {
                    "name": "Outside service area",
                    "criterion_key": "outside_service_area",
                    "source": "predefined",
                    "action": "disqualify",
                },
                {
                    "name": "The customer is only looking for a service that we do not provide.",
                    "criterion_key": "custom_service_gap",
                    "source": "custom",
                    "action": "disqualify",
                },
            ],
            "lead_temperatures": [
                {"name": "Cold", "min_score": 1, "max_score": 39, "color": "#4b86c6"},
                {"name": "Warm", "min_score": 40, "max_score": 59, "color": "#d59b20"},
                {"name": "Hot", "min_score": 60, "max_score": 79, "color": "#e56b35"},
                {"name": "Very Hot", "min_score": 80, "max_score": 100, "color": "#d83b4c"},
            ],
        }
    )


class QualificationTemplateServiceTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            engine,
            tables=[
                Organization.__table__,
                QualificationTemplate.__table__,
                QualificationCriterion.__table__,
                QualificationAttribute.__table__,
                QualificationPositiveSignal.__table__,
                DisqualificationCriterion.__table__,
                LeadTemperatureRule.__table__,
            ],
        )
        self.db = sessionmaker(bind=engine, expire_on_commit=False)()
        self.db.add_all(
            [
                Organization(id=1, name="North", org_domain="north.example"),
                Organization(id=2, name="South", org_domain="south.example"),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_nested_crud_search_and_organization_isolation(self):
        created = qualification_template_service.create_template(
            self.db, 1, build_payload()
        )
        self.assertEqual(created.organization_id, 1)
        self.assertEqual(created.criteria[0].weight, 25)
        self.assertEqual(created.qualification_mode, "essential_supporting")
        self.assertEqual(created.temperature_mode, "standard")
        self.assertEqual(created.lead_temperatures[0].min_score, 1)
        self.assertEqual(created.criteria[0].criterion_key, "genuine_need")
        self.assertEqual(created.criteria[0].importance, "Supporting")
        self.assertFalse(created.criteria[0].is_required)
        self.assertEqual(created.attributes[0].currency, "INR")
        self.assertTrue(created.attributes[0].is_qualification_relevant)
        self.assertEqual(created.attributes[0].importance, "Essential")
        self.assertEqual(created.attributes[0].value_rule, "range")
        self.assertEqual(float(created.attributes[0].min_value), 100000)
        self.assertEqual(float(created.attributes[0].max_value), 500000)
        self.assertEqual(created.positive_signals[0].signal_key, "demo_request")
        self.assertEqual(created.positive_signals[0].category, "Next Step")
        self.assertEqual(created.positive_signals[1].source, "custom")
        self.assertEqual(
            created.disqualification_criteria[0].criterion_key,
            "outside_service_area",
        )
        self.assertEqual(created.disqualification_criteria[1].source, "custom")
        self.assertEqual(len(created.lead_temperatures), 4)

        result = qualification_template_service.list_templates(
            self.db, 1, "inbound", "Active", 0, 10
        )
        self.assertEqual(result["total"], 1)

        updated_payload = build_payload("Inbound revenue")
        updated_payload.criteria[0].weight = 35
        updated = qualification_template_service.update_template(
            self.db, 1, created.id, updated_payload
        )
        self.assertEqual(updated.name, "Inbound revenue")
        self.assertEqual(updated.criteria[0].weight, 35)
        self.assertEqual(len(updated.criteria), 1)

        with self.assertRaises(HTTPException) as context:
            qualification_template_service.get_template(self.db, 2, created.id)
        self.assertEqual(context.exception.status_code, 404)

        qualification_template_service.delete_template(self.db, 1, created.id)
        self.assertEqual(
            qualification_template_service.list_templates(self.db, 1, None, None, 0, 10)["total"],
            0,
        )

    def test_temperature_ranges_require_complete_coverage_and_standard_values(self):
        custom_payload = build_payload().model_dump()
        custom_payload["temperature_mode"] = "custom"
        custom_payload["lead_temperatures"][1]["min_score"] = 41
        with self.assertRaises(ValueError):
            QualificationTemplatePayload.model_validate(custom_payload)

        standard_payload = build_payload().model_dump()
        standard_payload["lead_temperatures"][0]["max_score"] = 30
        standard_payload["lead_temperatures"][1]["min_score"] = 31
        with self.assertRaises(ValueError):
            QualificationTemplatePayload.model_validate(standard_payload)


if __name__ == "__main__":
    unittest.main()