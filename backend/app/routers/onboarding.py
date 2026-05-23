from fastapi import APIRouter, Depends

from ..config import Settings, get_settings
from ..dependencies import get_current_user
from ..schemas import OnboardingAiSummary, OnboardingAiSummaryRequest, Profile
from ..services.onboarding_ai import generate_onboarding_summary

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


@router.post("/ai-summary", response_model=OnboardingAiSummary)
def create_onboarding_ai_summary(
    payload: OnboardingAiSummaryRequest,
    _current_user: Profile = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> OnboardingAiSummary:
    return generate_onboarding_summary(payload, settings)
