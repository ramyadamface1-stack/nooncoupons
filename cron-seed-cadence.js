// Seed reconciliation is idempotent but reads the entire ControlPlane state.
// In a shared cron invocation it competes with due articles, remote R2,
// migration backups and the quality-gated publisher for 50 subrequests.
// Reconcile once per clock hour; regular /api/state still seeds on demand.
export function seedReconcileDue(scheduledTime){
  const stamp=Number(scheduledTime);
  if(!Number.isFinite(stamp)||stamp<0)return false;
  return new Date(stamp).getUTCMinutes()===0;
}
