"""REST API routes for user management and progress tracking."""

from fastapi import APIRouter, HTTPException
from app.models.schemas import ProgressOut

router = APIRouter(prefix="/api/users", tags=["users"])


# In-memory user store for MVP (replace with DB in production)
_users: dict[str, dict] = {
    "default-user": {
        "id": "default-user",
        "email": "user@example.com",
        "display_name": "Learner",
        "native_language": "en",
    }
}

_progress: dict[str, list[dict]] = {}


@router.get("/{user_id}/progress", response_model=list[ProgressOut])
async def get_user_progress(user_id: str):
    """Get aggregated progress data for a user across all languages."""
    if user_id not in _users:
        raise HTTPException(status_code=404, detail="User not found")

    user_progress = _progress.get(user_id, [])
    return [ProgressOut(**p) for p in user_progress]


@router.get("/{user_id}/history")
async def get_user_history(user_id: str, limit: int = 20):
    """List past sessions with scores for a user.

    Note: In the MVP this returns an empty list. In production,
    this queries the sessions + evaluations tables.
    """
    if user_id not in _users:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": user_id,
        "sessions": [],
        "message": "Session history will be populated once database persistence is enabled.",
    }
