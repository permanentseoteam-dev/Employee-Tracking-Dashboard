import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_create_and_list_employee(client: AsyncClient, seed_data: dict):
    # Login as Admin
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "admin123"},
    )
    admin_token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create new employee
    create_res = await client.post(
        "/api/v1/employees",
        headers=headers,
        json={
            "employee_code": "EMP099",
            "name": "David Tester",
            "email": "david@test.com",
            "password": "password123",
            "role": "EMPLOYEE",
            "status": "ACTIVE",
            "department_id": seed_data["dept"].id,
            "manager_id": seed_data["manager"].id,
        },
    )
    assert create_res.status_code == 201
    emp_data = create_res.json()
    assert emp_data["name"] == "David Tester"
    assert emp_data["employee_code"] == "EMP099"

    # List all employees as admin
    list_res = await client.get("/api/v1/employees", headers=headers)
    assert list_res.status_code == 200
    employees = list_res.json()
    assert len(employees) >= 4  # admin, manager, emp1, emp2, emp099


@pytest.mark.asyncio
async def test_manager_scope_isolation(client: AsyncClient, seed_data: dict):
    # Login as Manager Alice (only manages Bob EMP001)
    mgr_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "manager@test.com", "password": "manager123"},
    )
    mgr_token = mgr_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {mgr_token}"}

    # Manager listing employees should only see self + subordinates (Bob EMP001)
    list_res = await client.get("/api/v1/employees", headers=headers)
    assert list_res.status_code == 200
    employees = list_res.json()
    emp_emails = [e["email"] for e in employees]
    assert "manager@test.com" in emp_emails
    assert "bob@test.com" in emp_emails
    assert "charlie@test.com" not in emp_emails  # Charlie is not under this manager!

    # Attempting to fetch Charlie's profile directly should return 403 Forbidden
    charlie_res = await client.get(f"/api/v1/employees/{seed_data['emp2'].id}", headers=headers)
    assert charlie_res.status_code == 403
