import PackDetailClient from "./pack-detail-client";

export default async function PackersPackDetailPage({ params }) {
  const resolvedParams = await params;
  const packId = resolvedParams?.id;
  return <PackDetailClient packId={packId} />;
}

