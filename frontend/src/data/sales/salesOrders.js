import { computeOrderTotals, indianStates } from "./shared.js";

export const SALES_ORDER_STATUSES = [
  "Draft", "Pending Approval", "Approved", "Rejected", "Confirmed", "On Hold",
  "Partially Allocated", "Fully Allocated", "Partially Dispatched", "Fully Dispatched",
  "Invoiced", "Completed", "Cancelled",
];

export const salesOrderActions = {
  Draft: [
    { key: "submit", label: "Submit for Approval", to: "Pending Approval", kind: "outline" },
    { key: "cancel", label: "Cancel", to: "Cancelled", kind: "outline", tone: "danger", confirm: "Cancel this sales order?" },
  ],
  "Pending Approval": [
    { key: "approve", label: "Approve", to: "Approved", kind: "primary" },
    { key: "reject", label: "Reject", to: "Rejected", kind: "outline", tone: "danger" },
    { key: "cancel", label: "Cancel", to: "Cancelled", kind: "outline", tone: "danger", confirm: "Cancel this sales order?" },
  ],
  Approved: [
    { key: "confirm", label: "Confirm Order", to: "Confirmed", kind: "primary" },
    { key: "cancel", label: "Cancel", to: "Cancelled", kind: "outline", tone: "danger", confirm: "Cancel this sales order?" },
  ],
  Rejected: [{ key: "revise", label: "Revise", to: "Draft", kind: "outline" }],
  Confirmed: [
    { key: "hold", label: "Hold", to: "On Hold", kind: "outline", tone: "danger", requiresReason: true },
    { key: "cancel", label: "Cancel", to: "Cancelled", kind: "outline", tone: "danger", confirm: "Cancel this sales order?" },
  ],
  "On Hold": [{ key: "resume", label: "Resume", to: "Confirmed", kind: "primary" }],
  "Partially Allocated": [{ key: "cancel", label: "Cancel", to: "Cancelled", kind: "outline", tone: "danger", confirm: "Cancel this sales order? Any reservations will be released." }],
  "Fully Allocated": [{ key: "cancel", label: "Cancel", to: "Cancelled", kind: "outline", tone: "danger", confirm: "Cancel this sales order? Any reservations will be released." }],
  "Partially Dispatched": [],
  "Fully Dispatched": [],
  Invoiced: [{ key: "complete", label: "Mark Completed", to: "Completed", kind: "primary" }],
  Completed: [],
  Cancelled: [],
};

export const salesOrderEntity = {
  label: "Sales Order",
  singular: "Sales Order",
  icon: "FileText",
  description: "Customer sales orders with GST-ready line items, credit checks and fulfillment tracking.",
  statLabel: "Total Orders",
  statusList: SALES_ORDER_STATUSES,
  statusActions: salesOrderActions,
  rows: [],
  renderDocumentChain: (values) => [{ id: values.id, label: "Sales Order" }],
  list: {
    subtitle: "Order-to-cash starting point — customer orders with allocation, dispatch and invoicing status.",
    searchPlaceholder: "Search order number, customer, mobile...",
    searchKeys: ["id", "customerName", "customerMobile", "billingAddress", "source", "billNumber"],
    dateKey: "date",
    filters: [
      { key: "customerName", label: "Customer", optionsFromRows: true },
      { key: "salesperson", label: "Salesperson", optionsFromRows: true },
      { key: "priority", label: "Priority", options: ["Low", "Normal", "High", "Urgent"] },
      { key: "source", label: "Source", options: ["Create Bill", "Sales Order"] },
      { key: "status", label: "Status", options: SALES_ORDER_STATUSES },
    ],
    summary: [
      { label: "Total Orders", tone: "primary", compute: (rows) => rows.length },
      { label: "Pending Approval", tone: "warning", compute: (rows) => rows.filter((row) => row.status === "Pending Approval").length },
      { label: "Confirmed / Open", tone: "accent", compute: (rows) => rows.filter((row) => !["Draft", "Rejected", "Completed", "Cancelled"].includes(row.status)).length },
      {
        label: "Total Order Value",
        tone: "success",
        compute: (rows) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
          rows.reduce((sum, row) => sum + computeOrderTotals(row.items, row).grandTotal, 0)
        ),
      },
    ],
    columns: [
      { key: "id", label: "Order No", mono: true, link: true },
      {
        key: "date",
        label: "Order Date & Time",
        render: (row) => new Date(row.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      },
      { key: "customerName", label: "Customer" },
      { key: "source", label: "Source", render: (row) => row.source || "Sales Order" },
      { key: "salesperson", label: "Salesperson" },
      { key: "items", label: "Items", align: "right", render: (row) => row.items.length },
      { key: "grandTotal", label: "Order Total", align: "right", render: (row) => computeOrderTotals(row.items, row).grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }) },
      { key: "status", label: "Status", badge: true },
    ],
    rowActions: [
      { key: "view", label: "View", icon: "Eye" },
      { key: "edit", label: "Edit", icon: "Pencil", showWhen: (row) => row.status === "Draft" },
      { key: "duplicate", label: "Duplicate", icon: "Copy" },
      { key: "allocate", label: "Create Allocation", icon: "ArrowRightCircle", showWhen: (row) => ["Confirmed", "Partially Allocated"].includes(row.status), convertsTo: "product-allocation" },
      { key: "print", label: "Print", icon: "Printer", print: true },
      { key: "delete", label: "Delete", icon: "Trash2", tone: "danger", showWhen: (row) => row.status === "Draft", remove: true, confirm: "Delete this draft order?" },
    ],
  },
  form: {
    tabs: [
      {
        key: "overview",
        label: "Overview",
        fields: [
          { key: "id", label: "Order Number", type: "text", required: true, autoLabel: "Auto-generated" },
          { key: "date", label: "Order Date & Time", type: "datetime-local", required: true },
          { key: "salesChannel", label: "Sales Channel", type: "select", options: ["Direct", "Retail", "Home Delivery", "Distributor", "Online"] },
          { key: "customerName", label: "Customer Name", type: "customer-autocomplete", required: true, clearOnChange: ["customerId"] },
          { key: "customerMobile", label: "Mobile", type: "customer-autocomplete", digitsOnly: true, inputMode: "numeric", maxLength: 10, clearOnChange: ["customerId"] },
          { key: "billingAddress", label: "Address", type: "text" },
        ],
      },
      {
        key: "items",
        label: "Line Items",
        fields: [
          {
            key: "items",
            label: "Line Items",
            type: "lineItems",
            span: "full",
            allowAddRemove: true,
            variant: "medicine-request",
            columns: [
              { key: "composition", label: "Composition", type: "composition-select", required: true, minWidth: 280 },
              { key: "productCode", label: "Medicine", type: "product-select", dependsOnComposition: true, required: true, minWidth: 320 },
              { key: "qty", label: "Qty", type: "number", required: true, minWidth: 150 },
              { key: "uom", label: "Unit", type: "text", readOnly: true, minWidth: 100 },
              { key: "totalPrice", label: "Total Price", type: "computed-line-total", align: "right", minWidth: 130 },
              { key: "remarks", label: "Remarks", type: "text", minWidth: 230 },
            ],
          },
        ],
      },
      {
        key: "billing",
        label: "Billing & Shipping",
        fields: [
          { key: "shippingAddress", label: "Shipping Address", type: "textarea", span: "full" },
          { key: "destinationState", label: "Place of Supply (State)", type: "select", required: true, options: indianStates },
          { key: "district", label: "District", type: "text" },
          { key: "pin", label: "PIN Code", type: "text" },
        ],
      },
      {
        key: "credit",
        label: "Credit & Approval",
        fields: [{ key: "creditCheck", label: "Credit Check", type: "credit-check-panel" }],
      },
      {
        key: "totals",
        label: "Totals & Charges",
        fields: [
          { key: "orderTotals", label: "Order Totals", type: "order-totals-panel" },
          { key: "freight", label: "Freight Charges", type: "number" },
          { key: "packing", label: "Packing Charges", type: "number" },
          { key: "other", label: "Other Charges", type: "number" },
        ],
      },
    ],
  },
};
