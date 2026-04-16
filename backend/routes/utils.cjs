const { logInfo } = require("../logger.cjs");

const createRouteHandler = (handleServerError, context, handler, metaFactory = null) => async (req, res) => {
  logInfo("route_handler_started", {
    context,
    request_id: req?.requestId,
    method: req?.method,
    path: req?.originalUrl,
  });

  try {
    await handler(req, res);
    logInfo("route_handler_finished", {
      context,
      request_id: req?.requestId,
      method: req?.method,
      path: req?.originalUrl,
      headers_sent: res.headersSent,
    });
  } catch (error) {
    const meta = typeof metaFactory === "function" ? metaFactory(req) : {};
    handleServerError(res, error, context, req, meta);
  }
};

module.exports = {
  createRouteHandler,
};
