const express = require("express");
const cors = require("cors");
const { sql, dbConfig, getPool } = require("./backend/db.cjs");
const {
  logInfo,
  logError,
  createRequestLogger,
  handleServerError,
} = require("./backend/logger.cjs");
const { createHealthHandlers } = require("./backend/health.cjs");
const { registerExportadorasRoutes } = require("./backend/routes/exportadoras.cjs");
const { registerConfigurationRoutes } = require("./backend/routes/configuracion.cjs");
const { registerBalanceRoutes } = require("./backend/routes/balance.cjs");
const { registerTurnosRoutes } = require("./backend/routes/turnos.cjs");

const app = express();
app.use(cors());
app.use(express.json());
app.use(createRequestLogger());

const normalizarTexto = (v = "") => String(v || "").trim().toUpperCase();

const normalizarFilaFechas = (row, campos) => {
  if (!row) return null;
  const out = { ...row };
  for (const campo of campos) {
    if (out[campo] instanceof Date) {
      out[campo] = out[campo].toISOString().split("T")[0];
    } else if (typeof out[campo] === "string" && out[campo].includes("T")) {
      out[campo] = out[campo].split("T")[0];
    }
  }
  return out;
};

async function obtenerEspecieDesdePayload(p, especie_id, especieNombre) {
  const especieIdNum =
    especie_id === undefined || especie_id === null || especie_id === ""
      ? null
      : Number(especie_id);

  if (especieIdNum) {
    const q = await p.request().input("id", sql.Int, especieIdNum).query(`
      SELECT TOP 1 id, nombre, familia_id
      FROM especies
      WHERE id=@id AND activa=1
    `);
    if (q.recordset.length) {
      return {
        especie_id: q.recordset[0].id,
        especie: normalizarTexto(q.recordset[0].nombre),
        familia_id: q.recordset[0].familia_id,
      };
    }
  }

  const especie = normalizarTexto(especieNombre);
  if (!especie) return { especie_id: null, especie: "", familia_id: null };

  const q = await p.request().input("nombre", sql.NVarChar, especie).query(`
    SELECT TOP 1 id, nombre, familia_id
    FROM especies
    WHERE UPPER(nombre)=@nombre AND activa=1
    ORDER BY id
  `);

  if (q.recordset.length) {
    return {
      especie_id: q.recordset[0].id,
      especie: normalizarTexto(q.recordset[0].nombre),
      familia_id: q.recordset[0].familia_id,
    };
  }

  return { especie_id: null, especie, familia_id: null };
}

app.get("/", (req, res) => {
  res.send("Backend balance-fruta operativo");
});

const { handleHealthz, handleReadyz } = createHealthHandlers(getPool);

app.get("/healthz", handleHealthz);
app.get("/api/healthz", handleHealthz);
app.get("/readyz", handleReadyz);
app.get("/api/readyz", handleReadyz);

registerExportadorasRoutes(app, {
  sql,
  getPool,
  normalizarTexto,
  obtenerEspecieDesdePayload,
  handleServerError,
});

registerConfigurationRoutes(app, {
  sql,
  getPool,
  normalizarTexto,
  normalizarFilaFechas,
  handleServerError,
});

registerBalanceRoutes(app, {
  sql,
  getPool,
  handleServerError,
});

registerTurnosRoutes(app, {
  sql,
  getPool,
  handleServerError,
});

const PORT = Number(process.env.PORT || 4001);
app.listen(PORT, () => {
  logInfo("server_started", {
    port: PORT,
    server: dbConfig.server,
    database: dbConfig.database,
  });
});

process.on("unhandledRejection", (error) => {
  logError("unhandled_rejection", error);
});

process.on("uncaughtException", (error) => {
  logError("uncaught_exception", error);
});
