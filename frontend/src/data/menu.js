function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Sub-items that already have a real page in this build keep their existing route
// instead of a generated placeholder path. Master Setup's, Purchase
// Management's, Stock Management's, Manufacturing's and Sales's own children
// are generated below (they resolve to /master-management/<slug>,
// /purchase-management/<slug>, /stock-management/<slug>, /manufacturing/<slug>
// and /sales/<slug>, which those modules own — see data/masterManagement.js,
// data/purchaseManagement.js, data/stockManagement.js, data/manufacturing/ and
// data/sales/).
const existingRoutes = {
  Medicine: "/master-management/product-item",
  "Medicine Requisition": "/purchase-management/purchase-request",
  "Purchase Issue": "/purchase-management/purchase-issue",
  "Medicine Category": "/master-management/category",
  "Generic / Composition": "/master-management/generic-composition",
  "Brand Name": "/master-management/brand-name",
  Manufacturer: "/master-management/manufacturer",
  Supplier: "/master-management/supplier",
  "Customer Type": "/master-management/customer-type",
  GST: "/master-management/tax-gst",
  "Unit & Packing Type": "/master-management/unit",
  "Store / Warehouse": "/master-management/warehouse",
  "Rack / Location": "/master-management/stock-location",
  "Payment Mode": "/master-management/payment-mode",
  Customers: "/sales/customer-management",
};

const rawSections = [
  { label: "Dashboard", to: "/dashboard" },
  {
    label: "Purchase Management",
    children: ["Medicine Requisition", "Purchase Order", "Goods Receipt", "Purchase Issue", "Purchase Return"],
  },
  {
    label: "Stock Management",
    children: ["Stock Transfer", "Stock Adjustment", "Stock Count", "Batch / Lot Tracking"],
  },
  {
    label: "Pharmacy Sales",
    slug: "sales",
    children: ["Create Bill", "Sales Order", "Customers", "Delivery / Dispatch", "Payment Receipt", "Sales Return"],
  },
  {
    label: "Medicine Reports",
    children: ["Current Stock", "Low Stock", "Stock Movement", "Purchase Report", "Stock Valuation"],
  },
  { label: "Sales Reports", slug: "manufacturing-sales-reports", children: ["Sales Report", "Dispatch Report", "Sales Return Report"] },
  {
    label: "Master Setup",
    slug: "master-management",
    children: [
      "Medicine",
      "Medicine Category",
      "Generic / Composition",
      "Brand Name",
      "Manufacturer",
      "Supplier",
      "Customer Type",
      "GST",
      "Unit & Packing Type",
      "Store / Warehouse",
      "Rack / Location",
      "Payment Mode",
    ],
  },
];

export const menu = rawSections.map((section) => {
  if (!section.children) return section;

  const sectionSlug = section.slug || slugify(section.label);
  return {
    ...section,
    children: section.children.map((label) => ({
      label,
      to: existingRoutes[label] || `/${sectionSlug}/${slugify(label)}`,
    })),
  };
});

export const placeholderLookup = new Map();
menu.forEach((section) => {
  if (["Master Setup", "Purchase Management", "Stock Management", "Inventory Reports", "Pharmacy Sales", "Sales Reports"].includes(section.label)) return;
  section.children?.forEach((child) => {
    if (!Object.values(existingRoutes).includes(child.to)) {
      placeholderLookup.set(child.to, { section: section.label, title: child.label });
    }
  });
});
