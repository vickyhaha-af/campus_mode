"""
Authentication routes for Supabase Auth integration.
Handles signup, login, and profile endpoints.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from db.supabase_client import get_supabase
from typing import Optional

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    user: dict
    session: dict
    message: str


@router.post("/signup", response_model=AuthResponse)
async def signup(request: SignupRequest):
    """Create new user account via Supabase Auth."""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    
    try:
        # Sign up with Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {
                    "full_name": request.full_name or request.email.split("@")[0]
                }
            }
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Signup failed")
        
        return {
            "user": {
                "id": auth_response.user.id,
                "email": auth_response.user.email,
                "full_name": request.full_name
            },
            "session": {
                "access_token": auth_response.session.access_token if auth_response.session else None,
                "expires_at": auth_response.session.expires_at if auth_response.session else None
            },
            "message": "Account created successfully. Check your email for verification."
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Signup failed: {str(e)}")


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Authenticate user via Supabase Auth."""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    
    try:
        # Sign in with Supabase Auth
        auth_response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        return {
            "user": {
                "id": auth_response.user.id,
                "email": auth_response.user.email,
                "full_name": auth_response.user.user_metadata.get("full_name", "")
            },
            "session": {
                "access_token": auth_response.session.access_token,
                "expires_at": auth_response.session.expires_at
            },
            "message": "Login successful"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Login failed: {str(e)}")


@router.post("/logout")
async def logout(request: Request):
    """Sign out user and invalidate session."""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    
    try:
        # Get token from header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            # Sign out this session
            supabase.auth.sign_out()
        
        return {"message": "Logged out successfully"}
        
    except Exception as e:
        # Logout is best-effort
        return {"message": "Logout completed"}


@router.get("/me")
async def get_current_user_info(request: Request):
    """Get current authenticated user info."""
    from services.auth_middleware import get_current_user
    
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return {
        "id": user["id"],
        "email": user["email"],
        "role": user.get("role", "authenticated")
    }


@router.post("/reset-password")
async def reset_password(request: dict):
    """Request password reset email."""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    
    email = request.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    try:
        supabase.auth.reset_password_email(email)
        return {"message": "Password reset email sent"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Reset failed: {str(e)}")
