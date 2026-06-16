"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCommoditiesList,
  fetchCommodityTypesList,
  fetchContainerCodesList,
  fetchContainerParksList,
  fetchCountriesList,
  fetchCustomersList,
  fetchPackers,
  fetchPortsList,
  fetchReleasesList,
  fetchShippingLinesList,
  fetchStockLocations,
  fetchTerminalsList,
  fetchTransportersList,
  fetchUsersForSelect,
  fetchVesselVoyagesList,
  fetchPemsInspectionRemarks,
} from "@/lib/api/reference-data";

/** Shared TanStack query keys — one cache per reference table. */
export const REFERENCE_QUERY_KEYS = {
  customers: ["customers"],
  commodities: ["commodities"],
  commodityTypes: ["commodity-types"],
  shippingLines: ["shipping-lines"],
  containerCodes: ["container-codes"],
  containerParks: ["container-parks"],
  transporters: ["transporters"],
  terminals: ["terminals"],
  countries: ["countries"],
  ports: ["ports"],
  vesselVoyages: ["vessel-voyages"],
  releases: ["releases"],
  users: ["users-for-select"],
  stockLocations: ["stock-locations"],
  packers: ["reference-packers"],
  pemsInspectionRemarks: ["pems-inspection-remarks"],
};

const ALL_REFERENCE_QUERY_KEYS = Object.values(REFERENCE_QUERY_KEYS);

const queryDefaults = {
  staleTime: 0,
  retry: 1,
  refetchOnWindowFocus: true,
};

function useReferenceListQuery(key, queryFn) {
  return useQuery({
    queryKey: key,
    queryFn,
    ...queryDefaults,
  });
}

export const useCustomersQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.customers, fetchCustomersList);
export const useCommoditiesQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.commodities, fetchCommoditiesList);
export const useCommodityTypesQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.commodityTypes, fetchCommodityTypesList);
export const useShippingLinesQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.shippingLines, fetchShippingLinesList);
export const useContainerCodesQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.containerCodes, fetchContainerCodesList);
export const useContainerParksQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.containerParks, fetchContainerParksList);
export const useTransportersQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.transporters, fetchTransportersList);
export const useTerminalsQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.terminals, fetchTerminalsList);
export const useCountriesQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.countries, fetchCountriesList);
export const usePortsQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.ports, fetchPortsList);
export const useVesselVoyagesQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.vesselVoyages, fetchVesselVoyagesList);
export const useReleasesQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.releases, fetchReleasesList);
export const useUsersForSelectQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.users, () => fetchUsersForSelect().catch(() => []));
export const useStockLocationsQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.stockLocations, () => fetchStockLocations().catch(() => []));
export const usePackersQuery = () => useReferenceListQuery(REFERENCE_QUERY_KEYS.packers, () => fetchPackers().catch(() => []));
export const usePemsInspectionRemarksQuery = () =>
  useReferenceListQuery(REFERENCE_QUERY_KEYS.pemsInspectionRemarks, () => fetchPemsInspectionRemarks().catch(() => ({
    ecInspectionRemarks: [],
    goodsInspectionRemarks: [],
  })));

/**
 * Invalidate one or more reference-data caches after a save/delete.
 * @param {keyof typeof REFERENCE_QUERY_KEYS | Array<keyof typeof REFERENCE_QUERY_KEYS>} keys
 */
export function useInvalidateReferenceData() {
  const queryClient = useQueryClient();
  return (keys) => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    return Promise.all(
      keyList.map((key) => queryClient.invalidateQueries({ queryKey: REFERENCE_QUERY_KEYS[key] }))
    );
  };
}

/** Invalidate every reference-data cache (pack form + all admin screens). */
export function useInvalidateAllReferenceData() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ALL_REFERENCE_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
    );
}
