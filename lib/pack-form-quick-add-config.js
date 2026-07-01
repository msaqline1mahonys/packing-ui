import { CERTIFICATE_SECTIONS, RECORD_SECTIONS } from "@/lib/fumigation-fields";
import {
  createCertificateTemplate,
  createFumigant,
  createMethodology,
  createRecordTemplate,
  normalizeCertificateTemplate,
  normalizeFumigant,
  normalizeMethodology,
  normalizeRecordTemplate,
} from "@/lib/api/fumigation";
import { createVessel } from "@/lib/api/shipping";
import { createApiUser } from "@/lib/users-api";
import { DEFAULT_CONTAINER_SIZES } from "@/lib/Data";
import { quickAddPost } from "@/lib/pack-form-quick-add-api";

const PRODUCT_FORMS = ["Cylinder", "Tablet", "Liquid", "Gas", "Granule"];
const DOSAGE_UNITS = ["ppm", "g/m3", "mg/L", "%"];

export const PACK_FORM_QUICK_ADD_CONFIG = {
  customer: {
    title: "Customer",
    label: "➕ Add customer…",
    invalidateKey: "customers",
    fields: [
      { key: "code", label: "Customer code", required: true, placeholder: "e.g. CUST-001" },
      { key: "name", label: "Customer name", required: true },
    ],
    initialValues: () => ({ code: "", name: "" }),
    validate: (draft) => {
      if (!String(draft.code ?? "").trim() || !String(draft.name ?? "").trim()) {
        return "Customer code and name are required.";
      }
      return null;
    },
    save: (draft) =>
      quickAddPost("/reference-data/customers", {
        code: String(draft.code).trim(),
        name: String(draft.name).trim(),
        emails: [],
        addresses: [],
        contacts: [],
        warnings: [],
      }),
  },
  commodityType: {
    title: "Commodity type",
    label: "➕ Add commodity type…",
    invalidateKey: "commodityTypes",
    fields: [
      { key: "name", label: "Name", required: true, placeholder: "e.g. Wheat" },
      { key: "acosCode", label: "ACOS code", placeholder: "e.g. WHT001" },
      {
        key: "testRequired",
        label: "Test required",
        type: "select",
        required: true,
        options: ["Yes", "No"],
        defaultValue: "Yes",
      },
    ],
    initialValues: () => ({ name: "", acosCode: "", testRequired: "Yes" }),
    validate: (draft) => {
      if (!String(draft.name ?? "").trim()) return "Name is required.";
      if (!String(draft.testRequired ?? "").trim()) return "Test required is required.";
      return null;
    },
    save: (draft) =>
      quickAddPost("/product-settings/commodity-types", {
        name: String(draft.name).trim(),
        acos_code: String(draft.acosCode ?? "").trim() || null,
        test_required: draft.testRequired || "Yes",
      }),
  },
  commodity: {
    title: "Commodity grade",
    label: "➕ Add commodity…",
    invalidateKey: "commodities",
    fields: [
      {
        key: "commodityTypeId",
        label: "Commodity type",
        required: true,
        type: "select",
        optionsKey: "commodityTypes",
        quickAdd: "commodityType",
      },
      { key: "commodityCode", label: "Grade code", required: true },
      { key: "description", label: "Description", required: true, wide: true },
    ],
    initialValues: () => ({ commodityTypeId: "", commodityCode: "", description: "" }),
    validate: (draft) => {
      if (!String(draft.commodityTypeId ?? "").trim()) return "Commodity type is required.";
      if (!String(draft.commodityCode ?? "").trim() || !String(draft.description ?? "").trim()) {
        return "Grade code and description are required.";
      }
      return null;
    },
    save: (draft) =>
      quickAddPost("/product-settings/commodities", {
        commodity_type_id: draft.commodityTypeId,
        commodity_code: String(draft.commodityCode).trim(),
        description: String(draft.description).trim(),
        status: "Active",
        test_thresholds: [],
      }),
  },
  stockLocation: {
    title: "Stock location",
    label: "➕ Add location…",
    invalidateKey: "stockLocations",
    fields: [
      { key: "name", label: "Location name", required: true, placeholder: "e.g. Bay 12" },
      { key: "siteId", label: "Site", required: true, type: "select", optionsKey: "sites" },
      {
        key: "locationType",
        label: "Location type",
        type: "select",
        options: [
          { value: "Bay", label: "Bay" },
          { value: "Pile", label: "Pile" },
          { value: "Silo", label: "Silo" },
        ],
        defaultValue: "Bay",
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "Active", label: "Active" },
          { value: "Inactive", label: "Inactive" },
        ],
        defaultValue: "Active",
      },
    ],
    initialValues: (ctx) => ({
      name: "",
      siteId: ctx?.defaultSiteId ?? "",
      locationType: "Bay",
      status: "Active",
    }),
    validate: (draft) => {
      if (!String(draft.name ?? "").trim()) return "Location name is required.";
      if (!String(draft.siteId ?? "").trim()) return "Site is required.";
      return null;
    },
    save: (draft) =>
      quickAddPost("/reference-data/stock-locations", {
        name: String(draft.name).trim(),
        site_id: draft.siteId,
        location_type: draft.locationType || "Bay",
        status: draft.status || "Active",
        commodity_mode: "all",
        commodity_type_ids: [],
      }),
  },
  packer: {
    title: "Packer",
    label: "➕ Add packer…",
    invalidateKey: "packers",
    fields: [
      { key: "name", label: "Name", required: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["Active", "Under maintenance", "Inactive"],
        defaultValue: "Active",
      },
    ],
    initialValues: () => ({ name: "", status: "Active" }),
    validate: (draft) => (!String(draft.name ?? "").trim() ? "Name is required." : null),
    save: (draft) =>
      quickAddPost("/reference-data/packers", {
        name: String(draft.name).trim(),
        status: draft.status || "Active",
        stock_location_mode: "all",
        stock_location_ids: [],
      }),
  },
  containerCode: {
    title: "Container ISO code",
    label: "➕ Add container ISO…",
    invalidateKey: "containerCodes",
    fields: [
      { key: "isoCode", label: "ISO code", required: true, placeholder: "e.g. 22G1" },
      { key: "containerSize", label: "Container size", required: true, type: "select", options: DEFAULT_CONTAINER_SIZES },
      { key: "description", label: "Description", wide: true },
    ],
    initialValues: () => ({ isoCode: "", containerSize: "", description: "" }),
    validate: (draft) => {
      if (!String(draft.isoCode ?? "").trim() || !String(draft.containerSize ?? "").trim()) {
        return "ISO code and container size are required.";
      }
      return null;
    },
    save: (draft) =>
      quickAddPost("/reference-data/container-codes", {
        iso_code: String(draft.isoCode).trim(),
        container_size: String(draft.containerSize).trim(),
        description: String(draft.description ?? "").trim() || null,
      }),
  },
  shippingLine: {
    title: "Shipping line",
    label: "➕ Add shipping line…",
    invalidateKey: "shippingLines",
    fields: [
      { key: "shippingLineCode", label: "Code", placeholder: "e.g. MSC" },
      { key: "shippingLineName", label: "Name", required: true },
    ],
    initialValues: () => ({ shippingLineCode: "", shippingLineName: "" }),
    validate: (draft) => (!String(draft.shippingLineName ?? "").trim() ? "Name is required." : null),
    save: (draft) =>
      quickAddPost("/reference-data/shipping-lines", {
        shipping_line_code: String(draft.shippingLineCode ?? "").trim() || null,
        shipping_line_name: String(draft.shippingLineName).trim(),
        contacts: [],
      }),
  },
  terminal: {
    title: "Terminal",
    label: "➕ Add terminal…",
    invalidateKey: "terminals",
    fields: [
      { key: "terminalCode", label: "Terminal code", required: true },
      { key: "terminalName", label: "Terminal name", required: true },
      { key: "portOfLoading", label: "Port of loading" },
    ],
    initialValues: () => ({ terminalCode: "", terminalName: "", portOfLoading: "" }),
    validate: (draft) => {
      if (!String(draft.terminalCode ?? "").trim() || !String(draft.terminalName ?? "").trim()) {
        return "Terminal code and name are required.";
      }
      return null;
    },
    save: (draft) =>
      quickAddPost("/reference-data/terminals", {
        terminal_code: String(draft.terminalCode).trim(),
        terminal_name: String(draft.terminalName).trim(),
        port_of_loading: String(draft.portOfLoading ?? "").trim() || null,
        contacts: [],
      }),
  },
  country: {
    title: "Country",
    label: "➕ Add country…",
    invalidateKey: "countries",
    fields: [
      { key: "countryName", label: "Country name", required: true },
      { key: "countryCode", label: "Country code", required: true, placeholder: "e.g. AU" },
    ],
    initialValues: () => ({ countryName: "", countryCode: "" }),
    validate: (draft) => {
      if (!String(draft.countryName ?? "").trim() || !String(draft.countryCode ?? "").trim()) {
        return "Country name and code are required.";
      }
      return null;
    },
    save: (draft) =>
      quickAddPost("/reference-data/countries", {
        country_name: String(draft.countryName).trim(),
        country_code: String(draft.countryCode).trim(),
        contacts: [],
        warnings: [],
      }),
  },
  port: {
    title: "Port",
    label: "➕ Add port…",
    invalidateKey: "ports",
    fields: [
      { key: "code", label: "Port code", required: true, placeholder: "e.g. AUMEL" },
      { key: "name", label: "Port name", required: true },
      { key: "countryId", label: "Country", required: true, type: "select", optionsKey: "countries" },
    ],
    initialValues: () => ({ code: "", name: "", countryId: "" }),
    validate: (draft) => {
      if (!String(draft.code ?? "").trim() || !String(draft.name ?? "").trim()) return "Port code and name are required.";
      if (!String(draft.countryId ?? "").trim()) return "Country is required.";
      return null;
    },
    save: (draft) =>
      quickAddPost("/reference-data/ports", {
        code: String(draft.code).trim(),
        name: String(draft.name).trim(),
        country_id: draft.countryId,
      }),
  },
  containerPark: {
    title: "Container park",
    label: "➕ Add container park…",
    invalidateKey: "containerParks",
    fields: [
      { key: "containerParkCode", label: "Park code", required: true },
      { key: "containerParkName", label: "Park name", required: true },
    ],
    initialValues: () => ({ containerParkCode: "", containerParkName: "" }),
    validate: (draft) => {
      if (!String(draft.containerParkCode ?? "").trim() || !String(draft.containerParkName ?? "").trim()) {
        return "Park code and name are required.";
      }
      return null;
    },
    save: (draft) =>
      quickAddPost("/reference-data/container-parks", {
        container_park_code: String(draft.containerParkCode).trim(),
        container_park_name: String(draft.containerParkName).trim(),
        contacts: [],
      }),
  },
  transporter: {
    title: "Transporter",
    label: "➕ Add transporter…",
    invalidateKey: "transporters",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "code", label: "Code" },
      { key: "email", label: "Email", type: "email" },
    ],
    initialValues: () => ({ name: "", code: "", email: "" }),
    validate: (draft) => (!String(draft.name ?? "").trim() ? "Name is required." : null),
    save: (draft) =>
      quickAddPost("/contacts/transporters", {
        name: String(draft.name).trim(),
        code: String(draft.code ?? "").trim() || null,
        email: String(draft.email ?? "").trim() || null,
        contacts: [],
      }),
  },
  fumigant: {
    title: "Fumigant",
    label: "➕ Add fumigant…",
    fields: [
      { key: "code", label: "Code", required: true },
      { key: "name", label: "Name", required: true },
      { key: "productForm", label: "Product form", type: "select", options: PRODUCT_FORMS, defaultValue: PRODUCT_FORMS[0] },
      { key: "defaultUnit", label: "Default unit", type: "select", options: DOSAGE_UNITS, defaultValue: "g/m3" },
    ],
    initialValues: () => ({ code: "", name: "", productForm: PRODUCT_FORMS[0], defaultUnit: "g/m3" }),
    validate: (draft) => {
      if (!String(draft.code ?? "").trim() || !String(draft.name ?? "").trim()) return "Code and name are required.";
      return null;
    },
    save: async (draft) => {
      const result = await createFumigant({
        code: String(draft.code).trim(),
        name: String(draft.name).trim(),
        product_form: draft.productForm || null,
        default_unit: draft.defaultUnit || null,
      });
      return normalizeFumigant(result?.data ?? result);
    },
  },
  methodology: {
    title: "Methodology",
    label: "➕ Add methodology…",
    fields: [
      { key: "fumigantId", label: "Fumigant", required: true, type: "select", optionsKey: "fumigants" },
      { key: "name", label: "Name", required: true },
      { key: "version", label: "Version" },
    ],
    initialValues: () => ({ fumigantId: "", name: "", version: "" }),
    validate: (draft) => {
      if (!String(draft.fumigantId ?? "").trim()) return "Fumigant is required.";
      if (!String(draft.name ?? "").trim()) return "Name is required.";
      return null;
    },
    save: async (draft) => {
      const result = await createMethodology({
        fumigant_id: draft.fumigantId,
        name: String(draft.name).trim(),
        version: String(draft.version ?? "").trim() || null,
        dosage_ranges: [],
        application_methods: [],
      });
      return normalizeMethodology(result?.data ?? result);
    },
  },
  certificateTemplate: {
    title: "Certificate template",
    label: "➕ Add certificate template…",
    fields: [{ key: "name", label: "Template name", required: true }],
    initialValues: () => ({ name: "" }),
    validate: (draft) => (!String(draft.name ?? "").trim() ? "Template name is required." : null),
    save: async (draft) => {
      const result = await createCertificateTemplate({
        name: String(draft.name).trim(),
        sections: CERTIFICATE_SECTIONS.map((s) => s.key),
      });
      return normalizeCertificateTemplate(result?.data ?? result);
    },
  },
  recordTemplate: {
    title: "Record template",
    label: "➕ Add record template…",
    fields: [{ key: "name", label: "Template name", required: true }],
    initialValues: () => ({ name: "" }),
    validate: (draft) => (!String(draft.name ?? "").trim() ? "Template name is required." : null),
    save: async (draft) => {
      const result = await createRecordTemplate({
        name: String(draft.name).trim(),
        sections: RECORD_SECTIONS.map((s) => s.key),
      });
      return normalizeRecordTemplate(result?.data ?? result);
    },
  },
  user: {
    title: "User",
    label: "➕ Add user…",
    invalidateKey: "users",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "email", label: "Email", required: true, type: "email" },
      { key: "password", label: "Temporary password", required: true, type: "password" },
      { key: "fumigatorLicence", label: "Fumigator licence" },
    ],
    initialValues: (ctx) => ({
      name: "",
      email: "",
      password: "",
      fumigatorLicence: "",
      siteIds: ctx?.defaultSiteId ? [ctx.defaultSiteId] : [],
    }),
    validate: (draft) => {
      if (!String(draft.name ?? "").trim() || !String(draft.email ?? "").trim() || !String(draft.password ?? "").trim()) {
        return "Name, email, and password are required.";
      }
      return null;
    },
    save: async (draft, ctx) => {
      const siteIds = Array.isArray(draft.siteIds) && draft.siteIds.length
        ? draft.siteIds
        : ctx?.defaultSiteId
          ? [ctx.defaultSiteId]
          : [];
      return createApiUser({
        name: String(draft.name).trim(),
        email: String(draft.email).trim(),
        password: String(draft.password),
        siteIds,
        isFumigator: true,
        isActive: true,
        profileData: {
          fumigator_licence: String(draft.fumigatorLicence ?? "").trim() || null,
        },
      });
    },
  },
  vessel: {
    title: "Vessel",
    label: "➕ Add vessel…",
    invalidateKey: "vesselVoyages",
    fields: [
      { key: "vesselName", label: "Vessel name", required: true },
      { key: "lloydsNumber", label: "Lloyds / IMO number" },
    ],
    initialValues: () => ({ vesselName: "", lloydsNumber: "" }),
    validate: (draft) => (!String(draft.vesselName ?? "").trim() ? "Vessel name is required." : null),
    save: async (draft) => createVessel(draft),
  },
};

export function getQuickAddLabel(entityKey) {
  if (PACK_FORM_QUICK_ADD_CONFIG[entityKey]?.label) {
    return PACK_FORM_QUICK_ADD_CONFIG[entityKey].label;
  }
  if (entityKey === "release") return "➕ Add release…";
  if (entityKey === "vesselVoyage") return "➕ Add vessel voyage…";
  return "➕ Add new…";
}

/** Map a quick-add API response to a ClutchSelect option for the triggering field. */
export function quickAddCreatedOption(entityKey, created) {
  if (!created || typeof created !== "object") return null;
  const str = (...keys) => {
    for (const key of keys) {
      const value = created[key];
      if (value != null && String(value).trim() !== "") return String(value);
    }
    return "";
  };
  if (entityKey === "country") {
    const name = str("country_name", "countryName", "name");
    return name ? { value: name, label: name } : null;
  }
  if (entityKey === "containerCode") {
    const iso = str("iso_code", "isoCode", "container_code", "containerCode");
    if (!iso) return null;
    const size = str("container_size", "containerSize");
    const desc = str("description");
    return { value: iso, label: [iso, size, desc].filter(Boolean).join(" · ") };
  }
  if (entityKey === "commodityType") {
    const id = str("id");
    if (!id) return null;
    const name = str("name");
    return { value: id, label: name || id };
  }
  if (entityKey === "commodity") {
    const id = str("id");
    if (!id) return null;
    const code = str("commodity_code", "commodityCode");
    const desc = str("description");
    return { value: id, label: [code, desc].filter(Boolean).join(" — ") || id };
  }
  if (entityKey === "release") {
    const id = str("id");
    const number = str("release_number", "releaseNumber");
    if (!id) return null;
    return { value: id, label: number || id };
  }
  if (entityKey === "vesselVoyage") {
    const id = str("id");
    if (!id) return null;
    const vessel = created.vessel?.vessel_name ?? created.vessel?.vesselName ?? created.vessel_name ?? "";
    const voyage = str("voyage_number", "voyageNumber");
    return { value: id, label: [vessel, voyage].filter(Boolean).join(" · ") || id };
  }
  const id = str("id");
  if (!id) return null;
  const label =
    str(
      "name",
      "description",
      "release_number",
      "releaseNumber",
      "container_park_name",
      "containerParkName",
      "terminal_name",
      "terminalName",
      "shipping_line_name",
      "shippingLineName",
      "code",
      "commodity_code",
      "commodityCode",
    ) || id;
  return { value: id, label };
}
