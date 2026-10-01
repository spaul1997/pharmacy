import mongoose from "mongoose";

const salesOrderSchema = new mongoose.Schema(
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
    orderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    documentDate: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      default: "Draft",
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

salesOrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
salesOrderSchema.index({ tenantId: 1, documentDate: -1 });

export default mongoose.model("SalesOrder", salesOrderSchema, "sales_orders");
