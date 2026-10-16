function notFound(req, res, _next) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}
function errorHandler(err, _req, res, _next) {
  console.error(err);
  if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
  if (err.code === 11000) return res.status(409).json({ error: "Duplicate value", details: err.keyValue });
  if (err.name === "MulterError") return res.status(400).json({ error: err.message });
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
}
module.exports = { notFound, errorHandler };
