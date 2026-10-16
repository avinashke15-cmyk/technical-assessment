const service = require("../services/policy.service");
exports.searchByUsername = async (req, res, next) => {
  try {
    const username = String(req.query.username || "").trim();
    if (!username) return res.status(400).json({ error: "Query parameter 'username' is required." });
    res.json(await service.searchByUsername(username));
  } catch (e) { next(e); }
};
exports.aggregateByUser = async (req, res, next) => {
  try { res.json(await service.aggregateByUser({ state: req.query.state, userType: req.query.userType })); }
  catch (e) { next(e); }
};
exports.listPolicies = async (_req, res, next) => { try { res.json(await service.listPolicies()); } catch (e) { next(e); } };
exports.listAgents = async (_req, res, next) => { try { res.json(await service.listCollection("Agent")); } catch (e) { next(e); } };
exports.listUsers = async (_req, res, next) => { try { res.json(await service.listCollection("User")); } catch (e) { next(e); } };
exports.listAccounts = async (_req, res, next) => { try { res.json(await service.listCollection("UserAccount")); } catch (e) { next(e); } };
exports.listLobs = async (_req, res, next) => { try { res.json(await service.listCollection("LOBCategory")); } catch (e) { next(e); } };
exports.listCarriers = async (_req, res, next) => { try { res.json(await service.listCollection("PolicyCarrier")); } catch (e) { next(e); } };
