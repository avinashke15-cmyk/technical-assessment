const models = require('../models');
function parseScheduledAt(day, time) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) { const e = new Error('day must use YYYY-MM-DD format'); e.status=400; throw e; }
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { const e = new Error('time must use 24-hour HH:mm format'); e.status=400; throw e; }
  const [y,m,d] = day.split('-').map(Number); const [hh,mm] = time.split(':').map(Number);
  const date = new Date(y,m-1,d,hh,mm,0,0);
  if (date.getFullYear()!==y || date.getMonth()!==m-1 || date.getDate()!==d) { const e=new Error('day is not a valid calendar date'); e.status=400; throw e; }
  if (date.getTime() <= Date.now()) { const e=new Error('scheduled day and time must be in the future'); e.status=400; throw e; }
  return date;
}
async function createSchedule({message,day,time}) {
  if (typeof message!=='string' || !message.trim()) { const e=new Error('message is required'); e.status=400; throw e; }
  if (message.trim().length>5000) { const e=new Error('message must be 5000 characters or fewer'); e.status=400; throw e; }
  return models.ScheduledMessage.create({message:message.trim(),scheduledAt:parseScheduledAt(day,time)});
}
async function processDueSchedules() {
  while (true) {
    const schedule = await models.ScheduledMessage.findOneAndUpdate(
      {status:'pending',scheduledAt:{$lte:new Date()}}, {$set:{status:'processing'}},
      {sort:{scheduledAt:1},new:true}
    );
    if (!schedule) break;
    try {
      await models.Message.updateOne({scheduledMessageId:schedule._id}, {$setOnInsert:{
        message:schedule.message, scheduledAt:schedule.scheduledAt, scheduledMessageId:schedule._id, insertedAt:new Date()
      }}, {upsert:true});
      await models.ScheduledMessage.updateOne({_id:schedule._id},{$set:{status:'completed',processedAt:new Date(),error:''}});
    } catch (e) {
      await models.ScheduledMessage.updateOne({_id:schedule._id},{$set:{status:'failed',error:e.message}});
      console.error('[Scheduler] Failed:',e.message);
    }
  }
}
module.exports = {
 createSchedule,
 listSchedules: () => models.ScheduledMessage.find().sort({scheduledAt:1}).lean(),
 listMessages: () => models.Message.find().sort({scheduledAt:-1}).lean(),
 processDueSchedules
};
