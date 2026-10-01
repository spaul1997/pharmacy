import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { salesEntities } from "../../data/sales/entities.js";
import { computeOrderTotals, today } from "../../data/sales/shared.js";
import { useScopedState } from "../../lib/scopedStorage.js";
import {
  createSalesCustomer,
  createSalesBill,
  createSalesOrder,
  deleteSalesCustomer,
  deleteSalesBill,
  deleteSalesOrder,
  listSalesBills,
  listSalesCustomers,
  listSalesOrders,
  updateSalesCustomer,
  updateSalesBill,
  updateSalesOrder,
} from "../../services/salesService.js";
import { useMasterData } from "../master/MasterDataContext.jsx";

const SalesDataContext = createContext(null);

// Customer is code-keyed (like Master Management's entities); every other
// Sales entity is a numbered document keyed by id (like Purchase/Stock/
// Manufacturing's entities). See ManufacturingDataContext.jsx for the
// original version of this helper.
export function keyOf(row) {
  return row.id ?? row.code;
}

function initialEntityState() {
  const state = {};
  // Deep-copy array-shaped fields so editing one record's line items can't
  // mutate the shared seed data. Several of these keys are array-shaped only
  // on SOME entities (e.g. "notes" is an array on Customer rows but a plain
  // string on Invoice rows) — Array.isArray guards each one individually
  // rather than assuming presence implies array shape.
  const arrayFields = ["items", "shippingAddresses", "contacts", "attachments", "notes", "payments"];
  Object.keys(salesEntities).forEach((key) => {
    state[key] = salesEntities[key].rows.map((row) => {
      const copy = { ...row };
      arrayFields.forEach((field) => {
        if (Array.isArray(row[field])) copy[field] = row[field].map((entry) => ({ ...entry }));
      });
      return copy;
    });
  });
  return state;
}

// Sales' own lightweight per-product reservation ledger. Deliberately NOT an
// extension of StockDataContext (raw-material-only, warehouse-broken-down —
// extending it would mean redesigning an unrelated module's internals). Real
// stock decrements/increments still go through Master Management's
// product-item.stock via masterData.updateRow, same call shape Manufacturing's
// postFinishedGoodsReceipt already uses.
function initialReservedQty() {
  return {};
}

function customerIdentity(row) {
  const phone = String(row?.mobile || row?.phone || "").replace(/\D/g, "").slice(-10);
  return phone || String(row?.name || "").trim().toLowerCase();
}

function mergeCustomers(remoteRows, existingRows) {
  const remoteCodes = new Set(remoteRows.map(keyOf));
  const remoteIdentities = new Set(remoteRows.map(customerIdentity).filter(Boolean));
  return [
    ...remoteRows,
    ...existingRows.filter((row) => !remoteCodes.has(keyOf(row)) && !remoteIdentities.has(customerIdentity(row))),
  ];
}

export function SalesDataProvider({ children, storageScope, token }) {
  const masterData = useMasterData();
  const [data, setData] = useScopedState(storageScope, "sales-data", initialEntityState);
  const [reservedQty, setReservedQty] = useScopedState(storageScope, "sales-reserved-qty", initialReservedQty);

  useEffect(() => {
    if (!token || !storageScope) return undefined;
    let mounted = true;

    Promise.allSettled([listSalesBills(token), listSalesOrders(token), listSalesCustomers(token)]).then(([billResult, orderResult, customerResult]) => {
      if (!mounted) return;
      setData((prev) => {
        const next = { ...prev };
        if (billResult.status === "fulfilled" || orderResult.status === "fulfilled") {
          const remoteBillIds = new Set(billResult.status === "fulfilled" ? billResult.value.map(keyOf) : []);
          const pendingApiBills = (prev["sales-order"] || []).filter(
            (row) => row.source === "Create Bill" && row.apiId && !remoteBillIds.has(keyOf(row))
          );
          const remoteOrderIds = new Set(orderResult.status === "fulfilled" ? orderResult.value.map(keyOf) : []);
          const pendingApiOrders = (prev["sales-order"] || []).filter(
            (row) => row.source === "Sales Order" && row.apiId && !remoteOrderIds.has(keyOf(row))
          );
          const billRows = billResult.status === "fulfilled"
            ? [...billResult.value, ...pendingApiBills]
            : (prev["sales-order"] || []).filter((row) => row.source === "Create Bill");
          const orderRows = orderResult.status === "fulfilled"
            ? [...orderResult.value, ...pendingApiOrders]
            : (prev["sales-order"] || []).filter((row) => row.source !== "Create Bill");
          next["sales-order"] = [...billRows, ...orderRows];
        }
        if (customerResult.status === "fulfilled") {
          next["customer-management"] = customerResult.value;
        }
        return next;
      });
    });

    return () => {
      mounted = false;
    };
  }, [setData, storageScope, token]);

  const getRows = useCallback((entityKey) => data[entityKey] || [], [data]);
  const getRecord = useCallback((entityKey, id) => (data[entityKey] || []).find((row) => keyOf(row) === id), [data]);

  const addRow = useCallback(async (entityKey, record) => {
    if (token && entityKey === "customer-management") {
      const row = await createSalesCustomer(record, token);
      setData((prev) => ({ ...prev, [entityKey]: [row, ...(prev[entityKey] || []).filter((item) => keyOf(item) !== keyOf(row))] }));
      return row;
    }
    if (token && entityKey === "sales-order" && record.source === "Create Bill") {
      const result = await createSalesBill(record, token);
      setData((prev) => ({
        ...prev,
        "sales-order": [result.row, ...(prev["sales-order"] || []).filter((row) => keyOf(row) !== keyOf(result.row))],
        ...(result.customer
          ? { "customer-management": mergeCustomers([result.customer], prev["customer-management"] || []) }
          : {}),
      }));
      return result.row;
    }
    if (token && entityKey === "sales-order") {
      const row = await createSalesOrder({ ...record, source: "Sales Order" }, token);
      setData((prev) => ({ ...prev, [entityKey]: [row, ...(prev[entityKey] || []).filter((item) => keyOf(item) !== keyOf(row))] }));
      return row;
    }

    setData((prev) => ({ ...prev, [entityKey]: [{ ...record }, ...(prev[entityKey] || [])] }));
    return record;
  }, [setData, token]);

  const updateRow = useCallback(async (entityKey, id, patch) => {
    const existing = (data[entityKey] || []).find((row) => keyOf(row) === id);
    const merged = existing ? { ...existing, ...patch } : patch;
    if (token && entityKey === "customer-management") {
      const row = await updateSalesCustomer(id, merged, token);
      setData((prev) => ({ ...prev, [entityKey]: (prev[entityKey] || []).map((item) => (keyOf(item) === id ? row : item)) }));
      return row;
    }
    if (token && entityKey === "sales-order" && existing?.source === "Create Bill") {
      const result = await updateSalesBill(id, merged, token);
      setData((prev) => ({
        ...prev,
        [entityKey]: (prev[entityKey] || []).map((row) => (keyOf(row) === id ? result.row : row)),
        ...(result.customer
          ? { "customer-management": mergeCustomers([result.customer], prev["customer-management"] || []) }
          : {}),
      }));
      return result.row;
    }
    if (token && entityKey === "sales-order") {
      const row = await updateSalesOrder(id, merged, token);
      setData((prev) => ({ ...prev, [entityKey]: (prev[entityKey] || []).map((item) => (keyOf(item) === id ? row : item)) }));
      return row;
    }

    setData((prev) => ({
      ...prev,
      [entityKey]: (prev[entityKey] || []).map((row) => (keyOf(row) === id ? { ...row, ...patch } : row)),
    }));
    return merged;
  }, [data, setData, token]);

  const removeRow = useCallback(async (entityKey, id) => {
    const existing = (data[entityKey] || []).find((row) => keyOf(row) === id);
    if (token && entityKey === "customer-management") {
      await deleteSalesCustomer(id, token);
    } else if (token && entityKey === "sales-order" && existing?.source === "Create Bill") {
      await deleteSalesBill(id, token);
    } else if (token && entityKey === "sales-order") {
      await deleteSalesOrder(id, token);
    }
    setData((prev) => ({ ...prev, [entityKey]: (prev[entityKey] || []).filter((row) => keyOf(row) !== id) }));
  }, [data, setData, token]);

  const getProduct = useCallback((code) => masterData.getRows("product-item").find((p) => p.code === code), [masterData]);
  const getAvailableToAllocate = useCallback((code) => Math.max(0, (Number(getProduct(code)?.stock) || 0) - (Number(reservedQty[code]) || 0)), [getProduct, reservedQty]);

  const reserveStock = useCallback((items) => {
    setReservedQty((prev) => {
      const next = { ...prev };
      (items || []).forEach((item) => {
        if (!item.productCode) return;
        next[item.productCode] = (Number(next[item.productCode]) || 0) + (Number(item.allocatedQty) || 0);
      });
      return next;
    });
  }, []);

  const releaseStock = useCallback((items) => {
    setReservedQty((prev) => {
      const next = { ...prev };
      (items || []).forEach((item) => {
        if (!item.productCode) return;
        next[item.productCode] = Math.max(0, (Number(next[item.productCode]) || 0) - (Number(item.allocatedQty) || 0));
      });
      return next;
    });
  }, []);

  const dispatchStock = useCallback(
    (items, warehouse) => {
      (items || []).forEach((item) => {
        const qty = Number(item.dispatchQty) || 0;
        if (!item.productCode || qty <= 0) return;
        const product = getProduct(item.productCode);
        if (product) masterData.updateRow("product-item", item.productCode, { stock: Math.max(0, (Number(product.stock) || 0) - qty) });
      });
      setReservedQty((prev) => {
        const next = { ...prev };
        (items || []).forEach((item) => {
          const qty = Number(item.dispatchQty) || 0;
          if (!item.productCode || qty <= 0) return;
          next[item.productCode] = Math.max(0, (Number(next[item.productCode]) || 0) - qty);
        });
        return next;
      });
    },
    [getProduct, masterData]
  );

  const restockStock = useCallback(
    (items) => {
      (items || []).forEach((item) => {
        const qty = Number(item.returnQty) || 0;
        if (!item.productCode || qty <= 0) return;
        const product = getProduct(item.productCode);
        if (product) masterData.updateRow("product-item", item.productCode, { stock: (Number(product.stock) || 0) + qty });
      });
    },
    [getProduct, masterData]
  );

  // Returns the computed patch so callers can merge it into their own local
  // form state directly — reading back via getRecord() right after this call
  // would see a stale pre-update value, since setData()'s effect hasn't
  // flushed into this render's closures yet.
  const recordPayment = useCallback(
    (invoiceId, payment) => {
      const invoice = (data["sales-invoice"] || []).find((row) => row.id === invoiceId);
      if (!invoice) return null;
      const totals = computeOrderTotals(invoice.items, invoice);
      const payments = [...(invoice.payments || []), { date: today(), ...payment }];
      const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const status = paid >= totals.grandTotal ? "Paid" : "Partially Paid";
      const patch = { payments, status, activity: [...(invoice.activity || []), { event: status, date: today(), by: "You" }] };
      updateRow("sales-invoice", invoiceId, patch);
      return { ...invoice, ...patch };
    },
    [data, updateRow]
  );

  const value = useMemo(
    () => ({
      getRows,
      getRecord,
      addRow,
      updateRow,
      removeRow,
      reservedQty,
      getAvailableToAllocate,
      reserveStock,
      releaseStock,
      dispatchStock,
      restockStock,
      recordPayment,
    }),
    [getRows, getRecord, addRow, updateRow, removeRow, reservedQty, getAvailableToAllocate, reserveStock, releaseStock, dispatchStock, restockStock, recordPayment]
  );

  return <SalesDataContext.Provider value={value}>{children}</SalesDataContext.Provider>;
}

export function useSalesData() {
  const ctx = useContext(SalesDataContext);
  if (!ctx) throw new Error("useSalesData must be used inside SalesDataProvider");
  return ctx;
}
