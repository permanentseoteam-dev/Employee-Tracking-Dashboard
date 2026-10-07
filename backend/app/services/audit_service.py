from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog


class AuditService:
    @staticmethod
    async def log_action(
        db: AsyncSession,
        actor_id: str | None,
        actor_email: str | None,
        action: str,
        entity_type: str,
        entity_id: str | None = None,
        change_diff: dict | None = None,
        ip_address: str | None = None,
    ):
        log = AuditLog(
            actor_id=actor_id,
            actor_email=actor_email,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            change_diff=change_diff,
            ip_address=ip_address,
        )
        db.add(log)


audit_service = AuditService()
