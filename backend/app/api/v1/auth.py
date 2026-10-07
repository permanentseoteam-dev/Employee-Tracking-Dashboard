from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.employee import Employee
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.employee import EmployeeOut
from app.api.deps import get_current_user
from app.services.auth import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Employee).where(Employee.email == payload.email)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or suspended",
        )

    token = create_access_token(
        data={"sub": user.id, "role": user.role, "scope": "user", "email": user.email}
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role,
        name=user.name,
        email=user.email,
    )


@router.get("/me", response_model=EmployeeOut)
async def get_me(current_user: Employee = Depends(get_current_user)):
    return current_user
