const express = require("express");
const { createRouteHandler } = require("./utils.cjs");

const registerConfigurationRoutes = (app, deps) => {
  const { sql, getPool, normalizarTexto, normalizarFilaFechas, handleServerError } = deps;
  const router = express.Router();

  const upsertTable = (tabla) =>
    createRouteHandler(handleServerError, `${tabla}_upsert_failed`, async (req, res) => {
      const { exportadora_id, temporada_id, fecha, bins } = req.body;
      const p = await getPool();
      await p.request()
        .input("expId", sql.Int, exportadora_id)
        .input("tempId", sql.Int, temporada_id)
        .input("fecha", sql.Date, fecha)
        .input("bins", sql.Int, bins || 0)
        .query(`
          MERGE INTO ${tabla} AS tgt
          USING (VALUES (@expId,@tempId,@fecha,@bins))
            AS src(exportadora_id,temporada_id,fecha,bins)
          ON tgt.exportadora_id = src.exportadora_id
            AND tgt.temporada_id = src.temporada_id
            AND tgt.fecha = src.fecha
          WHEN MATCHED THEN
            UPDATE SET bins=src.bins, actualizado_en=GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (exportadora_id,temporada_id,fecha,bins)
            VALUES (src.exportadora_id,src.temporada_id,src.fecha,src.bins);
        `);
      res.json({ ok: true });
    });

  router.get(
    "/parametros-dia",
    createRouteHandler(handleServerError, "parametros_dia_list_failed", async (req, res) => {
      const p = await getPool();
      const r = await p.request().query("SELECT * FROM parametros_dia_especifico ORDER BY fecha DESC");
      res.json(r.recordset);
    }),
  );

  router.post(
    "/parametros-dia",
    createRouteHandler(handleServerError, "parametros_dia_upsert_failed", async (req, res) => {
      const { exportadora_id, especie_id, variedad, fecha, bins_por_hora } = req.body;
      const p = await getPool();
      await p.request()
        .input("eid", sql.Int, Number(exportadora_id) || null)
        .input("esid", sql.Int, Number(especie_id) || null)
        .input("var", sql.NVarChar(100), variedad || null)
        .input("f", sql.Date, fecha)
        .input("bph", sql.Decimal(10, 2), Number(bins_por_hora))
        .query(`
          MERGE parametros_dia_especifico AS t
          USING (VALUES(@eid,@esid,@var,@f,@bph))
            AS s(exportadora_id,especie_id,variedad,fecha,bins_por_hora)
          ON (t.fecha = s.fecha)
          AND (t.exportadora_id IS NULL AND s.exportadora_id IS NULL OR t.exportadora_id = s.exportadora_id)
          AND (t.especie_id IS NULL AND s.especie_id IS NULL OR t.especie_id = s.especie_id)
          AND (t.variedad IS NULL AND s.variedad IS NULL OR t.variedad = s.variedad)
          WHEN MATCHED THEN
            UPDATE SET bins_por_hora = s.bins_por_hora, actualizado_en = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (exportadora_id, especie_id, variedad, fecha, bins_por_hora)
            VALUES (s.exportadora_id, s.especie_id, s.variedad, s.fecha, s.bins_por_hora);
        `);
      res.json({ ok: true });
    }),
  );

  router.delete(
    "/parametros-dia/:id",
    createRouteHandler(handleServerError, "parametros_dia_delete_failed", async (req, res) => {
      const p = await getPool();
      await p.request()
        .input("id", sql.Int, Number(req.params.id))
        .query("DELETE FROM parametros_dia_especifico WHERE id = @id");
      res.json({ ok: true });
    }),
  );

  router.get(
    "/horas-extra-dia",
    createRouteHandler(handleServerError, "horas_extra_dia_list_failed", async (req, res) => {
      const p = await getPool();
      const r = await p.request().query("SELECT * FROM horas_extra_dia ORDER BY fecha DESC");
      res.json(r.recordset);
    }),
  );

  router.get(
    "/temporada",
    createRouteHandler(handleServerError, "temporada_activa_failed", async (req, res) => {
      const p = await getPool();
      const result = await p.request().query(`
        SELECT TOP 1 id, nombre, fecha_inicio, fecha_fin
        FROM temporadas
        WHERE activa=1
        ORDER BY id DESC
      `);
      const row = result.recordset[0] || null;
      res.json(normalizarFilaFechas(row, ["fecha_inicio", "fecha_fin"]));
    }),
  );

  router.get(
    "/datos",
    createRouteHandler(handleServerError, "datos_list_failed", async (req, res) => {
      const p = await getPool();
      const t = await p.request().query(
        "SELECT TOP 1 id FROM temporadas WHERE activa=1 ORDER BY id DESC",
      );
      if (!t.recordset.length) return res.json({ cosechas: [], curado: [], procesos: [] });
      const tempId = t.recordset[0].id;

      const [co, cu, pr] = await Promise.all([
        p.request().input("tid", sql.Int, tempId).query(
          "SELECT exportadora_id, CONVERT(VARCHAR,fecha,23) AS fecha, bins FROM cosechas WHERE temporada_id=@tid",
        ),
        p.request().input("tid", sql.Int, tempId).query(
          "SELECT exportadora_id, CONVERT(VARCHAR,fecha,23) AS fecha, bins FROM curado WHERE temporada_id=@tid",
        ),
        p.request().input("tid", sql.Int, tempId).query(
          "SELECT exportadora_id, CONVERT(VARCHAR,fecha,23) AS fecha, bins FROM procesos WHERE temporada_id=@tid",
        ),
      ]);

      res.json({
        temporada_id: tempId,
        cosechas: co.recordset,
        curado: cu.recordset,
        procesos: pr.recordset,
      });
    }),
  );

  router.post("/datos/cosecha", upsertTable("cosechas"));
  router.post("/datos/curado", upsertTable("curado"));
  router.post("/datos/proceso", upsertTable("procesos"));

  router.get(
    "/feriados",
    createRouteHandler(handleServerError, "feriados_list_failed", async (req, res) => {
      const p = await getPool();
      const r = await p.request().query(
        "SELECT CONVERT(VARCHAR,fecha,23) AS fecha, nombre FROM feriados ORDER BY fecha",
      );
      res.json(r.recordset.map((f) => f.fecha));
    }),
  );

  router.post(
    "/feriados",
    createRouteHandler(handleServerError, "feriados_create_failed", async (req, res) => {
      const { fecha, nombre } = req.body;
      const p = await getPool();
      await p.request()
        .input("fecha", sql.Date, fecha)
        .input("nombre", sql.NVarChar, nombre || "")
        .query(`
          IF NOT EXISTS (SELECT 1 FROM feriados WHERE fecha=@fecha)
            INSERT INTO feriados (fecha, nombre) VALUES (@fecha, @nombre)
        `);
      res.json({ ok: true });
    }),
  );

  router.delete(
    "/feriados/:fecha",
    createRouteHandler(handleServerError, "feriados_delete_failed", async (req, res) => {
      const p = await getPool();
      await p.request()
        .input("fecha", sql.Date, req.params.fecha)
        .query("DELETE FROM feriados WHERE fecha=@fecha");
      res.json({ ok: true });
    }),
  );

  router.get(
    "/configuracion",
    createRouteHandler(handleServerError, "configuracion_list_failed", async (req, res) => {
      const p = await getPool();
      const r = await p.request().query("SELECT clave, valor FROM configuracion");
      const cfg = {};
      r.recordset.forEach((row) => {
        cfg[row.clave] = row.valor;
      });
      res.json({
        bph: parseFloat(cfg.bins_por_hora || 18),
        hpd: parseFloat(cfg.horas_por_dia || 16),
        kpb: parseFloat(cfg.kg_por_bin || 460),
      });
    }),
  );

  router.put(
    "/configuracion",
    createRouteHandler(handleServerError, "configuracion_update_failed", async (req, res) => {
      const { bph, hpd, kpb } = req.body;
      const p = await getPool();
      const updates = [
        ["bins_por_hora", bph],
        ["horas_por_dia", hpd],
        ["kg_por_bin", kpb],
      ];
      for (const [clave, valor] of updates) {
        await p.request()
          .input("clave", sql.NVarChar, clave)
          .input("valor", sql.NVarChar, String(valor))
          .query("UPDATE configuracion SET valor=@valor WHERE clave=@clave");
      }
      res.json({ ok: true });
    }),
  );

  router.get(
    "/temporadas-familia",
    createRouteHandler(handleServerError, "temporadas_familia_list_failed", async (req, res) => {
      const p = await getPool();
      const existe = await p.request().query(`
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='temporadas_familia'
      `);

      if (!existe.recordset[0].total) return res.json([]);

      const result = await p.request().query(`
        SELECT
          tf.id,
          tf.familia_id,
          f.nombre AS familia_nombre,
          CONVERT(VARCHAR, tf.fecha_inicio, 23) AS fecha_inicio,
          CONVERT(VARCHAR, tf.fecha_fin, 23) AS fecha_fin,
          tf.activa
        FROM temporadas_familia tf
        JOIN familias_especies f ON f.id = tf.familia_id
        WHERE tf.activa = 1
        ORDER BY f.orden, f.id
      `);

      res.json(result.recordset);
    }),
  );

  router.post(
    "/temporadas-familia",
    createRouteHandler(handleServerError, "temporadas_familia_upsert_failed", async (req, res) => {
      const { familia_id, fecha_inicio, fecha_fin, activa } = req.body;
      const p = await getPool();
      const existe = await p.request().query(`
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='temporadas_familia'
      `);

      if (!existe.recordset[0].total) {
        return res.status(400).json({ error: "Falta la tabla dbo.temporadas_familia." });
      }

      const result = await p.request()
        .input("familia_id", sql.Int, Number(familia_id))
        .input("fecha_inicio", sql.Date, fecha_inicio)
        .input("fecha_fin", sql.Date, fecha_fin)
        .input("activa", sql.Bit, activa === undefined ? 1 : (activa ? 1 : 0))
        .query(`
          MERGE dbo.temporadas_familia AS tgt
          USING (VALUES (@familia_id, @fecha_inicio, @fecha_fin, @activa))
            AS src(familia_id, fecha_inicio, fecha_fin, activa)
          ON tgt.familia_id = src.familia_id
          WHEN MATCHED THEN
            UPDATE SET
              fecha_inicio = src.fecha_inicio,
              fecha_fin = src.fecha_fin,
              activa = src.activa,
              actualizado_en = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (familia_id, fecha_inicio, fecha_fin, activa)
            VALUES (src.familia_id, src.fecha_inicio, src.fecha_fin, src.activa)
          OUTPUT INSERTED.*;
        `);
      res.json(result.recordset[0]);
    }),
  );

  router.get(
    "/familias",
    createRouteHandler(handleServerError, "familias_list_failed", async (req, res) => {
      const p = await getPool();
      const existe = await p.request().query(`
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='temporadas_familia'
      `);

      const query = existe.recordset[0].total
        ? `
          SELECT
            f.id, f.nombre, f.orden, f.usa_curado, f.activa,
            CONVERT(VARCHAR, tf.fecha_inicio, 23) AS fecha_inicio,
            CONVERT(VARCHAR, tf.fecha_fin, 23) AS fecha_fin
          FROM familias_especies f
          LEFT JOIN temporadas_familia tf ON tf.familia_id = f.id AND tf.activa = 1
          WHERE f.activa=1
          ORDER BY f.orden, f.id
        `
        : `
          SELECT id, nombre, orden, usa_curado, activa,
                 NULL AS fecha_inicio, NULL AS fecha_fin
          FROM familias_especies
          WHERE activa=1
          ORDER BY orden, id
        `;

      const result = await p.request().query(query);
      res.json(result.recordset);
    }),
  );

  router.post(
    "/familias",
    createRouteHandler(handleServerError, "familias_create_failed", async (req, res) => {
      const { nombre, usa_curado, orden } = req.body;
      const p = await getPool();
      const result = await p.request()
        .input("nombre", sql.NVarChar, normalizarTexto(nombre))
        .input("usa_curado", sql.Bit, usa_curado || 0)
        .input("orden", sql.Int, orden || 0)
        .query(`
          INSERT INTO familias_especies (nombre, usa_curado, orden)
          OUTPUT INSERTED.*
          VALUES (@nombre, @usa_curado, @orden)
        `);
      res.json(result.recordset[0]);
    }),
  );

  router.put(
    "/familias/:id",
    createRouteHandler(handleServerError, "familias_update_failed", async (req, res) => {
      const { nombre, usa_curado, orden } = req.body;
      const p = await getPool();
      await p.request()
        .input("id", sql.Int, req.params.id)
        .input("nombre", sql.NVarChar, normalizarTexto(nombre))
        .input("usa_curado", sql.Bit, usa_curado)
        .input("orden", sql.Int, orden)
        .query(`
          UPDATE familias_especies
          SET nombre=@nombre, usa_curado=@usa_curado, orden=@orden
          WHERE id=@id
        `);
      res.json({ ok: true });
    }),
  );

  router.get(
    "/especies",
    createRouteHandler(handleServerError, "especies_list_failed", async (req, res) => {
      const p = await getPool();
      const result = await p.request().query(`
        SELECT
          e.id,
          e.nombre,
          e.familia_id,
          f.nombre AS familia_nombre,
          f.usa_curado AS familia_usa_curado,
          e.activa
        FROM especies e
        JOIN familias_especies f ON e.familia_id = f.id
        WHERE e.activa=1
        ORDER BY f.orden, e.nombre
      `);
      res.json(result.recordset);
    }),
  );

  router.post(
    "/especies",
    createRouteHandler(handleServerError, "especies_create_failed", async (req, res) => {
      const { nombre, familia_id } = req.body;
      const nombreNormalizado = normalizarTexto(nombre);
      const p = await getPool();
      const existing = await p.request()
        .input("nombre", sql.NVarChar, nombreNormalizado)
        .input("familia_id", sql.Int, familia_id)
        .query("SELECT * FROM especies WHERE nombre=@nombre AND familia_id=@familia_id");

      if (existing.recordset.length > 0) {
        const result = await p.request()
          .input("nombre", sql.NVarChar, nombreNormalizado)
          .input("familia_id", sql.Int, familia_id)
          .query(`
            UPDATE especies SET activa=1
            OUTPUT INSERTED.*
            WHERE nombre=@nombre AND familia_id=@familia_id
          `);
        return res.json(result.recordset[0]);
      }

      const result = await p.request()
        .input("nombre", sql.NVarChar, nombreNormalizado)
        .input("familia_id", sql.Int, familia_id)
        .query(`
          INSERT INTO especies (nombre, familia_id)
          OUTPUT INSERTED.*
          VALUES (@nombre, @familia_id)
        `);
      res.json(result.recordset[0]);
    }),
  );

  router.delete(
    "/especies/:id",
    createRouteHandler(handleServerError, "especies_delete_failed", async (req, res) => {
      const p = await getPool();
      await p.request()
        .input("id", sql.Int, req.params.id)
        .query("UPDATE especies SET activa=0 WHERE id=@id");
      res.json({ ok: true });
    }),
  );

  router.get(
    "/parametros-especie",
    createRouteHandler(handleServerError, "parametros_especie_list_failed", async (req, res) => {
      const p = await getPool();
      const result = await p.request().query(`
        SELECT
          pe.id,
          pe.especie_id,
          e.nombre AS especie_nombre,
          pe.bins_por_hora,
          pe.horas_por_dia,
          pe.kg_por_bin,
          pe.activa
        FROM parametros_especie pe
        LEFT JOIN especies e ON pe.especie_id = e.id
        WHERE pe.activa=1
        ORDER BY
          CASE WHEN pe.especie_id IS NULL THEN 0 ELSE 1 END,
          e.nombre
      `);
      res.json(result.recordset);
    }),
  );

  router.post(
    "/parametros-especie",
    createRouteHandler(handleServerError, "parametros_especie_upsert_failed", async (req, res) => {
      const { especie_id, bins_por_hora, horas_por_dia, kg_por_bin } = req.body;
      const p = await getPool();
      await p.request()
        .input("especie_id", sql.Int, especie_id || null)
        .input("bph", sql.Decimal(10, 2), bins_por_hora)
        .input("hpd", sql.Decimal(10, 2), horas_por_dia)
        .input("kpb", sql.Decimal(10, 2), kg_por_bin)
        .query(`
          MERGE INTO parametros_especie AS tgt
          USING (VALUES (@especie_id, @bph, @hpd, @kpb))
            AS src(especie_id, bins_por_hora, horas_por_dia, kg_por_bin)
          ON (tgt.especie_id = src.especie_id
              OR (tgt.especie_id IS NULL AND src.especie_id IS NULL))
          WHEN MATCHED THEN
            UPDATE SET
              bins_por_hora = src.bins_por_hora,
              horas_por_dia = src.horas_por_dia,
              kg_por_bin = src.kg_por_bin,
              actualizado_en = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (especie_id, bins_por_hora, horas_por_dia, kg_por_bin)
            VALUES (src.especie_id, src.bins_por_hora, src.horas_por_dia, src.kg_por_bin);
        `);
      res.json({ ok: true });
    }),
  );

  router.get(
    "/curado-horas-config",
    createRouteHandler(handleServerError, "curado_horas_config_list_failed", async (req, res) => {
      const p = await getPool();
      const r = await p.request().query("SELECT * FROM curado_horas_config");
      res.json(r.recordset);
    }),
  );

  router.put(
    "/curado-horas-config/:exportadora_id",
    createRouteHandler(handleServerError, "curado_horas_config_upsert_failed", async (req, res) => {
      const { horas_curado } = req.body;
      const p = await getPool();
      await p.request()
        .input("eid", sql.Int, Number(req.params.exportadora_id))
        .input("hc", sql.Int, Number(horas_curado) || 48)
        .query(`
          MERGE curado_horas_config AS t
          USING (VALUES(@eid, @hc)) AS s(exportadora_id, horas_curado)
          ON t.exportadora_id = s.exportadora_id
          WHEN MATCHED THEN
            UPDATE SET horas_curado = s.horas_curado, actualizado_en = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (exportadora_id, horas_curado) VALUES (s.exportadora_id, s.horas_curado);
        `);
      res.json({ ok: true });
    }),
  );

  app.use("/api", router);
};

module.exports = {
  registerConfigurationRoutes,
};
