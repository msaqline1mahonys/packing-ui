import PackDetailClient from "./pack-detail-client";

export default async function PackersPackDetailPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const packId = resolvedParams?.id;
  const initialContainerId =
    typeof resolvedSearch?.container === "string"
      ? resolvedSearch.container
      : typeof resolvedSearch?.containerId === "string"
        ? resolvedSearch.containerId
        : null;
  return <PackDetailClient key={packId} packId={packId} initialContainerId={initialContainerId} />;
}

