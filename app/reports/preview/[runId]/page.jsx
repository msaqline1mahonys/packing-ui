import PreviewClient from "./preview-client";

export const metadata = {
  title: "Report preview — Mahonys Packing",
};

export default async function ReportPreviewPage({ params }) {
  const { runId } = await params;
  return <PreviewClient runId={runId} />;
}
