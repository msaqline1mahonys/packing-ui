export function getVesselScheduleUpdatedAt(row) {
  return row?.vessel_schedule_updated_at ?? row?.vesselScheduleUpdatedAt ?? null;
}

export function getVesselScheduleAcknowledgedAt(row) {
  return row?.vessel_schedule_acknowledged_at ?? row?.vesselScheduleAcknowledgedAt ?? null;
}

export function hasPendingVesselScheduleUpdate(row) {
  const updatedAt = getVesselScheduleUpdatedAt(row);
  if (!updatedAt) return false;
  const acknowledgedAt = getVesselScheduleAcknowledgedAt(row);
  if (!acknowledgedAt) return true;
  return new Date(acknowledgedAt).getTime() < new Date(updatedAt).getTime();
}
