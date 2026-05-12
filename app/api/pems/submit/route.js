import { NextResponse } from "next/server";

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Missing request payload.";
  if (!payload.packId) return "Pack id is required.";
  if (!payload.recordType) return "Record type is required.";
  if (!payload.aoSignoff) return "AO signoff is required.";
  if (!payload.inspectionStart || !payload.inspectionEnd) return "Inspection start and end are required.";
  if (!Array.isArray(payload.containers) || !payload.containers.length) return "At least one container is required.";
  return null;
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const now = new Date();
  const submissionId = `PEMS-${now.getTime()}`;

  return NextResponse.json({
    status: "Accepted",
    submissionId,
    submittedAt: now.toISOString(),
    packId: payload.packId,
    containerCount: payload.containers.length,
    acceptedContainerIds: payload.containers.map((container) => container.id),
  });
}
