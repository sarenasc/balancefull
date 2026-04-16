const express = require("express");
const { createRouteHandler } = require("./utils.cjs");

const validarHora = (hora, campo) => {
  if (hora === null || hora === undefined) return null;
  if (typeof hora !== "string") throw new Error(`${campo}: debe ser una cadena`);
  if (!/^\d{2}:\d{2}:\d{2}$/.test(hora)) {
    throw new Error(`${campo}: formato invalido (esperado HH:MM:SS, recibido: ${hora})`);
  }
  return hora;
};

const registerTurnosRoutes = (app, deps) => {
  const { sql, getPool, handleServerError } = deps;
  const router = express.Router();

  router.get(
    "/turnos",
    createRouteHandler(handleServerError, "turnos_list_failed", async (req, res) => {
      const { semana, anio } = req.query;
      const p = await getPool();
      const r = await p.request()
        .input("semana", sql.Int, semana)
        .input("anio", sql.Int, anio)
        .query(`
          SELECT
            t.id,
            CONVERT(VARCHAR,t.fecha,23) AS fecha,
            t.hora_inicio,
            e.nombre AS exportadora,
            e.id AS exportadora_id,
            e.color_idx
          FROM turnos t
          JOIN exportadoras e ON e.id = t.exportadora_id
          WHERE t.semana=@semana AND t.anio=@anio
          ORDER BY t.fecha, t.hora_inicio
        `);
      res.json(r.recordset);
    }),
  );

  router.post(
    "/turnos",
    createRouteHandler(handleServerError, "turnos_upsert_failed", async (req, res) => {
      const { fecha, hora_inicio, exportadora_id, semana, anio } = req.body;
      const p = await getPool();
      await p.request()
        .input("fecha", sql.Date, fecha)
        .input("hora_inicio", sql.NVarChar, hora_inicio)
        .input("exportadora_id", sql.Int, exportadora_id)
        .input("semana", sql.Int, semana)
        .input("anio", sql.Int, anio)
        .query(`
          MERGE INTO turnos AS tgt
          USING (VALUES (@fecha,@hora_inicio,@exportadora_id,@semana,@anio))
            AS src(fecha,hora_inicio,exportadora_id,semana,anio)
          ON tgt.fecha=src.fecha AND tgt.hora_inicio=src.hora_inicio
          WHEN MATCHED THEN
            UPDATE SET exportadora_id=src.exportadora_id, semana=src.semana, anio=src.anio
          WHEN NOT MATCHED THEN
            INSERT (fecha,hora_inicio,exportadora_id,semana,anio)
            VALUES (src.fecha,src.hora_inicio,src.exportadora_id,src.semana,src.anio);
        `);
      res.json({ ok: true });
    }),
  );

  router.delete(
    "/turnos/:id",
    createRouteHandler(handleServerError, "turnos_delete_failed", async (req, res) => {
      const p = await getPool();
      await p.request()
        .input("id", sql.Int, req.params.id)
        .query("DELETE FROM turnos WHERE id=@id");
      res.json({ ok: true });
    }),
  );

  router.get(
    "/turnos-config",
    createRouteHandler(handleServerError, "turnos_config_list_failed", async (req, res) => {
      const p = await getPool();
      const r = await p.request().query("SELECT * FROM turnos_config WHERE activo=1 ORDER BY turno");
      res.json(r.recordset);
    }),
  );

  router.put(
    "/turnos-config/:id",
    createRouteHandler(handleServerError, "turnos_config_update_failed", async (req, res) => {
      const { hora_inicio, hora_fin, colacion_ini, colacion_fin, restriccion_ini, restriccion_fin } = req.body;
      const p = await getPool();
      await p.request()
        .input("id", sql.Int, req.params.id)
        .input("hi", sql.NVarChar, hora_inicio)
        .input("hf", sql.NVarChar, hora_fin)
        .input("ci", sql.NVarChar, colacion_ini || null)
        .input("cf", sql.NVarChar, colacion_fin || null)
        .input("ri", sql.NVarChar, restriccion_ini || null)
        .input("rf", sql.NVarChar, restriccion_fin || null)
        .query(`
          UPDATE turnos_config SET
            hora_inicio=@hi, hora_fin=@hf,
            colacion_ini=@ci, colacion_fin=@cf,
            restriccion_ini=@ri, restriccion_fin=@rf
          WHERE id=@id
        `);
      res.json({ ok: true });
    }),
  );

  router.get(
    "/tipos-restriccion",
    createRouteHandler(handleServerError, "tipos_restriccion_list_failed", async (req, res) => {
      const p = await getPool();
      const result = await p.request().query(`
        SELECT id, nombre, color, activa
        FROM tipos_restriccion
        WHERE activa=1
        ORDER BY nombre
      `);
      res.json(result.recordset);
    }),
  );

  router.post(
    "/tipos-restriccion",
    createRouteHandler(handleServerError, "tipos_restriccion_upsert_failed", async (req, res) => {
      const { nombre, color } = req.body;
      const p = await getPool();
      const existing = await p.request()
        .input("nombre", sql.NVarChar, nombre)
        .query("SELECT * FROM tipos_restriccion WHERE nombre=@nombre");

      if (existing.recordset.length > 0) {
        const result = await p.request()
          .input("nombre", sql.NVarChar, nombre)
          .input("color", sql.NVarChar, color || "#ef4444")
          .query(`
            UPDATE tipos_restriccion
            SET activa=1, color=@color
            OUTPUT INSERTED.*
            WHERE nombre=@nombre
          `);
        return res.json(result.recordset[0]);
      }

      const result = await p.request()
        .input("nombre", sql.NVarChar, nombre)
        .input("color", sql.NVarChar, color || "#ef4444")
        .query(`
          INSERT INTO tipos_restriccion (nombre, color)
          OUTPUT INSERTED.*
          VALUES (@nombre, @color)
        `);
      res.json(result.recordset[0]);
    }),
  );

  router.delete(
    "/tipos-restriccion/:id",
    createRouteHandler(handleServerError, "tipos_restriccion_delete_failed", async (req, res) => {
      const p = await getPool();
      await p.request()
        .input("id", sql.Int, req.params.id)
        .query("UPDATE tipos_restriccion SET activa=0 WHERE id=@id");
      res.json({ ok: true });
    }),
  );

  router.get(
    "/turnos-definicion",
    createRouteHandler(handleServerError, "turnos_definicion_list_failed", async (req, res) => {
      const p = await getPool();
      const result = await p.request().query(`
        SELECT
          id, nombre,
          hora_inicio, hora_fin,
          colacion_inicio, colacion_fin,
          orden, activa,
          horas_extra, horas_extra_inicio
        FROM turnos_definicion
        WHERE activa=1
        ORDER BY orden, id
      `);
      res.json(result.recordset);
    }),
  );

  router.post(
    "/turnos-definicion",
    createRouteHandler(handleServerError, "turnos_definicion_post_failed", async (req, res) => {
      const { nombre, hora_inicio, hora_fin, colacion_inicio, colacion_fin, orden, horas_extra, horas_extra_inicio } = req.body;
      const hi = validarHora(hora_inicio, "hora_inicio");
      const hf = validarHora(hora_fin, "hora_fin");
      const ci = validarHora(colacion_inicio, "colacion_inicio");
      const cf = validarHora(colacion_fin, "colacion_fin");
      const he = horas_extra != null ? Number(horas_extra) : null;
      const hei = horas_extra_inicio != null ? Number(horas_extra_inicio) : null;

      if (!hi || !hf) throw new Error("hora_inicio y hora_fin son obligatorias");

      const p = await getPool();
      const existing = await p.request()
        .input("nombre", sql.NVarChar, nombre)
        .query("SELECT * FROM turnos_definicion WHERE nombre=@nombre");

      if (existing.recordset.length > 0) {
        const result = await p.request()
          .input("nombre", sql.NVarChar, nombre)
          .input("hi", sql.VarChar(8), hi)
          .input("hf", sql.VarChar(8), hf)
          .input("ci", sql.VarChar(8), ci)
          .input("cf", sql.VarChar(8), cf)
          .input("orden", sql.Int, orden || 0)
          .input("he", sql.Decimal(4, 1), he)
          .input("hei", sql.Decimal(4, 1), hei)
          .query(`
            UPDATE turnos_definicion
            SET activa=1,
                hora_inicio = CAST(@hi AS TIME),
                hora_fin = CAST(@hf AS TIME),
                colacion_inicio = CASE WHEN @ci IS NULL THEN NULL ELSE CAST(@ci AS TIME) END,
                colacion_fin = CASE WHEN @cf IS NULL THEN NULL ELSE CAST(@cf AS TIME) END,
                orden = @orden,
                horas_extra = @he,
                horas_extra_inicio = @hei
            OUTPUT INSERTED.*
            WHERE nombre=@nombre
          `);
        return res.json(result.recordset[0]);
      }

      const result = await p.request()
        .input("nombre", sql.NVarChar, nombre)
        .input("hi", sql.VarChar(8), hi)
        .input("hf", sql.VarChar(8), hf)
        .input("ci", sql.VarChar(8), ci)
        .input("cf", sql.VarChar(8), cf)
        .input("orden", sql.Int, orden || 0)
        .input("he", sql.Decimal(4, 1), he)
        .input("hei", sql.Decimal(4, 1), hei)
        .query(`
          INSERT INTO turnos_definicion
            (nombre, hora_inicio, hora_fin, colacion_inicio, colacion_fin, orden, horas_extra, horas_extra_inicio)
          OUTPUT INSERTED.*
          VALUES (
            @nombre,
            CAST(@hi AS TIME),
            CAST(@hf AS TIME),
            CASE WHEN @ci IS NULL THEN NULL ELSE CAST(@ci AS TIME) END,
            CASE WHEN @cf IS NULL THEN NULL ELSE CAST(@cf AS TIME) END,
            @orden,
            @he,
            @hei
          )
        `);
      res.json(result.recordset[0]);
    }),
  );

  router.put(
    "/turnos-definicion/:id",
    createRouteHandler(handleServerError, "turnos_definicion_put_failed", async (req, res) => {
      const { nombre, hora_inicio, hora_fin, colacion_inicio, colacion_fin, orden, horas_extra, horas_extra_inicio } = req.body;
      const hi = validarHora(hora_inicio, "hora_inicio");
      const hf = validarHora(hora_fin, "hora_fin");
      const ci = validarHora(colacion_inicio, "colacion_inicio");
      const cf = validarHora(colacion_fin, "colacion_fin");
      const he = horas_extra != null ? Number(horas_extra) : null;
      const hei = horas_extra_inicio != null ? Number(horas_extra_inicio) : null;

      if (!hi || !hf) throw new Error("hora_inicio y hora_fin son obligatorias");

      const p = await getPool();
      await p.request()
        .input("id", sql.Int, req.params.id)
        .input("nombre", sql.NVarChar, nombre)
        .input("hi", sql.VarChar(8), hi)
        .input("hf", sql.VarChar(8), hf)
        .input("ci", sql.VarChar(8), ci)
        .input("cf", sql.VarChar(8), cf)
        .input("orden", sql.Int, orden)
        .input("he", sql.Decimal(4, 1), he)
        .input("hei", sql.Decimal(4, 1), hei)
        .query(`
          UPDATE turnos_definicion SET
            nombre = @nombre,
            hora_inicio = CAST(@hi AS TIME),
            hora_fin = CAST(@hf AS TIME),
            colacion_inicio = CASE WHEN @ci IS NULL THEN NULL ELSE CAST(@ci AS TIME) END,
            colacion_fin = CASE WHEN @cf IS NULL THEN NULL ELSE CAST(@cf AS TIME) END,
            orden = @orden,
            horas_extra = @he,
            horas_extra_inicio = @hei
          WHERE id=@id
        `);
      res.json({ ok: true });
    }),
  );

  router.delete(
    "/turnos-definicion/:id",
    createRouteHandler(handleServerError, "turnos_definicion_delete_failed", async (req, res) => {
      const p = await getPool();
      await p.request()
        .input("id", sql.Int, req.params.id)
        .query("UPDATE turnos_definicion SET activa=0 WHERE id=@id");
      res.json({ ok: true });
    }),
  );

  router.get(
    "/turnos-restricciones",
    createRouteHandler(handleServerError, "turnos_restricciones_list_failed", async (req, res) => {
      const { semana, anio } = req.query;
      const p = await getPool();
      const r = await p.request()
        .input("semana", sql.Int, semana)
        .input("anio", sql.Int, anio)
        .query(`
          SELECT
            tr.id,
            CONVERT(VARCHAR,tr.fecha,23) AS fecha,
            tr.hora_inicio,
            tr.tipo_restriccion_id,
            tr.semana,
            tr.anio,
            t.nombre,
            t.color
          FROM turnos_restricciones tr
          JOIN tipos_restriccion t ON t.id = tr.tipo_restriccion_id
          WHERE tr.semana=@semana AND tr.anio=@anio
          ORDER BY tr.fecha, tr.hora_inicio
        `);
      res.json(r.recordset);
    }),
  );

  router.post(
    "/turnos-restricciones",
    createRouteHandler(handleServerError, "turnos_restricciones_upsert_failed", async (req, res) => {
      const { fecha, hora_inicio, tipo_restriccion_id, semana, anio } = req.body;
      const p = await getPool();
      await p.request()
        .input("fecha", sql.Date, fecha)
        .input("hora_inicio", sql.NVarChar, hora_inicio)
        .input("tipo_restriccion_id", sql.Int, tipo_restriccion_id)
        .input("semana", sql.Int, semana)
        .input("anio", sql.Int, anio)
        .query(`
          MERGE INTO turnos_restricciones AS tgt
          USING (VALUES (@fecha,@hora_inicio,@tipo_restriccion_id,@semana,@anio))
            AS src(fecha,hora_inicio,tipo_restriccion_id,semana,anio)
          ON tgt.fecha=src.fecha AND tgt.hora_inicio=src.hora_inicio
          WHEN MATCHED THEN
            UPDATE SET
              tipo_restriccion_id=src.tipo_restriccion_id,
              semana=src.semana,
              anio=src.anio,
              actualizado_en=GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (fecha,hora_inicio,tipo_restriccion_id,semana,anio)
            VALUES (src.fecha,src.hora_inicio,src.tipo_restriccion_id,src.semana,src.anio);
        `);
      res.json({ ok: true });
    }),
  );

  router.delete(
    "/turnos-restricciones/:id",
    createRouteHandler(handleServerError, "turnos_restricciones_delete_failed", async (req, res) => {
      const p = await getPool();
      await p.request()
        .input("id", sql.Int, req.params.id)
        .query("DELETE FROM turnos_restricciones WHERE id=@id");
      res.json({ ok: true });
    }),
  );

  app.use("/api", router);
};

module.exports = {
  registerTurnosRoutes,
};
