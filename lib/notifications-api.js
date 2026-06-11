import { API_BASE_URL } from "@/lib/api-config";

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(result?.message || result?.msg || "Notification request failed.");
  }
  return result?.data ?? result;
}

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export function notificationFromApi(row) {
  if (!row) return null;
  const data = row.data && typeof row.data === "object" ? row.data : {};
  return {
    id: row.id,
    type: row.type ?? "",
    title: row.title ?? "",
    body: row.body ?? "",
    changes: data.changes ?? {},
    route: data.route ?? null,
    subjectType: row.subject_type ?? data.subject_type ?? null,
    subjectId: row.subject_id ?? data.subject_id ?? null,
    actorName: row.actor_name ?? row.actor?.name ?? "",
    readAt: row.read_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export async function fetchNotifications({ unread = false, perPage = 20 } = {}) {
  const params = new URLSearchParams();
  if (unread) params.set("unread", "1");
  params.set("per_page", String(perPage));
  const data = await request(`${API_BASE_URL}/notifications?${params.toString()}`);
  return unwrapList(data).map(notificationFromApi);
}

export async function fetchUnreadCount() {
  const data = await request(`${API_BASE_URL}/notifications/unread-count`);
  return Number(data?.count ?? 0);
}

export async function markNotificationRead(id) {
  await request(`${API_BASE_URL}/notifications/${id}/read`, {
    method: "POST",
    body: "{}",
  });
}

export async function markAllNotificationsRead() {
  await request(`${API_BASE_URL}/notifications/read-all`, {
    method: "POST",
    body: "{}",
  });
}
