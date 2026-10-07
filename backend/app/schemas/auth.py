from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
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
