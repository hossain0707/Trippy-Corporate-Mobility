from datetime import date,timedelta
import pytest
from app.modules.booking.pricing import quote,add_months,end_date

@pytest.mark.parametrize('kind,amount',[('bus',4000),('hiace',5200),('car',6400)])
def test_welcome_only_one_month(kind,amount):
    new=quote(kind,1,True)
    assert new.amount==amount and new.discount==20 and new.welcome
    returning=quote(kind,1,False)
    assert returning.discount==0 and returning.amount>new.amount

@pytest.mark.parametrize('kind,months,total',[
    ('bus',3,11250),('bus',6,21000),('bus',12,39000),
    ('hiace',3,14625),('hiace',6,27300),('hiace',12,50700),
    ('car',3,18000),('car',6,33600),('car',12,62400)
])
def test_multimonth_offer_for_all_subscribers(kind,months,total):
    assert quote(kind,months,True).amount==total
    assert quote(kind,months,False).amount==total

def test_month_end_clamping_and_leap():
    assert add_months(date(2027,1,31),1)==date(2027,2,28)
    assert add_months(date(2028,1,31),1)==date(2028,2,29)
    assert add_months(date(2026,12,31),3)==date(2027,3,31)

def test_invalid_dates_and_periods():
    start=date(2026,11,10)
    with pytest.raises(ValueError): end_date(start-timedelta(days=1),1,start)
    with pytest.raises(ValueError): end_date(start+timedelta(days=61),1,start)
    with pytest.raises(ValueError): quote('helicopter',1,False)
    with pytest.raises(ValueError): add_months(start,2)
