import { apiRequest } from "../lib/api.js";

const billPath = (id = "") => id
  ? `/sales/bills/${encodeURIComponent(id)}`
  : "/sales/bills";
const orderPath = (id = "") => id
  ? `/sales/orders/${encodeURIComponent(id)}`
  : "/sales/orders";
const customerPath = (code = "") => code
  ? `/sales/customers/${encodeURIComponent(code)}`
  : "/sales/customers";

export async function listSalesBills(token) {
  const result = await apiRequest(billPath(), { token });
  return result.rows || [];
}

export async function createSalesBill(record, token) {
  return apiRequest(billPath(), {
    method: "POST",
    token,
    body: JSON.stringify(record),
  });
}

export async function updateSalesBill(id, record, token) {
  return apiRequest(billPath(id), {
    method: "PUT",
    token,
    body: JSON.stringify(record),
  });
}

export async function deleteSalesBill(id, token) {
  return apiRequest(billPath(id), {
    method: "DELETE",
    token,
  });
}

export async function listSalesCustomers(token) {
  const result = await apiRequest(customerPath(), { token });
  return result.rows || [];
}

export async function listSalesOrders(token) {
  const result = await apiRequest(orderPath(), { token });
  return result.rows || [];
}

export async function createSalesOrder(record, token) {
  const result = await apiRequest(orderPath(), {
    method: "POST",
    token,
    body: JSON.stringify(record),
  });
  return result.row;
}

export async function updateSalesOrder(id, record, token) {
  const result = await apiRequest(orderPath(id), {
    method: "PUT",
    token,
    body: JSON.stringify(record),
  });
  return result.row;
}

export async function deleteSalesOrder(id, token) {
  return apiRequest(orderPath(id), { method: "DELETE", token });
}

export async function createSalesCustomer(record, token) {
  const result = await apiRequest(customerPath(), {
    method: "POST",
    token,
    body: JSON.stringify(record),
  });
  return result.row;
}

export async function updateSalesCustomer(code, record, token) {
  const result = await apiRequest(customerPath(code), {
    method: "PUT",
    token,
    body: JSON.stringify(record),
  });
  return result.row;
}

export async function deleteSalesCustomer(code, token) {
  return apiRequest(customerPath(code), { method: "DELETE", token });
}
