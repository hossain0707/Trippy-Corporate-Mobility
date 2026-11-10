from datetime import datetime
from zoneinfo import ZoneInfo
DHAKA = ZoneInfo('Asia/Dhaka')
def now(): return datetime.now(DHAKA)
def today(): return now().date()
