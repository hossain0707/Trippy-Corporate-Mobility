"""Server-authoritative pricing in integer BDT. No client-supplied fares."""
from calendar import monthrange
from datetime import date,timedelta
from dataclasses import dataclass
from ...core.database import one
from ...core.clock import today as dhaka_today

MONTHLY={'bus':5000,'hiace':6500,'car':8000}
WELCOME_DISCOUNT=20
DISCOUNTS={3:25,6:30,12:35}

def read_pricing(conn, *, lock=False):
    sql = """SELECT bus, hiace, car, first_month, three_months, six_months,
                    twelve_months, revision
             FROM app.subscription_pricing WHERE singleton"""
    row = one(conn, sql + (" FOR UPDATE" if lock else ""))
    if row is None:
        raise RuntimeError("Subscription pricing has not been initialized")
    return {
        "currency": "BDT",
        "monthly": {vehicle: row[vehicle] for vehicle in MONTHLY},
        "discounts": {
            "firstMonth": row["first_month"], "threeMonths": row["three_months"],
            "sixMonths": row["six_months"], "twelveMonths": row["twelve_months"],
        },
        "stackable": False,
        "revision": row["revision"],
    }


@dataclass(frozen=True)
class Quote:
    base:int
    discount:int
    amount:int
    welcome:bool

def add_months(start:date, months:int)->date:
    if months not in (1,3,6,12): raise ValueError('Invalid subscription duration')
    year = start.year + (start.month-1+months)//12
    month = (start.month-1+months)%12+1
    return date(year,month,min(start.day,monthrange(year,month)[1]))

def end_date(start:date,months:int,reference:date|None=None)->date:
    reference=reference or dhaka_today()
    if not reference<=start<=reference+timedelta(days=60):
        raise ValueError('Subscription must start within 60 days (Dhaka time)')
    return add_months(start,months)

def quote(vehicle_class:str,months:int,first_paid_booking:bool, pricing=None)->Quote:
    if vehicle_class not in MONTHLY or months not in (1,3,6,12):
        raise ValueError('Invalid vehicle or duration')
    monthly = MONTHLY if pricing is None else pricing["monthly"]
    base=monthly[vehicle_class]*months
    welcome=months==1 and first_paid_booking
    if pricing is None:
        discount = WELCOME_DISCOUNT if welcome else DISCOUNTS.get(months, 0)
    else:
        key = {3: "threeMonths", 6: "sixMonths", 12: "twelveMonths"}.get(months)
        discount = pricing["discounts"]["firstMonth" if welcome else key] if welcome or key else 0
    return Quote(base,discount,base*(100-discount)//100,welcome)
