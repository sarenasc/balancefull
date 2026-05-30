const express = require("express");
const { createRouteHandler } = require("./utils.cjs");

const registerBalanceRoutes = (app, deps) => {
  const { sql, getPool, handleServerError } = deps;
  const router = express.Router();

  router.get(
    "/balance/dias",
    createRouteHandler(handleServerError, "balance_days_list_failed", async (req, res) => {
      const p = await getPool();
      const t = await p.request().query(
        "SELECT TOP 1 id FROM temporadas WHERE activa=1 ORDER BY id DESC",
      );
      if (!t.recordset.length) return res.json([]);
      const tempId = t.recordset[0].id;

      const r = await p.request().input("tid", sql.Int, tempId).query(`
        SELECT
          CONVERT(VARCHAR,f.fecha,23) AS fecha,
          ISNULL(SUM(c.bins),0) AS cosecha,
          ISNULL(SUM(cu.bins),0) AS curado,
          ISNULL(SUM(pr.bins),0) AS proceso
        FROM (
          SELECT DISTINCT CAST(fecha AS DATE) AS fecha FROM (
            SELECT fecha FROM cosechas WHERE temporada_id=@tid
            UNION SELECT fecha FROM curado WHERE temporada_id=@tid
            UNION SELECT fecha FROM procesos WHERE temporada_id=@tid
          ) x
          WHERE fecha >= DATEADD(DAY,-5,CAST(GETDATE() AS DATE))
        ) f
        LEFT JOIN cosechas c ON CAST(c.fecha AS DATE)=f.fecha AND c.temporada_id=@tid
        LEFT JOIN curado cu ON CAST(cu.fecha AS DATE)=f.fecha AND cu.temporada_id=@tid
        LEFT JOIN procesos pr ON CAST(pr.fecha AS DATE)=f.fecha AND pr.temporada_id=@tid
        GROUP BY f.fecha
        ORDER BY f.fecha DESC
      `);
      res.json(r.recordset);
    }),
  );

  router.get(
    "/totales",
    createRouteHandler(handleServerError, "totales_summary_failed", async (req, res) => {
      const p = await getPool();
      const t = await p.request().query(
        "SELECT TOP 1 id FROM temporadas WHERE activa=1 ORDER BY id DESC",
      );
      if (!t.recordset.length) return res.json({});
      const tempId = t.recordset[0].id;

      const [bins, kilos, porExp] = await Promise.all([
        p.request().input("tid", sql.Int, tempId).input("hoy", sql.Date, new Date()).query(
          "SELECT ISNULL(SUM(bins),0) AS total FROM procesos WHERE temporada_id=@tid AND fecha <= @hoy",
        ),
        p.request().input("tid", sql.Int, tempId).input("hoy", sql.Date, new Date()).query(`
          SELECT ISNULL(SUM(pr.bins * CAST(cfg.valor AS FLOAT)),0) AS total
          FROM procesos pr
          CROSS JOIN configuracion cfg
          WHERE pr.temporada_id=@tid AND cfg.clave='kg_por_bin' AND pr.fecha <= @hoy
        `),
        p.request().input("tid", sql.Int, tempId).input("hoy", sql.Date, new Date()).query(`
          SELECT
            e.nombre AS exportadora,
            ISNULL(SUM(c.bins),0) AS bins_cosecha,
            ISNULL(SUM(pr.bins),0) AS bins_proceso
          FROM exportadoras e
          LEFT JOIN cosechas c ON c.exportadora_id=e.id AND c.temporada_id=@tid AND c.fecha <= @hoy
          LEFT JOIN procesos pr ON pr.exportadora_id=e.id AND pr.temporada_id=@tid AND pr.fecha <= @hoy
          WHERE e.activa=1
          GROUP BY e.nombre, e.id
          ORDER BY e.id
        `),
      ]);

      res.json({
        bins_procesados: bins.recordset[0].total,
        kilos_procesados: kilos.recordset[0].total,
        por_exportadora: porExp.recordset,
      });
    }),
  );

  app.use("/api", router);
};

module.exports = {
  registerBalanceRoutes,
};
