import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
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

    code: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    customerType: {
      type: String,
      default: "",
      trim: true,
    },

    phone: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      default: "",
    },

    billingCity: { type: String, default: "", trim: true },
    billingDistrict: { type: String, default: "", trim: true },
    billingState: { type: String, default: "", trim: true },
    billingPostalCode: { type: String, default: "", trim: true },
    gstin: { type: String, default: "", trim: true },

    openingBalance: {
      type: Number,
      default: 0,
    },

    currentBalance: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

customerSchema.index({ tenantId: 1, storeId: 1, phone: 1 });
customerSchema.index({ tenantId: 1, storeId: 1, name: 1 });

export default mongoose.model("Customer", customerSchema);
