from fastapi import APIRouter, HTTPException

from app.schemas import FeedbackCreate, FeedbackResult
from app.services import fate_service

router = APIRouter()


@router.get("/home/{user_id}", tags=["home"])
def get_home(user_id: str):
    return fate_service.home(user_id)


@router.get("/square", tags=["community"])
def get_square():
    return fate_service.square()


@router.get("/coordinates/{user_id}", tags=["coordinates"])
def get_coordinates(user_id: str):
    return fate_service.coordinates(user_id)


@router.get("/messages/{user_id}", tags=["messages"])
def get_messages(user_id: str):
    return fate_service.messages(user_id)


@router.get("/profile/{user_id}", tags=["profile"])
def get_profile(user_id: str):
    return fate_service.profile(user_id)


@router.get("/tags", tags=["tags"])
def get_tags():
    return fate_service.tags()


@router.post("/feedback", response_model=FeedbackResult, tags=["feedback"])
def submit_feedback(payload: FeedbackCreate):
    try:
        return fate_service.record_feedback(payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
