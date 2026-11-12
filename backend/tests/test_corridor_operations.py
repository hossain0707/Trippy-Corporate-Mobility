"""Unit regression checks for ordered corridor journeys and stop timetables."""
from datetime import time
from uuid import UUID
from unittest.mock import Mock
import pytest
from fastapi import HTTPException
from app.modules.booking import corridors
from app.modules.admin import corridors as admin_corridors
from app.core.schemas import ServiceTimetable, ScheduledStop

A=UUID('11111111-1111-4111-8111-111111111111')
B=UUID('22222222-2222-4222-8222-222222222222')
C=UUID('33333333-3333-4333-8333-333333333333')
R=UUID('44444444-4444-4444-8444-444444444444')
S=UUID('55555555-5555-4555-8555-555555555555')

def ordered_stops():
    return [
        {'direction':'morning','stop_id':A,'stop_order':0},
        {'direction':'morning','stop_id':B,'stop_order':1},
        {'direction':'morning','stop_id':C,'stop_order':2},
        {'direction':'evening','stop_id':C,'stop_order':0},
        {'direction':'evening','stop_id':B,'stop_order':1},
        {'direction':'evening','stop_id':A,'stop_order':2},
    ]

def test_segment_validation_permits_adjacent_riders(monkeypatch):
    monkeypatch.setattr(corridors,'rows',lambda *args:ordered_stops())
    assert corridors.segment_orders(object(),R,A,B)==(0,1,1,2)
    assert corridors.segment_orders(object(),R,B,C)==(1,2,0,1)

def test_same_stop_invalid(monkeypatch):
    monkeypatch.setattr(corridors,'rows',lambda *args:ordered_stops())
    with pytest.raises(HTTPException) as error:
        corridors.segment_orders(object(),R,A,A)
    assert error.value.status_code==422

def test_reversed_or_unapproved_stops_rejected(monkeypatch):
    monkeypatch.setattr(corridors,'rows',lambda *args:ordered_stops())
    with pytest.raises(HTTPException):
        corridors.segment_orders(object(),R,C,A)
    monkeypatch.setattr(corridors,'rows',lambda *args:ordered_stops()[:-1])
    with pytest.raises(HTTPException):
        corridors.segment_orders(object(),R,A,B)

def schedule():
    return ServiceTimetable(stops=[
      ScheduledStop(stopId=A,direction='morning',plannedArrival=time(7,30)),
      ScheduledStop(stopId=B,direction='morning',plannedArrival=time(7,55)),
      ScheduledStop(stopId=C,direction='morning',plannedArrival=time(8,20)),
      ScheduledStop(stopId=C,direction='evening',plannedArrival=time(18,0)),
      ScheduledStop(stopId=B,direction='evening',plannedArrival=time(18,35)),
      ScheduledStop(stopId=A,direction='evening',plannedArrival=time(19,5)),
    ])

def fake_service():
    return {'id':S,'route_id':R,'active':False,'morning_departure':time(7,30),
            'evening_departure':time(18,0)}

def setup_timetable(monkeypatch,service=None,booked=None):
    monkeypatch.setattr(admin_corridors,'one',
      lambda conn,sql,args: service if 'FROM app.services' in sql else booked)
    monkeypatch.setattr(admin_corridors,'rows',lambda *args:ordered_stops())
    called=[]
    monkeypatch.setattr(admin_corridors,'execute',
      lambda conn,sql,args:called.append((sql,args)))
    return called

def test_timetable_saves_all_stops_in_correct_order(monkeypatch):
    called=setup_timetable(monkeypatch,fake_service(),None)
    result=admin_corridors.save_timetable(object(),S,schedule())
    assert result['configuredStops']==6
    assert len([sql for sql,args in called if 'INSERT INTO app.service_stop_times' in sql])==6

def test_timetable_rejects_non_monotonic_or_first_departure(monkeypatch):
    setup_timetable(monkeypatch,fake_service(),None)
    invalid=schedule()
    invalid.stops[1].plannedArrival=time(7,20)
    with pytest.raises(HTTPException) as err:
        admin_corridors.save_timetable(object(),S,invalid)
    assert err.value.status_code==422
    invalid=schedule()
    invalid.stops[0].plannedArrival=time(7,35)
    with pytest.raises(HTTPException):
        admin_corridors.save_timetable(object(),S,invalid)

def test_timetable_rejects_active_or_historically_booked_service(monkeypatch):
    active=fake_service()
    active['active']=True
    setup_timetable(monkeypatch,active,None)
    with pytest.raises(HTTPException) as err:
        admin_corridors.save_timetable(object(),S,schedule())
    assert err.value.status_code==409
    setup_timetable(monkeypatch,fake_service(),{'id':A})
    with pytest.raises(HTTPException):
        admin_corridors.save_timetable(object(),S,schedule())

def test_timetable_rejects_missing_stop_entries(monkeypatch):
    setup_timetable(monkeypatch,fake_service(),None)
    invalid=schedule()
    invalid.stops.pop()
    with pytest.raises(HTTPException):
        admin_corridors.save_timetable(object(),S,invalid)
