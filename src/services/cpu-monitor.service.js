const previous = { usage: process.cpuUsage(), time: process.hrtime.bigint() };
let highSamples = 0;
let started = false;
const threshold = Number(process.env.CPU_RESTART_THRESHOLD || 70);
const interval = Number(process.env.CPU_MONITOR_INTERVAL_MS || 5000);
const requiredSamples = Number(process.env.CPU_HIGH_SAMPLES || 3);
function startCpuMonitor() {
  if (started) return;
  started = true;
  console.log(`[CPU] Monitoring process CPU; threshold=${threshold}%, interval=${interval}ms, samples=${requiredSamples}`);
  setInterval(() => {
    try {
      const usage = process.cpuUsage();
      const time = process.hrtime.bigint();
      const elapsedUs = Number(time - previous.time) / 1000;
      const usedUs = (usage.user - previous.usage.user) + (usage.system - previous.usage.system);
      previous.usage = usage;
      previous.time = time;
      if (elapsedUs <= 0) return;
      // 100% means one fully utilized CPU core; multi-core processes may exceed 100%.
      const percent = usedUs / elapsedUs * 100;
      console.log(`[CPU] Node.js process: ${percent.toFixed(1)}%`);
      highSamples = percent >= threshold ? highSamples + 1 : 0;
      if (highSamples >= requiredSamples) {
        console.error(`[CPU] Above ${threshold}% for ${requiredSamples} samples; exiting for PM2 restart.`);
        process.exit(1);
      }
    } catch (e) { console.error('[CPU] Measurement failed:', e.message); }
  }, interval).unref();
}
module.exports = { startCpuMonitor };
