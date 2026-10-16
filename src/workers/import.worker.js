const { parentPort, workerData } = require("worker_threads");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const csv = require("csv-parser");
const { Agent, User, UserAccount, LOBCategory, PolicyCarrier, Policy } = require("../models");

function norm(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
function pick(row, aliases) {
  const wanted = new Set(aliases.map(norm));
  for (const [key, value] of Object.entries(row)) if (wanted.has(norm(key)) && value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  return "";
}
function dateValue(value) {
  if (value === "" || value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function readRows(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".xlsx" || ext === ".xls") {
    const workbook = xlsx.readFile(filePath, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return Promise.resolve(xlsx.utils.sheet_to_json(sheet, { defval: "" }));
  }
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath).pipe(csv()).on("data", row => rows.push(row)).on("end", () => resolve(rows)).on("error", reject);
  });
}
async function upsertNamed(Model, field, value) {
  if (!value) return null;
  return Model.findOneAndUpdate({ [field]: value }, { $setOnInsert: { [field]: value } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
async function run() {
  if (!workerData.mongoUri) throw new Error("MONGODB_URI is not configured");
  await mongoose.connect(workerData.mongoUri);
  const rows = await readRows(workerData.filePath);
  let imported = 0, skipped = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const agentName = pick(row, ["Agent Name", "Agent"]);
      const firstName = pick(row, ["First Name", "Username", "User Name", "Name"]);
      const dob = dateValue(pick(row, ["DOB", "Date of Birth"]));
      const address = pick(row, ["Address", "User Address"]);
      const phoneNumber = pick(row, ["Phone Number", "Phone", "Mobile"]);
      const state = pick(row, ["State"]);
      const zipCode = pick(row, ["Zip Code", "Zip", "Postal Code"]);
      const email = pick(row, ["Email", "Email Address"]).toLowerCase();
      const gender = pick(row, ["Gender"]);
      const userType = pick(row, ["User Type", "UserType"]);
      const city = pick(row, ["City"]);
      const accountType = pick(row, ["Account Type", "AccountType"]);
      const policyModeRaw = pick(row, ["Policy Mode", "PolicyMode"]);
      const premiumAmountRaw = pick(row, ["Premium Amount", "PremiumAmount"]);
      const premiumAmountWrittenRaw = pick(row, ["Premium Amount Written", "PremiumAmountWritten"]);
      const producer = pick(row, ["Producer"]);
      const policyType = pick(row, ["Policy Type", "PolicyType"]);
      const csr = pick(row, ["CSR"]);
      const accountName = pick(row, ["Account Name", "User Account"]);
      const categoryName = pick(row, ["Policy Category", "Category Name", "LOB", "Policy LOB"]);
      const companyName = pick(row, ["Policy Carrier", "Company Name", "Carrier", "Insurance Company"]);
      const policyNumber = pick(row, ["Policy Number", "Policy No", "Policy #"]);
      const policyStartDate = dateValue(pick(row, ["Policy Start Date", "Start Date", "Effective Date"]));
      const policyEndDate = dateValue(pick(row, ["Policy End Date", "End Date", "Expiration Date"]));

      if (!firstName || !policyNumber || (!email && !phoneNumber)) { skipped++; continue; }
      const agent = agentName ? await upsertNamed(Agent, "name", agentName) : null;
      const account = accountName ? await upsertNamed(UserAccount, "name", accountName) : null;
      const category = categoryName ? await upsertNamed(LOBCategory, "categoryName", categoryName) : null;
      const carrier = companyName ? await upsertNamed(PolicyCarrier, "companyName", companyName) : null;

      // The supplied CSV contains repeated email addresses belonging to different people.
      // Use email + first name + phone as identity when email exists; otherwise name + phone.
      const userIdentity = email ? { email, firstName, phoneNumber } : { firstName, phoneNumber };
      const userUpdate = { firstName, dob, address, phoneNumber, state, zipCode, email, gender, userType, city, accountType };
      if (account) userUpdate.accountId = account._id;
      if (agent) userUpdate.agentId = agent._id;
      const user = await User.findOneAndUpdate(userIdentity, { $set: userUpdate }, { upsert: true, new: true, setDefaultsOnInsert: true });

      const numeric = (value) => value === "" ? null : Number(value);
      await Policy.findOneAndUpdate(
        { policyNumber, userId: user._id },
        { $set: { policyNumber, policyStartDate, policyEndDate, userId: user._id, categoryId: category?._id || null, companyId: carrier?._id || null,
          policyMode: numeric(policyModeRaw), premiumAmount: numeric(premiumAmountRaw), premiumAmountWritten: numeric(premiumAmountWrittenRaw), producer, policyType, csr } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      imported++;
    } catch (e) {
      skipped++;
      if (errors.length < 20) errors.push({ row: i + 2, error: e.message });
    }
  }
  parentPort.postMessage({ status: "completed", totalRows: rows.length, importedRows: imported, skippedRows: skipped, errors });
}
run().catch(err => parentPort.postMessage({ status: "failed", error: err.message })).finally(async () => {
  await mongoose.disconnect().catch(() => {});
});
