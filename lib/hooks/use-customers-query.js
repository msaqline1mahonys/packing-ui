"use client";

import { useMemo } from "react";
import {
  REFERENCE_QUERY_KEYS,
  useCustomersQuery,
  useInvalidateReferenceData,
} from "@/lib/hooks/use-reference-data-queries";

export const CUSTOMERS_QUERY_KEY = REFERENCE_QUERY_KEYS.customers;

export { useCustomersQuery };

export function useCustomersForSelect() {
  const query = useCustomersQuery();
  const data = useMemo(
    () =>
      (query.data ?? [])
        .map((row) => ({ id: row.id, name: row.name ?? "" }))
        .filter((row) => row.id != null && row.name),
    [query.data]
  );

  return {
    ...query,
    data,
  };
}

export function useInvalidateCustomers() {
  const invalidate = useInvalidateReferenceData();
  return () => invalidate("customers");
}
