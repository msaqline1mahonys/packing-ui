import { formatOutloadError, getOutloadBlockers, getPackerSignoffStatusBlocker } from "@/lib/packers-container-validation";
import { isPackersPackerSignoffBlocked } from "@/lib/packing-container-ui";
import { cancelPra, submitPra } from "@/lib/pra/api";

function trimField(value) {
  return String(value ?? "").trim();
}

export function createPraActionHandlers({
  packId,
  container,
  applyPatch,
  fallbackPacker = "",
  onBlocked,
  onError,
  isImport = false,
  packStatus,
}) {
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
    onSubmitPra: async () => {
      if (!packId || !container?.id) {
        onError?.("Save the pack before submitting PRA.");
        return;
      }
      try {
        const result = await submitPra(packId, container.id, {
          praTemplate: container?.praTemplate,
        });
        applyPatch(result.containerPatch || {});
      } catch (err) {
        onError?.(err?.message || "PRA submission failed.");
      }
    },
    onCancelPra: async () => {
      if (!packId || !container?.id) {
        onError?.("Save the pack before cancelling PRA.");
        return;
      }
      try {
        const result = await cancelPra(packId, container.id);
        applyPatch(result.containerPatch || {});
      } catch (err) {
        onError?.(err?.message || "PRA cancellation failed.");
      }
    },
  };
}
