import { formatOutloadError, getOutloadBlockers, getPackerSignoffStatusBlocker } from "@/lib/packers-container-validation";
import { isPackersPackerSignoffBlocked } from "@/lib/packing-container-ui";

function trimField(value) {
  return String(value ?? "").trim();
}

export function createPraActionHandlers({ container, applyPatch, fallbackPacker = "", onBlocked, isImport = false, packStatus }) {
  function blockIfSignoffNotAllowed() {
    if (!isPackersPackerSignoffBlocked(packStatus)) return false;
    onBlocked?.(getPackerSignoffStatusBlocker(packStatus));
    return true;
  }
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
    onResetContainer: () => {
      if (blockIfSignoffNotAllowed() && trimField(container?.packerSignoff)) return;
      applyPatch({
        packerSignoff: "",
        outLoaded: "No",
        praSignoff: "",
        praSubmitted: false,
        praLastStatus: "Pending",
        praLastSubmittedTime: "",
        praLastError: "",
      });
    },
    onMarkPacked: () => {
      if (blockIfSignoffNotAllowed()) return;
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
