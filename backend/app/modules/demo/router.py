"""Citywide DEMO ONLY. These endpoints never touch paid seat reservations or checkout."""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from psycopg.errors import ExclusionViolation, UniqueViolation
from pydantic import BaseModel, ConfigDict, Field

from ...core.database import connection, execute, one, rows
from ...core.errors import fail
from ...core.limits import throttle
from ...core.schemas import Duration
from ..auth.router import actor, require
from ..booking.pricing import end_date

router = APIRouter(prefix="/api", tags=["Demo bookings — no real transport"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DemoCreate(Strict):
    vehicleId: UUID
    name: str = Field(min_length=4, max_length=80, pattern=r"(?i).*demo.*")


class DemoVisibility(Strict):
    published: bool


class DemoBooking(Strict):
    seatId: UUID
    pickupZone: str = Field(min_length=2, max_length=100)
    officeZone: str = Field(min_length=2, max_length=100)
    startDate: date
    months: Duration
    idempotencyKey: UUID


def demo_period(start_date: date, months: int) -> date:
    try:
        return end_date(start_date, months)
    except ValueError as exc:
        fail(422, str(exc))


def verified_demo_vehicle(conn, vehicle_id: UUID):
    vehicle = one(conn, """SELECT v.id, v.registration_no, v.class, v.active,
        v.documents_verified, v.seat_map_verified, v.licensed_passenger_capacity,
        (SELECT count(*)::int FROM app.vehicle_seats s
          WHERE s.vehicle_id=v.id AND s.enabled) AS seat_count,
        EXISTS(SELECT 1 FROM app.services r WHERE r.vehicle_id=v.id) AS real_service_exists
        FROM app.vehicles v WHERE v.id=%s FOR UPDATE OF v""", (vehicle_id,))
    if (not vehicle or not vehicle["registration_no"].upper().startswith("DEMO-")
            or vehicle["active"] or vehicle["documents_verified"]
            or vehicle["seat_map_verified"] or vehicle["real_service_exists"]
            or vehicle["seat_count"] != vehicle["licensed_passenger_capacity"]):
        fail(422, "Only inactive, unverified DEMO-labelled fleet vehicles can be simulated")
    return vehicle


def demo_service(conn, service_id: UUID, lock=False):
    query = """SELECT d.id,d.vehicle_id,d.name,d.city,d.is_published,d.removed_at,
      v.class AS vehicle_class,v.licensed_passenger_capacity
      FROM app.demo_services d JOIN app.vehicles v ON v.id=d.vehicle_id
      WHERE d.id=%s AND d.is_published AND d.removed_at IS NULL
        AND NOT v.active AND NOT v.documents_verified AND NOT v.seat_map_verified
        AND v.registration_no ILIKE 'DEMO-%%'
        AND NOT EXISTS(SELECT 1 FROM app.services s WHERE s.vehicle_id=v.id)"""
    if lock:
        query += " FOR UPDATE OF d"
    result = one(conn, query, (service_id,))
    if not result:
        fail(404, "Demo service is no longer available")
    return result


@router.get("/demo/services")
def public_demo_services():
    """Dhaka-wide demo listing: intentionally unaffected by pickup/drop-off search."""
    with connection() as conn:
        return rows(conn, """SELECT d.id,d.name,d.city,d.vehicle_id,
            v.class AS vehicle_class,v.licensed_passenger_capacity,
            (SELECT count(*)::int FROM app.vehicle_seats s
              WHERE s.vehicle_id=v.id AND s.enabled) AS selectable_seats,
            TRUE AS is_demo
            FROM app.demo_services d JOIN app.vehicles v ON v.id=d.vehicle_id
            WHERE d.is_published AND d.removed_at IS NULL
              AND v.registration_no ILIKE 'DEMO-%%'
              AND NOT v.active AND NOT v.documents_verified AND NOT v.seat_map_verified
              AND NOT EXISTS(SELECT 1 FROM app.services s WHERE s.vehicle_id=v.id)
            ORDER BY d.created_at DESC LIMIT 20""")


@router.get("/demo/services/{service_id}/seats")
def public_demo_seats(service_id: UUID, startDate: date, months: Duration = Query(1)):
    ends = demo_period(startDate, months)
    with connection() as conn:
        service = demo_service(conn, service_id)
        seats = rows(conn, """SELECT s.id,s.label,s.row_no,s.col_no,
            EXISTS(SELECT 1 FROM app.demo_bookings b
              WHERE b.service_id=%s AND b.seat_id=s.id AND b.status='demo_booked'
                AND daterange(b.starts_on,b.ends_before,'[)') &&
                    daterange(%s,%s,'[)')) AS occupied
            FROM app.vehicle_seats s
            WHERE s.vehicle_id=%s AND s.enabled
            ORDER BY s.row_no,s.col_no""", (service_id, startDate, ends, service["vehicle_id"]))
        return {"isDemo": True, "service": service, "startsOn": startDate,
                "endsBefore": ends, "seats": seats,
                "availableCount": sum(not seat["occupied"] for seat in seats)}


def create_demo_booking(conn, user_id: UUID, service_id: UUID, data: DemoBooking):
    ends = demo_period(data.startDate, data.months)
    pickup = data.pickupZone.strip()
    office = data.officeZone.strip()
    if len(pickup) < 2 or len(office) < 2 or pickup.casefold() == office.casefold():
        fail(422, "Choose different Dhaka pickup and drop-off areas")
    # Serialize demo claims for a service before checking and inserting.
    service = demo_service(conn, service_id, lock=True)
    previous = one(conn, "SELECT * FROM app.demo_bookings WHERE user_id=%s AND idempotency_key=%s",
                   (user_id, data.idempotencyKey))
    if previous:
        if (previous["service_id"] == service_id and previous["seat_id"] == data.seatId
                and previous["starts_on"] == data.startDate and previous["ends_before"] == ends
                and previous["pickup_zone"] == pickup and previous["office_zone"] == office
                and previous["status"] == "demo_booked"):
            return previous
        fail(409, "This demo booking request was already used")
    seat = one(conn, """SELECT id FROM app.vehicle_seats
        WHERE id=%s AND vehicle_id=%s AND enabled""", (data.seatId, service["vehicle_id"]))
    if not seat:
        fail(422, "Seat is not part of this demo vehicle")
    booking = one(conn, """INSERT INTO app.demo_bookings
      (service_id,user_id,seat_id,pickup_zone,office_zone,starts_on,ends_before,months,idempotency_key)
      VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)
      RETURNING id,service_id,seat_id,starts_on,ends_before,months,status,created_at""",
      (service_id,user_id,data.seatId,pickup,office,data.startDate,ends,data.months,data.idempotencyKey))
    execute(conn, """INSERT INTO app.audit_events(actor_id,action,target_id,detail)
      VALUES(%s,'demo.booking_created',%s,
      jsonb_build_object('demo',true,'payment',false,'service_id',%s))""",
      (user_id,booking["id"],service_id))
    return booking


@router.post("/demo/services/{service_id}/bookings", status_code=201)
def book_demo(service_id: UUID, data: DemoBooking, user=Depends(actor)):
    throttle("demo-seat-booking", user["id"], 8, 60)
    try:
        with connection() as conn:
            booking = create_demo_booking(conn, user["id"], service_id, data)
        return {**booking, "isDemo": True, "amountBdt": 0,
                "message": "Demo Booked — no real journey or payment"}
    except (UniqueViolation, ExclusionViolation):
        fail(409, "This demo seat is occupied for those dates, or you already have a demo seat")


@router.get("/demo/me/bookings")
def my_demo_bookings(user=Depends(actor)):
    with connection() as conn:
        return rows(conn, """SELECT b.id,b.service_id,b.pickup_zone,b.office_zone,
          b.starts_on::text,b.ends_before::text,b.months,b.status,b.created_at,
          v.class AS vehicle_class,s.label AS seat_label,d.name AS service_name,
          (d.removed_at IS NOT NULL) AS archived
          FROM app.demo_bookings b
          JOIN app.demo_services d ON d.id=b.service_id
          JOIN app.vehicle_seats s ON s.id=b.seat_id
          JOIN app.vehicles v ON v.id=d.vehicle_id
          WHERE b.user_id=%s ORDER BY b.created_at DESC LIMIT 100""",(user["id"],))


@router.get("/admin/demo/services")
def admin_demo_services(user=Depends(require("admin"))):
    with connection() as conn:
        return rows(conn, """SELECT d.id,d.name,d.city,d.is_published,d.removed_at,d.created_at,
          d.vehicle_id,v.registration_no,v.class AS vehicle_class,
          v.licensed_passenger_capacity,
          (SELECT count(*)::int FROM app.demo_bookings b
            WHERE b.service_id=d.id AND b.status='demo_booked') AS bookings_count
          FROM app.demo_services d JOIN app.vehicles v ON v.id=d.vehicle_id
          ORDER BY d.created_at DESC LIMIT 100""")


@router.post("/admin/demo/services", status_code=201)
def create_demo_service(data: DemoCreate, user=Depends(require("admin"))):
    if "demo" not in data.name.casefold():
        fail(422, "The visible name must explicitly include DEMO")
    with connection() as conn:
        verified_demo_vehicle(conn, data.vehicleId)
        if one(conn,"""SELECT 1 FROM app.demo_services
           WHERE vehicle_id=%s AND removed_at IS NULL""",(data.vehicleId,)):
            fail(409,"This demo vehicle already has a demo service")
        created = one(conn, """INSERT INTO app.demo_services
          (vehicle_id,name,city,is_published,created_by)
          VALUES(%s,%s,'Dhaka',TRUE,%s)
          RETURNING id,name,city,is_published""",
          (data.vehicleId,data.name.strip(),user["id"]))
        execute(conn, """INSERT INTO app.audit_events(actor_id,action,target_id,detail)
          VALUES(%s,'demo.service_created',%s,'{"demo":true,"scope":"Dhaka"}'::jsonb)""",
          (user["id"],created["id"]))
        return created


@router.patch("/admin/demo/services/{service_id}")
def set_demo_visibility(service_id:UUID, data:DemoVisibility,
                        user=Depends(require("admin"))):
    with connection() as conn:
        row = one(conn, """SELECT d.id,d.vehicle_id FROM app.demo_services d
          WHERE d.id=%s AND d.removed_at IS NULL FOR UPDATE OF d""", (service_id,))
        if not row:
            fail(404, "Demo service not found or already removed")
        if data.published:
            verified_demo_vehicle(conn, row["vehicle_id"])
        updated = one(conn, """UPDATE app.demo_services SET is_published=%s
          WHERE id=%s RETURNING id,name,is_published""",
          (data.published, service_id))
        execute(conn, """INSERT INTO app.audit_events(actor_id,action,target_id,detail)
          VALUES(%s,'demo.visibility_changed',%s,jsonb_build_object('published',%s))""",
          (user["id"],service_id,data.published))
        return updated


@router.delete("/admin/demo/services/{service_id}")
def remove_demo_service(service_id: UUID, user=Depends(require("admin"))):
    """Soft delete: remove customer visibility, preserve demo booking/audit history."""
    with connection() as conn:
        deleted = one(conn, """UPDATE app.demo_services
          SET is_published=FALSE,removed_at=now()
          WHERE id=%s AND removed_at IS NULL
          RETURNING id,name,removed_at""", (service_id,))
        if not deleted:
            fail(404, "Demo service already removed or not found")
        execute(conn, """INSERT INTO app.audit_events(actor_id,action,target_id,detail)
          VALUES(%s,'demo.service_removed',%s,
          '{"demo":true,"bookings_preserved":true}'::jsonb)""", (user["id"],service_id))
        return deleted
