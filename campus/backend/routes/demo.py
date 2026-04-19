"""
Demo mode endpoint — returns a synthetic college + students + drives + companies
bundle with stable IDs. Frontend can stash these in localStorage and the whole
UI works with zero backend setup.
"""
from fastapi import APIRouter

from ..services.demo_store import demo_bundle, DEMO_COLLEGE_ID, DEMO_COLLEGE_SLUG


router = APIRouter(prefix="/api/campus/demo", tags=["campus:demo"])


@router.get("")
async def get_demo():
    bundle = demo_bundle()
    return {
        "demo": True,
        "college_id": DEMO_COLLEGE_ID,
        "college_slug": DEMO_COLLEGE_SLUG,
        **bundle,
    }
