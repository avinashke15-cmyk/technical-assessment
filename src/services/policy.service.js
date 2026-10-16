const mongoose = require("mongoose");
const models = require("../models");

exports.searchByUsername = async (username) => {
  const regex = new RegExp(escapeRegex(username), "i");
  const users = await models.User.find({ $or: [{ firstName: regex }, { email: regex }] })
    .populate("accountId").populate("agentId").lean();
  if (!users.length) return { count: 0, results: [] };
  const results = await Promise.all(users.map(async (user) => {
    const policies = await models.Policy.find({ userId: user._id })
      .populate("categoryId").populate("companyId").lean();
    return { user, policyCount: policies.length, policies };
  }));
  return { count: results.length, results };
};

exports.aggregateByUser = async ({ state, userType }) => {
  const match = {};
  if (state) match.state = state;
  if (userType) match.userType = userType;
  return models.User.aggregate([
    { $match: match },
    { $lookup: { from: "policies", localField: "_id", foreignField: "userId", as: "policies" } },
    { $lookup: { from: "lobcategories", localField: "policies.categoryId", foreignField: "_id", as: "categories" } },
    { $lookup: { from: "policycarriers", localField: "policies.companyId", foreignField: "_id", as: "carriers" } },
    { $project: {
      firstName: 1, email: 1, phoneNumber: 1, state: 1, userType: 1,
      policyCount: { $size: "$policies" },
      policies: { $map: { input: "$policies", as: "p", in: {
        policyNumber: "$$p.policyNumber", policyStartDate: "$$p.policyStartDate", policyEndDate: "$$p.policyEndDate",
        category: { $arrayElemAt: [{ $filter: { input: "$categories", as: "c", cond: { $eq: ["$$c._id", "$$p.categoryId"] } } }, 0] },
        carrier: { $arrayElemAt: [{ $filter: { input: "$carriers", as: "c", cond: { $eq: ["$$c._id", "$$p.companyId"] } } }, 0] }
      } } }
    } },
    { $sort: { firstName: 1 } }
  ]);
};

exports.listPolicies = async () => models.Policy.find().populate("userId").populate("categoryId").populate("companyId").lean();
exports.listCollection = async (name) => {
  const allowed = ["Agent", "User", "UserAccount", "LOBCategory", "PolicyCarrier"];
  if (!allowed.includes(name)) throw new Error("Invalid collection");
  return models[name].find().lean();
};
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
