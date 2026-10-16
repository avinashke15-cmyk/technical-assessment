const service = require('../services/message.service');
exports.createSchedule = async (req,res,next) => {
 try {
  const schedule = await service.createSchedule(req.body || {});
  res.status(201).json({message:'Message scheduled successfully',schedule,note:'Schedule saved now; message document is inserted when scheduled time arrives.'});
 } catch(e) { next(e); }
};
exports.listSchedules = async (_req,res,next) => { try { res.json(await service.listSchedules()); } catch(e) { next(e); } };
exports.listMessages = async (_req,res,next) => { try { res.json(await service.listMessages()); } catch(e) { next(e); } };
