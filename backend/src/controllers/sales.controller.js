import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import SalesOrder from "../models/SalesOrder.js";

const COMPANY_STATE = "Maharashtra";
const normalize = (value) => String(value ?? "").trim();
const normalizePhone = (value) => normalize(value).replace(/\D/g, "").slice(-10);
const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function requestError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function paymentModeValue(payments) {
  const modes = [...new Set(payments.map((payment) => normalize(payment.mode).toLowerCase()).filter(Boolean))];
  if (modes.length > 1) return "mixed";
  const mode = modes[0] || "cash";
  if (mode.includes("upi")) return "upi";
  if (mode.includes("card")) return "card";
  if (mode.includes("bank") || mode.includes("neft") || mode.includes("rtgs")) return "bank";
  if (mode.includes("credit")) return "credit";
  return "cash";
}

function paymentStatusValue(paidAmount, grandTotal) {
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount >= grandTotal) return "paid";
  return "partial";
}

function paymentStatusLabel(status) {
  if (status === "paid" || status === "Paid") return "Paid";
  if (status === "partial" || status === "Partially Paid") return "Partially Paid";
  return "Unpaid";
}

function serializeCustomer(customer) {
  if (!customer) return null;
  const code = customer.code || String(customer._id);
  return {
    ...(customer.data || {}),
    id: code,
    code,
    name: customer.name,
    customerType: customer.customerType || "",
    mobile: customer.phone || "",
    phone: customer.phone || "",
    address: customer.address || "",
    billingAddressLine1: customer.address || "",
    billingCity: customer.billingCity || "",
    billingDistrict: customer.billingDistrict || "",
    billingState: customer.billingState || "",
    billingPostalCode: customer.billingPostalCode || "",
    gstin: customer.gstin || "",
    status: customer.data?.status || (customer.status === "inactive" ? "Inactive" : "Active"),
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

function serializeSalesOrder(order) {
  return {
    ...(order.data || {}),
    apiId: String(order._id),
    id: order.orderNumber,
    date: order.data?.date || order.documentDate || "",
    source: "Sales Order",
    status: order.status || order.data?.status || "Draft",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

async function nextCustomerCode(tenantId) {
  const rows = await Customer.find({ tenantId, code: /^CUST-\d+$/ }).select("code").lean();
  const highest = rows.reduce((max, row) => {
    const sequence = Number(String(row.code).replace(/^CUST-/, ""));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 1000);
  return `CUST-${String(highest + 1).padStart(4, "0")}`;
}

async function nextSalesNumber(tenantId, dateValue) {
  const dateText = normalize(dateValue);
  const dateMatch = dateText.match(/^(\d{4})-(\d{2})/);
  const parsedDate = dateMatch ? null : new Date(dateValue);
  const year = dateMatch ? dateMatch[1] : String(Number.isNaN(parsedDate?.getTime()) ? new Date().getFullYear() : parsedDate.getFullYear());
  const month = dateMatch ? dateMatch[2] : String(Number.isNaN(parsedDate?.getTime()) ? new Date().getMonth() + 1 : parsedDate.getMonth() + 1).padStart(2, "0");
  const prefix = `IN-${year.slice(-2)}${month}-`;
  const [bills, orders] = await Promise.all([
    Sale.find({ tenantId, invoiceNumber: new RegExp(`^${escapeRegex(prefix)}\\d+$`) }).select("invoiceNumber").lean(),
    SalesOrder.find({ tenantId, orderNumber: new RegExp(`^${escapeRegex(prefix)}\\d+$`) }).select("orderNumber").lean(),
  ]);
  const highest = [...bills.map((row) => row.invoiceNumber), ...orders.map((row) => row.orderNumber)].reduce((max, id) => {
    const sequence = Number(String(id).slice(prefix.length));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

async function availableSalesNumber(tenantId, requestedNumber, dateValue) {
  if (requestedNumber) {
    const [billExists, orderExists] = await Promise.all([
      Sale.exists({ tenantId, invoiceNumber: requestedNumber }),
      SalesOrder.exists({ tenantId, orderNumber: requestedNumber }),
    ]);
    if (!billExists && !orderExists) return requestedNumber;
  }
  return nextSalesNumber(tenantId, dateValue);
}

function serializeBill(sale) {
  const stored = sale.data || {};
  return {
    ...stored,
    apiId: String(sale._id),
    id: sale.invoiceNumber,
    billNumber: sale.invoiceNumber,
    source: sale.source || "Create Bill",
    date: stored.date || sale.saleDate?.toISOString?.() || sale.saleDate,
    customerId: stored.customerId || (sale.customerId ? String(sale.customerId) : ""),
    customerName: sale.customerName,
    customerMobile: sale.customerMobile || "",
    customerType: sale.customerType || "",
    items: Array.isArray(stored.items) ? stored.items : [],
    payments: (sale.payments || []).map((payment) => ({
      date: payment.date || "",
      mode: payment.mode,
      amount: payment.amount,
      reference: payment.reference || "",
      notes: payment.notes || "",
    })),
    subtotal: sale.subtotal,
    totalDiscount: sale.discount,
    totalTax: sale.taxAmount,
    freight: sale.freight,
    packing: sale.packing,
    other: sale.other,
    roundOff: sale.roundOff,
    billTotal: sale.grandTotal,
    grandTotal: sale.grandTotal,
    amountReceived: sale.paidAmount,
    dueAmount: sale.dueAmount,
    paymentStatus: paymentStatusLabel(sale.paymentStatus),
    status: sale.status || "Draft",
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  };
}

async function upsertCustomer(req, body) {
  const name = normalize(body.customerName);
  if (!name) throw requestError(400, "Customer name is required.");

  const tenantId = req.auth.tenantId;
  const storeId = req.auth.storeId || null;
  const phone = normalizePhone(body.customerMobile);
  let customer = null;

  if (mongoose.isValidObjectId(body.customerId)) {
    customer = await Customer.findOne({ _id: body.customerId, tenantId });
  }
  if (!customer && normalize(body.customerId)) {
    customer = await Customer.findOne({ tenantId, code: normalize(body.customerId) });
  }
  if (!customer && phone) {
    customer = await Customer.findOne({ tenantId, storeId, phone });
  }
  if (!customer) {
    customer = await Customer.findOne({
      tenantId,
      storeId,
      name: new RegExp(`^${escapeRegex(name)}$`, "i"),
    });
  }

  const customerPatch = {
    code: customer?.code || await nextCustomerCode(tenantId),
    name,
    customerType: normalize(body.customerType),
    phone,
    address: normalize(body.billingAddress),
    billingCity: normalize(body.billingCity),
    billingDistrict: normalize(body.district),
    billingState: normalize(body.destinationState),
    billingPostalCode: normalize(body.pin),
    gstin: normalize(body.gstin).toUpperCase(),
    status: customer?.status || "active",
    data: {
      ...(customer?.data || {}),
      customerType: normalize(body.customerType),
      name,
      mobile: phone,
      billingAddressLine1: normalize(body.billingAddress),
      billingCity: normalize(body.billingCity),
      billingDistrict: normalize(body.district),
      billingState: normalize(body.destinationState),
      billingPostalCode: normalize(body.pin),
      gstin: normalize(body.gstin).toUpperCase(),
      status: customer?.data?.status || "Active",
    },
  };

  if (customer) {
    Object.assign(customer, customerPatch);
    await customer.save();
    return customer;
  }

  return Customer.create({
    tenantId,
    storeId,
    createdBy: req.auth.sub,
    ...customerPatch,
  });
}

async function billPayload(req, body) {
  const invoiceNumber = normalize(body.id || body.billNumber);
  if (!invoiceNumber) throw requestError(400, "Bill number is required.");

  const requestedItems = (Array.isArray(body.items) ? body.items : []).filter(
    (item) => normalize(item.productCode) && numberValue(item.qty) > 0
  );
  if (requestedItems.length === 0) {
    throw requestError(400, "Add at least one medicine with a quantity greater than zero.");
  }

  const productCodes = [...new Set(requestedItems.map((item) => normalize(item.productCode)))];
  const products = await Product.find({ tenantId: req.auth.tenantId, code: { $in: productCodes } }).lean();
  const productsByCode = new Map(products.map((product) => [product.code, product]));
  const missingCode = productCodes.find((code) => !productsByCode.has(code));
  if (missingCode) throw requestError(400, `Medicine ${missingCode} was not found.`);

  const isIntrastate = normalize(body.destinationState) === COMPANY_STATE;
  let subtotal = 0;
  let totalDiscount = 0;
  let taxableTotal = 0;
  let totalTax = 0;

  const items = requestedItems.map((item) => {
    const productCode = normalize(item.productCode);
    const product = productsByCode.get(productCode);
    const quantity = numberValue(item.qty);
    const sellingPrice = numberValue(item.rate);
    const discountPercent = Math.max(0, numberValue(item.discountPercent));
    const taxRate = Math.max(0, numberValue(item.gstRate));
    const base = quantity * sellingPrice;
    const discount = base * discountPercent / 100;
    const taxableValue = base - discount;
    const cgstAmount = isIntrastate ? taxableValue * taxRate / 200 : 0;
    const sgstAmount = isIntrastate ? taxableValue * taxRate / 200 : 0;
    const igstAmount = isIntrastate ? 0 : taxableValue * taxRate / 100;
    const taxAmount = cgstAmount + sgstAmount + igstAmount;
    const total = taxableValue + taxAmount;

    subtotal += base;
    totalDiscount += discount;
    taxableTotal += taxableValue;
    totalTax += taxAmount;

    return {
      productId: product._id,
      productCode,
      productName: normalize(item.productName) || product.name,
      genericName: normalize(item.genericName) || product.genericName,
      category: normalize(item.category) || product.category,
      location: normalize(item.location) || product.defaultLocation,
      composition: normalize(item.composition) || product.composition,
      hsn: normalize(item.hsn) || product.hsnCode,
      uom: normalize(item.uom) || product.salesUnit || product.baseUnit,
      quantity,
      sellingPrice,
      mrp: numberValue(product.mrp),
      taxRate,
      taxAmount,
      discount,
      discountPercent,
      taxableValue,
      cgstAmount,
      sgstAmount,
      igstAmount,
      total,
    };
  });

  const freight = Math.max(0, numberValue(body.freight));
  const packing = Math.max(0, numberValue(body.packing));
  const other = Math.max(0, numberValue(body.other));
  const preRound = taxableTotal + totalTax + freight + packing + other;
  const grandTotal = Math.round(preRound);
  const roundOff = grandTotal - preRound;
  const payments = (Array.isArray(body.payments) ? body.payments : [])
    .filter((payment) => normalize(payment.mode) && numberValue(payment.amount) > 0)
    .map((payment) => ({
      date: normalize(payment.date),
      mode: normalize(payment.mode),
      amount: numberValue(payment.amount),
      reference: normalize(payment.reference),
      notes: normalize(payment.notes),
    }));
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (paidAmount > grandTotal) {
    throw requestError(400, "Amount received cannot exceed the bill total.");
  }

  const customer = await upsertCustomer(req, body);
  const frontendItems = requestedItems.map((item, index) => ({
    ...item,
    productName: items[index].productName,
    genericName: items[index].genericName,
    category: items[index].category,
    location: items[index].location,
    composition: items[index].composition,
    hsn: items[index].hsn,
    uom: items[index].uom,
    qty: items[index].quantity,
    rate: items[index].sellingPrice,
    discountPercent: items[index].discountPercent,
    gstRate: items[index].taxRate,
  }));
  const paymentStatus = paymentStatusValue(paidAmount, grandTotal);
  const data = {
    ...body,
    id: invoiceNumber,
    billNumber: invoiceNumber,
    source: "Create Bill",
    customerId: customer.code || String(customer._id),
    customerName: customer.name,
    customerMobile: customer.phone,
    items: frontendItems,
    payments,
    billTotal: grandTotal,
    amountReceived: paidAmount,
    dueAmount: Math.max(0, grandTotal - paidAmount),
    paymentStatus: paymentStatusLabel(paymentStatus),
  };

  const saleDate = new Date(body.date);
  return {
    customer,
    patch: {
      invoiceNumber,
      customerId: customer._id,
      customerName: customer.name,
      customerMobile: customer.phone,
      customerType: normalize(body.customerType),
      billingAddress: normalize(body.billingAddress),
      shippingAddress: normalize(body.shippingAddress),
      destinationState: normalize(body.destinationState),
      district: normalize(body.district),
      pin: normalize(body.pin),
      gstin: normalize(body.gstin).toUpperCase(),
      saleDate: Number.isNaN(saleDate.getTime()) ? new Date() : saleDate,
      items,
      subtotal,
      discount: totalDiscount,
      taxAmount: totalTax,
      grandTotal,
      freight,
      packing,
      other,
      roundOff,
      paidAmount,
      dueAmount: Math.max(0, grandTotal - paidAmount),
      paymentMode: paymentModeValue(payments),
      paymentStatus,
      payments,
      source: "Create Bill",
      status: normalize(body.status) || "Draft",
      notes: normalize(body.notes),
      data,
    },
  };
}

function salesOrderPatch(body) {
  const orderNumber = normalize(body.id);
  if (!orderNumber) throw requestError(400, "Sales order number is required.");
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.some((item) => normalize(item.productCode) && numberValue(item.qty) > 0)) {
    throw requestError(400, "Add at least one medicine with a quantity greater than zero.");
  }
  return {
    orderNumber,
    documentDate: normalize(body.date),
    status: normalize(body.status) || "Draft",
    data: {
      ...body,
      id: orderNumber,
      source: "Sales Order",
      items,
      activity: Array.isArray(body.activity) ? body.activity : [],
    },
  };
}

function customerDocumentPatch(body, code) {
  const name = normalize(body.name);
  if (!name) throw requestError(400, "Customer name is required.");
  const phone = normalizePhone(body.mobile || body.phone);
  if (!phone) throw requestError(400, "Customer mobile number is required.");
  const statusLabel = normalize(body.status) || "Active";
  const address = normalize(body.address) || [body.billingAddressLine1, body.billingAddressLine2].map(normalize).filter(Boolean).join(", ");
  return {
    code,
    name,
    customerType: normalize(body.customerType),
    phone,
    email: normalize(body.email).toLowerCase(),
    address,
    billingCity: normalize(body.billingCity),
    billingDistrict: normalize(body.billingDistrict),
    billingState: normalize(body.billingState),
    billingPostalCode: normalize(body.billingPostalCode),
    gstin: normalize(body.gstin).toUpperCase(),
    openingBalance: numberValue(body.openingBalance),
    currentBalance: numberValue(body.currentBalance ?? body.openingBalance),
    status: statusLabel === "Inactive" ? "inactive" : "active",
    data: {
      ...body,
      id: code,
      code,
      name,
      mobile: phone,
      status: statusLabel,
    },
  };
}

export async function listSalesOrders(req, res, next) {
  try {
    const rows = await SalesOrder.find({ tenantId: req.auth.tenantId })
      .sort({ documentDate: -1, createdAt: -1 })
      .limit(500)
      .lean();
    return res.status(200).json({ rows: rows.map(serializeSalesOrder) });
  } catch (error) {
    next(error);
  }
}

export async function createSalesOrder(req, res, next) {
  try {
    const body = { ...(req.body || {}) };
    body.id = await availableSalesNumber(req.auth.tenantId, normalize(body.id), body.date);
    const patch = salesOrderPatch(body);
    const row = await SalesOrder.create({
      tenantId: req.auth.tenantId,
      storeId: req.auth.storeId || null,
      createdBy: req.auth.sub,
      ...patch,
    });
    return res.status(201).json({ row: serializeSalesOrder(row) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "Sales order number already exists." });
    next(error);
  }
}

export async function updateSalesOrder(req, res, next) {
  try {
    const orderNumber = normalize(req.params.id);
    const current = await SalesOrder.findOne({ tenantId: req.auth.tenantId, orderNumber });
    if (!current) return res.status(404).json({ message: "Sales order not found." });
    const patch = salesOrderPatch({ ...(current.data || {}), ...(req.body || {}), id: orderNumber });
    Object.assign(current, patch, { updatedBy: req.auth.sub });
    await current.save();
    return res.status(200).json({ row: serializeSalesOrder(current) });
  } catch (error) {
    next(error);
  }
}

export async function deleteSalesOrder(req, res, next) {
  try {
    const orderNumber = normalize(req.params.id);
    const order = await SalesOrder.findOne({ tenantId: req.auth.tenantId, orderNumber });
    if (!order) return res.status(404).json({ message: "Sales order not found." });
    if (order.status !== "Draft") return res.status(409).json({ message: "Only draft sales orders can be deleted." });
    await order.deleteOne();
    return res.status(200).json({ id: orderNumber });
  } catch (error) {
    next(error);
  }
}

export async function createCustomer(req, res, next) {
  try {
    const requestedCode = normalize(req.body?.code);
    const requestedCodeExists = requestedCode
      ? await Customer.exists({ tenantId: req.auth.tenantId, code: requestedCode })
      : false;
    const code = requestedCode && !requestedCodeExists
      ? requestedCode
      : await nextCustomerCode(req.auth.tenantId);
    const patch = customerDocumentPatch(req.body || {}, code);
    const duplicatePhone = await Customer.exists({ tenantId: req.auth.tenantId, phone: patch.phone });
    if (duplicatePhone) return res.status(409).json({ message: "Customer mobile number already exists." });
    const customer = await Customer.create({
      tenantId: req.auth.tenantId,
      storeId: req.auth.storeId || null,
      createdBy: req.auth.sub,
      ...patch,
    });
    return res.status(201).json({ row: serializeCustomer(customer) });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req, res, next) {
  try {
    const identifier = normalize(req.params.code);
    const selector = mongoose.isValidObjectId(identifier)
      ? { tenantId: req.auth.tenantId, $or: [{ _id: identifier }, { code: identifier }] }
      : { tenantId: req.auth.tenantId, code: identifier };
    const customer = await Customer.findOne(selector);
    if (!customer) return res.status(404).json({ message: "Customer not found." });
    const patch = customerDocumentPatch({ ...(customer.data || {}), ...(req.body || {}) }, customer.code || identifier);
    Object.assign(customer, patch);
    await customer.save();
    return res.status(200).json({ row: serializeCustomer(customer) });
  } catch (error) {
    next(error);
  }
}

export async function deleteCustomer(req, res, next) {
  try {
    const identifier = normalize(req.params.code);
    const selector = mongoose.isValidObjectId(identifier)
      ? { tenantId: req.auth.tenantId, $or: [{ _id: identifier }, { code: identifier }] }
      : { tenantId: req.auth.tenantId, code: identifier };
    const customer = await Customer.findOne(selector);
    if (!customer) return res.status(404).json({ message: "Customer not found." });
    await customer.deleteOne();
    return res.status(200).json({ id: identifier });
  } catch (error) {
    next(error);
  }
}

export async function listBills(req, res, next) {
  try {
    const rows = await Sale.find({ tenantId: req.auth.tenantId })
      .sort({ saleDate: -1, createdAt: -1 })
      .limit(500)
      .lean();
    return res.status(200).json({ rows: rows.map(serializeBill) });
  } catch (error) {
    next(error);
  }
}

export async function createBill(req, res, next) {
  try {
    const body = { ...(req.body || {}) };
    body.id = await availableSalesNumber(req.auth.tenantId, normalize(body.id || body.billNumber), body.date);
    const { customer, patch } = await billPayload(req, body);
    const sale = await Sale.create({
      tenantId: req.auth.tenantId,
      storeId: req.auth.storeId || null,
      createdBy: req.auth.sub,
      ...patch,
    });
    return res.status(201).json({ row: serializeBill(sale), customer: serializeCustomer(customer) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "Bill number already exists." });
    next(error);
  }
}

export async function updateBill(req, res, next) {
  try {
    const invoiceNumber = normalize(req.params.id);
    const current = await Sale.findOne({ tenantId: req.auth.tenantId, invoiceNumber });
    if (!current) return res.status(404).json({ message: "Bill not found." });

    const { customer, patch } = await billPayload(req, { ...(current.data || {}), ...(req.body || {}), id: invoiceNumber });
    Object.assign(current, patch);
    await current.save();
    return res.status(200).json({ row: serializeBill(current), customer: serializeCustomer(customer) });
  } catch (error) {
    next(error);
  }
}

export async function deleteBill(req, res, next) {
  try {
    const invoiceNumber = normalize(req.params.id);
    const sale = await Sale.findOne({ tenantId: req.auth.tenantId, invoiceNumber });
    if (!sale) return res.status(404).json({ message: "Bill not found." });
    if (sale.status !== "Draft") return res.status(409).json({ message: "Only draft bills can be deleted." });
    await sale.deleteOne();
    return res.status(200).json({ id: invoiceNumber });
  } catch (error) {
    next(error);
  }
}

export async function listBillCustomers(req, res, next) {
  try {
    const customers = await Customer.find({ tenantId: req.auth.tenantId })
      .sort({ updatedAt: -1, name: 1 })
      .limit(500)
      .lean();
    return res.status(200).json({ rows: customers.map(serializeCustomer) });
  } catch (error) {
    next(error);
  }
}
