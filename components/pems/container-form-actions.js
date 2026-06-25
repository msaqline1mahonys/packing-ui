import { formatOutloadError, getOutloadBlockers } from "@/lib/packers-container-validation";

export function createPraActionHandlers({ container, applyPatch, fallbackPacker = "", onBlocked, isImport = false }) {
  function blockIfOutloadInvalid(patch) {
    const next = { ...container, ...patch };
    const blockers = getOutloadBlockers(next, { isImport });
    if (blockers.length) {
      onBlocked?.(formatOutloadError(blockers));
      return true;
    }
    return false;
  }

  return {
    onResetContainer: () =>
      applyPatch({
        packerSignoff: "",
        outLoaded: "No",
        praSignoff: "",
        praSubmitted: false,
        praLastStatus: "Pending",
        praLastSubmittedTime: "",
        praLastError: "",
      }),
    onMarkPacked: () => {
      const signoff = String(container?.packerSignoff || fallbackPacker || "").trim();
      const patch = {
        packerSignoff: signoff,
        outLoaded: signoff ? "Yes" : "No",
      };
      if (blockIfOutloadInvalid(patch)) return;
      applyPatch(patch);
    },
    onSubmitPra: () =>
      applyPatch({
        praSubmitted: true,
        praLastStatus: "Accepted",
        praLastSubmittedTime: new Date().toLocaleString(),
        praLastError: "ERA0100-Message received without error",
      }),
  };
}
