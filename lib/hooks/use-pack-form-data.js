"use client";

import { useMemo } from "react";
import { activePackerNames } from "@/lib/api/packing";
import { useCustomersForSelect } from "@/lib/hooks/use-customers-query";
import {
  useCommoditiesQuery,
  useCommodityTypesQuery,
  useContainerCodesQuery,
  useContainerParksQuery,
  useCountriesQuery,
  useInvalidateAllReferenceData,
  usePackersQuery,
  usePortsQuery,
  useReleasesQuery,
  useShippingLinesQuery,
  useSitesQuery,
  useStockLocationsQuery,
  useTerminalsQuery,
  useTransportersQuery,
  useUsersForSelectQuery,
  useVesselVoyagesQuery,
} from "@/lib/hooks/use-reference-data-queries";

/**
 * Returns all reference/lookup data used by packing forms.
 * Each table has its own TanStack Query cache — saving reference data anywhere
 * in the app invalidates the matching cache so open forms update immediately.
 */
export function useAllPackLookups() {
  const { data: customers = [], isLoading: loadingCustomers } = useCustomersForSelect();
  const { data: commoditiesRaw = [], isLoading: loadingCommodities } = useCommoditiesQuery();
  const { data: commodityTypes = [], isLoading: loadingCommodityTypes } = useCommodityTypesQuery();
  const { data: shippingLines = [], isLoading: loadingShippingLines } = useShippingLinesQuery();
  const { data: containerCodes = [], isLoading: loadingContainerCodes } = useContainerCodesQuery();
  const { data: containerParks = [], isLoading: loadingContainerParks } = useContainerParksQuery();
  const { data: transporters = [], isLoading: loadingTransporters } = useTransportersQuery();
  const { data: referencePackers = [], isLoading: loadingReferencePackers } = usePackersQuery();
  const { data: terminals = [], isLoading: loadingTerminals } = useTerminalsQuery();
  const { data: vesselVoyages = [], isLoading: loadingVesselVoyages } = useVesselVoyagesQuery();
  const { data: countries = [], isLoading: loadingCountries } = useCountriesQuery();
  const { data: ports = [], isLoading: loadingPorts } = usePortsQuery();
  const { data: releases = [], isLoading: loadingReleases } = useReleasesQuery();
  const { data: users = [], isLoading: loadingUsers } = useUsersForSelectQuery();
  const { data: stockLocations = [], isLoading: loadingStockLocations } = useStockLocationsQuery();
  const { data: sites = [], isLoading: loadingSites } = useSitesQuery();

  const isLoading =
    loadingCustomers ||
    loadingCommodities ||
    loadingCommodityTypes ||
    loadingShippingLines ||
    loadingContainerCodes ||
    loadingContainerParks ||
    loadingTransporters ||
    loadingReferencePackers ||
    loadingTerminals ||
    loadingVesselVoyages ||
    loadingCountries ||
    loadingPorts ||
    loadingReleases ||
    loadingUsers ||
    loadingStockLocations ||
    loadingSites;

  const commodities = useMemo(
    () => (Array.isArray(commoditiesRaw) ? commoditiesRaw.filter((c) => c.status !== "Inactive") : []),
    [commoditiesRaw]
  );

  const packers = referencePackers;

  const fromUsers = useMemo(() => users.map((u) => u.name).filter(Boolean), [users]);
  const packerNames = useMemo(
    () => (fromUsers.length ? fromUsers : activePackerNames(packers)),
    [fromUsers, packers]
  );
  const packerSelectOptions = useMemo(() => activePackerNames(referencePackers), [referencePackers]);

  return {
    isLoading,
    users,
    packerNames,
    packerSelectOptions,
    packers,
    referencePackers,
    containerCodes,
    containerParks,
    transporters,
    stockLocations,
    customers,
    commodities,
    commodityTypes,
    shippingLines,
    terminals,
    vesselVoyages,
    countries,
    ports,
    releases,
    sites,
  };
}

/** @deprecated Prefer useInvalidateReferenceData('entityKey') for targeted invalidation. */
export function useInvalidatePackFormData() {
  return useInvalidateAllReferenceData();
}

// Re-export individual hooks for screens that only need one table.
export {
  useCommoditiesQuery,
  useCommodityTypesQuery,
  useContainerCodesQuery,
  useContainerParksQuery,
  useCountriesQuery,
  useInvalidateAllReferenceData,
  usePackersQuery,
  usePortsQuery,
  useReleasesQuery,
  useShippingLinesQuery,
  useSitesQuery,
  useStockLocationsQuery,
  useTerminalsQuery,
  useTransportersQuery,
  useUsersForSelectQuery,
  useVesselVoyagesQuery,
} from "@/lib/hooks/use-reference-data-queries";

export { useCustomersForSelect, useCustomersQuery, useInvalidateCustomers } from "@/lib/hooks/use-customers-query";
export { useInvalidateReferenceData, REFERENCE_QUERY_KEYS } from "@/lib/hooks/use-reference-data-queries";
