"""Application composition only; no business logic in this entrypoint."""
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI,HTTPException,Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from psycopg.errors import ExclusionViolation,UniqueViolation,ForeignKeyViolation
from .core.config import settings
from .core.database import open_pool,close_pool,connection,one
from .modules.auth.router import router as identity
from .modules.catalog.router import router as catalog
from .modules.booking.router import router as booking
from .modules.payments.router import router as payments
from .modules.tracking.router import router as tracking
from .modules.admin.router import router as admin
from .modules.support.router import router as support

log=logging.getLogger('trippy')

@asynccontextmanager
async def lifespan(app:FastAPI):
    open_pool()
    yield
    close_pool()

app=FastAPI(title='Trippy Corporate API',version='1.0.0',lifespan=lifespan,
            docs_url='/api/docs' if settings().app_env!='production' else None,
            redoc_url=None,openapi_url='/api/openapi.json' if settings().app_env!='production' else None)
app.add_middleware(CORSMiddleware,allow_origins=[settings().web_origin],allow_credentials=False,
                   allow_methods=['GET','POST','PATCH','PUT','OPTIONS'],allow_headers=['Authorization','Content-Type'])

@app.exception_handler(ExclusionViolation)
@app.exception_handler(UniqueViolation)
async def conflict(_,exc):
    return JSONResponse({'error':'CONFLICT','message':'The seat or resource has already been claimed'},status_code=409)

@app.exception_handler(ForeignKeyViolation)
async def invalid_reference(_,exc):
    return JSONResponse({'error':'INVALID_REFERENCE','message':'Referenced item not found'},status_code=422)

@app.exception_handler(HTTPException)
async def http_error(_,exc:HTTPException):
    return JSONResponse({'error':'HTTP_ERROR','message':exc.detail},status_code=exc.status_code)

for router in (identity,catalog,booking,payments,tracking,admin,support):
    app.include_router(router)

@app.get('/health/live',tags=['Health'])
def health_live(): return {'status':'ok'}

@app.get('/health/ready',tags=['Health'])
def health_ready():
    with connection() as conn: one(conn,'SELECT 1 AS ready')
    return {'status':'ready'}
