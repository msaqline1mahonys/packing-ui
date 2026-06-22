"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import ClutchSelect from "@/components/custom/ClutchSelect";
import { commodityOptionLabel } from "@/lib/commodity-display";
import { cn, nowDatetimeLocal, nowDatetimeLocalDate } from "@/lib/utils";
import { saveInTicketSnapshot } from "@/lib/ticketing-in-ticket-storage";
import { enrichPrintSnapshot } from "@/lib/in-ticket-print";
import {
  completeTicket,
  deleteTicket,
  fetchTicket,
  fetchTicketFormData,
  mergeTicketFromApi,
  overrideTicket,
  saveCmo,
  saveTicket,
  saveTruck,
  ticketTypeToDirection,
} from "@/lib/ticketing-api";
import { DEMO_TESTS } from "@/lib/demo-in-ticket-data";
import { fetchLocationUtilization, fetchTransactions } from "@/lib/transactions-api";
import SeasonSelect from "@/components/ticketing/season-select";
import {
  displayFromStorageKg,
  formatWeightFromStorageKg,
  storageKgFromDisplay,
  weightUnitLabel,
} from "@/lib/weight-units";
import TestResultsSection from "@/components/quality-tests/TestResultsSection";
import {
  buildTestsByName,
  commodityTypeRequiresTestConfirmation,
  getCommodityThresholds,
  sumGroupMembers,
  testAppliesToSurface,
} from "@/lib/test-thresholds";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500";

function getCmoCommodityLines(cmo) {
  if (!cmo) return [];
  if (Array.isArray(cmo.commodities) && cmo.commodities.length) return cmo.commodities;
  const ids = Array.isArray(cmo.commodityIds) ? cmo.commodityIds : cmo.commodityId ? [cmo.commodityId] : [];
  return ids.map((commodityId) => ({
    commodityTypeId: cmo.commodityTypeId,
    commodityId,
  }));
}

function formatCmoCommoditySummary(cmo, commodities) {
  const lines = getCmoCommodityLines(cmo);
  if (!lines.length) return "Unknown";
  return lines
    .map((line) => {
      const comm = commodities.find((c) => c.id === line.commodityId);
      return commodityOptionLabel(comm) || "Unknown";
    })
    .join(", ");
}

function formatLocationStockSuffix(util, stockItemsFallback = []) {
  const commodities = util?.commodities ?? [];
  if (commodities.length > 0) {
    const parts = commodities.slice(0, 3).map((item) => {
      const name = item.commodityName ?? item.commodity_name ?? "Unknown";
      const total = Number(item.total ?? 0);
      return total > 0 ? `${name} ${total.toFixed(1)} MT` : name;
    });
    const more = commodities.length > 3 ? ` +${commodities.length - 3} more` : "";
    return ` — ${parts.join(", ")}${more}`;
  }
  if (stockItemsFallback.length > 0) {
    return ` — ${stockItemsFallback.map((item) => item.commodityTypeName).join(", ")}`;
  }
  if (util && Number(util.totalStock ?? 0) > 0) {
    return " — in use";
  }
  return " (empty)";
}

function buildBlankTicket(direction) {
  return {
    type: direction,
    site: "",
    status: "booked",
    cmoId: null,
    truck: null,
    truckId: null,
    customerId: null,
    commodityTypeId: null,
    commodityId: null,
    grossWeights: [0],
    tareWeights: [0],
    grossWeightDateTimes: [""],
    tareWeightDateTimes: [""],
    splitLoad: false,
    tests: {},
    commodityConfirmed: false,
    commodityOverrideReason: "",
    signoff: "",
    signoffUserId: "",
    unloadedLocation: "",
    loadingLocation: "",
    notes: "",
    ticketReference: "",
    ticketRef: "",
    bookingRef: "",
    ngr: "",
    season: "",
    additionalReference: "",
    date: nowDatetimeLocalDate(),
  };
}

export default function InTicketFormClient({ mode, ticketId: routeTicketId, direction = "incoming" }) {
  const router = useRouter();
  const isCreate = mode === "create";
  const isIncoming = direction !== "outgoing";
  const ticketType = isIncoming ? "in" : "out";
  const listPath = isIncoming ? "/ticketing" : "/ticketing/outgoing";
  const detailPathBase = isIncoming ? "/ticketing/in" : "/ticketing/outgoing";
  const ticketLabel = isIncoming ? "In-Ticket" : "Out-Ticket";
  const ticketSubtitle = isIncoming ? "Incoming weighbridge ticket" : "Outgoing weighbridge ticket";
  const cmoDirection = ticketTypeToDirection(isIncoming ? "in" : "out");
  const locationField = isIncoming ? "unloadedLocation" : "loadingLocation";
  const testSurface = isIncoming ? "Incoming Tickets" : "Outgoing Tickets";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [internalAccounts, setInternalAccounts] = useState([]);
  const [commodityTypes, setCommodityTypes] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [tests, setTests] = useState(DEMO_TESTS);
  const [users, setUsers] = useState([]);
  const [stockLocations, setStockLocations] = useState([]);

  const [cmos, setCmos] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [completedTickets, setCompletedTickets] = useState([]);
  const [locationUtilization, setLocationUtilization] = useState([]);

  const [ticket, setTicket] = useState(() => buildBlankTicket(ticketType));

  const [showCmoModal, setShowCmoModal] = useState(false);
  const [showTruckModal, setShowTruckModal] = useState(false);
  const [showCommodityModal, setShowCommodityModal] = useState(false);
  const [suggestedCommodities, setSuggestedCommodities] = useState([]);
  const [testResultsSummary, setTestResultsSummary] = useState([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [locationWarning, setLocationWarning] = useState(null);

  const [newCmo, setNewCmo] = useState({
    cmoReference: "",
    direction: cmoDirection,
    customerId: "",
    commodityTypeId: "",
    commodityIds: [],
    status: "Open",
    season: "",
    estimatedAmount: "",
    note: "",
    attachments: [],
  });
  const [newTruck, setNewTruck] = useState({ name: "", driver: "", tare: "" });

  const ticketNumericId = ticket.id ?? routeTicketId ?? null;
  const ticketDisplayRef = ticket.ticketReference || "";
  const isCompleted = ticket.status === "completed";
  const printHref = ticketNumericId ? `${detailPathBase}/${ticketNumericId}/print?print=1` : null;

  const cmo = ticket.cmoId ? cmos.find((c) => c.id === ticket.cmoId) : null;
  const cmoCommodityLines = useMemo(() => getCmoCommodityLines(cmo), [cmo]);
  const allowedCommodityTypeIds = useMemo(
    () => new Set(cmoCommodityLines.map((line) => line.commodityTypeId).filter(Boolean)),
    [cmoCommodityLines]
  );
  const allowedCommodityIds = useMemo(
    () => new Set(cmoCommodityLines.map((line) => line.commodityId).filter(Boolean)),
    [cmoCommodityLines]
  );
  const commodity = ticket.commodityId ? commodities.find((c) => c.id === ticket.commodityId) : null;
  const cmoCommodity = cmoCommodityLines.length === 1
    ? commodities.find((c) => c.id === cmoCommodityLines[0].commodityId)
    : commodity;
  const weightUnit = commodity?.unitType ?? cmoCommodity?.unitType;
  const customer = ticket.accountType === "internal" && ticket.internalAccountId
    ? internalAccounts.find((acc) => acc.id === ticket.internalAccountId)
    : ticket.customerId
      ? customers.find((cust) => cust.id === ticket.customerId) || internalAccounts.find((acc) => acc.id === ticket.customerId)
      : null;

  const set = (key, val) => setTicket((prev) => ({ ...prev, [key]: val }));
  const setTest = (name, val) => setTicket((prev) => ({ ...prev, tests: { ...prev.tests, [name]: val } }));
  const locationValue = ticket[locationField] ?? "";

  const utilizationByLocation = useMemo(() => {
    const map = {};
    locationUtilization.forEach((u) => { map[u.locationId] = u; });
    return map;
  }, [locationUtilization]);

  const buildPrintSnapshot = () => {
    const cmoObj = ticket.cmoId ? cmos.find((c) => c.id === ticket.cmoId) : null;
    const commodityObj = ticket.commodityId ? commodities.find((c) => c.id === ticket.commodityId) : null;
    const commodityTypeObj = ticket.commodityTypeId
      ? commodityTypes.find((ct) => ct.id === ticket.commodityTypeId)
      : null;
    const locationObj = locationValue ? stockLocations.find((l) => l.id === locationValue) : null;
    let sitePrint = null;
    try {
      const authPayload = JSON.parse(localStorage.getItem("authPayload") || "{}");
      const site = authPayload.current_site;
      if (site) {
        sitePrint = {
          name: site.name ?? "",
          phone: site.phone ?? "",
          email: site.email ?? "",
          ticketPrintHeader: site.ticket_print_header ?? site.ticketPrintHeader ?? "",
          ticketPrintFooter: site.ticket_print_footer ?? site.ticketPrintFooter ?? "",
          ticketPrintLogo: site.ticket_print_logo ?? site.ticketPrintLogo ?? "",
        };
      }
    } catch {
      sitePrint = null;
    }
    return {
      ...ticket,
      type: ticketType,
      testsCatalog: tests,
      sitePrint,
      cmo: cmoObj ? { id: cmoObj.id, cmoReference: cmoObj.cmoReference } : null,
      commodity: commodityObj
        ? {
            id: commodityObj.id,
            commodityCode: commodityObj.commodityCode ?? commodityObj.commodity_code ?? "",
            description: commodityObj.description ?? "",
            unitType: commodityObj.unitType ?? commodityObj.unit_type ?? "MT",
            // Carry the test/group structure so the printout can break group
            // tests back out into their individual member tests + total.
            testThresholds: getCommodityThresholds(commodityObj),
          }
        : null,
      commodityType: commodityTypeObj ? { id: commodityTypeObj.id, name: commodityTypeObj.name } : null,
      customer: customer ? { id: customer.id, name: customer.name, code: customer.code } : null,
      location: locationObj
        ? { id: locationObj.id, name: locationObj.name, locationType: locationObj.locationType }
        : null,
    };
  };

  const savePrintSnapshot = async () => {
    if (!ticketNumericId) return;
    const snapshot = await enrichPrintSnapshot(buildPrintSnapshot());
    saveInTicketSnapshot(ticketNumericId, snapshot, ticketType);
  };

  const handlePrintNavigate = async (href) => {
    if (!href) return;
    await savePrintSnapshot();
    router.push(href);
  };

  const accountSelectValue =
    ticket.accountType === "internal" && ticket.internalAccountId
      ? `internal:${ticket.internalAccountId}`
      : ticket.customerId
        ? `customer:${ticket.customerId}`
        : "";

  const getLocationStock = (locationId) => {
    const stockItems = [];
    const locKey = String(locationId);
    completedTickets
      .filter((t) => {
        const tLoc = String(t.unloadedLocation || t.loadingLocation || t.stockLocationId || "");
        return t.type === ticketType && t.status === "completed" && tLoc === locKey;
      })
      .forEach((tk) => {
        const tCmo = cmos.find((c) => c.id === tk.cmoId);
        const tCommodityType = tCmo ? commodityTypes.find((ct) => ct.id === tCmo.commodityTypeId) : null;
        const gross = (tk.grossWeights || []).reduce((a, b) => a + b, 0);
        const tare = (tk.tareWeights || []).reduce((a, b) => a + b, 0);
        const netWeight = gross - tare;
        if (netWeight > 0 && tCommodityType) {
          const existingItem = stockItems.find((item) => item.commodityTypeId === tCommodityType.id);
          if (existingItem) existingItem.weight += netWeight;
          else
            stockItems.push({
              commodityTypeId: tCommodityType.id,
              commodityTypeName: tCommodityType.name,
              weight: netWeight,
            });
        }
      });
    return stockItems.filter((item) => item.weight > 0);
  };

  const validateLocationSelection = (locationId) => {
    if (!locationId || !ticket.commodityTypeId) return null;
    const stockItems = getLocationStock(locationId);
    const selectedCommodityType = commodityTypes.find((ct) => ct.id === ticket.commodityTypeId);
    if (stockItems.length === 0) return null;
    const differentCommodityTypes = stockItems.filter((item) => item.commodityTypeId !== ticket.commodityTypeId);
    if (differentCommodityTypes.length > 0) {
      const otherTypes = differentCommodityTypes.map((item) => item.commodityTypeName).join(", ");
      return `Warning: This location currently contains ${otherTypes}. You are trying to unload ${selectedCommodityType?.name}. Consider selecting an empty bin or a location with the same commodity type.`;
    }
    return null;
  };

  useEffect(() => {
    if (locationValue && ticket.cmoId) {
      setLocationWarning(validateLocationSelection(locationValue));
    } else {
      setLocationWarning(null);
    }
  }, [locationValue, ticket.cmoId, ticket.commodityTypeId, completedTickets, cmos, commodityTypes]);

  const getRemainingTonnage = (cmoId) => {
    if (!cmoId) return null;
    const selectedCmo = cmos.find((c) => c.id === cmoId);
    if (!selectedCmo) return null;
    const lines = getCmoCommodityLines(selectedCmo);
    const commodityForCmo = commodities.find(
      (c) => c.id === (ticket.commodityId || lines[0]?.commodityId || selectedCmo.commodityId)
    );
    const unit = commodityForCmo?.unitType ?? commodityForCmo?.unit_type;
    const totalReceivedKg = completedTickets
      .filter((t) => t.type === ticketType && t.status === "completed" && t.cmoId === cmoId)
      .reduce((sum, t) => {
        const netWeight =
          (t.grossWeights || []).reduce((a, b) => a + b, 0) - (t.tareWeights || []).reduce((a, b) => a + b, 0);
        return sum + netWeight;
      }, 0);
    const receivedFromTickets = displayFromStorageKg(totalReceivedKg, unit);
    const receivedDisplay = Number(selectedCmo.actualAmountDelivered) || receivedFromTickets;
    const remaining = selectedCmo.estimatedAmount - receivedDisplay;
    return {
      total: selectedCmo.estimatedAmount,
      received: receivedDisplay,
      remaining,
      unitLabel: weightUnitLabel(unit),
    };
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [formData, utilData] = await Promise.all([
          fetchTicketFormData(cmoDirection),
          fetchLocationUtilization().catch(() => []),
        ]);
        if (cancelled) return;
        setCmos(formData.cmos);
        setCustomers(formData.customers);
        setInternalAccounts(formData.internalAccounts);
        setCommodityTypes(formData.commodityTypes);
        setCommodities(formData.commodities);
        if (Array.isArray(formData.tests) && formData.tests.length > 0) setTests(formData.tests);
        setTrucks(formData.trucks);
        setStockLocations(formData.stockLocations);
        setUsers(formData.users);
        setCompletedTickets(formData.completedTickets);
        setLocationUtilization(utilData);

        if (mode === "edit" && routeTicketId) {
          const loaded = await fetchTicket(routeTicketId);
          if (!cancelled) setTicket((prev) => mergeTicketFromApi(prev, loaded));
        } else {
          setTicket(buildBlankTicket(ticketType));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load ticket.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mode, routeTicketId, cmoDirection, ticketType]);

  const addWeight = (type) => {
    set(type, [...ticket[type], 0]);
    const dateTimeType = type === "grossWeights" ? "grossWeightDateTimes" : "tareWeightDateTimes";
    set(dateTimeType, [...(ticket[dateTimeType] || []), ""]);
  };

  const updateWeight = (type, idx, val) => {
    const arr = [...ticket[type]];
    const prevValue = arr[idx];
    const newValue = val == null || val === "" ? 0 : Number(val) || 0;
    arr[idx] = newValue;
    set(type, arr);
    const dateTimeType = type === "grossWeights" ? "grossWeightDateTimes" : "tareWeightDateTimes";
    const dateTimeArr = [...(ticket[dateTimeType] || [])];
    if (!dateTimeArr[idx] && newValue > 0 && prevValue === 0) {
      dateTimeArr[idx] = nowDatetimeLocal();
      set(dateTimeType, dateTimeArr);
    }
  };

  const updateWeightDateTime = (type, idx, val) => {
    const dateTimeType = type === "grossWeights" ? "grossWeightDateTimes" : "tareWeightDateTimes";
    const arr = [...(ticket[dateTimeType] || [])];
    arr[idx] = val;
    set(dateTimeType, arr);
  };

  const removeWeight = (type, idx) => {
    set(
      type,
      ticket[type].filter((_, i) => i !== idx)
    );
    const dateTimeType = type === "grossWeights" ? "grossWeightDateTimes" : "tareWeightDateTimes";
    set(
      dateTimeType,
      (ticket[dateTimeType] || []).filter((_, i) => i !== idx)
    );
  };

  const grossTotal = useMemo(() => (ticket.grossWeights || []).reduce((a, b) => a + b, 0), [ticket.grossWeights]);
  const tareTotal = useMemo(() => (ticket.tareWeights || []).reduce((a, b) => a + b, 0), [ticket.tareWeights]);
  const netTotal = grossTotal - tareTotal;

  const requiresCommodityConfirmation = useMemo(
    () =>
      commodityTypeRequiresTestConfirmation({
        commodities,
        commodityTypeId: ticket.commodityTypeId,
        allowedCommodityIds,
        testsCatalog: tests,
        surface: testSurface,
      }),
    [commodities, ticket.commodityTypeId, allowedCommodityIds, tests, testSurface]
  );

  const confirmCommodity = () => {
    if (!ticket.commodityTypeId) return;
    const testsByName = buildTestsByName(tests);
    const sameCommodities = commodities.filter(
      (c) =>
        c.commodityTypeId === ticket.commodityTypeId &&
        c.status === "active" &&
        (allowedCommodityIds.size === 0 || allowedCommodityIds.has(c.id))
    );
    const commodityAnalysis = sameCommodities.map((comm) => {
      const thresholds = getCommodityThresholds(comm);
      const groupedNames = new Set();
      thresholds.filter((t) => t.parentGroupId).forEach((t) => groupedNames.add(t.name));
      const testResults = [];

      // Standalone (non-group) tests are validated against their own range, but
      // only when the test applies to this ticket surface and isn't part of a group.
      thresholds
        .filter(
          (t) =>
            !t.parentGroupId &&
            !groupedNames.has(t.name) &&
            testAppliesToSurface(t.name, testsByName, testSurface)
        )
        .forEach((t) => {
          const raw = ticket.tests[t.name];
          const testValue = Number(raw);
          const min = Number(t.min);
          const max = Number(t.max);
          const hasValue = raw !== "" && raw != null && !Number.isNaN(testValue);
          const isWithinRange = hasValue && testValue >= min && testValue <= max;
          testResults.push({ testName: t.name, value: testValue, min, max, hasValue, pass: isWithinRange });
        });

      // Group tests: the root row carries the range; the value is the sum of
      // its member tests.
      const groupMap = new Map();
      thresholds
        .filter((t) => t.parentGroupId)
        .forEach((t) => {
          if (!groupMap.has(t.parentGroupId)) groupMap.set(t.parentGroupId, { root: null, members: [] });
          const g = groupMap.get(t.parentGroupId);
          if (t.isGroupRoot) g.root = t;
          else g.members.push(t);
        });
      groupMap.forEach(({ root, members }) => {
        if (!root) return;
        if (!testAppliesToSurface(root.name, testsByName, testSurface)) return;
        const { total, hasValue } = sumGroupMembers(members, ticket.tests);
        const min = Number(root.min);
        const max = Number(root.max);
        const isWithinRange = hasValue && total >= min && total <= max;
        testResults.push({ testName: root.name, value: total, min, max, hasValue, pass: isWithinRange, isGroup: true });
      });

      const allTestsPass = testResults.length > 0 && testResults.every((r) => r.pass);
      return {
        commodityId: comm.id,
        commodityDescription: comm.description,
        testResults,
        matches: allTestsPass,
      };
    });
    const matchingCommodities = commodityAnalysis.filter((c) => c.matches);
    setTestResultsSummary(commodityAnalysis);
    setSuggestedCommodities(matchingCommodities);
    setOverrideReason("");
    setShowCommodityModal(true);
  };

  const commodityReady = requiresCommodityConfirmation ? ticket.commodityConfirmed : Boolean(ticket.commodityId);

  const completionBaseReady =
    ticket.cmoId &&
    ticket.truck &&
    grossTotal > 0 &&
    tareTotal > 0 &&
    ticket.signoffUserId &&
    (isIncoming ? ticket.unloadedLocation : ticket.loadingLocation);

  const pendingCommodityForCompletion = completionBaseReady && !commodityReady;

  const canComplete = completionBaseReady && commodityReady;

  const handleSave = async () => {
    try {
      setError("");
      const saved = await saveTicket({ ...ticket, type: ticketType });
      setTicket(saved);
      if (isCreate) {
        router.push(`${detailPathBase}/${saved.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const handleCompleteClick = () => {
    if (pendingCommodityForCompletion) {
      if (requiresCommodityConfirmation) {
        setError("Confirm the commodity grade before completing this ticket. Use Identify Commodity Grade to review test results and confirm.");
        confirmCommodity();
      } else {
        setError("Select an identified commodity before completing this ticket.");
      }
      return;
    }
    if (!canComplete) return;
    void handleComplete();
  };

  const handleComplete = async () => {
    try {
      setError("");
      let saved = await saveTicket({ ...ticket, type: ticketType });
      setTicket(saved);
      saved = await completeTicket(saved.id, saved);
      setTicket(saved);
      setCompletedTickets((prev) => [...prev.filter((t) => t.id !== saved.id), saved]);
      if (saved.cmoId) {
        const gross = (saved.grossWeights || []).reduce((a, b) => a + b, 0);
        const tare = (saved.tareWeights || []).reduce((a, b) => a + b, 0);
        const netMt = Math.max(0, gross - tare) / 1000;
        setCmos((prev) =>
          prev.map((cmo) =>
            cmo.id === saved.cmoId
              ? {
                  ...cmo,
                  actualAmountDelivered: Number((Number(cmo.actualAmountDelivered || 0) + netMt).toFixed(4)),
                }
              : cmo
          )
        );
      }
      setShowPrintConfirm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Complete failed.");
    }
  };

  const handleOverride = async () => {
    try {
      setError("");
      const updated = await overrideTicket(ticket.id, ticket);
      setTicket(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Override failed.");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading ticket…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[min(92rem,calc(100%-2rem))] space-y-3 px-5 pt-2 pb-10 font-sans sm:px-6 sm:pt-3 lg:px-8">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0f1e3d] md:text-[1.35rem]">
            {isCompleted ? "Completed" : isCreate ? "New" : "Edit"} {ticketLabel}{ticketDisplayRef ? ` — ${ticketDisplayRef}` : ""}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">{ticketSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {printHref ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="text-xs"
              onClick={() => void handlePrintNavigate(printHref)}
            >
              Print overview
            </Button>
          ) : null}
          {isCompleted ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="bg-amber-50 text-amber-900 hover:bg-amber-100"
                onClick={handleOverride}
              >
                Override
              </Button>
            </>
          ) : null}
          <Link href={listPath} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}>
            Back
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
        <div className="min-w-0 flex-1 space-y-4">
          <Card title="CMO & Booking">
            <div className="grid gap-x-4 gap-y-3 md:grid-cols-2">
              <FormRow label="CMO" required>
                <div className="flex gap-2">
                  <ClutchSelect
                    className="min-w-0 flex-1"
                    options={cmos
                      .filter((c) => c.direction === cmoDirection)
                      .map((c) => ({ value: c.id, label: `${c.cmoReference} - ${formatCmoCommoditySummary(c, commodities)}` }))}
                    value={(() => {
                      const filteredCmos = cmos.filter((c) => c.direction === cmoDirection);
                      const opt = filteredCmos.find((c) => String(c.id) === String(ticket.cmoId ?? ""));
                      return opt ? { value: opt.id, label: `${opt.cmoReference} - ${formatCmoCommoditySummary(opt, commodities)}` } : null;
                    })()}
                    isDisabled={isCompleted}
                    placeholder="Select CMO"
                    onChange={(option) => {
                      const cmoId = option ? option.value : null;
                      const selectedCmo = cmoId ? cmos.find((c) => c.id === cmoId) : null;
                      const lines = getCmoCommodityLines(selectedCmo);
                      const singleLine = lines.length === 1 ? lines[0] : null;
                      setTicket((prev) => ({
                        ...prev,
                        cmoId,
                        customerId: selectedCmo ? selectedCmo.customerId ?? prev.customerId : prev.customerId,
                        accountType: "customer",
                        internalAccountId: null,
                        commodityTypeId: selectedCmo ? selectedCmo.commodityTypeId ?? null : null,
                        commodityId: singleLine ? singleLine.commodityId ?? null : null,
                        season: selectedCmo?.season ?? "",
                        commodityConfirmed: false,
                        commodityOverrideReason: "",
                      }));
                    }}
                  />
                  {!isCompleted ? (
                    <button
                      type="button"
                      onClick={() => setShowCmoModal(true)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand text-lg font-medium leading-none text-white hover:bg-brand/90"
                      aria-label="Add CMO"
                    >
                      +
                    </button>
                  ) : null}
                </div>
              </FormRow>

              <FormRow label="Customer / Account">
                <ClutchSelect
                  options={[
                    ...customers.map((c) => ({ value: `customer:${c.id}`, label: `${c.name} (${c.code})` })),
                    ...internalAccounts.map((a) => ({ value: `internal:${a.id}`, label: a.name })),
                  ]}
                  value={accountSelectValue ? { value: accountSelectValue, label: (() => {
                    if (accountSelectValue.startsWith("internal:")) {
                      const id = accountSelectValue.slice("internal:".length);
                      const acc = internalAccounts.find((a) => String(a.id) === String(id));
                      return acc ? acc.name : accountSelectValue;
                    }
                    const id = accountSelectValue.slice("customer:".length);
                    const cust = customers.find((c) => String(c.id) === String(id));
                    return cust ? `${cust.name} (${cust.code})` : accountSelectValue;
                  })() } : null}
                  isDisabled={isCompleted}
                  placeholder="Select customer or account"
                  onChange={(option) => {
                    const v = option ? option.value : "";
                    if (!v) {
                      setTicket((prev) => ({
                        ...prev,
                        customerId: null,
                        internalAccountId: null,
                        accountType: "customer",
                      }));
                      return;
                    }
                    const [type, id] = v.split(":");
                    if (type === "internal") {
                      setTicket((prev) => ({
                        ...prev,
                        accountType: "internal",
                        internalAccountId: id,
                        customerId: null,
                      }));
                    } else {
                      setTicket((prev) => ({
                        ...prev,
                        accountType: "customer",
                        customerId: id,
                        internalAccountId: null,
                      }));
                    }
                  }}
                />
              </FormRow>

              <FormRow label="Commodity Type">
                {(() => {
                  const commodityTypeOptions = commodityTypes
                    .filter((ct) => !cmo || allowedCommodityTypeIds.size === 0 || allowedCommodityTypeIds.has(ct.id))
                    .map((ct) => ({ value: ct.id, label: ct.name }));
                  return (
                    <ClutchSelect
                      options={commodityTypeOptions}
                      value={commodityTypeOptions.find((o) => String(o.value) === String(ticket.commodityTypeId ?? "")) ?? null}
                      isDisabled={isCompleted}
                      placeholder="Select commodity type"
                      onChange={(option) => {
                        const v = option ? option.value : null;
                        set("commodityTypeId", v || null);
                        set("commodityId", null);
                        set("commodityConfirmed", false);
                        set("commodityOverrideReason", "");
                      }}
                    />
                  );
                })()}
              </FormRow>

              <FormRow label="Identified Commodity Grade">
                {(() => {
                  const identifiedCommodityOptions = commodities
                    .filter(
                      (c) =>
                        c.status === "active" &&
                        (!ticket.commodityTypeId || c.commodityTypeId === ticket.commodityTypeId) &&
                        (!cmo || allowedCommodityIds.size === 0 || allowedCommodityIds.has(c.id))
                    )
                    .map((c) => ({ value: c.id, label: commodityOptionLabel(c) }));
                  return (
                    <ClutchSelect
                      options={identifiedCommodityOptions}
                      value={identifiedCommodityOptions.find((o) => String(o.value) === String(ticket.commodityId ?? "")) ?? null}
                      isDisabled={isCompleted || !ticket.commodityTypeId}
                      placeholder="Select commodity grade"
                      onChange={(option) => {
                        const v = option ? option.value : null;
                        set("commodityId", v || null);
                        set("commodityConfirmed", false);
                        set("commodityOverrideReason", "");
                      }}
                    />
                  );
                })()}
              </FormRow>
            </div>

            {ticket.cmoId && cmo ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">CMO details</div>
                <div className="mt-2 grid gap-2 text-xs text-slate-800 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500">Reference</div>
                    <div className="font-semibold text-[#0f1e3d]">{cmo.cmoReference || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500">Customer / account</div>
                    <div>{customer?.name || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500">CMO commodities</div>
                    <div>{formatCmoCommoditySummary(cmo, commodities)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500">Status</div>
                    <div>{cmo.status || "-"}</div>
                  </div>
                </div>
                <div className="mt-2 border-t border-slate-200 pt-2">
                  <div className="text-[10px] font-semibold text-slate-500">Note</div>
                  <div className="mt-0.5 whitespace-pre-wrap text-xs text-slate-800">{(cmo.note ?? "").trim() || "-"}</div>
                </div>
                {getRemainingTonnage(ticket.cmoId) ? (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 pt-2 text-[11px] text-slate-600">
                    <span>
                      <strong className="text-slate-800">Estimated:</strong>{" "}
                      {getRemainingTonnage(ticket.cmoId).total.toLocaleString()}{" "}
                      {getRemainingTonnage(ticket.cmoId).unitLabel}
                    </span>
                    <span>
                      <strong className="text-slate-800">Received:</strong>{" "}
                      {getRemainingTonnage(ticket.cmoId).received.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 3,
                      })}{" "}
                      {getRemainingTonnage(ticket.cmoId).unitLabel}
                    </span>
                    <span>
                      <strong className="text-[#0f1e3d]">Remaining:</strong>{" "}
                      {getRemainingTonnage(ticket.cmoId).remaining.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 3,
                      })}{" "}
                      {getRemainingTonnage(ticket.cmoId).unitLabel}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card title="Truck & Weights">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end">
              <FormRow label="Truck" required>
                <div className="flex gap-2">
                  <ClutchSelect
                    className="min-w-0 flex-1"
                    options={trucks.map((t) => ({ value: t.id, label: `${t.name} (${t.driver})` }))}
                    value={trucks.find((tr) => String(tr.id) === String(ticket.truck?.id ?? ""))
                      ? { value: ticket.truck.id, label: `${ticket.truck.name} (${ticket.truck.driver})` }
                      : null}
                    isDisabled={isCompleted}
                    placeholder="Select truck"
                    onChange={(option) => {
                      const t = option ? trucks.find((tr) => tr.id === option.value) : null;
                      setTicket((prev) => ({ ...prev, truck: t || null, truckId: t?.id ?? null }));
                    }}
                  />
                  {!isCompleted ? (
                    <button
                      type="button"
                      onClick={() => setShowTruckModal(true)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand text-lg font-medium leading-none text-white hover:bg-brand/90"
                      aria-label="Add truck"
                    >
                      +
                    </button>
                  ) : null}
                </div>
              </FormRow>
              <FormRow label="Split Load">
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ticket.splitLoad}
                    disabled={isCompleted}
                    onClick={() => !isCompleted && set("splitLoad", !ticket.splitLoad)}
                    className={cn(
                      "relative h-[22px] w-10 shrink-0 rounded-full transition-colors",
                      ticket.splitLoad ? "bg-brand" : "bg-slate-300",
                      isCompleted && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-[left]",
                        ticket.splitLoad ? "left-5" : "left-0.5"
                      )}
                    />
                  </button>
                  <span className="text-xs text-slate-500">Split Load</span>
                </div>
              </FormRow>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {isIncoming ? (
                <>
                  <WeightSection
                    label="Gross Weight"
                    weights={ticket.grossWeights}
                    dateTimes={ticket.grossWeightDateTimes}
                    total={grossTotal}
                    unitType={weightUnit}
                    splitLoad={ticket.splitLoad}
                    disabled={isCompleted}
                    hideTotal
                    onAdd={() => addWeight("grossWeights")}
                    onUpdate={(i, storageKg) => updateWeight("grossWeights", i, storageKg)}
                    onUpdateDateTime={(i, v) => updateWeightDateTime("grossWeights", i, v)}
                    onRemove={(i) => removeWeight("grossWeights", i)}
                  />
                  <WeightSection
                    label="Tare Weight"
                    weights={ticket.tareWeights}
                    dateTimes={ticket.tareWeightDateTimes}
                    total={tareTotal}
                    unitType={weightUnit}
                    splitLoad={ticket.splitLoad}
                    disabled={isCompleted}
                    hideTotal
                    onAdd={() => addWeight("tareWeights")}
                    onUpdate={(i, storageKg) => updateWeight("tareWeights", i, storageKg)}
                    onUpdateDateTime={(i, v) => updateWeightDateTime("tareWeights", i, v)}
                    onRemove={(i) => removeWeight("tareWeights", i)}
                  />
                </>
              ) : (
                <>
                  <WeightSection
                    label="Tare Weight"
                    weights={ticket.tareWeights}
                    dateTimes={ticket.tareWeightDateTimes}
                    total={tareTotal}
                    unitType={weightUnit}
                    splitLoad={ticket.splitLoad}
                    disabled={isCompleted}
                    hideTotal
                    onAdd={() => addWeight("tareWeights")}
                    onUpdate={(i, storageKg) => updateWeight("tareWeights", i, storageKg)}
                    onUpdateDateTime={(i, v) => updateWeightDateTime("tareWeights", i, v)}
                    onRemove={(i) => removeWeight("tareWeights", i)}
                  />
                  <WeightSection
                    label="Gross Weight"
                    weights={ticket.grossWeights}
                    dateTimes={ticket.grossWeightDateTimes}
                    total={grossTotal}
                    unitType={weightUnit}
                    splitLoad={ticket.splitLoad}
                    disabled={isCompleted}
                    hideTotal
                    onAdd={() => addWeight("grossWeights")}
                    onUpdate={(i, storageKg) => updateWeight("grossWeights", i, storageKg)}
                    onUpdateDateTime={(i, v) => updateWeightDateTime("grossWeights", i, v)}
                    onRemove={(i) => removeWeight("grossWeights", i)}
                  />
                </>
              )}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {isIncoming ? (
                <>
                  <WeightSummaryBadge label="Gross Weight" total={grossTotal} unitType={weightUnit} variant="gross" />
                  <WeightSummaryBadge label="Tare Weight" total={tareTotal} unitType={weightUnit} variant="tare" />
                </>
              ) : (
                <>
                  <WeightSummaryBadge label="Tare Weight" total={tareTotal} unitType={weightUnit} variant="tare" />
                  <WeightSummaryBadge label="Gross Weight" total={grossTotal} unitType={weightUnit} variant="gross" />
                </>
              )}
              <WeightSummaryBadge label="Net Weight" total={netTotal} unitType={weightUnit} variant="net" />
            </div>

            {tareTotal > grossTotal && grossTotal > 0 ? (
              <div className="mt-3 rounded-md border border-yellow-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <strong className="block text-sm">Weight warning</strong>
                Tare weight exceeds gross weight. Please verify the weight entries.
              </div>
            ) : null}
          </Card>

          {ticket.commodityTypeId && requiresCommodityConfirmation ? (
            <Card title="Test Results">
              <TestResultsSection
                commodityTypeId={ticket.commodityTypeId}
                commodities={commodities}
                allowedCommodityIds={allowedCommodityIds}
                testsCatalog={tests}
                surface={testSurface}
                testValues={ticket.tests}
                disabled={isCompleted}
                onChange={setTest}
                showValidationHints
                validHintLabel="Valid for some commodities"
                invalidHintLabel="Not valid for any commodity"
                emptyMessage="No tests are configured for this commodity type."
              />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" disabled={isCompleted || ticket.commodityConfirmed} onClick={confirmCommodity}>
                  {ticket.commodityConfirmed ? "Commodity Grade Confirmed" : "Identify Commodity Grade"}
                </Button>
                {ticket.commodityConfirmed && commodity ? (
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {commodity.commodityCode ?? commodity.commodity_code ?? commodity.description}
                  </span>
                ) : null}
                {ticket.commodityConfirmed && ticket.commodityOverrideReason ? (
                  <span className="text-[11px] text-amber-800">Override: {ticket.commodityOverrideReason}</span>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="w-full shrink-0 space-y-4 lg:w-[280px]">
          <Card title="Details">
            <FormRow label="Ticket Date" required>
              <input
                className={inputClass}
                type="date"
                value={ticket.date || ""}
                disabled={isCompleted}
                onChange={(e) => set("date", e.target.value)}
              />
            </FormRow>
            {ticket.id || ticketDisplayRef ? (
              <FormRow label="Ticket number">
                <input
                  className={`${inputClass} bg-slate-50 text-slate-600`}
                  value={ticketDisplayRef}
                  readOnly
                  disabled
                  placeholder={ticket.id ? "—" : "Assigned on save"}
                />
              </FormRow>
            ) : isCreate ? (
              <FormRow label="Ticket number">
                <input className={`${inputClass} bg-slate-50 text-slate-500`} value="" readOnly disabled placeholder="Assigned on save" />
              </FormRow>
            ) : null}
            <FormRow label="Booking Ref">
              <input
                className={inputClass}
                value={ticket.bookingRef || ""}
                disabled={isCompleted}
                onChange={(e) => set("bookingRef", e.target.value)}
                placeholder="Enter booking reference…"
              />
            </FormRow>
            <FormRow label="Ticket Ref">
              <input
                className={inputClass}
                value={ticket.ticketRef || ""}
                disabled={isCompleted}
                onChange={(e) => set("ticketRef", e.target.value)}
                placeholder="Enter ticket reference…"
              />
            </FormRow>
            <FormRow label="NGR">
              <input
                className={inputClass}
                value={ticket.ngr || ""}
                disabled={isCompleted}
                onChange={(e) => set("ngr", e.target.value)}
                placeholder="Optional"
              />
            </FormRow>
            <FormRow label="Season">
              <SeasonSelect
                value={ticket.season || ""}
                isDisabled={isCompleted}
                placeholder="Select season..."
                onChange={(v) => set("season", v)}
              />
            </FormRow>
            <FormRow label="Additional Reference">
              <input
                className={inputClass}
                value={ticket.additionalReference}
                disabled={isCompleted}
                onChange={(e) => set("additionalReference", e.target.value)}
                placeholder="Enter additional reference..."
              />
            </FormRow>
            <FormRow label="Signoff">
              {(() => {
                const signoffOptions = users.filter((u) => u.active).map((u) => ({ value: u.id, label: u.name }));
                return (
                  <ClutchSelect
                    options={signoffOptions}
                    value={signoffOptions.find((o) => String(o.value) === String(ticket.signoffUserId ?? "")) ?? null}
                    isDisabled={isCompleted}
                    placeholder="Select user"
                    onChange={(option) => {
                      const userId = option ? option.value : "";
                      const user = option ? users.find((u) => u.id === option.value) : null;
                      setTicket((prev) => ({
                        ...prev,
                        signoffUserId: userId,
                        signoff: user?.name ?? "",
                      }));
                    }}
                  />
                );
              })()}
            </FormRow>
            <FormRow label={isIncoming ? "Unloaded Location" : "Loading Location"} required>
              {(() => {
                const locationOptions = stockLocations
                  .filter((loc) => (loc.status ?? "active").toLowerCase() === "active")
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((loc) => {
                    const util = utilizationByLocation[loc.id];
                    const stockItems = util ? [] : getLocationStock(loc.id);
                    const suffix = formatLocationStockSuffix(util, stockItems);
                    return { value: loc.id, label: `${loc.name} (${loc.locationType})${suffix}` };
                  });
                return (
                  <ClutchSelect
                    options={locationOptions}
                    value={locationOptions.find((o) => String(o.value) === String(locationValue)) ?? null}
                    isDisabled={isCompleted || !ticket.cmoId}
                    placeholder="Select location"
                    onChange={(option) => {
                      const locId = option ? option.value : "";
                      set(locationField, locId);
                      setLocationWarning(locId ? validateLocationSelection(locId) : null);
                    }}
                  />
                );
              })()}
              {locationWarning ? (
                <div className="mt-2 rounded-md border border-yellow-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  <strong className="block text-sm">Location warning</strong>
                  {locationWarning}
                </div>
              ) : null}
            </FormRow>

            {locationValue ? (
              <LocationSnapshotPanel
                locationName={stockLocations.find((l) => l.id === locationValue)?.name}
                locationType={stockLocations.find((l) => l.id === locationValue)?.locationType}
                util={utilizationByLocation[locationValue]}
              />
            ) : null}

            <FormRow label="Notes">
              <textarea
                className={cn(inputClass, "min-h-[60px] resize-y")}
                value={ticket.notes}
                disabled={isCompleted}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Add notes..."
              />
            </FormRow>
          </Card>

          <Card title="Actions">
            <div className="flex flex-col gap-2">
              {!isCompleted ? (
                <>
                  <Button
                    type="button"
                    className="w-full justify-center"
                    disabled={!canComplete && !pendingCommodityForCompletion}
                    onClick={handleCompleteClick}
                  >
                    Complete Ticket
                  </Button>
                  <Button type="button" variant="outline" className="w-full justify-center" onClick={handleSave}>
                    Save Draft
                  </Button>
                </>
              ) : null}
              {!isCompleted && ticketNumericId ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full justify-center"
                  onClick={async () => {
                    if (typeof window !== "undefined" && window.confirm("Remove this ticket?")) {
                      try {
                        await deleteTicket(ticketNumericId);
                        router.push(listPath);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Delete failed.");
                      }
                    }
                  }}
                >
                  Remove Ticket
                </Button>
              ) : null}
              {pendingCommodityForCompletion ? (
                <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-900">
                  <span className="font-semibold">Commodity grade confirmation required.</span>{" "}
                  {requiresCommodityConfirmation
                    ? "All other requirements are met. Use Identify Commodity Grade to confirm the grade before completing this ticket."
                    : "All other requirements are met. Select an identified commodity before completing this ticket."}
                </p>
              ) : !canComplete && !isCompleted ? (
                <p className="mt-1 text-[11px] leading-snug text-slate-500">
                  <span className="font-semibold text-slate-600">Required:</span> CMO, truck, gross &amp; tare weights,
                  {requiresCommodityConfirmation ? " commodity grade confirmed," : " commodity grade,"} signoff, and{" "}
                  {isIncoming ? "unload" : "load"} location.
                </p>
              ) : null}
            </div>
          </Card>

          {ticketNumericId && isCompleted ? (
            <Card title="Transactions">
              <TransactionInfo ticketId={ticketNumericId} ticketStatus={ticket.status} />
            </Card>
          ) : null}
        </div>
      </div>

      <Modal open={showCmoModal} title={`Create New CMO (${isIncoming ? "Incoming" : "Outgoing"})`} onClose={() => setShowCmoModal(false)}>
        <FormRow label="CMO Reference" required>
          <input
            className={inputClass}
            value={newCmo.cmoReference}
            onChange={(e) => setNewCmo({ ...newCmo, cmoReference: e.target.value })}
            placeholder="e.g. CMO-0142"
          />
        </FormRow>
        <FormRow label="Customer / Account" required>
          {(() => {
            const cmoCustomerOptions = [
              ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
              ...internalAccounts.map((a) => ({ value: a.id, label: a.name })),
            ];
            return (
              <ClutchSelect
                options={cmoCustomerOptions}
                value={cmoCustomerOptions.find((o) => String(o.value) === String(newCmo.customerId)) ?? null}
                placeholder="Select customer or account"
                onChange={(option) => setNewCmo({ ...newCmo, customerId: option ? option.value : "" })}
              />
            );
          })()}
        </FormRow>

        <FormRow label="Commodity Type" required>
          {(() => {
            const cmoCommodityTypeOptions = commodityTypes.map((t) => ({ value: t.id, label: t.name }));
            return (
              <ClutchSelect
                options={cmoCommodityTypeOptions}
                value={cmoCommodityTypeOptions.find((o) => String(o.value) === String(newCmo.commodityTypeId)) ?? null}
                placeholder="Select commodity type"
                onChange={(option) => setNewCmo({ ...newCmo, commodityTypeId: option ? option.value : "", commodityIds: [] })}
              />
            );
          })()}
        </FormRow>
        <FormRow label="Commodity Grades" required>
          {!newCmo.commodityTypeId ? (
            <p className="text-xs text-slate-500">Select a commodity type first.</p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
              {commodities
                .filter(
                  (c) =>
                    c.status === "active" &&
                    (!newCmo.commodityTypeId || c.commodityTypeId === newCmo.commodityTypeId)
                )
                .map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300"
                      checked={newCmo.commodityIds.includes(c.id)}
                      onChange={() =>
                        setNewCmo((prev) => ({
                          ...prev,
                          commodityIds: prev.commodityIds.includes(c.id)
                            ? prev.commodityIds.filter((id) => id !== c.id)
                            : [...prev.commodityIds, c.id],
                        }))
                      }
                    />
                    <span>{commodityOptionLabel(c)}</span>
                  </label>
                ))}
            </div>
          )}
        </FormRow>
        <FormRow label="Season">
          <SeasonSelect
            value={newCmo.season}
            placeholder="Select season..."
            onChange={(v) => setNewCmo({ ...newCmo, season: v })}
          />
        </FormRow>
        <FormRow
          label={`Estimated Amount${
            newCmo.commodityIds[0]
              ? ` (${weightUnitLabel(commodities.find((c) => c.id === newCmo.commodityIds[0])?.unitType)})`
              : ""
          }`}
        >
          <input
            className={inputClass}
            type="number"
            value={newCmo.estimatedAmount}
            onChange={(e) => setNewCmo({ ...newCmo, estimatedAmount: e.target.value })}
            placeholder="0"
          />
        </FormRow>
        <FormRow label="Note">
          <input
            className={inputClass}
            value={newCmo.note}
            onChange={(e) => setNewCmo({ ...newCmo, note: e.target.value })}
            placeholder="Optional notes"
          />
        </FormRow>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowCmoModal(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              if (!newCmo.customerId || !newCmo.commodityTypeId || newCmo.commodityIds.length === 0) return;
              try {
                setError("");
                const created = await saveCmo({
                  cmoReference: newCmo.cmoReference,
                  direction: cmoDirection,
                  customerId: newCmo.customerId,
                  commodityTypeId: newCmo.commodityTypeId,
                  commodityIds: newCmo.commodityIds,
                  status: newCmo.status || "Open",
                  season: newCmo.season || null,
                  estimatedAmount: Number(newCmo.estimatedAmount) || 0,
                  note: newCmo.note,
                });
                setCmos((prev) => [...prev, created]);
                const lines = getCmoCommodityLines(created);
                const singleLine = lines.length === 1 ? lines[0] : null;
                setTicket((prev) => ({
                  ...prev,
                  cmoId: created.id,
                  customerId: created.customerId,
                  commodityTypeId: created.commodityTypeId,
                  commodityId: singleLine ? singleLine.commodityId : null,
                  season: created.season ?? "",
                  commodityConfirmed: false,
                  commodityOverrideReason: "",
                }));
                setShowCmoModal(false);
                setNewCmo({
                  cmoReference: "",
                  direction: cmoDirection,
                  customerId: "",
                  commodityTypeId: "",
                  commodityIds: [],
                  status: "Open",
                  season: "",
                  estimatedAmount: "",
                  note: "",
                  attachments: [],
                });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to create CMO.");
              }
            }}
          >
            Create CMO
          </Button>
        </div>
      </Modal>

      <Modal open={showTruckModal} title="Add New Truck" onClose={() => setShowTruckModal(false)}>
        <FormRow label="Rego" required>
          <input
            className={inputClass}
            value={newTruck.name}
            onChange={(e) => setNewTruck({ ...newTruck, name: e.target.value.toUpperCase() })}
            placeholder="e.g. TRK-006"
          />
        </FormRow>
        <FormRow label="Driver">
          <input
            className={inputClass}
            value={newTruck.driver}
            onChange={(e) => setNewTruck({ ...newTruck, driver: e.target.value })}
            placeholder="Driver name"
          />
        </FormRow>
        <FormRow label="Tare Weight (t)">
          <input
            className={inputClass}
            type="number"
            value={newTruck.tare}
            onChange={(e) => setNewTruck({ ...newTruck, tare: e.target.value })}
            placeholder="0"
          />
        </FormRow>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowTruckModal(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              if (!newTruck.name.trim()) return;
              try {
                setError("");
                const created = await saveTruck({
                  name: newTruck.name.trim().toUpperCase(),
                  driver: newTruck.driver.trim(),
                  tare: newTruck.tare,
                });
                setTrucks((prev) => [...prev, created]);
                setTicket((prev) => ({ ...prev, truck: created, truckId: created.id }));
                setShowTruckModal(false);
                setNewTruck({ name: "", driver: "", tare: "" });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to create truck.");
              }
            }}
          >
            Add Truck
          </Button>
        </div>
      </Modal>

      <Modal open={showCommodityModal} title="Commodity Grade Identification" wide onClose={() => setShowCommodityModal(false)}>
        <CommodityIdentificationBody
          suggestedCommodities={suggestedCommodities}
          testResultsSummary={testResultsSummary}
          commodities={commodities}
          allowedCommodityIds={allowedCommodityIds}
          ticket={ticket}
          set={set}
          overrideReason={overrideReason}
          setOverrideReason={setOverrideReason}
          onClose={() => setShowCommodityModal(false)}
        />
      </Modal>

      <Modal open={showPrintConfirm} title="Ticket Completed" onClose={() => setShowPrintConfirm(false)}>
        <p className="text-center text-sm text-slate-800">The ticket has been completed successfully.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const href = ticket.id ? `${detailPathBase}/${ticket.id}/print?print=1` : listPath;
              setShowPrintConfirm(false);
              void handlePrintNavigate(href);
            }}
          >
            Print Ticket
          </Button>
          <Link
            href={ticket.id ? `${detailPathBase}/${ticket.id}` : listPath}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex items-center justify-center")}
            onClick={() => setShowPrintConfirm(false)}
          >
            Skip Print
          </Link>
        </div>
      </Modal>
    </div>
  );
}

function CommodityIdentificationBody({
  suggestedCommodities,
  testResultsSummary,
  commodities,
  allowedCommodityIds,
  ticket,
  set,
  overrideReason,
  setOverrideReason,
  onClose,
}) {
  return (
    <>
      <div className="mb-4">
        {suggestedCommodities.length > 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-800">
              {suggestedCommodities.length === 1 ? "Suggested Commodity Grade:" : "Matching Commodity Grades:"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {suggestedCommodities
                .map((c) => commodities.find((comm) => comm.id === c.commodityId)?.description)
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-yellow-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">No commodity grade matches all test results</p>
            <p className="mt-1 text-xs text-amber-950/90">You can still select a commodity with an override reason</p>
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Test Results Analysis</div>
        <div className="flex flex-col gap-2">
          {testResultsSummary.map((commodityAnalysis, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-lg border-2 px-3 py-2",
                commodityAnalysis.matches ? "border-emerald-200 bg-emerald-50/80" : "border-red-200 bg-red-50/80"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">{commodityAnalysis.commodityDescription}</span>
                <span className={cn("text-[11px] font-semibold", commodityAnalysis.matches ? "text-emerald-700" : "text-red-700")}>
                  {commodityAnalysis.matches ? "MATCH" : "NO MATCH"}
                </span>
              </div>
              {commodityAnalysis.testResults.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1">
                  {commodityAnalysis.testResults.map((test, tIdx) => (
                    <div key={tIdx} className="flex justify-between pl-2 text-[11px] text-slate-600">
                      <span>
                        <span className={cn("mr-1 font-semibold", test.pass ? "text-emerald-700" : "text-red-700")}>
                          {test.pass ? "PASS" : "FAIL"}:
                        </span>
                        {test.testName}
                      </span>
                      <span>
                        Value:{" "}
                        <strong className={test.pass ? "text-emerald-700" : "text-red-700"}>{test.hasValue ? test.value : "-"}</strong>
                        {" · "}
                        Range:{" "}
                        <strong>
                          {test.min}-{test.max}
                        </strong>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <FormRow label="Confirm Commodity Grade" required>
        {(() => {
          const confirmCommodityOptions = commodities
            .filter(
              (c) =>
                c.commodityTypeId === ticket.commodityTypeId &&
                c.status === "active" &&
                (!allowedCommodityIds || allowedCommodityIds.size === 0 || allowedCommodityIds.has(c.id))
            )
            .map((comm) => {
              const isSuggested = suggestedCommodities.some((s) => s.commodityId === comm.id);
              return { value: comm.id, label: `${commodityOptionLabel(comm)}${isSuggested ? " (Suggested)" : ""}` };
            });
          return (
            <ClutchSelect
              options={confirmCommodityOptions}
              value={confirmCommodityOptions.find((o) => String(o.value) === String(ticket.commodityId ?? "")) ?? null}
              placeholder="Select commodity grade"
              onChange={(option) => set("commodityId", option ? option.value : null)}
            />
          );
        })()}
      </FormRow>

      {ticket.commodityId && !suggestedCommodities.some((s) => s.commodityId === ticket.commodityId) ? (
        <FormRow label="Override Reason" required>
          <textarea
            className={cn(inputClass, "min-h-[72px] resize-y")}
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Explain why you're selecting a different commodity grade..."
            rows={3}
          />
        </FormRow>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        {ticket.commodityId && suggestedCommodities.some((s) => s.commodityId === ticket.commodityId) ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              set("commodityConfirmed", true);
              set("commodityOverrideReason", "");
              onClose();
            }}
          >
            Confirm {commodityOptionLabel(commodities.find((c) => c.id === ticket.commodityId))}
          </Button>
        ) : null}
        {ticket.commodityId && !suggestedCommodities.some((s) => s.commodityId === ticket.commodityId) ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!overrideReason.trim()}
            onClick={() => {
              if (!overrideReason.trim()) {
                alert("Please provide an override reason for selecting a different commodity");
                return;
              }
              set("commodityConfirmed", true);
              set("commodityOverrideReason", overrideReason);
              onClose();
            }}
          >
            Override & Confirm
          </Button>
        ) : null}
      </div>
    </>
  );
}

function WeightSummaryBadge({ label, total, unitType, variant }) {
  const totalFormatted = formatWeightFromStorageKg(total, unitType);
  const hasTotal = total > 0;

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-slate-200/90 bg-slate-50/50 px-3 py-2.5">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>
      <span
        className={cn(
          "inline-flex items-baseline gap-1 rounded-md px-2.5 py-1 text-base font-bold tabular-nums shadow-sm",
          hasTotal
            ? variant === "gross"
              ? "bg-[#0f1e3d] text-white"
              : variant === "tare"
                ? "bg-amber-100 text-amber-950 ring-1 ring-amber-300/70"
                : "bg-emerald-600 text-white"
            : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
        )}
      >
        {hasTotal ? (
          <>
            {totalFormatted.formatted}
            <span
              className={cn(
                "text-xs font-semibold",
                variant === "gross" || variant === "net" ? "text-white/80" : "text-amber-800/80"
              )}
            >
              {totalFormatted.unit}
            </span>
          </>
        ) : (
          <span className="text-sm font-medium">—</span>
        )}
      </span>
    </div>
  );
}

function WeightSection({
  label,
  weights,
  dateTimes,
  total,
  unitType,
  splitLoad,
  disabled,
  hideTotal,
  onAdd,
  onUpdate,
  onUpdateDateTime,
  onRemove,
}) {
  const displayWeights = weights.length === 0 ? [0] : weights;
  const displayDateTimes = dateTimes || [];
  const unitLabel = weightUnitLabel(unitType);
  const totalFormatted = formatWeightFromStorageKg(total, unitType);
  const isGross = label.toLowerCase().includes("gross");
  const hasTotal = total > 0;

  return (
    <div className="mt-3">
      {!hideTotal ? (
        <div className="mb-2 flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>
          <span
            className={cn(
              "inline-flex items-baseline gap-1 rounded-md px-2.5 py-1 text-base font-bold tabular-nums shadow-sm",
              hasTotal
                ? isGross
                  ? "bg-[#0f1e3d] text-white"
                  : "bg-amber-100 text-amber-950 ring-1 ring-amber-300/70"
                : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
            )}
          >
            {hasTotal ? (
              <>
                {totalFormatted.formatted}
                <span
                  className={cn(
                    "text-xs font-semibold",
                    hasTotal && isGross ? "text-white/80" : hasTotal ? "text-amber-800/80" : ""
                  )}
                >
                  {totalFormatted.unit}
                </span>
              </>
            ) : (
              <span className="text-sm font-medium">—</span>
            )}
          </span>
        </div>
      ) : (
        <div className="mb-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>
        </div>
      )}
      <div className="flex flex-wrap items-start gap-2.5">
        {displayWeights.map((w, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/90 p-2">
            <div className="grid gap-2 md:grid-cols-[110px_180px_auto] md:items-end">
              <div>
                <label className="mb-1 block text-[10px] font-semibold text-slate-500">Weight ({unitLabel})</label>
                <input
                  className={cn(inputClass, "w-[110px] text-sm")}
                  type="number"
                  disabled={disabled}
                  placeholder="0"
                  value={
                    w != null && w !== "" && Number(w) !== 0
                      ? String(displayFromStorageKg(w, unitType))
                      : ""
                  }
                  onChange={(e) =>
                    onUpdate(i, e.target.value === "" ? null : storageKgFromDisplay(e.target.value, unitType))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold text-slate-500">Date &amp; Time</label>
                <input
                  type="datetime-local"
                  disabled={disabled}
                  value={displayDateTimes[i] || ""}
                  onChange={(e) => onUpdateDateTime(i, e.target.value)}
                  className={cn(inputClass, "w-[180px] text-xs")}
                />
              </div>
              {splitLoad && !disabled && weights.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="h-8 self-end px-1 text-lg leading-none text-red-600 hover:text-red-800"
                  aria-label="Remove line"
                >
                  x
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {!disabled && splitLoad ? (
          <button
            type="button"
            onClick={onAdd}
            className="mt-6 rounded-md border border-dashed border-indigo-300 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            + Add
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-slate-200/95 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wide text-[#0f1e3d]">{title}</span>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  );
}

function FormRow({ label, required, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function Modal({ open, title, wide, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "relative max-h-[min(90vh,720px)] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl",
          wide ? "max-w-[700px]" : "max-w-md"
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="modal-title" className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onClose}>
            x
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function LocationSnapshotPanel({ locationName, locationType, util }) {
  if (!locationName) return null;

  const capacity = Number(util?.capacity ?? 0);
  const totalStock = Number(util?.totalStock ?? 0);
  const utilizationPct =
    util?.utilizationPct != null
      ? util.utilizationPct
      : capacity > 0
        ? parseFloat(((totalStock / capacity) * 100).toFixed(2))
        : null;
  const commodities = util?.commodities ?? [];

  const barColor =
    utilizationPct == null ? "bg-slate-300"
      : utilizationPct >= 90 ? "bg-red-500"
        : utilizationPct >= 70 ? "bg-amber-400"
          : "bg-emerald-500";
  const textColor =
    utilizationPct == null ? "text-slate-400"
      : utilizationPct >= 90 ? "text-red-600"
        : utilizationPct >= 70 ? "text-amber-600"
          : "text-emerald-600";

  const remaining = capacity > 0 ? capacity - totalStock : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className={cn("shrink-0 text-sm font-bold tabular-nums text-brand")}>
          {totalStock.toFixed(2)}
          <span className="ml-0.5 text-[10px] font-medium text-slate-400">MT</span>
        </span>

        {capacity > 0 && utilizationPct != null && (
          <>
            <div className="min-w-0 flex-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn("h-full transition-all duration-300", barColor)}
                  style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                />
              </div>
            </div>
            <span className={cn("shrink-0 text-[11px] font-bold tabular-nums", textColor)}>
              {Math.round(utilizationPct)}%
            </span>
          </>
        )}
      </div>

      {remaining != null && (
        <p className="mt-1 text-[10px] text-slate-400">
          {remaining > 0 ? `${remaining.toFixed(1)} T remaining` : "At capacity"}
        </p>
      )}

      {/* Commodity pills */}
      {commodities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {commodities.slice(0, 3).map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
            >
              {item.commodityName}
              <span className="font-semibold text-brand">{Number(item.total).toFixed(1)}</span>
              <span className="text-[9px] text-slate-400">MT</span>
            </span>
          ))}
          {commodities.length > 3 && (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-400">
              +{commodities.length - 3} more
            </span>
          )}
        </div>
      )}

      {commodities.length === 0 && (
        <p className="mt-1 text-[11px] italic text-slate-400">No stock currently stored</p>
      )}
    </div>
  );
}

function TransactionInfo({ ticketId, ticketStatus }) {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticketId || ticketStatus !== "completed") {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchTransactions({ ticketId });
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [ticketId, ticketStatus]);

  if (loading) {
    return <div className="text-xs italic text-slate-500">Loading transactions...</div>;
  }

  if (rows.length === 0) {
    return <div className="text-xs italic text-slate-500">No transactions recorded for this ticket yet.</div>;
  }

  const activeTransactions = rows.filter((t) => t.status === "active");
  const hasAdjustments = rows.some((t) => t.status === "adjusted");
  const hasReversals = rows.some((t) => t.status === "reversed");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>
          {activeTransactions.length} active transaction{activeTransactions.length !== 1 ? "s" : ""}
        </span>
        <button type="button" className="font-semibold text-brand underline" onClick={() => router.push("/stock-management/all-transactions")}>
          View All
        </button>
      </div>
      {activeTransactions.slice(0, 4).map((t) => (
        <div key={t.id} className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-2 text-[11.5px]">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-[#0f1e3d]">
              {t.transactionType ? t.transactionType.charAt(0).toUpperCase() + t.transactionType.slice(1) : "N/A"}
            </span>
            <span className="text-[10px] text-slate-500">{t.transactionDate}</span>
          </div>
          <span className={cn("font-bold", t.quantity >= 0 ? "text-emerald-700" : "text-red-700")}>
            {t.quantity >= 0 ? "+" : ""}
            {Number(t.quantity).toFixed(2)} MT
          </span>
        </div>
      ))}
      {hasAdjustments ? (
        <div className="mt-1 rounded bg-amber-50 px-2 py-1.5 text-[10.5px] text-amber-900">This ticket has been adjusted</div>
      ) : null}
      {hasReversals ? (
        <div className="mt-1 rounded bg-red-50 px-2 py-1.5 text-[10.5px] text-red-900">Some transactions have been reversed</div>
      ) : null}
    </div>
  );
}