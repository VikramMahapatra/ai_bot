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
                    "key": "implementation_timeline",
                    "label": "Implementation timeline",
                    "data_type": "select",
                    "options": ["0-30 days", "1-3 months", "Later"],
                    "is_required": True,
                }
            ],
            "positive_signals": [
                {"name": "Requests a demo", "score": 20}
            ],
            "disqualification_criteria": [
                {"name": "Outside service area", "action": "disqualify"}
            ],
            "lead_temperatures": [
                {"name": "Cold", "min_score": 0, "max_score": 24, "color": "#4b86c6"},
                {"name": "Warm", "min_score": 25, "max_score": 49, "color": "#d59b20"},
                {"name": "Hot", "min_score": 50, "max_score": 74, "color": "#e56b35"},
                {"name": "Very Hot", "min_score": 75, "max_score": 100, "color": "#d83b4c"},
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
        self.assertEqual(created.criteria[0].criterion_key, "genuine_need")
        self.assertEqual(created.criteria[0].importance, "Supporting")
        self.assertFalse(created.criteria[0].is_required)
        self.assertEqual(created.attributes[0].options[0], "0-30 days")
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


if __name__ == "__main__":
    unittest.main()