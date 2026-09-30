import Category from "../models/Category.js";
import Department from "../models/Department.js";
import LocationType from "../models/LocationType.js";
import MasterRecord from "../models/MasterRecord.js";
import Product from "../models/Product.js";
import RawMaterial from "../models/RawMaterial.js";
import StockLocation from "../models/StockLocation.js";
import Store from "../models/Store.js";
import Unit from "../models/Unit.js";
import Vendor from "../models/Vendor.js";
import WarehouseType from "../models/WarehouseType.js";

const normalize = (value) => String(value ?? "").trim();
const normalizeEmail = (value) => normalize(value).toLowerCase();
const DEFAULT_PRODUCT_TYPE = "Other";
const CASE_INSENSITIVE_COLLATION = { locale: "en", strength: 2 };

const formatDuplicateError = (error) => {
  if (error?.code !== 11000) return null;

  const fields = Object.keys(error.keyPattern || error.keyValue || {});
  const duplicateIndex = `${error.index || ""} ${error.message || ""}`;
  if (fields.includes("name") && fields.includes("bank")) {
    return "This Payment Mode and Bank combination already exists.";
  }
  if (fields.includes("name") && fields.includes("warehouse")) {
    return "This Location Name and Warehouse combination already exists.";
  }
  if (fields.includes("name") && fields.includes("manufacturer")) {
    return "This Brand Name and Manufacturer combination already exists.";
  }
  if (fields.includes("storeName")) {
    return "This Warehouse Name already exists.";
  }
  if (duplicateIndex.includes("unique_manufacturer_name_per_tenant")) {
    return "This Manufacturer Name already exists.";
  }
  if (fields.includes("entity") && fields.includes("name")) {
    return "This Customer Type already exists.";
  }
  if (duplicateIndex.includes("unique_supplier_name_per_tenant")) {
    return "This Supplier Name already exists.";
  }
  if (fields.includes("name")) {
    return "This Unit Name already exists.";
  }
  if (fields.includes("rate")) {
    return "This GST Rate already exists.";
  }

  const field = fields.find((key) => !["tenantId", "storeId", "entity"].includes(key)) || "record";
  return `${field} already exists.`;
};

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const booleanValue = (value) => value === true || value === "true";

const generateMasterCode = async (Model, tenantId, prefix, width = 3, startAt = 1, filter = {}) => {
  const query = { tenantId, ...filter };
  const baseCount = await Model.countDocuments(query);

  for (let offset = 1; offset <= 1000; offset += 1) {
    const nextNumber = startAt + baseCount + offset - 1;
    const code = `${prefix}-${String(nextNumber).padStart(width, "0")}`;
    const exists = await Model.exists({ ...query, code });
    if (!exists) return code;
  }

  throw new Error(`Unable to generate ${prefix} code.`);
};

const validateStockLocationWarehouse = async (tenantId, warehouse) => {
  if (!warehouse) return "";

  const warehouseValue = normalize(warehouse);
  const exists = await Store.exists({
    tenantId,
    status: { $ne: "Inactive" },
    $or: [
      { code: warehouseValue },
      { name: warehouseValue },
      { storeName: warehouseValue },
    ],
  });

  return exists ? "" : "Select a valid active warehouse from Warehouse master data.";
};

const productFields = [
  "shortName",
  "category",
  "subCategory",
  "brand",
  "genericName",
  "composition",
  "manufacturer",
  "dosageForm",
  "strength",
  "packSize",
  "drugSchedule",
  "storageCondition",
  "description",
  "modelNumber",
  "productSize",
  "color",
  "material",
  "grade",
  "specification",
  "hsnCode",
  "barcode",
  "baseUnit",
  "purchaseUnit",
  "salesUnit",
  "defaultBom",
  "defaultWarehouse",
  "defaultLocation",
  "storageType",
  "internalNotes",
  "remarks",
  "attachment",
];

const numericProductFields = [
  "weight",
  "length",
  "width",
  "thickness",
  "conversionFactor",
  "minStock",
  "maxStock",
  "reorderLevel",
  "safetyStock",
  "openingQty",
  "openingValue",
  "purchasePrice",
  "mrp",
  "standardCost",
  "sellingPrice",
  "wholesalePrice",
  "gst",
  "discount",
  "leadTime",
  "productionCost",
];

const booleanProductFields = [
  "serialTracking",
  "batchTracking",
  "expiryTracking",
  "manufactured",
  "bomRequired",
  "qualityInspection",
  "prescriptionRequired",
  "controlledMedicine",
  "coldChainRequired",
];

const serializeProductItem = (product) => ({
  id: product.id,
  code: product.code,
  sku: product.sku || product.code,
  name: product.name,
  shortName: product.shortName || "",
  category: product.category || "",
  subCategory: product.subCategory || "",
  productType: product.productType || DEFAULT_PRODUCT_TYPE,
  brand: product.brand || "",
  genericName: product.genericName || product.medicineDetails?.genericName || "",
  composition: product.composition || product.medicineDetails?.composition || "",
  manufacturer: product.manufacturer || product.medicineDetails?.manufacturer || "",
  dosageForm: product.dosageForm || "",
  strength: product.strength || "",
  packSize: product.packSize || "",
  drugSchedule: product.drugSchedule || "",
  prescriptionRequired: Boolean(product.prescriptionRequired || product.medicineDetails?.prescriptionRequired),
  controlledMedicine: Boolean(product.controlledMedicine),
  coldChainRequired: Boolean(product.coldChainRequired),
  storageCondition: product.storageCondition || "",
  description: product.description || "",
  modelNumber: product.modelNumber || "",
  productSize: product.productSize || "",
  color: product.color || "",
  material: product.material || "",
  grade: product.grade || "",
  weight: product.weight || 0,
  length: product.length || 0,
  width: product.width || 0,
  thickness: product.thickness || 0,
  specification: product.specification || "",
  hsnCode: product.hsnCode || "",
  barcode: product.barcode || "",
  serialTracking: Boolean(product.serialTracking),
  batchTracking: Boolean(product.batchTracking),
  expiryTracking: Boolean(product.expiryTracking),
  baseUnit: product.baseUnit || "",
  unit: product.baseUnit || "",
  purchaseUnit: product.purchaseUnit || "",
  salesUnit: product.salesUnit || "",
  conversionFactor: product.conversionFactor || 0,
  minStock: product.minStock || product.minimumStock || 0,
  maxStock: product.maxStock || 0,
  reorderLevel: product.reorderLevel || 0,
  safetyStock: product.safetyStock || 0,
  openingQty: product.openingQty || product.currentStock || 0,
  openingValue: product.openingValue || 0,
  stock: product.currentStock || product.openingQty || 0,
  purchasePrice: product.purchasePrice || 0,
  mrp: product.mrp || 0,
  standardCost: product.standardCost || 0,
  sellingPrice: product.sellingPrice || 0,
  price: product.sellingPrice || 0,
  wholesalePrice: product.wholesalePrice || 0,
  gst: product.gst || product.taxRate || 0,
  discount: product.discount || 0,
  manufactured: Boolean(product.manufactured),
  defaultBom: product.defaultBom || "",
  leadTime: product.leadTime || 0,
  productionCost: product.productionCost || 0,
  bomRequired: Boolean(product.bomRequired),
  qualityInspection: Boolean(product.qualityInspection),
  defaultWarehouse: product.defaultWarehouse || "",
  warehouse: product.defaultWarehouse || "",
  defaultLocation: product.defaultLocation || "",
  storageType: product.storageType || "",
  internalNotes: product.internalNotes || "",
  remarks: product.remarks || "",
  attachment: product.attachment || "",
  status: product.status || "Active",
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

const productItemPatch = (body) => {
  const patch = {};

  if (body.code !== undefined) {
    patch.code = normalize(body.code);
    patch.sku = patch.code;
  }
  if (body.name !== undefined) patch.name = normalize(body.name);
  if (body.productType !== undefined) patch.productType = normalize(body.productType) || DEFAULT_PRODUCT_TYPE;
  if (body.status !== undefined) patch.status = normalize(body.status) || "Active";

  productFields.forEach((field) => {
    if (body[field] !== undefined) patch[field] = normalize(body[field]);
  });
  numericProductFields.forEach((field) => {
    if (body[field] !== undefined) patch[field] = numberValue(body[field]);
  });
  booleanProductFields.forEach((field) => {
    if (body[field] !== undefined) patch[field] = booleanValue(body[field]);
  });

  if (patch.openingQty !== undefined) patch.currentStock = patch.openingQty;
  if (patch.minStock !== undefined) patch.minimumStock = patch.minStock;
  if (patch.gst !== undefined) patch.taxRate = patch.gst;
  if (patch.salesUnit !== undefined) patch.baseUnit = patch.salesUnit;

  return patch;
};

const serializeCategory = (category, itemCount = category.itemCount || 0) => ({
  id: category.id,
  code: category.code,
  name: category.name,
  parent: category.parent || "-",
  type: category.type,
  description: category.description || "",
  displayOrder: category.displayOrder || 0,
  itemCount,
  status: category.status || "Active",
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

const categoryPatch = (body) => {
  const patch = {};

  if (body.code !== undefined) patch.code = normalize(body.code);
  if (body.name !== undefined) patch.name = normalize(body.name);
  if (body.parent !== undefined) patch.parent = normalize(body.parent) || "-";
  if (body.type !== undefined) patch.type = normalize(body.type);
  if (body.description !== undefined) patch.description = normalize(body.description);
  if (body.displayOrder !== undefined) patch.displayOrder = numberValue(body.displayOrder);
  if (body.itemCount !== undefined) patch.itemCount = numberValue(body.itemCount);
  if (body.status !== undefined) patch.status = normalize(body.status) || "Active";

  return patch;
};

const rawMaterialTextFields = [
  "category",
  "subCategory",
  "description",
  "grade",
  "color",
  "dimensions",
  "specification",
  "baseUnit",
  "preferredSupplier",
  "qualityGrade",
  "certification",
  "defaultWarehouse",
  "defaultLocation",
  "storageType",
  "internalNotes",
  "attachment",
];

const rawMaterialNumberFields = [
  "weight",
  "minStock",
  "maxStock",
  "reorderLevel",
  "openingQty",
  "openingValue",
  "leadTime",
  "moq",
  "lastPurchasePrice",
];

const rawMaterialBooleanFields = [
  "batchTracking",
  "expiryTracking",
  "inspectionRequired",
];

const serializeRawMaterial = (material) => ({
  id: material.id,
  code: material.code,
  name: material.name,
  category: material.category || "",
  subCategory: material.subCategory || "",
  description: material.description || "",
  grade: material.grade || "",
  color: material.color || "",
  weight: material.weight || 0,
  dimensions: material.dimensions || "",
  specification: material.specification || "",
  batchTracking: Boolean(material.batchTracking),
  expiryTracking: Boolean(material.expiryTracking),
  baseUnit: material.baseUnit || "",
  unit: material.baseUnit || "",
  minStock: material.minStock || 0,
  maxStock: material.maxStock || 0,
  reorderLevel: material.reorderLevel || 0,
  openingQty: material.openingQty || material.currentStock || 0,
  openingValue: material.openingValue || 0,
  stock: material.currentStock || material.openingQty || 0,
  preferredSupplier: material.preferredSupplier || "",
  leadTime: material.leadTime || 0,
  moq: material.moq || 0,
  lastPurchasePrice: material.lastPurchasePrice || 0,
  price: material.lastPurchasePrice || 0,
  qualityGrade: material.qualityGrade || "",
  inspectionRequired: Boolean(material.inspectionRequired),
  certification: material.certification || "",
  defaultWarehouse: material.defaultWarehouse || "",
  defaultLocation: material.defaultLocation || "",
  storageType: material.storageType || "",
  internalNotes: material.internalNotes || "",
  attachment: material.attachment || "",
  status: material.status || "Active",
  createdAt: material.createdAt,
  updatedAt: material.updatedAt,
});

const rawMaterialPatch = (body) => {
  const patch = {};

  if (body.code !== undefined) patch.code = normalize(body.code);
  if (body.name !== undefined) patch.name = normalize(body.name);
  if (body.status !== undefined) patch.status = normalize(body.status) || "Active";
  rawMaterialTextFields.forEach((field) => {
    if (body[field] !== undefined) patch[field] = normalize(body[field]);
  });
  rawMaterialNumberFields.forEach((field) => {
    if (body[field] !== undefined) patch[field] = numberValue(body[field]);
  });
  rawMaterialBooleanFields.forEach((field) => {
    if (body[field] !== undefined) patch[field] = booleanValue(body[field]);
  });

  if (patch.openingQty !== undefined) patch.currentStock = patch.openingQty;

  return patch;
};

const serializeUnit = (unit) => ({
  id: unit.id,
  code: unit.code,
  name: unit.name,
  symbol: unit.symbol || unit.shortName || "",
  shortName: unit.shortName || unit.symbol || "",
  type: unit.type || "",
  decimalPlaces: unit.decimalPlaces || 0,
  baseUnit: unit.baseUnit || "",
  conversionFactor: unit.conversionFactor || 0,
  description: unit.description || "",
  conversions: Array.isArray(unit.conversions) ? unit.conversions : [],
  isBase: !unit.baseUnit || unit.baseUnit === "-",
  status: unit.status || "Active",
  createdAt: unit.createdAt,
  updatedAt: unit.updatedAt,
});

const unitPatch = (body) => {
  const patch = {};

  if (body.code !== undefined) patch.code = normalize(body.code);
  if (body.name !== undefined) patch.name = normalize(body.name);
  if (body.symbol !== undefined) {
    patch.symbol = normalize(body.symbol);
    patch.shortName = patch.symbol;
  }
  if (body.type !== undefined) patch.type = normalize(body.type);
  if (body.baseUnit !== undefined) patch.baseUnit = normalize(body.baseUnit) === "-" ? "" : normalize(body.baseUnit);
  if (body.description !== undefined) patch.description = normalize(body.description);
  if (body.status !== undefined) patch.status = normalize(body.status) || "Active";
  if (body.decimalPlaces !== undefined) patch.decimalPlaces = numberValue(body.decimalPlaces);
  if (body.conversionFactor !== undefined) patch.conversionFactor = numberValue(body.conversionFactor);
  if (Array.isArray(body.conversions)) {
    patch.conversions = body.conversions.map((row) => ({
      from: normalize(row.from),
      to: normalize(row.to),
      factor: numberValue(row.factor),
    }));
  }

  return patch;
};

const vendorTextFields = [
  "type",
  "website",
  "contact",
  "designation",
  "phone",
  "address",
  "gstNumber",
  "panNumber",
  "registrationNumber",
  "bankName",
  "accountNumber",
  "ifsc",
  "branchName",
  "accountHolder",
  "paymentTerms",
  "internalNotes",
  "attachment",
];

const serializeSupplier = (supplier) => ({
  id: supplier.id,
  code: supplier.code,
  name: supplier.name,
  type: supplier.type || "",
  website: supplier.website || "",
  contact: supplier.contact || "",
  designation: supplier.designation || "",
  phone: supplier.phone || "",
  email: supplier.email || "",
  address: supplier.address || "",
  gstNumber: supplier.gstNumber || "",
  panNumber: supplier.panNumber || "",
  registrationNumber: supplier.registrationNumber || "",
  bankName: supplier.bankName || "",
  accountNumber: supplier.accountNumber || "",
  ifsc: supplier.ifsc || "",
  branchName: supplier.branchName || "",
  accountHolder: supplier.accountHolder || "",
  paymentTerms: supplier.paymentTerms || "",
  leadTime: supplier.leadTime || 0,
  creditLimit: supplier.creditLimit || 0,
  openingBalance: supplier.openingBalance || 0,
  currentBalance: supplier.currentBalance || 0,
  rating: supplier.rating || 0,
  qualityRating: supplier.qualityRating || 0,
  deliveryRating: supplier.deliveryRating || 0,
  internalNotes: supplier.internalNotes || "",
  attachment: supplier.attachment || "",
  status: supplier.status || "Active",
  createdAt: supplier.createdAt,
  updatedAt: supplier.updatedAt,
});

const supplierPatch = (body) => {
  const patch = {};

  if (body.code !== undefined) patch.code = normalize(body.code);
  if (body.name !== undefined) patch.name = normalize(body.name);
  if (body.email !== undefined) patch.email = normalizeEmail(body.email);
  if (body.status !== undefined) patch.status = normalize(body.status) || "Active";
  vendorTextFields.forEach((field) => {
    if (body[field] !== undefined) patch[field] = normalize(body[field]);
  });
  ["leadTime", "creditLimit", "rating", "qualityRating", "deliveryRating"].forEach((field) => {
    if (body[field] !== undefined) patch[field] = numberValue(body[field]);
  });

  return patch;
};

const serializeWarehouseType = (warehouseType) => ({
  id: warehouseType.id,
  code: warehouseType.code,
  name: warehouseType.name,
  description: warehouseType.description || "",
  status: warehouseType.status || "Active",
  createdAt: warehouseType.createdAt,
  updatedAt: warehouseType.updatedAt,
});

const warehouseTypePatch = (body) => {
  const patch = {};

  if (body.code !== undefined) patch.code = normalize(body.code);
  if (body.name !== undefined) patch.name = normalize(body.name);
  if (body.description !== undefined) patch.description = normalize(body.description);
  if (body.status !== undefined) patch.status = normalize(body.status) || "Active";

  return patch;
};

const serializeLocationType = (locationType) => ({
  id: locationType.id,
  code: locationType.code,
  name: locationType.name,
  description: locationType.description || "",
  status: locationType.status || "Active",
  createdAt: locationType.createdAt,
  updatedAt: locationType.updatedAt,
});

const locationTypePatch = (body) => {
  const patch = {};

  if (body.code !== undefined) patch.code = normalize(body.code);
  if (body.name !== undefined) patch.name = normalize(body.name);
  if (body.description !== undefined) patch.description = normalize(body.description);
  if (body.status !== undefined) patch.status = normalize(body.status) || "Active";

  return patch;
};

const serializeDepartment = (department) => ({
  id: department.id,
  code: department.code,
  name: department.name,
  description: department.description || "",
  status: department.status || "Active",
  createdAt: department.createdAt,
  updatedAt: department.updatedAt,
});

const departmentPatch = (body) => {
  const patch = {};

  if (body.code !== undefined) patch.code = normalize(body.code);
  if (body.name !== undefined) patch.name = normalize(body.name);
  if (body.description !== undefined) patch.description = normalize(body.description);
  if (body.status !== undefined) patch.status = normalize(body.status) || "Active";

  return patch;
};

const warehouseTextFields = [
  "manager",
  "phone",
  "email",
  "addressLine",
  "city",
  "state",
  "district",
  "pincode",
  "capacityUnit",
  "internalNotes",
];

const warehouseBooleanFields = [
  "binManagement",
  "batchTracking",
  "serialTracking",
  "qualityArea",
  "wipArea",
  "dispatchArea",
];

const serializeWarehouse = (warehouse) => ({
  id: warehouse.id,
  code: warehouse.code,
  name: warehouse.name || warehouse.storeName,
  storeName: warehouse.storeName,
  type: warehouse.type || warehouse.storeType || "General",
  storeType: warehouse.storeType,
  manager: warehouse.manager || "",
  phone: warehouse.phone || "",
  email: warehouse.email || "",
  addressLine: warehouse.addressLine || warehouse.address || "",
  address: warehouse.address || warehouse.addressLine || "",
  city: warehouse.city || "",
  state: warehouse.state || "",
  district: warehouse.district || "",
  pincode: warehouse.pincode || "",
  capacity: warehouse.capacity || 0,
  capacityUnit: warehouse.capacityUnit || "",
  maxWeight: warehouse.maxWeight || 0,
  maxVolume: warehouse.maxVolume || 0,
  utilization: warehouse.utilization || 0,
  binManagement: Boolean(warehouse.binManagement),
  batchTracking: Boolean(warehouse.batchTracking),
  serialTracking: Boolean(warehouse.serialTracking),
  qualityArea: Boolean(warehouse.qualityArea),
  wipArea: Boolean(warehouse.wipArea),
  dispatchArea: Boolean(warehouse.dispatchArea),
  internalNotes: warehouse.internalNotes || "",
  status: warehouse.status || "Active",
  createdAt: warehouse.createdAt,
  updatedAt: warehouse.updatedAt,
});

const warehousePatch = (body) => {
  const patch = {};

  if (body.code !== undefined) patch.code = normalize(body.code);
  if (body.name !== undefined) {
    patch.name = normalize(body.name);
    patch.storeName = patch.name;
  }
  if (body.type !== undefined) {
    patch.type = normalize(body.type) || "General";
    patch.storeType = patch.type;
  }
  if (body.status !== undefined) patch.status = normalize(body.status) || "Active";
  warehouseTextFields.forEach((field) => {
    if (body[field] !== undefined) patch[field] = field === "email" ? normalizeEmail(body[field]) : normalize(body[field]);
  });
  ["capacity", "maxWeight", "maxVolume", "utilization"].forEach((field) => {
    if (body[field] !== undefined) patch[field] = numberValue(body[field]);
  });
  warehouseBooleanFields.forEach((field) => {
    if (body[field] !== undefined) patch[field] = booleanValue(body[field]);
  });

  if (patch.addressLine !== undefined) patch.address = patch.addressLine;

  return patch;
};

const stockLocationTextFields = [
  "warehouse",
  "type",
  "zone",
  "rack",
  "shelf",
  "bin",
  "allowedCategory",
  "temperature",
  "internalNotes",
];

const serializeStockLocation = (location) => ({
  id: location.id,
  code: location.code,
  name: location.name,
  warehouse: location.warehouse || "",
  type: location.type || "",
  zone: location.zone || "",
  rack: location.rack || "",
  shelf: location.shelf || "",
  bin: location.bin || "",
  maxQuantity: location.maxQuantity || 0,
  maxWeight: location.maxWeight || 0,
  maxVolume: location.maxVolume || 0,
  utilization: location.utilization || 0,
  allowedCategory: location.allowedCategory || "Any",
  temperature: location.temperature || "Ambient",
  hazardous: Boolean(location.hazardous),
  batchAllowed: Boolean(location.batchAllowed),
  expiryTracking: Boolean(location.expiryTracking),
  internalNotes: location.internalNotes || "",
  status: location.status || "Active",
  createdAt: location.createdAt,
  updatedAt: location.updatedAt,
});

const stockLocationPatch = (body) => {
  const patch = {};

  if (body.code !== undefined) patch.code = normalize(body.code);
  if (body.name !== undefined) patch.name = normalize(body.name);
  if (body.status !== undefined) patch.status = normalize(body.status) || "Active";
  stockLocationTextFields.forEach((field) => {
    if (body[field] !== undefined) patch[field] = normalize(body[field]);
  });
  ["maxQuantity", "maxWeight", "maxVolume", "utilization"].forEach((field) => {
    if (body[field] !== undefined) patch[field] = numberValue(body[field]);
  });
  ["hazardous", "batchAllowed", "expiryTracking"].forEach((field) => {
    if (body[field] !== undefined) patch[field] = booleanValue(body[field]);
  });

  return patch;
};

const masterRecordFields = [
  "description",
  "composition",
  "manufacturer",
  "drugLicense",
  "phone",
  "bank",
  "addressRequired",
];

const serializeMasterRecord = (record) => ({
  id: record.id || record._id,
  code: record.code,
  name: record.name,
  description: record.description || "",
  composition: record.composition || "",
  manufacturer: record.manufacturer || "",
  drugLicense: record.drugLicense || "",
  phone: record.phone || "",
  email: record.email || "",
  rate: record.rate ?? 0,
  bank: record.bank || "",
  addressRequired: record.addressRequired || "No",
  status: record.status || "Active",
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const masterRecordPatch = (body) => {
  const patch = {};

  if (body.code !== undefined) patch.code = normalize(body.code);
  if (body.name !== undefined) patch.name = normalize(body.name);
  if (body.email !== undefined) patch.email = normalizeEmail(body.email);
  if (body.rate !== undefined) patch.rate = numberValue(body.rate);
  if (body.status !== undefined) patch.status = normalize(body.status) || "Active";
  masterRecordFields.forEach((field) => {
    if (body[field] !== undefined) patch[field] = normalize(body[field]);
  });

  return patch;
};

const taxRatePatch = (body) => {
  const patch = masterRecordPatch(body);
  delete patch.name;

  if (body.rate !== undefined) {
    patch.name = patch.rate === 0 ? "GST Exempt" : `GST ${patch.rate}%`;
  }

  return patch;
};

const pharmacyMasterConfig = (entity, prefix, overrides = {}) => ({
  Model: MasterRecord,
  serialize: serializeMasterRecord,
  patch: masterRecordPatch,
  filter: { entity },
  createDefaults: { entity },
  sort: { createdAt: -1, code: 1 },
  autoCode: { prefix, width: 3, startAt: 1 },
  requiredDraft: ["name"],
  requiredActive: [],
  requiredMessage: "Name is required.",
  draftMessage: "Name is required.",
  ...overrides,
});

const masterEntityApis = {
  "generic-compositions": pharmacyMasterConfig("generic-compositions", "GEN", {
    requiredActive: ["composition"],
    requiredMessage: "Generic name and composition are required.",
  }),
  "brand-names": pharmacyMasterConfig("brand-names", "BRD", {
    uniqueTogether: ["name", "manufacturer"],
    uniqueTogetherMessage: "This Brand Name and Manufacturer combination already exists.",
  }),
  manufacturers: pharmacyMasterConfig("manufacturers", "MFR", {
    uniqueTogether: ["name"],
    uniqueTogetherMessage: "This Manufacturer Name already exists.",
  }),
  "customer-types": pharmacyMasterConfig("customer-types", "CT", {
    autoCode: { prefix: "CT", width: 2, startAt: 1 },
    requiredActive: ["addressRequired"],
    requiredMessage: "Customer type and address requirement are required.",
    uniqueTogether: ["name"],
    uniqueTogetherMessage: "This Customer Type already exists.",
  }),
  "tax-rates": pharmacyMasterConfig("tax-rates", "GST", {
    autoCode: { prefix: "GST", width: 2, startAt: 1 },
    patch: taxRatePatch,
    requiredMessage: "GST rate is required.",
    draftMessage: "GST rate is required.",
    uniqueTogether: ["rate"],
    uniqueTogetherMessage: "This GST Rate already exists.",
  }),
  "payment-modes": pharmacyMasterConfig("payment-modes", "PAY", {
    autoCode: { prefix: "PAY", width: 2, startAt: 1 },
    uniqueTogether: ["name", "bank"],
    uniqueTogetherMessage: "This Payment Mode and Bank combination already exists.",
  }),
  "raw-materials": {
    Model: RawMaterial,
    serialize: serializeRawMaterial,
    patch: rawMaterialPatch,
    sort: { createdAt: -1, code: 1 },
    autoCode: { prefix: "RM", width: 4, startAt: 2001 },
    requiredDraft: ["name"],
    requiredActive: ["category", "baseUnit"],
    requiredMessage: "Material name, category, and base unit are required.",
    draftMessage: "Material name is required.",
  },
  units: {
    Model: Unit,
    serialize: serializeUnit,
    patch: unitPatch,
    sort: { createdAt: -1, code: 1 },
    autoCode: { prefix: "UOM", width: 2 },
    requiredDraft: ["name"],
    requiredActive: [],
    requiredMessage: "Unit name is required.",
    draftMessage: "Unit name is required.",
    uniqueTogether: ["name"],
    uniqueTogetherMessage: "This Unit Name already exists.",
  },
  suppliers: {
    Model: Vendor,
    serialize: serializeSupplier,
    patch: supplierPatch,
    sort: { createdAt: -1, code: 1 },
    autoCode: { prefix: "SUP", width: 3, startAt: 101 },
    requiredDraft: ["name"],
    requiredActive: ["type", "contact", "phone"],
    requiredMessage: "Supplier name, supplier type, contact person, and phone are required.",
    draftMessage: "Supplier name is required.",
    uniqueTogether: ["name"],
    uniqueTogetherMessage: "This Supplier Name already exists.",
  },
  "warehouse-types": {
    Model: WarehouseType,
    serialize: serializeWarehouseType,
    patch: warehouseTypePatch,
    sort: { createdAt: -1, code: 1 },
    autoCode: { prefix: "WHT", width: 2, startAt: 1 },
    requiredDraft: ["name"],
    requiredActive: [],
    requiredMessage: "Warehouse type name is required.",
    draftMessage: "Warehouse type name is required.",
  },
  "location-types": {
    Model: LocationType,
    serialize: serializeLocationType,
    patch: locationTypePatch,
    sort: { createdAt: -1, code: 1 },
    autoCode: { prefix: "LCT", width: 2, startAt: 1 },
    requiredDraft: ["name"],
    requiredActive: [],
    requiredMessage: "Location type name is required.",
    draftMessage: "Location type name is required.",
  },
  departments: {
    Model: Department,
    serialize: serializeDepartment,
    patch: departmentPatch,
    sort: { createdAt: -1, code: 1 },
    autoCode: { prefix: "DPT", width: 2, startAt: 1 },
    requiredDraft: ["name"],
    requiredActive: [],
    requiredMessage: "Department name is required.",
    draftMessage: "Department name is required.",
  },
  warehouses: {
    Model: Store,
    serialize: serializeWarehouse,
    patch: warehousePatch,
    sort: { createdAt: -1, code: 1 },
    autoCode: { prefix: "WH", width: 2, startAt: 1 },
    requiredDraft: ["name"],
    requiredActive: [],
    requiredMessage: "Warehouse name is required.",
    draftMessage: "Warehouse name is required.",
    uniqueTogether: ["storeName"],
    uniqueTogetherMessage: "This Warehouse Name already exists.",
  },
  "stock-locations": {
    Model: StockLocation,
    serialize: serializeStockLocation,
    patch: stockLocationPatch,
    sort: { createdAt: -1, code: 1 },
    autoCode: { prefix: "LOC", width: 3, startAt: 1 },
    requiredDraft: ["name"],
    requiredActive: ["warehouse"],
    requiredMessage: "Location name and warehouse are required.",
    draftMessage: "Location name is required.",
    uniqueTogether: ["name", "warehouse"],
    uniqueTogetherMessage: "This Location Name and Warehouse combination already exists.",
  },
};

const validateMasterPatch = (patch, config) => {
  if (config.requiredDraft.some((field) => !patch[field])) {
    return config.draftMessage;
  }

  if (patch.status !== "Draft" && config.requiredActive.some((field) => !patch[field])) {
    return config.requiredMessage;
  }

  return "";
};

const hasUniqueTogetherConflict = async (config, tenantId, values, excludeCode = "") => {
  if (!config.uniqueTogether?.length) return false;

  const query = {
    tenantId,
    ...(config.filter || {}),
  };

  config.uniqueTogether.forEach((field) => {
    query[field] = normalize(values[field]);
  });

  if (excludeCode) query.code = { $ne: excludeCode };

  const match = await config.Model.exists(query).collation(CASE_INSENSITIVE_COLLATION);
  return Boolean(match);
};

export async function listProductItems(req, res, next) {
  try {
    const products = await Product.find({ tenantId: req.auth.tenantId })
      .sort({ createdAt: -1, code: 1 })
      .lean();

    return res.status(200).json({
      rows: products.map(serializeProductItem),
    });
  } catch (error) {
    next(error);
  }
}

export async function createProductItem(req, res, next) {
  try {
    const patch = productItemPatch(req.body);

    if (!patch.code) {
      patch.code = await generateMasterCode(Product, req.auth.tenantId, "MED", 4, 1001);
      patch.sku = patch.code;
    }

    if (!patch.name) {
      return res.status(400).json({
        message: "Product name is required.",
      });
    }

    if (patch.status !== "Draft" && !patch.category) {
      return res.status(400).json({
        message: "Medicine name and medicine category are required.",
      });
    }

    const product = await Product.create({
      tenantId: req.auth.tenantId,
      storeId: req.auth.storeId || null,
      createdBy: req.auth.sub,
      ...patch,
    });

    return res.status(201).json({
      row: serializeProductItem(product),
    });
  } catch (error) {
    const duplicateMessage = formatDuplicateError(error);
    if (duplicateMessage) {
      return res.status(409).json({ message: duplicateMessage });
    }

    next(error);
  }
}

export async function updateProductItem(req, res, next) {
  try {
    const currentCode = normalize(req.params.code);
    const patch = productItemPatch(req.body);

    if (patch.code === "") {
      return res.status(400).json({ message: "Item code is required." });
    }
    if (patch.name === "") {
      return res.status(400).json({ message: "Product name is required." });
    }

    const product = await Product.findOneAndUpdate(
      { tenantId: req.auth.tenantId, code: currentCode },
      { $set: patch },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product item not found." });
    }

    return res.status(200).json({
      row: serializeProductItem(product),
    });
  } catch (error) {
    const duplicateMessage = formatDuplicateError(error);
    if (duplicateMessage) {
      return res.status(409).json({ message: duplicateMessage });
    }

    next(error);
  }
}

export async function listCategories(req, res, next) {
  try {
    const [categories, products] = await Promise.all([
      Category.find({ tenantId: req.auth.tenantId })
        .sort({ displayOrder: 1, createdAt: -1, code: 1 })
        .lean(),
      Product.find({ tenantId: req.auth.tenantId }).select("category").lean(),
    ]);
    const countByCategory = products.reduce((counts, product) => {
      if (!product.category) return counts;
      counts.set(product.category, (counts.get(product.category) || 0) + 1);
      return counts;
    }, new Map());

    return res.status(200).json({
      rows: categories.map((category) => serializeCategory(category, countByCategory.get(category.name) || 0)),
    });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req, res, next) {
  try {
    const patch = categoryPatch(req.body);

    if (!patch.code) {
      patch.code = await generateMasterCode(Category, req.auth.tenantId, "CAT", 2);
    }

    if (!patch.name) {
      return res.status(400).json({
        message: "Category name is required.",
      });
    }

    if (patch.status !== "Draft" && !patch.type) {
      return res.status(400).json({
        message: "Category name and category type are required.",
      });
    }

    if (!patch.type) {
      patch.type = "Medicines";
    }

    const category = await Category.create({
      tenantId: req.auth.tenantId,
      storeId: req.auth.storeId || null,
      createdBy: req.auth.sub,
      ...patch,
    });

    return res.status(201).json({
      row: serializeCategory(category),
    });
  } catch (error) {
    const duplicateMessage = formatDuplicateError(error);
    if (duplicateMessage) {
      return res.status(409).json({ message: duplicateMessage });
    }

    next(error);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const currentCode = normalize(req.params.code);
    const patch = categoryPatch(req.body);

    if (patch.code === "") {
      return res.status(400).json({ message: "Category code is required." });
    }
    if (patch.name === "") {
      return res.status(400).json({ message: "Category name is required." });
    }

    const category = await Category.findOneAndUpdate(
      { tenantId: req.auth.tenantId, code: currentCode },
      { $set: patch },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    return res.status(200).json({
      row: serializeCategory(category),
    });
  } catch (error) {
    const duplicateMessage = formatDuplicateError(error);
    if (duplicateMessage) {
      return res.status(409).json({ message: duplicateMessage });
    }

    next(error);
  }
}

export async function listMasterRows(req, res, next) {
  try {
    const config = masterEntityApis[req.params.masterEntity];

    if (!config) {
      return res.status(404).json({ message: "Master entity not found." });
    }

    const rows = await config.Model.find({ tenantId: req.auth.tenantId, ...(config.filter || {}) })
      .sort(config.sort)
      .lean();

    return res.status(200).json({
      rows: rows.map(config.serialize),
    });
  } catch (error) {
    next(error);
  }
}

export async function createMasterRow(req, res, next) {
  try {
    const config = masterEntityApis[req.params.masterEntity];

    if (!config) {
      return res.status(404).json({ message: "Master entity not found." });
    }

    const patch = config.patch(req.body);

    if (config.autoCode && !patch.code) {
      patch.code = await generateMasterCode(
        config.Model,
        req.auth.tenantId,
        config.autoCode.prefix,
        config.autoCode.width,
        config.autoCode.startAt,
        config.filter
      );
    }

    const validationMessage = validateMasterPatch(patch, config);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    if (req.params.masterEntity === "stock-locations") {
      const warehouseMessage = await validateStockLocationWarehouse(req.auth.tenantId, patch.warehouse);
      if (warehouseMessage) {
        return res.status(400).json({ message: warehouseMessage });
      }
    }

    if (await hasUniqueTogetherConflict(config, req.auth.tenantId, patch)) {
      return res.status(409).json({ message: config.uniqueTogetherMessage });
    }

    const row = await config.Model.create({
      tenantId: req.auth.tenantId,
      storeId: req.auth.storeId || null,
      createdBy: req.auth.sub,
      ...(config.createDefaults || {}),
      ...patch,
    });

    return res.status(201).json({
      row: config.serialize(row),
    });
  } catch (error) {
    const duplicateMessage = formatDuplicateError(error);
    if (duplicateMessage) {
      return res.status(409).json({ message: duplicateMessage });
    }

    next(error);
  }
}

export async function updateMasterRow(req, res, next) {
  try {
    const config = masterEntityApis[req.params.masterEntity];

    if (!config) {
      return res.status(404).json({ message: "Master entity not found." });
    }

    const currentCode = normalize(req.params.code);
    const patch = config.patch(req.body);

    if (patch.code === "") {
      return res.status(400).json({ message: "Code is required." });
    }
    if (patch.name === "") {
      return res.status(400).json({ message: "Name is required." });
    }

    if (req.params.masterEntity === "stock-locations" && patch.warehouse !== undefined) {
      const warehouseMessage = await validateStockLocationWarehouse(req.auth.tenantId, patch.warehouse);
      if (warehouseMessage) {
        return res.status(400).json({ message: warehouseMessage });
      }
    }

    if (config.uniqueTogether?.length) {
      let uniqueValues = patch;

      if (config.uniqueTogether.some((field) => patch[field] === undefined)) {
        const currentRow = await config.Model.findOne({
          tenantId: req.auth.tenantId,
          ...(config.filter || {}),
          code: currentCode,
        }).lean();

        if (!currentRow) {
          return res.status(404).json({ message: "Master record not found." });
        }

        uniqueValues = { ...currentRow, ...patch };
      }

      if (await hasUniqueTogetherConflict(config, req.auth.tenantId, uniqueValues, currentCode)) {
        return res.status(409).json({ message: config.uniqueTogetherMessage });
      }
    }

    const row = await config.Model.findOneAndUpdate(
      { tenantId: req.auth.tenantId, ...(config.filter || {}), code: currentCode },
      { $set: patch },
      { new: true, runValidators: true }
    );

    if (!row) {
      return res.status(404).json({ message: "Master record not found." });
    }

    return res.status(200).json({
      row: config.serialize(row),
    });
  } catch (error) {
    const duplicateMessage = formatDuplicateError(error);
    if (duplicateMessage) {
      return res.status(409).json({ message: duplicateMessage });
    }

    next(error);
  }
}
