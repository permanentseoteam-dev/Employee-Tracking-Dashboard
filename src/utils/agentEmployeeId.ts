/** Canonical id the employee-agent polls for live/record commands. */
export function agentCommandEmployeeId(emp: {
  id: string;
  user_id?: string | null;
}): string {
  const uid = (emp.user_id || '').trim();
  return uid || emp.id;
}
