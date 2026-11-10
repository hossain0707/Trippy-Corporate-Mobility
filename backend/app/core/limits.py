"""Atomic PostgreSQL rate limits, separate committed transaction even on rejected request."""
from hashlib import sha256
from time import time
from .database import connection,one
from .errors import fail

def throttle(action:str,subject,limit:int,window_seconds:int):
    bucket=int(time()//window_seconds)
    digest=sha256(str(subject).encode('utf-8')).hexdigest()
    with connection() as conn:
        row=one(conn,'''INSERT INTO app.rate_limits(action,key_hash,bucket,hit_count)
            VALUES(%s,%s,%s,1) ON CONFLICT(action,key_hash,bucket)
            DO UPDATE SET hit_count=app.rate_limits.hit_count+1 RETURNING hit_count''',(action,digest,bucket))
    if row['hit_count']>limit:
        fail(429,'Too many requests. Please try again later')
