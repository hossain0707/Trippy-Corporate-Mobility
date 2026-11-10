from datetime import date, datetime, time
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Literal

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')
VehicleClass = Literal['bus','hiace','car']
Duration = Literal[1,3,6,12]

class SeatDraft(Strict):
    label: str = Field(min_length=1,max_length=12,pattern=r'^[A-Za-z0-9-]+$')
    rowNo: int = Field(ge=0,le=40)
    colNo: int = Field(ge=0,le=8)

class HoldRequest(Strict):
    serviceId: UUID
    seatId: UUID
    startDate: date
    months: Duration
    pickupStopId: UUID
    dropoffStopId: UUID
    idempotencyKey: UUID

class DemandRequest(Strict):
    serviceId: UUID | None = None
    homeZone: str = Field(min_length=2,max_length=100)
    officeZone: str = Field(min_length=2,max_length=100)
    vehicleClass: VehicleClass | None = None

class ProfileUpdate(Strict):
    fullName: str = Field(min_length=2,max_length=120)
    email: EmailStr

class NewStop(Strict):
    name: str = Field(min_length=2,max_length=120)
    zone: str = Field(min_length=2,max_length=100)
    latitude: float = Field(ge=-90,le=90)
    longitude: float = Field(ge=-180,le=180)
    approved: bool = False

class NewVehicle(Strict):
    vehicleClass: VehicleClass
    registrationNo: str = Field(min_length=4,max_length=64)
    operatorName: str = Field(min_length=2,max_length=120)
    licensedPassengerCapacity: int = Field(ge=1,le=60)
    fitnessExpiresOn: date | None = None
    insuranceExpiresOn: date | None = None
    seats: list[SeatDraft] = Field(min_length=1,max_length=60)

class VerifyVehicle(Strict):
    documentsVerified: bool
    seatMapVerified: bool
    active: bool
    fitnessExpiresOn: date | None = None
    insuranceExpiresOn: date | None = None

class NewRoute(Strict):
    name: str = Field(min_length=2,max_length=120)
    homeZone: str = Field(min_length=2,max_length=100)
    officeZone: str = Field(min_length=2,max_length=100)
    morningStops: list[UUID] = Field(min_length=2,max_length=50)
    eveningStops: list[UUID] = Field(min_length=2,max_length=50)

class NewService(Strict):
    code: str = Field(pattern=r'^[A-Z0-9-]{3,20}$')
    routeId: UUID
    vehicleId: UUID
    morningDeparture: time
    eveningDeparture: time
    operatingDays: list[int] = Field(min_length=1,max_length=7)

class Activation(Strict): active: bool
class RoleChange(Strict): role: Literal['rider','driver','dispatcher']
class DriverAssignment(Strict):
    serviceId: UUID
    driverId: UUID

class GpsPing(Strict):
    serviceId: UUID
    latitude: float = Field(ge=-90,le=90)
    longitude: float = Field(ge=-180,le=180)
    accuracyMeters: float | None = Field(default=None,ge=0,le=2000)
    measuredAt: datetime

class DriverCompliance(Strict):
    licenseReference: str = Field(min_length=4,max_length=80)
    licenseExpiresOn: date

class SeatLayout(Strict):
    seats: list[SeatDraft] = Field(min_length=1,max_length=60)

class NewSupportTicket(Strict):
    serviceId: UUID | None = None
    category: Literal['safety','driver','payment','route','accessibility','other']
    message: str = Field(min_length=10,max_length=2000)

class SupportStatus(Strict):
    status: Literal['open','in_progress','resolved','closed']
