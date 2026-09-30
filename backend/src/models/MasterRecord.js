import mongoose from "mongoose";

const masterRecordSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
      index: true,
    },
    entity: {
      type: String,
      required: true,
      enum: [
        "generic-compositions",
        "brand-names",
        "manufacturers",
        "customer-types",
        "tax-rates",
        "payment-modes",
      ],
      index: true,
    },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    composition: { type: String, default: "", trim: true },
    manufacturer: { type: String, default: "", trim: true },
    drugLicense: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    rate: { type: Number, default: 0, min: 0, max: 100 },
    bank: { type: String, default: "", trim: true },
    addressRequired: {
      type: String,
      enum: ["Yes", "No"],
      default: "No",
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Draft"],
      default: "Active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

masterRecordSchema.index(
  { tenantId: 1, entity: 1, code: 1 },
  { unique: true }
);
masterRecordSchema.index({ tenantId: 1, entity: 1, name: 1 });
masterRecordSchema.index({ tenantId: 1, entity: 1, status: 1 });
masterRecordSchema.index(
  { tenantId: 1, entity: 1, name: 1, bank: 1 },
  {
    unique: true,
    name: "unique_payment_mode_bank_per_tenant",
    partialFilterExpression: { entity: "payment-modes" },
    collation: { locale: "en", strength: 2 },
  }
);
masterRecordSchema.index(
  { tenantId: 1, entity: 1, rate: 1 },
  {
    unique: true,
    name: "unique_gst_rate_per_tenant",
    partialFilterExpression: { entity: "tax-rates" },
  }
);
masterRecordSchema.index(
  { tenantId: 1, entity: 1, name: 1 },
  {
    unique: true,
    name: "unique_customer_type_per_tenant",
    partialFilterExpression: { entity: "customer-types" },
    collation: { locale: "en", strength: 2 },
  }
);
masterRecordSchema.index(
  { tenantId: 1, entity: 1, name: 1 },
  {
    unique: true,
    name: "unique_manufacturer_name_per_tenant",
    partialFilterExpression: { entity: "manufacturers" },
    collation: { locale: "en", strength: 2 },
  }
);
masterRecordSchema.index(
  { tenantId: 1, entity: 1, name: 1, manufacturer: 1 },
  {
    unique: true,
    name: "unique_brand_name_manufacturer_per_tenant",
    partialFilterExpression: { entity: "brand-names" },
    collation: { locale: "en", strength: 2 },
  }
);

export default mongoose.model("MasterRecord", masterRecordSchema);
