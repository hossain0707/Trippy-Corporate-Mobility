from app.modules.payments.gateway import verified_amount

def test_independently_verified_bdt_amount():
    correct={'status':'VALID','tran_id':'TC-123','amount':'5200.00','currency':'BDT'}
    assert verified_amount(correct,5200,'TC-123')
    assert verified_amount({**correct,'status':'VALIDATED'},5200,'TC-123')
    assert not verified_amount({**correct,'tran_id':'other'},5200,'TC-123')
    assert not verified_amount({**correct,'amount':'500'},5200,'TC-123')
    assert not verified_amount({**correct,'currency':'USD'},5200,'TC-123')
    assert not verified_amount({**correct,'status':'FAILED'},5200,'TC-123')
    assert not verified_amount({**correct,'amount':'NaN'},5200,'TC-123')
