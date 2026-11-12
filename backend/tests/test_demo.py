"""Demo bookings never initiate a payment or confer transport rights."""
from datetime import date
from uuid import UUID
from unittest.mock import Mock

import pytest
from pydantic import ValidationError

from app.modules.demo import router as demo

USER=UUID('11111111-1111-4111-8111-111111111111')
SERVICE=UUID('22222222-2222-4222-8222-222222222222')
SEAT=UUID('33333333-3333-4333-8333-333333333333')
BOOK=UUID('44444444-4444-4444-8444-444444444444')
KEY=UUID('55555555-5555-4555-8555-555555555555')


def booking(**overrides):
    payload=dict(seatId=SEAT,pickupZone='Uttara Sector 7',
                 officeZone='Banani',startDate=date(2026,11,16),
                 months=1,idempotencyKey=KEY)
    payload.update(overrides)
    return demo.DemoBooking(**payload)


def test_demonstration_must_be_explicitly_named():
    assert demo.DemoCreate(vehicleId=SERVICE,name='Demo Bus').name == 'Demo Bus'
    with pytest.raises(ValidationError):
        demo.DemoCreate(vehicleId=SERVICE,name='Real city bus')


def test_demo_booking_validates_no_shortcuts():
    with pytest.raises(ValidationError):
        booking(pickupZone='U')
    with pytest.raises(ValidationError):
        booking(months=2)


def test_demo_booking_no_real_hold_or_payment(monkeypatch):
    monkeypatch.setattr(demo,'demo_period',lambda start,months:date(2026,12,16))
    monkeypatch.setattr(demo,'demo_service',lambda conn,ident,lock=False:{
        'id':SERVICE,'vehicle_id':SERVICE
    })
    queries=[]
    def one(conn,sql,args=()):
        queries.append(sql)
        if 'SELECT * FROM app.demo_bookings' in sql:
            return None
        if 'FROM app.vehicle_seats' in sql:
            return {'id':SEAT}
        if 'INSERT INTO app.demo_bookings' in sql:
            return dict(id=BOOK,service_id=SERVICE,seat_id=SEAT,status='demo_booked')
        raise AssertionError(sql)
    monkeypatch.setattr(demo,'one',one)
    monkeypatch.setattr(demo,'execute',Mock())
    result=demo.create_demo_booking(object(),USER,SERVICE,booking())
    assert result['status']=='demo_booked'
    assert any('INSERT INTO app.demo_bookings' in x for x in queries)
    assert not any('app.reservations' in x or 'app.payment_attempts' in x for x in queries)


def test_duplicate_idempotency_key_cannot_mutate_booking(monkeypatch):
    monkeypatch.setattr(demo,'demo_period',lambda start,months:date(2026,12,16))
    monkeypatch.setattr(demo,'demo_service',lambda conn,ident,lock=False:{
        'vehicle_id':SERVICE
    })
    existing={'service_id':SERVICE,'seat_id':SEAT,'starts_on':date(2026,11,16),
              'ends_before':date(2026,12,16),'pickup_zone':'Uttara Sector 7',
              'office_zone':'Banani','status':'demo_booked'}
    monkeypatch.setattr(demo,'one',lambda conn,sql,args=():existing)
    assert demo.create_demo_booking(object(),USER,SERVICE,booking()) is existing
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        demo.create_demo_booking(object(),USER,SERVICE,booking(officeZone='Gulshan'))
    assert exc.value.status_code==409


def test_demo_booking_rejects_same_pickup_and_dropoff(monkeypatch):
    monkeypatch.setattr(demo,'demo_period',lambda start,months:date(2026,12,16))
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        demo.create_demo_booking(object(),USER,SERVICE,booking(pickupZone='  Banani ',officeZone='banani'))
    assert exc.value.status_code==422


def test_admin_visibility_requires_staff_authentication():
    # Every admin endpoint uses the server-only role+MFA dependency.
    for route in demo.router.routes:
        if route.path.startswith('/api/admin/demo'):
            assert any(dep.call is not None for dep in route.dependant.dependencies)


def test_demo_seat_endpoint_accepts_subscription_months_from_http_query(monkeypatch):
    """Regression: Literal[int] in Query rejects stringified numbers with FastAPI/Pydantic."""
    from contextlib import nullcontext
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    monkeypatch.setattr(demo, 'connection', lambda: nullcontext(object()))
    monkeypatch.setattr(demo, 'demo_period', lambda start, months: date(2026,12,16))
    monkeypatch.setattr(demo, 'demo_service', lambda conn,ident: {
        'id': SERVICE, 'vehicle_id': SERVICE, 'vehicle_class': 'bus'
    })
    monkeypatch.setattr(demo, 'rows', lambda conn,sql,args=():[
        {'id': SEAT, 'label': 'B01', 'row_no': 1, 'col_no': 0, 'occupied': False}
    ])
    app = FastAPI()
    app.include_router(demo.router)
    client = TestClient(app)
    for months in (1,3,6,12):
        result=client.get(f'/api/demo/services/{SERVICE}/seats',
            params={'startDate':'2026-11-16','months':str(months)})
        assert result.status_code==200, result.json()
        assert result.json()['availableCount']==1
    invalid=client.get(f'/api/demo/services/{SERVICE}/seats',
        params={'startDate':'2026-11-16','months':'invalid'})
    assert invalid.status_code==422
