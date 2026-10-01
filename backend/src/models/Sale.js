import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    productCode: { type: String, required: true, trim: true },
    productName: { type: String, default: "", trim: true },
    genericName: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    composition: { type: String, default: "", trim: true },
    hsn: { type: String, default: "", trim: true },
    uom: { type: String, default: "", trim: true },

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductBatch",
      default: null,
    },

    batchNumber: {
      type: String,
      default: "",
    },

    expiryDate: {
      type: Date,
      default: null,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    sellingPrice: {
      type: Number,
      required: true,
    },

    mrp: {
      type: Number,
      default: 0,
    },

    taxRate: {
      type: Number,
      default: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    discountPercent: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },

    total: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const salePaymentSchema = new mongoose.Schema(
  {
    date: { type: String, default: "" },
    mode: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    reference: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
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

    invoiceNumber: {
      type: String,
      required: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    customerName: { type: String, required: true, trim: true },
    customerMobile: { type: String, default: "", trim: true },
    customerType: { type: String, default: "", trim: true },
    billingAddress: { type: String, default: "", trim: true },
    shippingAddress: { type: String, default: "", trim: true },
    destinationState: { type: String, default: "", trim: true },
    district: { type: String, default: "", trim: true },
    pin: { type: String, default: "", trim: true },
    gstin: { type: String, default: "", trim: true },

    saleDate: {
      type: Date,
      default: Date.now,
    },

    items: [saleItemSchema],

    subtotal: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
    },

    grandTotal: {
      type: Number,
      default: 0,
    },

    freight: { type: Number, default: 0 },
    packing: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },

    paidAmount: {
      type: Number,
      default: 0,
    },

    dueAmount: {
      type: Number,
      default: 0,
    },

    paymentMode: {
      type: String,
      enum: ["cash", "upi", "card", "bank", "credit", "mixed"],
      default: "cash",
    },

    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "unpaid", "Paid", "Partially Paid", "Unpaid"],
      default: "unpaid",
    },

    payments: [salePaymentSchema],

    source: { type: String, default: "Create Bill", trim: true },

    prescription: {
      isRequired: {
        type: Boolean,
        default: false,
      },

      doctorName: {
        type: String,
        default: "",
      },

      prescriptionNumber: {
        type: String,
        default: "",
      },

      prescriptionFile: {
        type: String,
        default: "",
      },
    },

    notes: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      default: "Draft",
      trim: true,
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

saleSchema.index(
  { tenantId: 1, storeId: 1, invoiceNumber: 1 },
  { unique: true }
);

saleSchema.index({ tenantId: 1, storeId: 1, saleDate: -1 });
saleSchema.index({ tenantId: 1, storeId: 1, customerId: 1 });

export default mongoose.model("Sale", saleSchema);
