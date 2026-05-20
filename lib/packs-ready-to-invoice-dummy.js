import { FEES_AND_CHARGES_ROWS } from "@/lib/Data";

export const PACKS_READY_TO_INVOICE = [
  {
    id: "PK-2401",
    customer: "Green Leaf Commodities",
    commodity: "Wheat",
    vessel: "MV Horizon East",
    totalContainers: 6,
    totalWeightTon: 142.5,
    commodityRatePerTon: 31.75,
    fumigationRequired: true,
    fumigationRatePerTon: 12.5,
    emptyParkRatePerContainer: 85,
    terminalRatePerContainer: 115,
  },
  {
    id: "PK-2402",
    customer: "Riverland Exports",
    commodity: "Barley",
    vessel: "MV Northern Crest",
    totalContainers: 4,
    totalWeightTon: 96,
    commodityRatePerTon: 29.5,
    fumigationRequired: false,
    fumigationRatePerTon: 0,
    emptyParkRatePerContainer: 82,
    terminalRatePerContainer: 110,
  },
  {
    id: "PK-2403",
    customer: "Sunrise Agriculture",
    commodity: "Canola",
    vessel: "MV Coral Bay",
    totalContainers: 8,
    totalWeightTon: 188.3,
    commodityRatePerTon: 34.2,
    fumigationRequired: true,
    fumigationRatePerTon: 13.25,
    emptyParkRatePerContainer: 88,
    terminalRatePerContainer: 118,
  },
  {
    id: "PK-2404",
    customer: "West Coast Feed",
    commodity: "Lupins",
    vessel: "MV Pacific Dawn",
    totalContainers: 5,
    totalWeightTon: 117.8,
    commodityRatePerTon: 30.9,
    fumigationRequired: false,
    fumigationRatePerTon: 0,
    emptyParkRatePerContainer: 84,
    terminalRatePerContainer: 112,
  },
];

export const FEES_AND_CHARGES_LOOKUP = FEES_AND_CHARGES_ROWS;

export function calculateBaseLineItems(pack) {
  return [
    {
      id: "commodity-cost",
      source: "default",
      label: "Commodity cost",
      unitPrice: Number(pack.commodityRatePerTon) || 0,
      quantity: Number(pack.totalWeightTon) || 0,
      unitLabel: "MT",
      basisText: `${formatTon(pack.totalWeightTon)} total container weight`,
    },
    {
      id: "fumigation-cost",
      source: "default",
      label: "Fumigation cost",
      unitPrice: pack.fumigationRequired ? Number(pack.fumigationRatePerTon) || 0 : 0,
      quantity: pack.fumigationRequired ? Number(pack.totalWeightTon) || 0 : 0,
      unitLabel: "MT",
      basisText: pack.fumigationRequired ? `${formatTon(pack.totalWeightTon)} fumigated weight` : "No fumigation required",
    },
    {
      id: "empty-park-cost",
      source: "default",
      label: "Empty park cost",
      unitPrice: Number(pack.emptyParkRatePerContainer) || 0,
      quantity: Number(pack.totalContainers) || 0,
      unitLabel: "container",
      basisText: `${pack.totalContainers} containers (also revenue amount)`,
    },
    {
      id: "terminal-cost",
      source: "default",
      label: "Terminal cost",
      unitPrice: Number(pack.terminalRatePerContainer) || 0,
      quantity: Number(pack.totalContainers) || 0,
      unitLabel: "container",
      basisText: `${pack.totalContainers} containers (also revenue amount)`,
    },
  ];
}

export function createFeeLineItem(charge, pack) {
  const { quantity, unitLabel } = getChargeQuantityAndUnit(charge, pack);
  return {
    id: `charge-${charge.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    source: "fee",
    chargeId: charge.id,
    label: charge.chargeName || "Additional charge",
    unitPrice: Number(charge.chargeRate) || 0,
    quantity,
    unitLabel,
    basisText: getChargeBasisText(charge, pack),
  };
}

export function calculateApplyToAllPackLineItems(pack) {
  return FEES_AND_CHARGES_LOOKUP.filter((charge) => charge.applyToAllPacks).map((charge) => createFeeLineItem(charge, pack));
}

export function calculateInitialLineItems(pack) {
  return [...calculateBaseLineItems(pack), ...calculateApplyToAllPackLineItems(pack)];
}

function getChargeQuantityAndUnit(charge, pack) {
  if (charge.chargeType === "Per Container") return { quantity: Number(pack.totalContainers) || 0, unitLabel: "container" };
  if (charge.chargeType === "Per MT") return { quantity: Number(pack.totalWeightTon) || 0, unitLabel: "MT" };
  return { quantity: 1, unitLabel: "invoice" };
}

export function calculateLineItemAmount(item) {
  return (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
}

function getChargeBasisText(charge, pack) {
  if (charge.chargeType === "Per Container") return `${pack.totalContainers} containers`;
  if (charge.chargeType === "Per MT") return `${formatTon(pack.totalWeightTon)} total weight`;
  return "One charge per invoice";
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export function formatTon(value) {
  return `${Number(value || 0).toFixed(1)} MT`;
}
