"""Server-authoritative pricing in integer BDT. No client-supplied fares."""
from calendar import monthrange
from datetime import date,timedelta
from dataclasses import dataclass
from ...core.clock import today as dhaka_today

MONTHLY={'bus':5000,'hiace':6500,'car':8000}
DISCOUNTS={3:25,6:30,12:35}

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

def quote(vehicle_class:str,months:int,first_paid_booking:bool)->Quote:
    if vehicle_class not in MONTHLY or months not in (1,3,6,12):
        raise ValueError('Invalid vehicle or duration')
    base=MONTHLY[vehicle_class]*months
    welcome=months==1 and first_paid_booking
    discount=20 if welcome else DISCOUNTS.get(months,0)
    return Quote(base,discount,base*(100-discount)//100,welcome)
