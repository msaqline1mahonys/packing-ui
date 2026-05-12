export function createPraActionHandlers({ container, applyPatch, fallbackPacker = "" }) {
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
    onMarkPacked: () =>
      applyPatch({
        outLoaded: "Yes",
        packerSignoff: container?.packerSignoff || fallbackPacker || "",
      }),
    onSubmitPra: () =>
      applyPatch({
        praSubmitted: true,
        praLastStatus: "Accepted",
        praLastSubmittedTime: new Date().toLocaleString(),
        praLastError: "ERA0100-Message received without error",
      }),
  };
}
