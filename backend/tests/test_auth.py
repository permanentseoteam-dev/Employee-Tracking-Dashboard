import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_login_success(client: AsyncClient, seed_data: dict):
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "ADMIN"
    assert data["email"] == "admin@test.com"


@pytest.mark.asyncio
async def test_auth_login_invalid_password(client: AsyncClient, seed_data: dict):
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_auth_me_endpoint(client: AsyncClient, seed_data: dict):
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "bob@test.com", "password": "bob123"},
    )
    token = login_res.json()["access_token"]

    me_res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "bob@test.com"
    assert me_data["role"] == "EMPLOYEE"
