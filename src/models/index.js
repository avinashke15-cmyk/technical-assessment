const mongoose = require("mongoose");
const { Schema } = mongoose;

const agentSchema = new Schema({ name: { type: String, required: true, trim: true, unique: true } }, { timestamps: true });
const userSchema = new Schema({
  firstName: { type: String, required: true, trim: true, index: true },
  dob: { type: Date, default: null },
  address: { type: String, default: "" },
  phoneNumber: { type: String, default: "", index: true },
  state: { type: String, default: "", index: true },
  zipCode: { type: String, default: "" },
  email: { type: String, default: "", lowercase: true, trim: true, index: true },
  gender: { type: String, default: "" },
  userType: { type: String, default: "", index: true },
  city: { type: String, default: "" },
  accountType: { type: String, default: "" },
  accountId: { type: Schema.Types.ObjectId, ref: "UserAccount", default: null },
  agentId: { type: Schema.Types.ObjectId, ref: "Agent", default: null }
}, { timestamps: true });
userSchema.index({ email: 1 });
userSchema.index({ firstName: 1, phoneNumber: 1 });

const userAccountSchema = new Schema({ name: { type: String, required: true, trim: true, unique: true } }, { timestamps: true });
const lobSchema = new Schema({ categoryName: { type: String, required: true, trim: true, unique: true } }, { timestamps: true });
const carrierSchema = new Schema({ companyName: { type: String, required: true, trim: true, unique: true } }, { timestamps: true });
const policySchema = new Schema({
  policyNumber: { type: String, required: true, trim: true },
  policyStartDate: { type: Date, default: null },
  policyEndDate: { type: Date, default: null },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  categoryId: { type: Schema.Types.ObjectId, ref: "LOBCategory", default: null, index: true },
  companyId: { type: Schema.Types.ObjectId, ref: "PolicyCarrier", default: null, index: true },
  policyMode: { type: Number, default: null },
  producer: { type: String, default: "" },
  policyType: { type: String, default: "" },
  premiumAmount: { type: Number, default: null },
  premiumAmountWritten: { type: Number, default: null },
  csr: { type: String, default: "" }
}, { timestamps: true });
policySchema.index({ policyNumber: 1, userId: 1 }, { unique: true });
policySchema.index({ userId: 1, policyEndDate: 1 });


const scheduledMessageSchema = new Schema({
  message: { type: String, required: true, trim: true },
  scheduledAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', index: true },
  processedAt: { type: Date, default: null },
  error: { type: String, default: '' }
}, { timestamps: true });
scheduledMessageSchema.index({ status: 1, scheduledAt: 1 });
const messageSchema = new Schema({
  message: { type: String, required: true, trim: true },
  scheduledAt: { type: Date, required: true },
  scheduledMessageId: { type: Schema.Types.ObjectId, ref: 'ScheduledMessage', required: true, unique: true },
  insertedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = {
  Agent: mongoose.models.Agent || mongoose.model("Agent", agentSchema, "agents"),
  User: mongoose.models.User || mongoose.model("User", userSchema, "users"),
  UserAccount: mongoose.models.UserAccount || mongoose.model("UserAccount", userAccountSchema, "useraccounts"),
  LOBCategory: mongoose.models.LOBCategory || mongoose.model("LOBCategory", lobSchema, "lobcategories"),
  PolicyCarrier: mongoose.models.PolicyCarrier || mongoose.model("PolicyCarrier", carrierSchema, "policycarriers"),
  Policy: mongoose.models.Policy || mongoose.model("Policy", policySchema, "policies"),
  ScheduledMessage: mongoose.models.ScheduledMessage || mongoose.model("ScheduledMessage", scheduledMessageSchema, "scheduledmessages"),
  Message: mongoose.models.Message || mongoose.model("Message", messageSchema, "messages")
};
