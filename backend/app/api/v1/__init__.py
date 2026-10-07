from fastapi import APIRouter
from app.api.v1.activity import router as activity_router
from app.api.v1.agent import router as agent_router
from app.api.v1.attendance import router as attendance_router
from app.api.v1.audit import router as audit_router
from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.departments import router as departments_router
from app.api.v1.devices import router as devices_router
from app.api.v1.employees import router as employees_router
from app.api.v1.rules import router as rules_router
from app.api.v1.screenshots import router as screenshots_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(departments_router)
api_v1_router.include_router(employees_router)
api_v1_router.include_router(devices_router)
api_v1_router.include_router(agent_router)
api_v1_router.include_router(attendance_router)
api_v1_router.include_router(activity_router)
api_v1_router.include_router(screenshots_router)
api_v1_router.include_router(rules_router)
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(audit_router)
