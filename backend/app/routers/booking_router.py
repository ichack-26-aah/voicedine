from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from app.services.booking_service import trigger_call

router = APIRouter(prefix="/api/booking", tags=["booking"])

class BookingRequest(BaseModel):
    restaurant_name: str
    phone_number: str

@router.post("/book")
async def book_table(request: BookingRequest):
    try:
        result = trigger_call(request.phone_number, request.restaurant_name)
        return {"status": "success", "data": result}
    except ValueError as e:
         raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")
