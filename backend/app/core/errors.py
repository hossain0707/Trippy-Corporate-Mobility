from fastapi import HTTPException

def fail(status:int, detail:str):
    raise HTTPException(status_code=status,detail=detail)
