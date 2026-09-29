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

export default mongoose.model("MasterRecord", masterRecordSchema);
