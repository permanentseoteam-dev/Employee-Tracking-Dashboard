import asyncio
from app.database import async_session_factory
from app.api.v1.rules import get_performance_scorecard
from app.models.employee import Employee
from sqlalchemy import select

async def main():
    async with async_session_factory() as db:
        emps = (await db.execute(select(Employee))).scalars().all()
        for e in emps:
            try:
                res = await get_performance_scorecard(employee_id=None, db=db, current_user=e)
                print(f"[{e.role}] {e.name} ({e.email}) -> Stars: {res.total_stars}, Days: {res.total_days_logged}, Violations: {len(res.violations_ledger)}")
            except Exception as err:
                print(f"[{e.role}] {e.name} Error:", err)

asyncio.run(main())

