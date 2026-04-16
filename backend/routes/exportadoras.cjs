const registerExportadorasRoutes = (app, deps) => {
  const { sql, getPool, normalizarTexto, obtenerEspecieDesdePayload, handleServerError } = deps;

  app.get("/api/exportadoras", async (req, res) => {
    try {
      const p = await getPool();
      const result = await p.request().query(`
        SELECT
          e.id,
          e.nombre,
          e.especie,
          e.variedad,
          e.planta,
          e.color_idx,
          e.especie_id,
          e.visible_linea,
          e.activa,
          esp.familia_id,
          e.horas_curado
        FROM exportadoras e
        LEFT JOIN especies esp ON esp.id = e.especie_id
        WHERE e.activa=1
        ORDER BY e.id
      `);
      res.json(result.recordset);
    } catch (e) {
      handleServerError(res, e, "exportadoras_list_failed", req);
    }
  });

  app.post("/api/exportadoras", async (req, res) => {
    const { nombre, especie_id, especie, variedad, color_idx, visible_linea } = req.body;
    try {
      const p = await getPool();
      const especieInfo = await obtenerEspecieDesdePayload(p, especie_id, especie);
      const nombreNorm = normalizarTexto(nombre);
      const variedadNorm = normalizarTexto(variedad);

      if (!nombreNorm) {
        return res.status(400).json({ error: "El nombre de la exportadora es obligatorio" });
      }

      const existente = await p
        .request()
        .input("nombre", sql.NVarChar, nombreNorm)
        .input("especie_id", sql.Int, especieInfo.especie_id)
        .input("especie", sql.NVarChar, especieInfo.especie || "")
        .input("variedad", sql.NVarChar, variedadNorm)
        .query(`
          SELECT TOP 1 *
          FROM exportadoras
          WHERE UPPER(nombre)=@nombre
            AND ISNULL(especie_id, -1)=ISNULL(@especie_id, -1)
            AND UPPER(ISNULL(especie,''))=UPPER(ISNULL(@especie,''))
            AND UPPER(ISNULL(variedad,''))=UPPER(ISNULL(@variedad,''))
          ORDER BY id
        `);

      if (existente.recordset.length > 0) {
        const id = existente.recordset[0].id;
        const result = await p
          .request()
          .input("id", sql.Int, id)
          .input("color_idx", sql.Int, Number(color_idx || 0))
          .input("visible_linea", sql.Bit, visible_linea === undefined ? 1 : (visible_linea ? 1 : 0))
          .input("especie_id", sql.Int, especieInfo.especie_id)
          .input("especie", sql.NVarChar, especieInfo.especie || "")
          .query(`
            UPDATE exportadoras
            SET activa=1,
                especie_id=@especie_id,
                especie=@especie,
                color_idx=@color_idx,
                visible_linea=@visible_linea
            OUTPUT INSERTED.*
            WHERE id=@id
          `);
        return res.json(result.recordset[0]);
      }

      const result = await p
        .request()
        .input("nombre", sql.NVarChar, nombreNorm)
        .input("especie", sql.NVarChar, especieInfo.especie || "")
        .input("variedad", sql.NVarChar, variedadNorm)
        .input("color_idx", sql.Int, Number(color_idx || 0))
        .input("especie_id", sql.Int, especieInfo.especie_id)
        .input("visible_linea", sql.Bit, visible_linea === undefined ? 1 : (visible_linea ? 1 : 0))
        .query(`
          INSERT INTO exportadoras (nombre, especie, variedad, color_idx, especie_id, visible_linea)
          OUTPUT INSERTED.*
          VALUES (@nombre, @especie, @variedad, @color_idx, @especie_id, @visible_linea)
        `);
      res.json(result.recordset[0]);
    } catch (e) {
      handleServerError(res, e, "exportadoras_create_failed", req);
    }
  });

  app.put("/api/exportadoras/:id", async (req, res) => {
    const { nombre, especie_id, especie, variedad, color_idx, visible_linea, activa } = req.body;
    try {
      const p = await getPool();

      if (nombre === undefined && especie === undefined && variedad === undefined) {
        const result = await p
          .request()
          .input("id", sql.Int, req.params.id)
          .input("visible_linea", sql.Bit, visible_linea === undefined ? 1 : (visible_linea ? 1 : 0))
          .query(`
            UPDATE exportadoras
            SET visible_linea=@visible_linea
            OUTPUT INSERTED.*
            WHERE id=@id
          `);
        return res.json(result.recordset[0] || { ok: true });
      }

      const especieInfo = await obtenerEspecieDesdePayload(p, especie_id, especie);
      const nombreNorm = normalizarTexto(nombre);
      if (!nombreNorm) {
        return res.status(400).json({ error: "El nombre de la exportadora es obligatorio" });
      }

      const result = await p
        .request()
        .input("id", sql.Int, req.params.id)
        .input("nombre", sql.NVarChar, nombreNorm)
        .input("especie", sql.NVarChar, especieInfo.especie || "")
        .input("variedad", sql.NVarChar, normalizarTexto(variedad))
        .input("color_idx", sql.Int, Number(color_idx || 0))
        .input("especie_id", sql.Int, especieInfo.especie_id)
        .input("visible_linea", sql.Bit, visible_linea === undefined ? 1 : (visible_linea ? 1 : 0))
        .input("activa", sql.Bit, activa === undefined ? 1 : (activa ? 1 : 0))
        .query(`
          UPDATE exportadoras
          SET nombre=@nombre,
              especie=@especie,
              variedad=@variedad,
              color_idx=@color_idx,
              especie_id=@especie_id,
              visible_linea=@visible_linea,
              activa=@activa
          OUTPUT INSERTED.*
          WHERE id=@id
        `);
      res.json(result.recordset[0] || { ok: true });
    } catch (e) {
      handleServerError(res, e, "exportadoras_update_failed", req);
    }
  });

  app.put("/api/exportadoras/:id/horas-curado", async (req, res) => {
    const { horas_curado } = req.body;
    try {
      const p = await getPool();
      await p.request()
        .input("id", sql.Int, Number(req.params.id))
        .input("hc", sql.Int, Number(horas_curado) || 48)
        .query("UPDATE exportadoras SET horas_curado=@hc WHERE id=@id");
      res.json({ ok: true });
    } catch (e) {
      handleServerError(res, e, "exportadoras_horas_curado_update_failed", req);
    }
  });
};

module.exports = {
  registerExportadorasRoutes,
};
