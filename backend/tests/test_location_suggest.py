"""Only approved, active fleet stops may be exposed to public autocomplete."""
from contextlib import nullcontext
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.modules.catalog import router as catalog


def test_public_stop_suggestions_only_query_approved_active(monkeypatch):
    captured={}
    monkeypatch.setattr(catalog,'connection',lambda: nullcontext(object()))
    def fake_rows(conn,query,params):
        captured['sql']=query
        captured['params']=params
        return [{
          'id':'11111111-1111-4111-8111-111111111111',
          'name':'Banani Kakoli','zone':'Banani',
          'latitude':23.79,'longitude':90.40,
        }]
    monkeypatch.setattr(catalog,'rows',fake_rows)
    app=FastAPI()
    app.include_router(catalog.router)
    client=TestClient(app)

    result=client.get('/api/locations/stops',params={'q':'Ban'})
    assert result.status_code==200
    assert result.json()[0]['name']=='Banani Kakoli'
    assert 'WHERE approved AND active' in captured['sql']
    assert 'LIMIT 8' in captured['sql']
    assert captured['params']==('Ban','Ban','Ban')


def test_public_stops_reject_blank_or_huge_queries():
    app=FastAPI()
    app.include_router(catalog.router)
    client=TestClient(app)
    assert client.get('/api/locations/stops',params={'q':'B'}).status_code==422
    assert client.get('/api/locations/stops',params={'q':'a'*81}).status_code==422
