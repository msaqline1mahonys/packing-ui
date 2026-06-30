import { readAuthPayload } from "@/lib/auth-session";
import { readSiteOptions } from "@/lib/site-data";

/** Site options for integration settings — prefers live auth payload UUIDs. */
export function readIntegrationSettingsSiteOptions() {
  const payload = readAuthPayload();
  const allowed = Array.isArray(payload?.allowed_sites) ? payload.allowed_sites : [];
  if (allowed.length) {
    return allowed
      .map((site) => {
        const id = String(site?.id ?? "").trim();
        if (!id) return null;
        return {
          id,
          label: String(site?.name ?? site?.code ?? id).trim(),
        };
      })
      .filter(Boolean);
  }
  if (payload?.current_site?.id) {
    return [
      {
        id: String(payload.current_site.id),
        label: String(payload.current_site.name ?? payload.current_site.code ?? "Current site"),
      },
    ];
  }
  return readSiteOptions();
}
