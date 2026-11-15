"""Authoritative corridor stop ordering for both daily journey directions."""
from uuid import UUID
from ...core.database import rows
from ...core.errors import fail


def segment_orders(conn,route_id:UUID,pickup_stop_id:UUID,dropoff_stop_id:UUID):
    """Four numeric bounds: morning [pickup,dropoff), evening [office,home).

    Every stop must be approved, active and assigned to BOTH directions of
    the same fixed corridor. The evening journey reverses the morning route.
    No arbitrary geographic point may be used for a booking.
    """
    if pickup_stop_id==dropoff_stop_id:
        fail(422,"Pickup and drop-off must be different approved stops")
    records=rows(conn,"""SELECT rs.direction,rs.stop_id,rs.stop_order
      FROM app.route_stops rs
      JOIN app.stops st ON st.id=rs.stop_id
      WHERE rs.route_id=%s AND rs.stop_id=ANY(%s::uuid[])
        AND st.approved AND st.active""",
      (route_id,[pickup_stop_id,dropoff_stop_id]))
    order={(item["direction"],item["stop_id"]):item["stop_order"] for item in records}
    keys=[("morning",pickup_stop_id),("morning",dropoff_stop_id),
          ("evening",dropoff_stop_id),("evening",pickup_stop_id)]
    if any(key not in order for key in keys):
        fail(422,"Select approved stops on the same morning and evening corridor")
    mp,md,ed,ep=[order[key] for key in keys]
    if not (mp<md and ed<ep):
        fail(422,"Pickup must come before drop-off in the morning and reverse in the evening")
    return (mp,md,ed,ep)
