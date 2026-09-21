from datetime import datetime
from enum import Enum
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class QualificationStatus(str, Enum):
    active = "Active"
    inactive = "Inactive"


class AttributeDataType(str, Enum):
    text = "text"
    number = "number"
    currency = "currency"
    quantity = "quantity"
    boolean = "boolean"
    date = "date"
    date_range = "date_range"
    location = "location"
    percentage = "percentage"
    select = "select"
    multi_select = "multi_select"


class CriterionInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    criterion_key: Optional[str] = Field(default=None, max_length=100)
    source: str = Field(default="predefined", pattern=r"^(predefined|custom)$")
    importance: str = Field(default="Essential", pattern=r"^(Essential|Supporting)$")
    description: Optional[str] = None
    is_required: bool = True
    weight: int = Field(default=10, ge=0, le=100)

    @model_validator(mode="after")
    def synchronize_importance(self):
        self.is_required = self.importance == "Essential"
        return self


class AttributeInput(BaseModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]*$", max_length=100)
    label: str = Field(min_length=1, max_length=255)
    data_type: AttributeDataType = AttributeDataType.text
    description: Optional[str] = None
    is_required: bool = False
    is_qualification_relevant: bool = False
    importance: str = Field(default="Supporting", pattern=r"^(Essential|Supporting)$")
    currency: Optional[str] = Field(default=None, max_length=8)
    value_rule: str = Field(default="any", pattern=r"^(any|minimum|maximum|range)$")
    min_value: Optional[Decimal] = None
    max_value: Optional[Decimal] = None
    options: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_options(self):
        if self.data_type in {AttributeDataType.select, AttributeDataType.multi_select}:
            cleaned = [option.strip() for option in self.options if option.strip()]
            if not cleaned:
                raise ValueError("Select attributes require at least one option")
            self.options = cleaned
        else:
            self.options = []
        if self.data_type == AttributeDataType.currency and not self.currency:
            self.currency = "INR"
        if self.data_type not in {
            AttributeDataType.number,
            AttributeDataType.currency,
            AttributeDataType.quantity,
            AttributeDataType.percentage,
        }:
            self.value_rule = "any"
            self.min_value = None
            self.max_value = None
        if self.value_rule == "minimum" and self.min_value is None:
            raise ValueError("Minimum value is required for a minimum rule")
        if self.value_rule == "maximum" and self.max_value is None:
            raise ValueError("Maximum value is required for a maximum rule")
        if self.value_rule == "range":
            if self.min_value is None or self.max_value is None:
                raise ValueError("Minimum and maximum values are required for a range")
            if self.min_value > self.max_value:
                raise ValueError("Minimum value cannot exceed maximum value")
        return self


class PositiveSignalInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    signal_key: Optional[str] = Field(default=None, max_length=100)
    category: str = Field(
        default="Interest",
        pattern=r"^(Interest|Commercial Interest|Next Step|Timing|Other / Custom)$",
    )
    source: str = Field(default="predefined", pattern=r"^(predefined|custom)$")
    description: Optional[str] = None
    score: int = Field(default=10, ge=1, le=100)


class DisqualificationCriterionInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    criterion_key: Optional[str] = Field(default=None, max_length=100)
    source: str = Field(default="predefined", pattern=r"^(predefined|custom)$")
    description: Optional[str] = None
    action: str = Field(default="disqualify", pattern=r"^(disqualify|review)$")


class LeadTemperatureInput(BaseModel):
    name: str = Field(pattern=r"^(Cold|Warm|Hot|Very Hot)$")
    min_score: int = Field(ge=1, le=100)
    max_score: int = Field(ge=1, le=100)
    description: Optional[str] = None
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")

    @model_validator(mode="after")
    def validate_range(self):
        if self.min_score > self.max_score:
            raise ValueError("Minimum score cannot exceed maximum score")
        return self


class QualificationTemplatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    objective: str = Field(min_length=1)
    status: QualificationStatus = QualificationStatus.active
    qualification_mode: str = Field(
        default="essential_supporting",
        pattern=r"^(essential_supporting|any_selected|all_selected)$",
    )
    temperature_mode: str = Field(default="standard", pattern=r"^(standard|custom)$")
    criteria: List[CriterionInput] = Field(default_factory=list)
    attributes: List[AttributeInput] = Field(default_factory=list)
    positive_signals: List[PositiveSignalInput] = Field(default_factory=list)
    disqualification_criteria: List[DisqualificationCriterionInput] = Field(
        default_factory=list
    )
    lead_temperatures: List[LeadTemperatureInput]

    @field_validator("name", "objective")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

    @model_validator(mode="after")
    def validate_structure(self):
        criterion_keys = [
            criterion.criterion_key
            for criterion in self.criteria
            if criterion.criterion_key
        ]
        if len(criterion_keys) != len(set(criterion_keys)):
            raise ValueError("Qualification criterion keys must be unique")

        signal_keys = [signal.signal_key for signal in self.positive_signals if signal.signal_key]
        if len(signal_keys) != len(set(signal_keys)):
            raise ValueError("Positive signal keys must be unique")

        disqualifier_keys = [
            criterion.criterion_key
            for criterion in self.disqualification_criteria
            if criterion.criterion_key
        ]
        if len(disqualifier_keys) != len(set(disqualifier_keys)):
            raise ValueError("Disqualification criterion keys must be unique")

        attribute_keys = [attribute.key for attribute in self.attributes]
        if len(attribute_keys) != len(set(attribute_keys)):
            raise ValueError("Attribute keys must be unique")

        expected_names = {"Cold", "Warm", "Hot", "Very Hot"}
        temperatures = sorted(self.lead_temperatures, key=lambda item: item.min_score)
        if {item.name for item in temperatures} != expected_names or len(temperatures) != 4:
            raise ValueError("Lead temperatures must define Cold, Warm, Hot, and Very Hot")
        if temperatures[0].min_score != 1 or temperatures[-1].max_score != 100:
            raise ValueError("Lead temperature ranges must cover scores from 1 to 100")
        for previous, current in zip(temperatures, temperatures[1:]):
            if current.min_score != previous.max_score + 1:
                raise ValueError("Lead temperature ranges must be contiguous and non-overlapping")
        if self.temperature_mode == "standard":
            standard_ranges = {
                "Cold": (1, 39),
                "Warm": (40, 59),
                "Hot": (60, 79),
                "Very Hot": (80, 100),
            }
            if any(
                (temperature.min_score, temperature.max_score)
                != standard_ranges[temperature.name]
                for temperature in temperatures
            ):
                raise ValueError("Standard temperature mode must use the standard score ranges")
        return self


class QualificationTemplateListParams(BaseModel):
    search: Optional[str] = None
    status: Optional[QualificationStatus] = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=10, ge=1, le=100)


class ChildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int


class CriterionResponse(CriterionInput, ChildResponse):
    pass


class AttributeResponse(AttributeInput, ChildResponse):
    pass


class PositiveSignalResponse(PositiveSignalInput, ChildResponse):
    pass


class DisqualificationCriterionResponse(DisqualificationCriterionInput, ChildResponse):
    pass


class LeadTemperatureResponse(LeadTemperatureInput, ChildResponse):
    pass


class QualificationTemplateResponse(QualificationTemplatePayload):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    criteria: List[CriterionResponse]
    attributes: List[AttributeResponse]
    positive_signals: List[PositiveSignalResponse]
    disqualification_criteria: List[DisqualificationCriterionResponse]
    lead_temperatures: List[LeadTemperatureResponse]


class QualificationTemplateSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    objective: str
    status: QualificationStatus
    created_at: datetime
    updated_at: Optional[datetime] = None


class QualificationTemplateListResponse(BaseModel):
    items: List[QualificationTemplateSummary]
    total: int
    skip: int
    limit: int


class QualificationStatusUpdate(BaseModel):
    status: QualificationStatus