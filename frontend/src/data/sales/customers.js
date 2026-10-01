import { customerCategories, customerTypes } from "./shared.js";

export const CUSTOMER_STATUSES = ["Active", "Inactive", "On Credit Hold", "Blacklisted"];

export const customerEntity = {
  label: "Customer Management",
  singular: "Customer",
  icon: "Users",
  description: "Customer master with billing/shipping profiles, tax and credit settings, and full transaction history.",
  statLabel: "Total Customers",
  rows: [],
  list: {
    subtitle: "Customer master, credit control and relationship history.",
    searchPlaceholder: "Search customer code, name, GSTIN, mobile...",
    searchKeys: ["code", "name", "gstin", "mobile", "email"],
    filters: [
      { key: "customerType", label: "Customer Type", options: customerTypes },
      { key: "category", label: "Category", options: customerCategories },
      { key: "billingState", label: "State", optionsFromRows: true },
      { key: "salesperson", label: "Salesperson", optionsFromRows: true },
      { key: "status", label: "Status", options: CUSTOMER_STATUSES },
    ],
    summary: [
      { label: "Total Customers", tone: "primary", compute: (rows) => rows.length },
      { label: "Active Customers", tone: "success", compute: (rows) => rows.filter((row) => row.status === "Active").length },
      { label: "On Credit Hold", tone: "warning", compute: (rows) => rows.filter((row) => row.status === "On Credit Hold").length },
      { label: "Total Credit Limit", tone: "accent", compute: (rows) => `₹${(rows.reduce((sum, row) => sum + (Number(row.creditLimit) || 0), 0) / 100000).toFixed(1)}L` },
    ],
    columns: [
      { key: "code", label: "Customer Code", mono: true, link: true },
      { key: "name", label: "Customer Name" },
      { key: "customerType", label: "Type" },
      { key: "contactPerson", label: "Contact Person" },
      { key: "mobile", label: "Mobile" },
      { key: "billingCity", label: "City" },
      { key: "billingState", label: "State" },
      { key: "creditLimit", label: "Credit Limit", align: "right", money: true },
      { key: "status", label: "Status", badge: true },
    ],
    rowActions: [
      { key: "view", label: "View", icon: "Eye" },
      { key: "edit", label: "Edit", icon: "Pencil", hideWhen: (row) => row.status === "Blacklisted" },
      { key: "duplicate", label: "Duplicate", icon: "Copy" },
      { key: "hold", label: "Place on Credit Hold", icon: "Ban", showWhen: (row) => row.status === "Active", setStatus: "On Credit Hold" },
      { key: "reactivate", label: "Reactivate", icon: "Check", tone: "success", showWhen: (row) => ["Inactive", "On Credit Hold"].includes(row.status), setStatus: "Active" },
      { key: "print", label: "Print Statement", icon: "Printer", print: true },
    ],
  },
};
