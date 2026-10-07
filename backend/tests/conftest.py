import asyncio
from collections.abc import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.api.deps import get_db
from app.database import Base
from app.main import app
from app.models.department import Department
from app.models.employee import Employee, RoleEnum
from app.services.auth import hash_password

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_factory = async_sessionmaker(
    bind=test_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with test_session_factory() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seed_data(db_session: AsyncSession):
    # Create Engineering Department
    dept = Department(name="Engineering", code="ENG")
    db_session.add(dept)
    await db_session.flush()

    # Create Admin
    admin = Employee(
        employee_code="ADM001",
        name="Admin User",
        email="admin@test.com",
        password_hash=hash_password("admin123"),
        role=RoleEnum.ADMIN.value,
        department_id=dept.id,
    )
    db_session.add(admin)
    await db_session.flush()

    # Create Manager
    manager = Employee(
        employee_code="MGR001",
        name="Manager Alice",
        email="manager@test.com",
        password_hash=hash_password("manager123"),
        role=RoleEnum.MANAGER.value,
        department_id=dept.id,
    )
    db_session.add(manager)
    await db_session.flush()

    # Create Employee 1 under Manager
    emp1 = Employee(
        employee_code="EMP001",
        name="Bob Developer",
        email="bob@test.com",
        password_hash=hash_password("bob123"),
        role=RoleEnum.EMPLOYEE.value,
        department_id=dept.id,
        manager_id=manager.id,
    )
    # Create Employee 2 (Not under this manager)
    emp2 = Employee(
        employee_code="EMP002",
        name="Charlie Designer",
        email="charlie@test.com",
        password_hash=hash_password("charlie123"),
        role=RoleEnum.EMPLOYEE.value,
        department_id=dept.id,
        manager_id=None,
    )
    db_session.add_all([emp1, emp2])
    await db_session.commit()

    return {
        "dept": dept,
        "admin": admin,
        "manager": manager,
        "emp1": emp1,
        "emp2": emp2,
    }
