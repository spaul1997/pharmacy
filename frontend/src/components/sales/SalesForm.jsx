import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, ChevronDown, ChevronRight as Crumb, Paperclip, Plus, ReceiptIndianRupee, Trash2 } from "lucide-react";
import { salesEntities } from "../../data/sales/entities.js";
import { COMPANY_STATE, computeLineTax, computeOrderTotals, localDateTimeNow, money, money0, nextId, nextMonthlyId, today, now } from "../../data/sales/shared.js";
import { computeCustomerOutstanding } from "./salesUtils.js";
import { ConfirmDialog } from "../ui.jsx";
import { AuditStrip } from "../manufacturing/AuditStrip.jsx";
import { DocumentChain } from "../purchase/DocumentChain.jsx";
import { WorkflowTimeline } from "../purchase/WorkflowTimeline.jsx";
import { keyOf, useSalesData } from "./SalesDataContext.jsx";
import { useMasterData } from "../master/MasterDataContext.jsx";
import { useToast } from "../Toast.jsx";

const fallbackIds = {
  "product-allocation": "ALC-2026-0001",
  "delivery-dispatch": "DSP-2026-0001",
  "sales-invoice": "INV-2026-0001",
  "sales-return": "SR-2026-0001",
};

const LINK_FIELD_KEYS = ["customerId", "salesOrderId", "allocationId", "dispatchId", "invoiceId"];

// convertsTo pairs (from a list row action) map to the target form's link field.
const LINK_FIELD_BY_PAIR = {
  "sales-order->product-allocation": "salesOrderId",
  "product-allocation->delivery-dispatch": "allocationId",
  "delivery-dispatch->sales-invoice": "dispatchId",
  "sales-invoice->sales-return": "invoiceId",
};

function productUnit(product) {
  return product?.salesUnit || product?.unit || product?.baseUnit || "";
}

function productLocation(product) {
  return product?.defaultLocation || product?.location || product?.stockLocation || product?.warehouse || "";
}

function productOptionDetails(product) {
  const details = [
    `G: ${product?.genericName || product?.composition || ""}`,
    `C: ${product?.category || ""}`,
  ];
  const location = productLocation(product);
  if (location) details.push(`L: ${location}`);
  return details.join(", ");
}

function MedicineSelect({ options, value, disabled, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const [hoverStyle, setHoverStyle] = useState(null);
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const selected = options.find((product) => product.code === value);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target) && !listRef.current?.contains(event.target)) setOpen(false);
    }
    // Render the list in a fixed-position portal so it floats over the table
    // instead of stretching the row (and isn't clipped by overflow-x-auto).
    function positionMenu() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = 256;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < menuHeight + 8 && rect.top > spaceBelow;
      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    }
    positionMenu();
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("scroll", positionMenu, true);
    window.addEventListener("resize", positionMenu);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("scroll", positionMenu, true);
      window.removeEventListener("resize", positionMenu);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="w-full min-w-0"
      onMouseEnter={() => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!selected || open || !rect) return;
        setHoverStyle({ position: "fixed", left: rect.left, top: rect.bottom + 4, maxWidth: Math.max(rect.width, 280) });
      }}
      onMouseLeave={() => setHoverStyle(null)}
    >
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setHoverStyle(null);
          setOpen((current) => !current);
        }}
        className="flex w-full items-center justify-between gap-2 rounded border border-[var(--line)] bg-white px-2 py-1.5 text-left text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-[var(--muted)]"
      >
        {selected ? (
          <span className="min-w-0 truncate text-sm font-medium text-[var(--ink)]">{selected.name || "Unnamed medicine"}</span>
        ) : (
          <span className="text-sm text-[var(--muted)]">{placeholder}</span>
        )}
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {hoverStyle && selected && !open && createPortal(
        <div role="tooltip" style={hoverStyle} className="pointer-events-none z-50 rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 shadow-lg">
          <span className="block text-sm font-medium text-[var(--ink)]">{selected.name || "Unnamed medicine"}</span>
          <span className="block text-xs text-[var(--muted)]">{productOptionDetails(selected)}</span>
        </div>,
        document.body
      )}
      {open && !disabled && menuStyle && createPortal(
        <div ref={listRef} role="listbox" style={menuStyle} className="z-50 max-h-64 overflow-y-auto rounded-md border border-[var(--line)] bg-white p-1 shadow-lg">
          {options.length === 0 ? (
            <p className="px-2.5 py-3 text-sm text-[var(--muted)]">No medicines available.</p>
          ) : options.map((product) => (
            <button
              key={product.code}
              type="button"
              role="option"
              aria-selected={product.code === value}
              onClick={() => {
                onChange(product.code);
                setOpen(false);
              }}
              className={`block w-full rounded px-2.5 py-2 text-left hover:bg-slate-50 ${product.code === value ? "bg-blue-50" : ""}`}
            >
              <span className="block text-sm font-medium text-[var(--ink)]">{product.name || "Unnamed medicine"}</span>
              <span className="block text-xs text-[var(--muted)]">{productOptionDetails(product)}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function CustomerAutocomplete({ field, value, error, disabled, customers, inputClassName, onChange, onSelect }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const query = String(value || "").trim().toLowerCase();
  const queryDigits = query.replace(/\D/g, "");
  const suggestions = customers
    .filter((customer) => {
      if (!query) return true;
      const name = String(customer.name || customer.companyName || "").toLowerCase();
      const mobile = String(customer.mobile || customer.phone || "");
      const mobileDigits = mobile.replace(/\D/g, "");
      return name.includes(query) || mobile.toLowerCase().includes(query) || (queryDigits && mobileDigits.includes(queryDigits));
    })
    .slice(0, 6);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
        {field.label}
        {field.required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      </label>
      <input
        type={field.type === "tel" || field.inputMode === "numeric" ? "tel" : "text"}
        value={value || ""}
        disabled={disabled}
        inputMode={field.inputMode}
        maxLength={field.maxLength}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        placeholder={field.placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          let nextValue = event.target.value;
          if (field.digitsOnly) nextValue = nextValue.replace(/\D/g, "");
          if (field.maxLength) nextValue = nextValue.slice(0, field.maxLength);
          onChange(nextValue);
          setOpen(true);
        }}
        className={inputClassName}
      />
      {open && !disabled && suggestions.length > 0 && (
        <div role="listbox" className="absolute z-40 mt-1 max-h-64 w-full min-w-[18rem] overflow-y-auto rounded-md border border-[var(--line)] bg-white p-1 shadow-lg">
          {suggestions.map((customer) => {
            const mobile = customer.mobile || customer.phone || "";
            const location = [customer.billingCity, customer.billingState].filter(Boolean).join(", ");
            return (
              <button
                key={keyOf(customer)}
                type="button"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(customer);
                  setOpen(false);
                }}
                className="block w-full rounded px-2.5 py-2 text-left hover:bg-slate-50"
              >
                <span className="block text-sm font-medium text-[var(--ink)]">{customer.name || customer.companyName}</span>
                <span className="block text-xs text-[var(--muted)]">
                  {[mobile, location].filter(Boolean).join(" · ")}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

function uniqueOptions(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function totalPayments(formValues) {
  if (Array.isArray(formValues?.payments)) {
    return formValues.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  }
  return Number(formValues?.amountReceived) || 0;
}

function normalizeFilterValue(value) {
  return String(value || "").trim().toLowerCase();
}

function compositionOptionValue(composition) {
  return String(composition?.composition || composition?.name || "").trim();
}

function productMatchesComposition(product, selectedComposition, compositionRows) {
  const selected = normalizeFilterValue(selectedComposition);
  if (!selected) return false;

  const composition = compositionRows.find((row) =>
    [row.name, row.composition].some((value) => normalizeFilterValue(value) === selected)
  );
  const aliases = new Set(
    [selectedComposition, composition?.name, composition?.composition]
      .map(normalizeFilterValue)
      .filter(Boolean)
  );

  return [product?.genericName, product?.composition]
    .map(normalizeFilterValue)
    .some((value) => aliases.has(value));
}

function fullAddress(customer, shipping) {
  if (shipping) return `${shipping.line1}${shipping.line2 ? ", " + shipping.line2 : ""}, ${shipping.city}, ${shipping.state} ${shipping.postalCode}`;
  if (!customer) return "";
  if (customer.address) return customer.address;
  return `${customer.billingAddressLine1 || ""}${customer.billingAddressLine2 ? ", " + customer.billingAddressLine2 : ""}, ${customer.billingCity || ""}, ${customer.billingState || ""} ${customer.billingPostalCode || ""}`;
}

function sumPriorByProduct(rows, matchField, matchValue, qtyField) {
  const totals = {};
  rows
    .filter((r) => r[matchField] === matchValue)
    .forEach((r) => {
      (r.items || []).forEach((item) => {
        if (!item.productCode) return;
        totals[item.productCode] = (totals[item.productCode] || 0) + (Number(item[qtyField]) || 0);
      });
    });
  return totals;
}

/**
 * Cross-document auto-fill, shared by the link-field's onChange AND by the
 * initializer when arriving via a "Create Allocation" / "Create Dispatch" /
 * etc. convertsTo action from a list row. Mirrors buildWorkOrderPatch from
 * ManufacturingForm.jsx, generalized over 5 relationships instead of 1.
 */
function buildLinkedPatch(entityKey, fieldKey, value, salesData, masterData, hasEmptyItems) {
  if (fieldKey === "customerId") {
    const customer = salesData.getRecord("customer-management", value);
    const defaultShipping = customer?.shippingAddresses?.find((a) => a.isDefault) || customer?.shippingAddresses?.[0];
    return {
      customerId: value,
      customerName: customer?.name || "",
      customerType: customer?.customerType || "",
      customerMobile: customer?.mobile || customer?.phone || "",
      billingAddress: fullAddress(customer),
      shippingAddress: fullAddress(customer, defaultShipping),
      destinationState: customer?.billingState || "",
      district: customer?.billingDistrict || "",
      pin: customer?.billingPostalCode || "",
      gstin: customer?.gstin || "",
      paymentTerms: customer?.paymentTerms || "",
    };
  }
  if (fieldKey === "salesOrderId") {
    const order = salesData.getRecord("sales-order", value);
    const patch = { salesOrderId: value, customerId: order?.customerId, customerName: order?.customerName, warehouse: order?.warehouse };
    if (order && hasEmptyItems) {
      patch.items = order.items.map((item) => ({
        productCode: item.productCode,
        productName: item.productName,
        orderedQty: item.qty,
        allocatedQty: Math.min(item.qty, salesData.getAvailableToAllocate(item.productCode)),
        uom: item.uom,
        sourceWarehouse: order.warehouse,
        location: "",
        batchNo: "",
        remarks: "",
      }));
    }
    return patch;
  }
  if (fieldKey === "allocationId") {
    const allocation = salesData.getRecord("product-allocation", value);
    const patch = { allocationId: value, salesOrderId: allocation?.salesOrderId, customerId: allocation?.customerId, customerName: allocation?.customerName, warehouse: allocation?.warehouse };
    if (allocation && hasEmptyItems) {
      const dispatchedSoFar = sumPriorByProduct(salesData.getRows("delivery-dispatch"), "allocationId", value, "dispatchQty");
      patch.items = allocation.items
        .map((item) => ({
          productCode: item.productCode,
          productName: item.productName,
          allocatedQty: item.allocatedQty,
          dispatchQty: Math.max(0, item.allocatedQty - (dispatchedSoFar[item.productCode] || 0)),
          uom: item.uom,
          batchNo: item.batchNo || "",
          condition: "Good",
          packageNo: "",
        }))
        .filter((l) => l.dispatchQty > 0);
    }
    return patch;
  }
  if (fieldKey === "dispatchId") {
    const dispatch = salesData.getRecord("delivery-dispatch", value);
    const customer = dispatch ? salesData.getRecord("customer-management", dispatch.customerId) : null;
    const patch = {
      dispatchId: value,
      salesOrderId: dispatch?.salesOrderId,
      customerId: dispatch?.customerId,
      customerName: dispatch?.customerName,
      gstin: customer?.gstin || "",
      pan: customer?.pan || "",
      billingAddress: fullAddress(customer),
      shippingAddress: dispatch?.deliveryAddress || "",
      destinationState: customer?.billingState || "",
      stateCode: customer?.gstStateCode || "",
      warehouse: dispatch?.warehouse,
    };
    if (dispatch && hasEmptyItems) {
      patch.items = dispatch.items.map((item) => {
        const product = masterData.getRows("product-item").find((p) => p.code === item.productCode);
        return {
          productCode: item.productCode,
          productName: item.productName,
          hsn: product?.hsnCode || "",
          uom: item.uom,
          qty: item.dispatchQty,
          rate: product?.price || 0,
          discountPercent: customer?.discountPercent || 0,
          gstRate: product?.gst || 0,
          batchNo: item.batchNo || "",
        };
      });
    }
    return patch;
  }
  if (fieldKey === "invoiceId") {
    const invoice = salesData.getRecord("sales-invoice", value);
    const customer = invoice ? salesData.getRecord("customer-management", invoice.customerId) : null;
    const patch = {
      invoiceId: value,
      salesOrderId: invoice?.salesOrderId,
      dispatchId: invoice?.dispatchId,
      customerId: invoice?.customerId,
      customerName: invoice?.customerName,
      customerPhone: customer?.mobile || "",
    };
    if (invoice && hasEmptyItems) {
      const returnedSoFar = sumPriorByProduct(salesData.getRows("sales-return"), "invoiceId", value, "returnQty");
      patch.items = invoice.items
        .map((item) => ({
          productCode: item.productCode,
          productName: item.productName,
          invoicedQty: Math.max(0, (Number(item.qty) || 0) - (returnedSoFar[item.productCode] || 0)),
          returnQty: 0,
          rate: item.rate,
          discountPercent: item.discountPercent,
          gstRate: item.gstRate,
          returnReason: "",
          condition: "Good",
        }))
        .filter((l) => l.invoicedQty > 0);
    }
    return patch;
  }
  return {};
}

function StatBox({ label, value, tone }) {
  const toneClass = tone === "danger" ? "text-[var(--danger)]" : tone === "warning" ? "text-[var(--warning)]" : tone === "success" ? "text-emerald-700" : "text-[var(--ink)]";
  return (
    <div className="rounded-md border border-[var(--line)] bg-white p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function LineItemCell({ column, row, disabled, onChange, formValues, ctx }) {
  const readOnly = disabled || column.readOnly;
  const { salesData, masterData } = ctx;

  if (column.type === "composition-select") {
    const products = masterData.getRows("product-item");
    const compositionRows = masterData.getRows("generic-composition");
    const selectedProduct = products.find((product) => product.code === row.productCode);
    const currentValue = row.composition || selectedProduct?.composition || selectedProduct?.genericName || "";
    const options = uniqueOptions([
      ...compositionRows.filter((item) => item.status !== "Inactive").map(compositionOptionValue),
      ...products.map((product) => product.composition || product.genericName),
      currentValue,
    ]);

    return (
      <select
        disabled={readOnly}
        value={currentValue}
        onChange={(event) => {
          const composition = event.target.value;
          onChange({
            ...row,
            composition,
            genericName: compositionRows.find((item) => compositionOptionValue(item) === composition)?.name || "",
            productCode: "",
            productName: "",
            hsn: "",
            uom: "",
            rate: 0,
            discountPercent: 0,
            gstRate: 0,
          });
        }}
        className="w-full min-w-[260px] rounded border border-[var(--line)] px-2 py-2 text-sm disabled:bg-slate-50 disabled:text-[var(--muted)]"
      >
        <option value="">Select composition...</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (column.type === "product-select") {
    const products = masterData.getRows("product-item");
    const compositionRows = masterData.getRows("generic-composition");
    const options = column.dependsOnComposition
      ? products.filter((product) =>
          product.code === row.productCode || productMatchesComposition(product, row.composition, compositionRows)
        )
      : products;
    const medicineDisabled = readOnly || (column.dependsOnComposition && !row.composition);
    return (
      <MedicineSelect
        disabled={medicineDisabled}
        value={row.productCode || ""}
        options={options}
        placeholder={column.dependsOnComposition && !row.composition ? "Select composition first..." : "Select medicine..."}
        onChange={(code) => {
          const product = products.find((p) => p.code === code);
          const customer = salesData.getRecord("customer-management", formValues.customerId);
          onChange({
            ...row,
            productCode: code,
            productName: product?.name || "",
            hsn: product?.hsnCode || "",
            composition: row.composition || product?.composition || product?.genericName || "",
            genericName: product?.genericName || "",
            category: product?.category || "",
            location: productLocation(product),
            uom: productUnit(product),
            rate: product?.sellingPrice ?? product?.price ?? row.rate ?? 0,
            discountPercent: customer?.discountPercent ?? row.discountPercent ?? 0,
            gstRate: product?.gst ?? row.gstRate ?? 18,
          });
        }}
      />
    );
  }

  if (column.type === "computed-line-total") {
    const value = (Number(row.qty) || 0) * (Number(row.rate) || 0);
    return <span className="block whitespace-nowrap px-2 py-2 text-right text-sm font-medium text-[var(--ink)]">{money.format(value)}</span>;
  }

  if (column.type === "computed-gst-line") {
    const qty = Number(row.qty ?? row.returnQty ?? row.dispatchQty ?? row.allocatedQty) || 0;
    const isIntrastate = formValues.destinationState === COMPANY_STATE;
    const tax = computeLineTax({ ...row, qty }, isIntrastate);
    const value = { taxable: tax.taxableValue, cgst: tax.cgstAmt, sgst: tax.sgstAmt, igst: tax.igstAmt, total: tax.lineTotal }[column.part] ?? 0;
    return <span className="block whitespace-nowrap px-2 py-1.5 text-sm font-medium text-[var(--ink)]">{money.format(value)}</span>;
  }

  if (column.type === "available-to-allocate") {
    const avail = row.productCode ? salesData.getAvailableToAllocate(row.productCode) : null;
    return <span className="block whitespace-nowrap px-2 py-1.5 text-sm font-medium text-[var(--ink)]">{avail === null ? "—" : avail}</span>;
  }

  if (readOnly) {
    return <span className="block whitespace-nowrap px-2 py-1.5 text-sm text-[var(--muted)]">{row[column.key] ?? ""}</span>;
  }

  if (column.type === "select") {
    return (
      <select
        value={row[column.key] || ""}
        onChange={(event) => onChange({ ...row, [column.key]: event.target.value })}
        className="w-full min-w-[130px] rounded border border-[var(--line)] px-2 py-1.5 text-sm"
      >
        <option value="">Select...</option>
        {column.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={column.type === "number" ? "number" : column.type === "date" ? "date" : "text"}
      value={row[column.key] ?? ""}
      onChange={(event) => {
        let value = event.target.value;
        if (column.maxKey && value !== "" && Number(value) > Number(row[column.maxKey])) value = String(row[column.maxKey]);
        onChange({ ...row, [column.key]: value });
      }}
      className="w-full min-w-[90px] rounded border border-[var(--line)] px-2 py-1.5 text-sm"
    />
  );
}

function LineItemsField({ field, rows, disabled, onChange, onFormValueChange, formValues, formErrors, ctx }) {
  const items = Array.isArray(rows) ? rows : [];
  const isMedicineRequest = field.variant === "medicine-request";
  const paymentModes = Array.isArray(field.paymentModes) ? field.paymentModes : [];
  const payments = Array.isArray(formValues.payments) && formValues.payments.length
    ? formValues.payments
    : [{ mode: formValues.paymentMode || "Cash", amount: formValues.amountReceived ?? "" }];
  const deliveryCharge = field.showDeliveryCharge ? Number(formValues.freight) || 0 : 0;
  const itemSummary = computeOrderTotals(items, {
    destinationState: formValues.destinationState,
    freight: deliveryCharge,
  });
  const gstTotal = itemSummary.totalCGST + itemSummary.totalSGST + itemSummary.totalIGST;
  return (
    <div>
      {isMedicineRequest && (
        <div className="mb-3 flex items-center gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Medicine Items</h3>
          {!disabled && field.allowAddRemove && (
            <button type="button" onClick={() => onChange([...items, {}])} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary-deep)]">
              <Plus size={15} /> Add Item
            </button>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-md border border-[var(--line)]">
        <table className={`w-full text-left text-sm ${isMedicineRequest ? "min-w-[1100px]" : "min-w-[900px]"}`}>
          <thead className="bg-slate-50 text-xs uppercase text-[var(--muted)]">
            <tr>
              {field.columns.map((col) => (
                <th key={col.key} className={`px-2 py-2 first:pl-3 ${col.align === "right" ? "text-right" : ""}`} style={col.minWidth ? { minWidth: col.minWidth } : undefined}>
                  {col.label}
                  {col.required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
                </th>
              ))}
              {!disabled && field.allowAddRemove && <th className="px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={field.columns.length + 1} className="px-3 py-4 text-center text-sm text-[var(--muted)]">
                  No items yet.
                </td>
              </tr>
            )}
            {items.map((row, index) => (
              <tr key={index} className="border-t border-slate-100">
                {field.columns.map((col) => (
                  <td key={col.key} className="px-2 py-1.5 first:pl-3">
                    <LineItemCell
                      column={col}
                      row={row}
                      disabled={disabled}
                      formValues={formValues}
                      ctx={ctx}
                      onChange={(next) => {
                        const updated = [...items];
                        updated[index] = next;
                        onChange(updated);
                      }}
                    />
                  </td>
                ))}
                {!disabled && field.allowAddRemove && (
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))} className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] hover:bg-red-50 hover:text-[var(--danger)]">
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isMedicineRequest && !disabled && field.allowAddRemove && (
        <button type="button" onClick={() => onChange([...items, {}])} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-deep)]">
          <Plus size={13} /> Add Item
        </button>
      )}
      {isMedicineRequest && (
        <div className={`mt-4 ${paymentModes.length ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start" : "flex justify-end"}`}>
          {paymentModes.length > 0 && (
            <section className="min-w-0 max-w-2xl">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Payment Details</h3>
                  {payments.length > 1 && (
                    <span className="text-xs text-[var(--muted)]">Total: {money.format(totalPayments({ payments }))}</span>
                  )}
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onFormValueChange("payments", [...payments, { mode: "", amount: "" }])}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] px-2 py-1 text-xs font-semibold text-[var(--primary)] hover:bg-blue-50"
                  >
                    <Plus size={13} /> Add Payment
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <div className="hidden grid-cols-[minmax(12rem,1fr)_minmax(9rem,0.65fr)_2rem] gap-2 px-1 text-xs font-medium text-[var(--muted)] sm:grid">
                  <span>Payment Mode<span className="ml-0.5 text-[var(--danger)]">*</span></span>
                  <span>Amount Received</span>
                  <span />
                </div>
                {payments.map((payment, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2 rounded-md border border-[var(--line)] bg-slate-50/60 p-2 sm:grid-cols-[minmax(12rem,1fr)_minmax(9rem,0.65fr)_2rem] sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
                    <label className="text-xs font-medium text-[var(--muted)] sm:contents">
                      <span className="sm:hidden">Payment Mode<span className="ml-0.5 text-[var(--danger)]">*</span></span>
                      <select
                        value={payment.mode || ""}
                        disabled={disabled}
                        aria-label={`Payment mode ${index + 1}`}
                        onChange={(event) => {
                          const updated = [...payments];
                          updated[index] = { ...payment, mode: event.target.value };
                          onFormValueChange("payments", updated);
                        }}
                        className="h-9 w-full rounded-md border border-[var(--line)] bg-white px-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-[var(--muted)]"
                      >
                        <option value="">Select payment mode...</option>
                        {paymentModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-[var(--muted)] sm:contents">
                      <span className="sm:hidden">Amount Received</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={payment.amount ?? ""}
                        disabled={disabled}
                        aria-label={`Amount received ${index + 1}`}
                        onChange={(event) => {
                          const amount = event.target.value;
                          if (amount !== "" && Number(amount) < 0) return;
                          const updated = [...payments];
                          updated[index] = { ...payment, amount };
                          onFormValueChange("payments", updated);
                        }}
                        className="h-9 w-full rounded-md border border-[var(--line)] bg-white px-2 text-right text-sm tabular-nums text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-[var(--muted)]"
                      />
                    </label>
                    {!disabled && payments.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remove payment ${index + 1}`}
                        onClick={() => onFormValueChange("payments", payments.filter((_, paymentIndex) => paymentIndex !== index))}
                        className="inline-flex h-8 w-8 items-center justify-center justify-self-end rounded text-[var(--muted)] hover:bg-red-50 hover:text-[var(--danger)]"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : <span className="hidden sm:block" />}
                  </div>
                ))}
              </div>
              {formErrors.payments && <p className="mt-1 text-xs text-[var(--danger)]">{formErrors.payments}</p>}
            </section>
          )}
          <div className={`w-full max-w-sm rounded-md border border-[var(--line)] bg-slate-50 px-4 py-3 text-sm ${paymentModes.length ? "lg:justify-self-end" : ""}`}>
            <div className="flex items-center justify-between gap-4 py-0.5">
              <span className="text-[var(--muted)]">Subtotal</span>
              <span className="tabular-nums text-[var(--ink)]">{money.format(itemSummary.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-0.5">
              <span className="text-[var(--muted)]">Discount</span>
              <span className="tabular-nums text-[var(--ink)]">{money.format(-itemSummary.totalDiscount)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-0.5">
              <span className="text-[var(--muted)]">GST</span>
              <span className="tabular-nums text-[var(--ink)]">{money.format(gstTotal)}</span>
            </div>
            {field.showDeliveryCharge && (
              <div className="flex items-center justify-between gap-4 py-1">
                <label htmlFor={`${field.key}-delivery-charge`} className="text-[var(--muted)]">
                  Delivery Charge
                </label>
                <div className="relative w-32">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--muted)]">₹</span>
                  <input
                    id={`${field.key}-delivery-charge`}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={formValues.freight ?? ""}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (nextValue === "" || Number(nextValue) >= 0) onFormValueChange("freight", nextValue);
                    }}
                    className="w-full rounded-md border border-[var(--line)] bg-white py-1.5 pl-7 pr-2 text-right text-sm tabular-nums text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-[var(--muted)]"
                    aria-label="Delivery Charge"
                  />
                </div>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-4 border-t border-[var(--line)] pt-2 font-semibold text-[var(--ink)]">
              <span>Grand Total</span>
              <span className="tabular-nums">{money.format(itemSummary.grandTotal)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ field, value, error, disabled, onChange, onFormValueChange, formValues, formErrors = {}, ctx }) {
  const baseInput = `w-full rounded-md border bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-[var(--muted)] ${
    error ? "border-[var(--danger)] focus:ring-red-100" : "border-[var(--line)]"
  }`;
  const { salesData } = ctx;

  if (field.type === "lineItems") {
    return (
      <div>
        <LineItemsField field={field} rows={value} disabled={disabled} onChange={onChange} onFormValueChange={onFormValueChange} formValues={formValues} formErrors={formErrors} ctx={ctx} />
        {error && <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  if (field.type === "customer-autocomplete") {
    const customers = salesData
      .getRows("customer-management")
      .filter((customer) => customer.status !== "Inactive");
    return (
      <CustomerAutocomplete
        field={field}
        value={value}
        error={error}
        disabled={disabled}
        customers={customers}
        inputClassName={baseInput}
        onChange={onChange}
        onSelect={(customer) => onFormValueChange("customerId", keyOf(customer))}
      />
    );
  }

  if (["customer-select", "sales-order-select", "allocation-select", "dispatch-select", "invoice-select"].includes(field.type)) {
    const sourceEntity = { "customer-select": "customer-management", "sales-order-select": "sales-order", "allocation-select": "product-allocation", "dispatch-select": "delivery-dispatch", "invoice-select": "sales-invoice" }[field.type];
    const rows = salesData.getRows(sourceEntity);
    const labelFor = (row) => (sourceEntity === "customer-management" ? `${row.code} — ${row.name}` : `${row.id} — ${row.customerName}`);
    return (
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
          {field.label}
          {field.required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
        </label>
        <select value={value || ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={baseInput}>
          <option value="">Select...</option>
          {rows.map((row) => (
            <option key={keyOf(row)} value={keyOf(row)}>
              {labelFor(row)}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  if (field.type === "credit-check-panel") {
    const customer = salesData.getRecord("customer-management", formValues.customerId);
    const outstanding = customer ? computeCustomerOutstanding(customer.code, salesData.getRows("sales-invoice"), salesData.getRows("sales-return")) : null;
    const creditLimit = Number(customer?.creditLimit) || 0;
    const available = creditLimit - (outstanding?.totalOutstanding || 0);
    return (
      <div className="sm:col-span-2 lg:col-span-3 space-y-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatBox label="Credit Limit" value={money0.format(creditLimit)} />
          <StatBox label="Current Outstanding" value={money0.format(outstanding?.totalOutstanding || 0)} tone={outstanding?.totalOutstanding ? "warning" : undefined} />
          <StatBox label="Available Credit" value={money0.format(available)} tone={available < 0 ? "danger" : "success"} />
        </div>
        {customer?.creditHoldStatus && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
            This customer is on credit hold — confirm payment status before approving this order.
          </div>
        )}
        {!customer && <p className="text-sm text-[var(--muted)]">Select a customer on the Overview tab to see credit details.</p>}
      </div>
    );
  }

  if (field.type === "order-totals-panel") {
    const totals = computeOrderTotals(formValues.items, formValues);
    return (
      <div className="sm:col-span-2 lg:col-span-3 rounded-md border border-[var(--line)] bg-slate-50 p-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
          <Row label="Subtotal" value={totals.subtotal} />
          <Row label="Discount" value={-totals.totalDiscount} />
          <Row label="Taxable Value" value={totals.taxableTotal} />
          {totals.isIntrastate ? (
            <>
              <Row label="CGST" value={totals.totalCGST} />
              <Row label="SGST" value={totals.totalSGST} />
            </>
          ) : (
            <Row label="IGST" value={totals.totalIGST} />
          )}
          <Row label="Freight + Packing + Other" value={totals.freight + totals.packing + totals.other} />
          <Row label="Round Off" value={totals.roundOff} />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3">
          <span className="text-sm font-semibold text-[var(--ink)]">Grand Total</span>
          <span className="text-lg font-bold text-[var(--primary)]">{money0.format(totals.grandTotal)}</span>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">{totals.isIntrastate ? "Intrastate transaction — CGST + SGST applied." : "Interstate transaction — IGST applied."}</p>
      </div>
    );
  }

  if (field.type === "bill-payment-summary") {
    const totals = computeOrderTotals(formValues.items, formValues);
    const received = totalPayments(formValues);
    const balance = Math.max(0, totals.grandTotal - received);
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatBox label="Bill Total" value={money0.format(totals.grandTotal)} />
        <StatBox label="Amount Received" value={money0.format(received)} tone={received > 0 ? "success" : undefined} />
        <StatBox label="Balance Due" value={money0.format(balance)} tone={balance > 0 ? "warning" : "success"} />
      </div>
    );
  }

  if (field.type === "payments-panel") {
    const totals = computeOrderTotals(formValues.items, formValues);
    const paid = (formValues.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const balance = Math.max(0, totals.grandTotal - paid);
    return (
      <div className="sm:col-span-2 lg:col-span-3 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatBox label="Invoice Total" value={money0.format(totals.grandTotal)} />
          <StatBox label="Amount Received" value={money0.format(paid)} tone="success" />
          <StatBox label="Balance Due" value={money0.format(balance)} tone={balance > 0 ? "warning" : "success"} />
        </div>
        <div className="overflow-x-auto rounded-md border border-[var(--line)]">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(formValues.payments || []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-sm text-[var(--muted)]">
                    No payments recorded yet.
                  </td>
                </tr>
              )}
              {(formValues.payments || []).map((p, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2">{p.date}</td>
                  <td className="px-3 py-2">{p.mode}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.reference}</td>
                  <td className="px-3 py-2 text-right font-medium">{money.format(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (field.type === "toggle") {
    return (
      <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] px-3 py-2.5">
        <span className="text-sm font-medium text-[var(--ink)]">{field.label}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(!value)}
          aria-pressed={Boolean(value)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${value ? "bg-[var(--primary)]" : "bg-slate-200"}`}
        >
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
          {field.label}
          {field.required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
        </label>
        <select value={value || ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={baseInput}>
          <option value="">Select {field.label.toLowerCase()}...</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className={field.span === "full" ? "sm:col-span-2 lg:col-span-3" : ""}>
        <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
          {field.label}
          {field.required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
        </label>
        <textarea value={value || ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} rows={3} className={baseInput} />
        {error && <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  if (field.type === "file") {
    return (
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">{field.label}</label>
        <label className={`flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm ${disabled ? "text-[var(--muted)]" : "text-[var(--ink)] hover:bg-slate-50"} border-[var(--line)]`}>
          <Paperclip size={14} />
          {value ? value : "Choose file..."}
          <input type="file" disabled={disabled} className="hidden" onChange={(event) => onChange(event.target.files?.[0]?.name || "")} />
        </label>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
        {field.label}
        {field.required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
        {field.autoLabel && <span className="ml-1.5 text-xs font-normal text-[var(--muted)]">({field.autoLabel})</span>}
      </label>
      <input
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "datetime-local" ? "datetime-local" : field.type === "tel" ? "tel" : "text"}
        value={field.type === "datetime-local" && /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? `${value}T00:00` : value || ""}
        disabled={disabled || Boolean(field.autoLabel) || field.readOnly}
        placeholder={field.placeholder}
        inputMode={field.inputMode}
        maxLength={field.maxLength}
        pattern={field.pattern}
        onChange={(event) => {
          let nextValue = event.target.value;
          if (field.digitsOnly) nextValue = nextValue.replace(/\D/g, "");
          if (field.maxLength) nextValue = nextValue.slice(0, field.maxLength);
          onChange(nextValue);
        }}
        className={baseInput}
      />
      {error && <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <>
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right font-medium text-[var(--ink)]">{money.format(value)}</span>
    </>
  );
}

export function SalesForm({ entityKey, mode, recordId, presentation = "standard" }) {
  const entity = salesEntities[entityKey];
  const salesData = useSalesData();
  const masterData = useMasterData();
  const showToast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const isView = mode === "view";
  const isCreate = mode === "create";
  const isPersisted = !isCreate;
  const isCreateBill = presentation === "bill" && entityKey === "sales-order" && isCreate;

  const existingRecord = recordId ? salesData.getRecord(entityKey, recordId) : null;
  const convertFrom = !recordId ? location.state?.convertFrom : null;
  const duplicateFrom = !recordId ? location.state?.duplicateFrom : null;
  const presetCustomerId = !recordId ? location.state?.presetCustomerId : null;

  const [values, setValues] = useState(() => {
    if (existingRecord) return { ...existingRecord };

    const rows = salesData.getRows(entityKey);
    const documentDate = entityKey === "sales-order" ? localDateTimeNow() : today();
    const base = {
      id: entityKey === "sales-order"
        ? nextMonthlyId(rows, "id", "IN", documentDate)
        : nextId(rows, "id", fallbackIds[entityKey]),
      date: documentDate,
      status: "Draft",
      activity: [{ event: "Draft", date: documentDate, by: "You" }],
      ...(entityKey === "sales-order" && !isCreateBill ? { salesChannel: "Direct" } : {}),
      ...(isCreateBill
        ? {
            source: "Create Bill",
            customerType: "",
            priority: "Normal",
            paymentTerms: "Cash on Delivery",
            paymentMode: "Cash",
            amountReceived: "",
            paymentReference: "",
            payments: [{ mode: "Cash", amount: "" }],
          }
        : {}),
    };
    if (entity.form.tabs.some((tab) => tab.fields.some((f) => f.type === "lineItems"))) {
      base.items = entityKey === "sales-order" ? [{}] : [];
    }

    if (duplicateFrom) {
      return { ...duplicateFrom, ...base, createdBy: undefined, createdAt: undefined, updatedBy: undefined, updatedAt: undefined };
    }

    if (convertFrom) {
      const linkField = LINK_FIELD_BY_PAIR[`${convertFrom.entityKey}->${entityKey}`];
      if (linkField) return { ...base, ...buildLinkedPatch(entityKey, linkField, keyOf(convertFrom.record), salesData, masterData, true) };
    }

    if (presetCustomerId && entityKey === "sales-order") {
      return { ...base, ...buildLinkedPatch(entityKey, "customerId", presetCustomerId, salesData, masterData, true) };
    }

    return base;
  });

  useEffect(() => {
    if (!isCreate && existingRecord) setValues({ ...existingRecord });
  }, [existingRecord, isCreate]);

  const [activeTab, setActiveTab] = useState(entity.form.tabs[0].key);
  const [errors, setErrors] = useState({});
  const [errorBanner, setErrorBanner] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [dispositionDraft, setDispositionDraft] = useState("Restock");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState({ amount: "", mode: "Bank Transfer", reference: "", notes: "" });
  const [isSaving, setIsSaving] = useState(false);

  const ctx = { salesData, masterData };

  function handleFieldChange(field, next) {
    if (LINK_FIELD_KEYS.includes(field.key)) {
      setValues((prev) => {
        const patch = buildLinkedPatch(entityKey, field.key, next, salesData, masterData, Array.isArray(prev.items) && prev.items.length === 0);
        if (isCreateBill && field.key === "customerId" && patch.customerMobile) {
          patch.customerMobile = String(patch.customerMobile).replace(/\D/g, "").slice(-10);
        }
        return { ...prev, ...patch };
      });
      return;
    }
    setValues((prev) => {
      const updated = { ...prev, [field.key]: next };
      (field.clearOnChange || []).forEach((key) => {
        updated[key] = "";
      });
      return updated;
    });
  }

  function validate() {
    const nextErrors = {};
    let firstInvalidTab = null;
    (isCreateBill ? billTabs : entity.form.tabs).forEach((tab) => {
      tab.fields.flatMap((field) => [field, ...(field.paymentFields || [])]).forEach((field) => {
        const fieldValue = String(values[field.key] ?? "").trim();
        if (field.required && !field.autoLabel && !fieldValue) {
          nextErrors[field.key] = `${field.label} is required.`;
          if (!firstInvalidTab) firstInvalidTab = tab.key;
          return;
        }
        if (field.digitsOnly && fieldValue && !/^\d+$/.test(fieldValue)) {
          nextErrors[field.key] = `${field.label} must contain numbers only.`;
          if (!firstInvalidTab) firstInvalidTab = tab.key;
        } else if (field.maxLength && fieldValue.length > field.maxLength) {
          nextErrors[field.key] = `${field.label} must not exceed ${field.maxLength} digits.`;
          if (!firstInvalidTab) firstInvalidTab = tab.key;
        }
      });
    });
    if (entityKey === "sales-order") {
      const validItems = (values.items || []).filter(
        (item) => item.productCode && Number(item.qty) > 0
      );
      if (validItems.length === 0) {
        nextErrors.items = "Add at least one medicine with a quantity greater than zero.";
        if (!firstInvalidTab) firstInvalidTab = "items";
      }
    }
    if (isCreateBill) {
      const payments = Array.isArray(values.payments) ? values.payments : [];
      if (payments.length === 0 || payments.some((payment) => !String(payment.mode || "").trim())) {
        nextErrors.payments = "Select a payment mode for every payment row.";
        if (!firstInvalidTab) firstInvalidTab = "items";
      } else if (totalPayments(values) > computeOrderTotals(values.items, values).grandTotal) {
        nextErrors.payments = "Amount received cannot exceed the bill total.";
        if (!firstInvalidTab) firstInvalidTab = "items";
      }
    }
    setErrors(nextErrors);
    if (firstInvalidTab) {
      setActiveTab(firstInvalidTab);
      setErrorBanner(`Please fill in ${Object.keys(nextErrors).length} required field(s).`);
      return false;
    }
    setErrorBanner("");
    return true;
  }

  async function persist(patch) {
    const key = keyOf(values);
    const record = { ...values, ...patch, updatedBy: "You", updatedAt: now() };
    if (isCreateBill) delete record.salesChannel;
    let savedRecord;
    if (isCreate) {
      record.createdBy = "You";
      record.createdAt = now();
      savedRecord = await salesData.addRow(entityKey, record);
    } else {
      savedRecord = await salesData.updateRow(entityKey, key, record);
    }
    const nextRecord = savedRecord || record;
    setValues(nextRecord);
    return nextRecord;
  }

  async function handleFirstSave() {
    if (isSaving || !validate()) return;
    const billTotals = isCreateBill ? computeOrderTotals(values.items, values) : null;
    const amountReceived = totalPayments(values);
    const payments = isCreateBill
      ? (values.payments || [])
          .filter((payment) => payment.mode && payment.amount !== "" && Number(payment.amount) > 0)
          .map((payment) => ({ date: today(), mode: payment.mode, amount: Number(payment.amount) }))
      : values.payments;
    setIsSaving(true);
    setErrorBanner("");
    try {
      const record = await persist({
        status: "Draft",
        ...(isCreateBill
          ? {
              billNumber: values.id,
              billTotal: billTotals.grandTotal,
              amountReceived,
              paymentMode: values.payments?.[0]?.mode || values.paymentMode,
              payments,
              paymentStatus:
                amountReceived >= billTotals.grandTotal
                  ? "Paid"
                  : amountReceived > 0
                    ? "Partially Paid"
                    : "Unpaid",
            }
          : {}),
      });
      showToast(isCreateBill ? `${keyOf(record)} saved in Sales Order.` : `${keyOf(record)} created.`);
      navigate(isCreateBill ? "/sales/sales-order" : `/sales/${entityKey}/${keyOf(record)}/view`);
    } catch (error) {
      setErrorBanner(error.message || "Unable to save the bill.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveChanges() {
    if (isSaving) return;
    setIsSaving(true);
    setErrorBanner("");
    try {
      await persist({});
      showToast(`${values.id} saved.`);
      navigate(`/sales/${entityKey}`);
    } catch (error) {
      setErrorBanner(error.message || "Unable to save changes.");
    } finally {
      setIsSaving(false);
    }
  }

  function runTransition(action) {
    if (action.salesEffect === "recordPayment" && !action.to) {
      setPaymentDraft({ amount: "", mode: "Bank Transfer", reference: "", notes: "" });
      setPaymentDialogOpen(true);
      return;
    }
    if (action.requiresReason) {
      setReasonDraft("");
      setPendingAction(action);
      return;
    }
    if (action.requiresDisposition) {
      setDispositionDraft(values.disposition || "Restock");
      setPendingAction(action);
      return;
    }
    if (!["Draft", "Cancelled", "Rejected"].includes(action.to) && !validate()) return;
    if (action.confirm) {
      setPendingAction(action);
      return;
    }
    applyTransition(action, {});
  }

  async function applyTransition(action, extra) {
    if (action.salesEffect === "reserveStock") salesData.reserveStock(values.items);
    if (action.salesEffect === "releaseStock") salesData.releaseStock(values.items);
    if (action.salesEffect === "dispatchStock") salesData.dispatchStock(values.items, values.warehouse);
    if (action.salesEffect === "restockIfApplicable" && (extra.disposition || values.disposition) === "Restock") salesData.restockStock(values.items);

    const patch = { status: action.to, ...extra, activity: [...(values.activity || []), { event: action.to, date: today(), by: "You" }] };

    if (action.salesEffect === "issueCreditNote") {
      const priorNoted = salesData.getRows(entityKey).filter((r) => r.creditNoteNumber);
      const totals = computeOrderTotals(values.items.map((i) => ({ ...i, qty: i.returnQty })), values);
      patch.creditNoteNumber = nextId(priorNoted, "creditNoteNumber", "CN-2026-0001");
      patch.creditNoteDate = today();
      patch.creditNoteAmount = Math.round(totals.grandTotal * 100) / 100;
    }

    setIsSaving(true);
    setErrorBanner("");
    try {
      const record = await persist(patch);
      showToast(`${keyOf(record)} is now ${action.to}.`);
      setPendingAction(null);
      setReasonDraft("");
    } catch (error) {
      setErrorBanner(error.message || "Unable to update the sales record.");
    } finally {
      setIsSaving(false);
    }
  }

  function submitPayment() {
    const updated = salesData.recordPayment(values.id, { amount: Number(paymentDraft.amount) || 0, mode: paymentDraft.mode, reference: paymentDraft.reference, notes: paymentDraft.notes });
    if (updated) setValues(updated);
    showToast(`Payment of ${money.format(Number(paymentDraft.amount) || 0)} recorded for ${values.id}.`);
    setPaymentDialogOpen(false);
  }

  function handleAction(action) {
    if (action.print) {
      window.print();
      return;
    }
    runTransition(action);
  }

  const recordKey = keyOf(values);
  const actions = entity.statusActions?.[values.status] || [];
  const tabs = entity.statusList ? [...entity.form.tabs, { key: "__activity", label: "Activity" }] : entity.form.tabs;
  const chainLinks = entity.renderDocumentChain ? entity.renderDocumentChain(values) : null;
  const cancelPath = isCreateBill ? "/sales/sales-order" : `/sales/${entityKey}`;
  const configuredPaymentModes = masterData
    .getRows("payment-mode")
    .filter((row) => row.status === "Active")
    .map((row) => {
      const name = String(row.name || "").trim();
      const bank = String(row.bank || "").trim();
      return bank ? `${name} (${bank})` : name;
    })
    .filter(Boolean);
  const configuredCustomerTypeRows = masterData
    .getRows("customer-type")
    .filter((row) => row.status !== "Inactive");
  const configuredCustomerTypes = configuredCustomerTypeRows
    .map((row) => row.name)
    .filter(Boolean);
  const customerTypeOptions = configuredCustomerTypes.length
    ? configuredCustomerTypes
    : ["Retail Customer", "Wholesale Customer", "Hospital / Clinic"];
  const selectedCustomerType = configuredCustomerTypeRows.find(
    (row) => normalizeFilterValue(row.name) === normalizeFilterValue(values.customerType)
  );
  const customerAddressRequired = normalizeFilterValue(selectedCustomerType?.addressRequired) === "yes";
  const stateDistricts = masterData.locationOptions || {};
  const stateOptions = Object.keys(stateDistricts);
  const districtOptions = values.destinationState ? stateDistricts[values.destinationState] || [] : [];
  const billPaymentModes = configuredPaymentModes.length
    ? configuredPaymentModes
    : ["Cash", "UPI", "Credit / Debit Card", "Credit Account"];
  const billTabs = isCreateBill
    ? [
        ...entity.form.tabs
          .filter((tab) => !["credit", "totals"].includes(tab.key))
          .filter((tab) => tab.key !== "billing" || customerAddressRequired)
          .map((tab) => ({
            ...tab,
            fields: tab.fields
              .filter((field) => !(tab.key === "overview" && field.key === "billingAddress"))
              .map((field) => {
                if (field.key === "salesChannel") {
                  return { key: "customerType", label: "Customer Type", type: "select", required: true, options: customerTypeOptions, clearOnChange: ["freight"] };
                }
                if (field.key === "customerName") {
                  return { ...field, type: "customer-autocomplete", clearOnChange: ["customerId"] };
                }
                if (field.key === "customerMobile") {
                  return { ...field, type: "customer-autocomplete", digitsOnly: true, inputMode: "numeric", maxLength: 10, pattern: "[0-9]*", clearOnChange: ["customerId"] };
                }
                if (tab.key === "items" && field.type === "lineItems") {
                  return {
                    ...field,
                    showDeliveryCharge: customerAddressRequired,
                    paymentModes: billPaymentModes,
                    columns: field.columns
                      .filter((column) => column.key !== "remarks")
                      .flatMap((column) =>
                        column.key === "uom"
                          ? [
                              { ...column, label: "Unit" },
                              { key: "discountPercent", label: "Discount (%)", type: "number", minWidth: 130 },
                              { key: "gstRate", label: "GST (%)", type: "number", minWidth: 110 },
                            ]
                          : [column]
                      ),
                  };
                }
                if (tab.key === "billing" && field.key === "destinationState") {
                  return { ...field, required: true, options: stateOptions, clearOnChange: ["district"] };
                }
                if (tab.key === "billing" && field.key === "district") {
                  return { ...field, type: "select", required: true, options: districtOptions, disabled: !values.destinationState };
                }
                return tab.key === "billing" ? { ...field, required: true } : field;
              }),
          })),
      ]
    : entity.form.tabs;

  function renderFormField(field) {
    const fullWidthTypes = ["lineItems", "credit-check-panel", "order-totals-panel", "bill-payment-summary", "payments-panel"];
    const isFullWidth = field.span === "full" || fullWidthTypes.includes(field.type);
    return (
      <div key={field.key} className={isFullWidth ? "sm:col-span-2 lg:col-span-3" : ""}>
        <Field
          field={field}
          value={values[field.key]}
          error={errors[field.key]}
          disabled={isView || field.disabled}
          formValues={values}
          formErrors={errors}
          ctx={ctx}
          onChange={(next) => handleFieldChange(field, next)}
          onFormValueChange={(key, next) => handleFieldChange({ key }, next)}
        />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 flex items-center gap-1 text-xs text-[var(--muted)] print:hidden">
        <span>Sales</span>
        <Crumb size={12} />
        {isCreateBill ? (
          <span className="text-[var(--ink)]">Create Bill</span>
        ) : (
          <>
            <Link to={`/sales/${entityKey}`} className="hover:text-[var(--primary)]">
              {entity.label}
            </Link>
            <Crumb size={12} />
            <span className="text-[var(--ink)]">
              {isView ? recordKey : isCreate ? "New" : "Edit"} {isView ? "" : entity.singular}
            </span>
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-[var(--ink)]">
            {isCreateBill && <ReceiptIndianRupee size={21} className="text-[var(--primary)]" />}
            {isCreateBill ? "Create Bill" : isCreate ? `New ${entity.label}` : isView ? recordKey : `Edit ${recordKey}`}
          </h2>
          {isCreateBill && <p className="mt-1 text-sm text-[var(--muted)]">Create a pharmacy bill and save it directly in Sales Order.</p>}
        </div>
        {isCreateBill && (
          <button type="button" onClick={() => navigate(cancelPath)} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-slate-50">
            <ArrowLeft size={15} /> Back
          </button>
        )}
        {!isCreate && <span className="rounded-full border border-[var(--line)] bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-[var(--ink)]">{values.status}</span>}
      </div>
      {isView && <AuditStrip record={values} />}

      {isPersisted && chainLinks && chainLinks.some((l) => l.id) && (
        <div className="mt-3 print:hidden">
          <DocumentChain links={chainLinks} />
        </div>
      )}

      {entity.statusList && isPersisted && (
        <div className="mt-3 rounded-md border border-[var(--line)] bg-white p-4 print:hidden">
          <WorkflowTimeline steps={entity.statusList.filter((s) => !["Rejected", "Cancelled"].includes(s))} activity={entity.statusList.slice(0, entity.statusList.indexOf(values.status) + 1).map((event) => ({ event }))} />
        </div>
      )}

      {errorBanner && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 print:hidden">
          <AlertCircle size={16} />
          {errorBanner}
        </div>
      )}

      <div className="mt-4 rounded-md border border-[var(--line)] bg-white">
        {isCreateBill ? (
          <div className="divide-y divide-[var(--line)]">
            {billTabs.map((tab) => (
              <section key={tab.key} className="p-4 sm:p-5">
                {tab.key !== "items" && (
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{tab.label}</h3>
                )}
                <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${tab.key === "overview" ? "xl:grid-cols-5" : ""}`}>
                  {tab.fields.map(renderFormField)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1 overflow-x-auto border-b border-[var(--line)] px-3 pt-2 print:hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap rounded-t-md border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === tab.key ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-5">
              {activeTab === "__activity" ? (
            <div className="overflow-x-auto rounded-md border border-[var(--line)]">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {(values.activity || []).map((entry, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-[var(--ink)]">{entry.event}</td>
                      <td className="px-3 py-2">{entry.date}</td>
                      <td className="px-3 py-2">{entry.by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              ) : (
                entity.form.tabs
                  .filter((tab) => tab.key === activeTab)
                  .map((tab) => (
                    <div key={tab.key} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {tab.fields.map(renderFormField)}
                    </div>
                  ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-end gap-2 rounded-md border border-[var(--line)] bg-white/95 p-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] backdrop-blur print:hidden">
        <button type="button" onClick={() => navigate(cancelPath)} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-slate-50">
          {isView ? "Close" : "Cancel"}
        </button>
        {isView && (
          <button type="button" onClick={() => window.print()} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-slate-50">
            Print
          </button>
        )}
        {isCreate && (
          <button type="button" disabled={isSaving} onClick={handleFirstSave} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-deep)] disabled:cursor-not-allowed disabled:opacity-60">
            {isCreateBill && <ReceiptIndianRupee size={16} />}
            {isSaving ? "Saving..." : isCreateBill ? "Save Bill" : "Save Draft"}
          </button>
        )}
        {mode === "edit" && (
          <>
            <button type="button" disabled={isSaving} onClick={handleSaveChanges} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <Link to={`/sales/${entityKey}/${values.id}/view`} className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-deep)]">
              Done Editing
            </Link>
          </>
        )}
        {isView &&
          actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => handleAction(action)}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                action.kind === "primary" ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-deep)]" : action.tone === "danger" ? "border border-red-200 text-[var(--danger)] hover:bg-red-50" : "border border-[var(--line)] text-[var(--ink)] hover:bg-slate-50"
              }`}
            >
              {action.label}
            </button>
          ))}
        {isView && values.status === "Draft" && (
          <Link to={`/sales/${entityKey}/${values.id}/edit`} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-slate-50">
            Edit
          </Link>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingAction) && !pendingAction?.requiresReason && !pendingAction?.requiresDisposition}
        title={pendingAction?.confirm || `${pendingAction?.label}?`}
        message={`This will update ${recordKey} to "${pendingAction?.to}".`}
        confirmLabel={pendingAction?.label}
        tone={pendingAction?.tone === "danger" ? "danger" : "primary"}
        onConfirm={() => applyTransition(pendingAction, {})}
        onCancel={() => setPendingAction(null)}
      />

      {pendingAction?.requiresReason && (
        <Modal title={pendingAction.label} onCancel={() => setPendingAction(null)}>
          <p className="text-sm text-[var(--muted)]">Provide a reason for this action on {recordKey}.</p>
          <textarea value={reasonDraft} onChange={(e) => setReasonDraft(e.target.value)} rows={3} className="mt-3 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100" />
          <ModalActions onCancel={() => setPendingAction(null)} onConfirm={() => applyTransition(pendingAction, { reason: reasonDraft.trim() })} confirmDisabled={!reasonDraft.trim()} confirmLabel="Confirm" />
        </Modal>
      )}

      {pendingAction?.requiresDisposition && (
        <Modal title={pendingAction.label} onCancel={() => setPendingAction(null)}>
          <p className="text-sm text-[var(--muted)]">Choose a disposition for the returned items before approving for credit.</p>
          <select value={dispositionDraft} onChange={(e) => setDispositionDraft(e.target.value)} className="mt-3 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100">
            {["Restock", "Repair", "Rework", "Replace", "Return to Vendor", "Scrap"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <ModalActions onCancel={() => setPendingAction(null)} onConfirm={() => applyTransition(pendingAction, { disposition: dispositionDraft })} confirmLabel="Confirm" />
        </Modal>
      )}

      {paymentDialogOpen && (
        <Modal title="Record Payment" onCancel={() => setPaymentDialogOpen(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Amount Received</label>
              <input type="number" value={paymentDraft.amount} onChange={(e) => setPaymentDraft((p) => ({ ...p, amount: e.target.value }))} className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Payment Mode</label>
              <select value={paymentDraft.mode} onChange={(e) => setPaymentDraft((p) => ({ ...p, mode: e.target.value }))} className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100">
                {["Cash", "Bank Transfer", "UPI", "Card", "Cheque"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Reference / Transaction No.</label>
              <input value={paymentDraft.reference} onChange={(e) => setPaymentDraft((p) => ({ ...p, reference: e.target.value }))} className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>
          <ModalActions onCancel={() => setPaymentDialogOpen(false)} onConfirm={submitPayment} confirmLabel="Record Payment" confirmDisabled={!paymentDraft.amount || Number(paymentDraft.amount) <= 0} />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-md border border-[var(--line)] bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-[var(--ink)]">{title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, confirmLabel, confirmDisabled }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-slate-50">
        Cancel
      </button>
      <button type="button" disabled={confirmDisabled} onClick={onConfirm} className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-deep)] disabled:opacity-50">
        {confirmLabel}
      </button>
    </div>
  );
}
