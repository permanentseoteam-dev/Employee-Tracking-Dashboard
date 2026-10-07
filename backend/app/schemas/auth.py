from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    name: str
    email: str


class TokenPayload(BaseModel):
    sub: str  # user id or device id
    role: str
    scope: str = "user"  # "user" or "device"
