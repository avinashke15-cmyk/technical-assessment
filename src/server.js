require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");
const { Worker } = require("worker_threads");
const connectDB = require("./config/db");
const { errorHandler, notFound } = require("./middleware/error-handler");
const apiRoutes = require("./routes");
const { startCpuMonitor } = require("./services/cpu-monitor.service");
const messageService = require("./services/message.service");
const app = express();

app.use(express.json({ limit: "1mb" }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", apiRoutes);

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueId = crypto.randomBytes(16).toString("hex");
    cb(null, `${Date.now()}-${uniqueId}${path.extname(file.originalname).toLowerCase()}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![".csv", ".xlsx", ".xls"].includes(ext)) return cb(new Error("Only CSV, XLSX, and XLS files are supported"));
    cb(null, true);
  }
});

const jobs = new Map();
app.post("/api/import", upload.single("file"), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: "Upload a file using multipart field 'file'." });
  const jobId = crypto.randomBytes(16).toString("hex");
  jobs.set(jobId, { jobId, status: "queued", uploadedFile: req.file.originalname, createdAt: new Date().toISOString() });

  const worker = new Worker(path.resolve(__dirname, "workers/import.worker.js"), {
    workerData: { filePath: req.file.path, originalName: req.file.originalname, mongoUri: process.env.MONGODB_URI }
  });
  jobs.set(jobId, { ...jobs.get(jobId), status: "processing" });
  worker.on("message", (message) => {
    jobs.set(jobId, { ...jobs.get(jobId), ...message, jobId, updatedAt: new Date().toISOString() });
  });
  worker.on("error", (error) => {
    jobs.set(jobId, { ...jobs.get(jobId), status: "failed", error: error.message, updatedAt: new Date().toISOString() });
  });
  worker.on("exit", (code) => {
    const current = jobs.get(jobId);
    if (code !== 0 && current.status !== "failed" && current.status !== "completed") {
      jobs.set(jobId, { ...current, status: "failed", error: `Worker exited with code ${code}` });
    }
    fs.promises.unlink(req.file.path).catch(() => {});
  });
  res.status(202).json({ jobId, status: "processing", statusUrl: `/api/import/${jobId}` });
});

app.get("/api/import/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Import job not found (job state is in-memory and may reset on restart)." });
  res.json(job);
});

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 3000);
connectDB()
  .then(() => {
    app.listen(port, () => console.log(`API listening on port ${port}`));
    startCpuMonitor();
    const schedulerInterval = Number(process.env.MESSAGE_SCHEDULER_INTERVAL_MS || 10000);
    setInterval(() => messageService.processDueSchedules().catch(err => console.error('[Scheduler]', err.message)), schedulerInterval).unref();
    messageService.processDueSchedules().catch(err => console.error('[Scheduler startup]', err.message));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
