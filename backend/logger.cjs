const fs = require("fs");

const writeDebugLog = (payload) => {
  const file = process.env.DEBUG_LOG_FILE;
  if (!file) return;
  try {
    fs.appendFileSync(file, `${JSON.stringify(payload)}\n`);
  } catch (_) {
    // best-effort debug logging
  }
};

const logInfo = (message, meta = {}) => {
  const payload = { level: "info", message, ...meta };
  console.log(JSON.stringify(payload));
  writeDebugLog(payload);
};

const logError = (message, error, meta = {}) => {
  const payload = {
    level: "error",
    message,
    error: error?.message || String(error),
    stack: error?.stack,
    ...meta,
  };
  console.error(JSON.stringify(payload));
  writeDebugLog(payload);
};

const createRequestLogger = () => (req, res, next) => {
  const startedAt = Date.now();
  req.requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader("X-Request-Id", req.requestId);

  res.on("finish", () => {
    logInfo("request_completed", {
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
    });
  });

  next();
};

const handleServerError = (res, error, context, req = null, meta = {}) => {
  logError(context, error, {
    ...(req?.requestId ? { request_id: req.requestId } : {}),
    ...(req?.method ? { method: req.method } : {}),
    ...(req?.originalUrl ? { path: req.originalUrl } : {}),
    ...meta,
  });
  res.status(500).json({ error: error.message });
};

module.exports = {
  logInfo,
  logError,
  createRequestLogger,
  handleServerError,
};
