from uuid import uuid4
import pytest
from pydantic import ValidationError
from app.core.schemas import NewVehicle,SeatDraft,HoldRequest

def test_no_extra_fields_in_reservation():
    payload={'serviceId':str(uuid4()),'seatId':str(uuid4()),'startDate':'2027-01-10','months':3,
             'pickupStopId':str(uuid4()),'dropoffStopId':str(uuid4()),'idempotencyKey':str(uuid4())}
    assert HoldRequest(**payload).months==3
    with pytest.raises(ValidationError): HoldRequest(**payload,amountBdt=0)
    with pytest.raises(ValidationError): HoldRequest(**{**payload,'months':2})

def test_bounds_on_cabin_seat():
    assert SeatDraft(label='B12',rowNo=2,colNo=4).label=='B12'
    with pytest.raises(ValidationError): SeatDraft(label='!!',rowNo=2,colNo=4)
    with pytest.raises(ValidationError): SeatDraft(label='B99',rowNo=42,colNo=4)
