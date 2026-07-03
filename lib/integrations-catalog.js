/**
 * Inbound integrations — systems that push data into Mahonys Packing.
 * Add new entries here as additional integration endpoints are built.
 */

export const INBOUND_INTEGRATION_TYPES = {
  VESSEL_SCHEDULE: "VESSEL_SCHEDULE",
};

export const INBOUND_INTEGRATIONS = [
  {
    type: INBOUND_INTEGRATION_TYPES.VESSEL_SCHEDULE,
    name: "Comtrac vessel schedule",
    summary:
      "Receive Comtrac carrier VS (schedule) and VR (rotation) CSV files to create and update vessel departures.",
    method: "POST",
    path: "/integrations/vessel-schedule",
    supportsSeparateFiles: true,
    fileFields: [
      {
        key: "vs",
        label: "Vessel schedule (VS)",
        multipart: "vs_file",
        json: "vs_csv",
        description: "Creates and updates vessels and voyages (one voyage per ship + voyage + terminal + load port + operator). JSON field accepts base64 or plain CSV text.",
      },
      {
        key: "vr",
        label: "Vessel rotation (VR)",
        multipart: "vr_file",
        json: "vr_csv",
        description: "Enriches terminal names and updates terminals on existing voyages. JSON field accepts base64 or plain CSV text.",
      },
    ],
    standardHeaders: [
      { name: "X-Clutch-Organization-Id", description: "Your organization UUID" },
      { name: "X-Clutch-Site-Id", description: "Target site UUID" },
      { name: "X-Clutch-Integration-Type", description: "VESSEL_SCHEDULE" },
      { name: "Authorization", description: "Bearer <integration_key>" },
      { name: "X-Clutch-Request-Id", description: "Optional trace id", optional: true },
    ],
  },
];

export function getInboundIntegration(type) {
  return INBOUND_INTEGRATIONS.find((row) => row.type === type) ?? null;
}
