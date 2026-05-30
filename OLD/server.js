const express = require("express");
const sql = require("mssql");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ─── SQL Server config ───────────────────────────────────────────────────────
const dbConfig = {
  server: process.env.DB_SERVER || "172.20.20.5",
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "Robin@2021",
  database: process.env.DB_NAME || "almahue_balance",
  port: Number(process.env.DB_PORT || 1433),
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool;
const getPool = async () => {
  if (!pool) pool = await sql.connect(dbConfig);
  return pool;
};

const normalizarTexto = (v = "") => String(v || "").trim().toUpperCase();

// ─── FIX #1: función normalizarFilaFechas que faltaba ───────────────────────
const normalizarFilaFechas = (row, campos) => {
  if (!row) return null;
  const out = { ...row };
  for (const c of campos) {
    if (out[c] instanceof Date) {
      out[c] = out[c].toISOString().split("T")[0];
    } else if (typeof out[c] === "string" && out[c].includes("T")) {
      out[c] = out[c].split("T")[0];
    }
  }
  return out;
};

// ─── FIX #2: obtenerEspecieDesdePayload con llaves correctas ─────────────────
async function obtenerEspecieDesdePayload(p, especie_id, especieNombre) {
  const especieIdNum =
    especie_id === undefined || especie_id === null || especie_id === ""
      ? null
      : Number(especie_id);

  if (especieIdNum) {
    const q = await p
      .request()
      .input("id", sql.Int, especieIdNum)
      .query(`
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

  const q = await p
    .request()
    .input("nombre", sql.NVarChar, especie)
    .query(`
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

// ═══════════════════════════════════════════════════════════════════════════
// ENDPOINTS ORIGINALES
// ═══════════════════════════════════════════════════════════════════════════

// ─── EXPORTADORAS ────────────────────────────────────────────────────────────
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
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/exportadoras/:id", async (req, res) => {
  const { nombre, especie_id, especie, variedad, color_idx, visible_linea, activa } = req.body;
  try {
    const p = await getPool();

    // Si solo viene visible_linea (toggle de visibilidad), actualizar solo ese campo
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TEMPORADA ACTIVA ───────────────────────────────────────────────────────

// ─── HORAS CURADO POR EXPORTADORA (KIWI) ─────────────────────────────────────
app.put("/api/exportadoras/:id/horas-curado", async (req, res) => {
  const { horas_curado } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input("id", sql.Int, Number(req.params.id))
      .input("hc", sql.Int, Number(horas_curado) || 48)
      .query("UPDATE exportadoras SET horas_curado=@hc WHERE id=@id");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ─── PARÁMETROS POR DÍA ESPECÍFICO ───────────────────────────────────────────
app.get("/api/parametros-dia", async (req, res) => {
  try {
    const p = await getPool();
    const r = await p.request().query("SELECT * FROM parametros_dia_especifico ORDER BY fecha DESC");
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/parametros-dia", async (req, res) => {
  const { exportadora_id, especie_id, variedad, fecha, bins_por_hora } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input("eid",  sql.Int,          Number(exportadora_id) || null)
      .input("esid", sql.Int,          Number(especie_id)     || null)
      .input("var",  sql.NVarChar(100), variedad              || null)
      .input("f",    sql.Date,          fecha)
      .input("bph",  sql.Decimal(10,2), Number(bins_por_hora))
      .query(`
        MERGE parametros_dia_especifico AS t
        USING (VALUES(@eid,@esid,@var,@f,@bph))
          AS s(exportadora_id,especie_id,variedad,fecha,bins_por_hora)
        ON  (t.fecha = s.fecha)
        AND (t.exportadora_id IS NULL AND s.exportadora_id IS NULL OR t.exportadora_id = s.exportadora_id)
        AND (t.especie_id     IS NULL AND s.especie_id     IS NULL OR t.especie_id     = s.especie_id)
        AND (t.variedad       IS NULL AND s.variedad       IS NULL OR t.variedad       = s.variedad)
        WHEN MATCHED THEN
          UPDATE SET bins_por_hora = s.bins_por_hora, actualizado_en = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (exportadora_id, especie_id, variedad, fecha, bins_por_hora)
          VALUES (s.exportadora_id, s.especie_id, s.variedad, s.fecha, s.bins_por_hora);
      `);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/parametros-dia/:id", async (req, res) => {
  try {
    const p = await getPool();
    await p.request()
      .input("id", sql.Int, Number(req.params.id))
      .query("DELETE FROM parametros_dia_especifico WHERE id = @id");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/temporada", async (req, res) => {
  try {
    const p = await getPool();
    const result = await p.request().query(`
      SELECT TOP 1 id, nombre, fecha_inicio, fecha_fin
      FROM temporadas
      WHERE activa=1
      ORDER BY id DESC
    `);
    const row = result.recordset[0] || null;
    res.json(normalizarFilaFechas(row, ["fecha_inicio", "fecha_fin"]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DATOS (cosechas + curado + procesos) ────────────────────────────────────
app.get("/api/datos", async (req, res) => {
  try {
    const p = await getPool();
    const t = await p.request().query(
      "SELECT TOP 1 id FROM temporadas WHERE activa=1 ORDER BY id DESC"
    );
    if (!t.recordset.length) return res.json({ cosechas: [], curado: [], procesos: [] });
    const tempId = t.recordset[0].id;

    const [co, cu, pr] = await Promise.all([
      p.request().input("tid", sql.Int, tempId)
        .query("SELECT exportadora_id, CONVERT(VARCHAR,fecha,23) AS fecha, bins FROM cosechas WHERE temporada_id=@tid"),
      p.request().input("tid", sql.Int, tempId)
        .query("SELECT exportadora_id, CONVERT(VARCHAR,fecha,23) AS fecha, bins FROM curado WHERE temporada_id=@tid"),
      p.request().input("tid", sql.Int, tempId)
        .query("SELECT exportadora_id, CONVERT(VARCHAR,fecha,23) AS fecha, bins FROM procesos WHERE temporada_id=@tid"),
    ]);
    res.json({
      temporada_id: tempId,
      cosechas: co.recordset,
      curado: cu.recordset,
      procesos: pr.recordset,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── UPSERT helper ───────────────────────────────────────────────────────────
const upsertTable = (tabla) => async (req, res) => {
  const { exportadora_id, temporada_id, fecha, bins } = req.body;
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
};

app.post("/api/datos/cosecha", upsertTable("cosechas"));
app.post("/api/datos/curado",  upsertTable("curado"));
app.post("/api/datos/proceso", upsertTable("procesos"));

// ─── FERIADOS ────────────────────────────────────────────────────────────────
app.get("/api/feriados", async (req, res) => {
  try {
    const p = await getPool();
    const r = await p.request().query(
      "SELECT CONVERT(VARCHAR,fecha,23) AS fecha, nombre FROM feriados ORDER BY fecha"
    );
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/feriados", async (req, res) => {
  const { fecha, nombre } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input("fecha", sql.Date, fecha)
      .input("nombre", sql.NVarChar, nombre || "")
      .query(`
        IF NOT EXISTS (SELECT 1 FROM feriados WHERE fecha=@fecha)
          INSERT INTO feriados (fecha, nombre) VALUES (@fecha, @nombre)
      `);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/feriados/:fecha", async (req, res) => {
  const { nombre } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input("fecha",  sql.Date,     req.params.fecha)
      .input("nombre", sql.NVarChar, nombre || "")
      .query("UPDATE feriados SET nombre=@nombre WHERE fecha=@fecha");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/feriados/:fecha", async (req, res) => {
  try {
    const p = await getPool();
    await p.request()
      .input("fecha", sql.Date, req.params.fecha)
      .query("DELETE FROM feriados WHERE fecha=@fecha");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── CONFIGURACIÓN ───────────────────────────────────────────────────────────
app.get("/api/configuracion", async (req, res) => {
  try {
    const p = await getPool();
    const r = await p.request().query("SELECT clave, valor FROM configuracion");
    const cfg = {};
    r.recordset.forEach(row => { cfg[row.clave] = row.valor; });
    res.json({
      bph: parseFloat(cfg.bins_por_hora || 18),
      hpd: parseFloat(cfg.horas_por_dia || 16),
      kpb: parseFloat(cfg.kg_por_bin || 460),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/configuracion", async (req, res) => {
  const { bph, hpd, kpb } = req.body;
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BALANCE ÚLTIMOS 5 DÍAS ─────────────────────────────────────────────────
app.get("/api/balance/dias", async (req, res) => {
  try {
    const p = await getPool();
    const t = await p.request().query(
      "SELECT TOP 1 id FROM temporadas WHERE activa=1 ORDER BY id DESC"
    );
    if (!t.recordset.length) return res.json([]);
    const tempId = t.recordset[0].id;

    const r = await p.request().input("tid", sql.Int, tempId).query(`
      SELECT
        CONVERT(VARCHAR,f.fecha,23) AS fecha,
        ISNULL(SUM(c.bins),0)  AS cosecha,
        ISNULL(SUM(cu.bins),0) AS curado,
        ISNULL(SUM(pr.bins),0) AS proceso
      FROM (
        SELECT DISTINCT CAST(fecha AS DATE) AS fecha FROM (
          SELECT fecha FROM cosechas WHERE temporada_id=@tid
          UNION SELECT fecha FROM curado   WHERE temporada_id=@tid
          UNION SELECT fecha FROM procesos WHERE temporada_id=@tid
        ) x
        WHERE fecha >= DATEADD(DAY,-5,CAST(GETDATE() AS DATE))
      ) f
      LEFT JOIN cosechas c  ON CAST(c.fecha  AS DATE)=f.fecha AND c.temporada_id=@tid
      LEFT JOIN curado   cu ON CAST(cu.fecha AS DATE)=f.fecha AND cu.temporada_id=@tid
      LEFT JOIN procesos pr ON CAST(pr.fecha AS DATE)=f.fecha AND pr.temporada_id=@tid
      GROUP BY f.fecha
      ORDER BY f.fecha DESC
    `);
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TOTALES ACUMULADOS A LA FECHA ───────────────────────────────────────────
app.get("/api/totales", async (req, res) => {
  try {
    const p = await getPool();
    const t = await p.request().query(
      "SELECT TOP 1 id FROM temporadas WHERE activa=1 ORDER BY id DESC"
    );
    if (!t.recordset.length) return res.json({});
    const tempId = t.recordset[0].id;

    const [bins, kilos, porExp] = await Promise.all([
      p.request().input("tid", sql.Int, tempId).input("hoy", sql.Date, new Date()).query(
        "SELECT ISNULL(SUM(bins),0) AS total FROM procesos WHERE temporada_id=@tid AND fecha <= @hoy"
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
          ISNULL(SUM(c.bins),0)  AS bins_cosecha,
          ISNULL(SUM(pr.bins),0) AS bins_proceso
        FROM exportadoras e
        LEFT JOIN cosechas c  ON c.exportadora_id=e.id  AND c.temporada_id=@tid  AND c.fecha  <= @hoy
        LEFT JOIN procesos pr ON pr.exportadora_id=e.id AND pr.temporada_id=@tid AND pr.fecha <= @hoy
        WHERE e.activa=1
        GROUP BY e.nombre, e.id
        ORDER BY e.id
      `),
    ]);

    res.json({
      bins_procesados:  bins.recordset[0].total,
      kilos_procesados: kilos.recordset[0].total,
      por_exportadora:  porExp.recordset,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TURNOS ───────────────────────────────────────────────────────────────────
app.get("/api/turnos", async (req, res) => {
  const { semana, anio } = req.query;
  try {
    const p = await getPool();
    const r = await p.request()
      .input("semana", sql.Int, semana)
      .input("anio",   sql.Int, anio)
      .query(`
        SELECT
          t.id,
          CONVERT(VARCHAR,t.fecha,23) AS fecha,
          t.hora_inicio,
          e.nombre AS exportadora,
          e.id     AS exportadora_id,
          e.color_idx
        FROM turnos t
        JOIN exportadoras e ON e.id = t.exportadora_id
        WHERE t.semana=@semana AND t.anio=@anio
        ORDER BY t.fecha, t.hora_inicio
      `);
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/turnos-restricciones", async (req, res) => {
  const { semana, anio } = req.query;
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/turnos-restricciones", async (req, res) => {
  const { fecha, hora_inicio, tipo_restriccion_id, semana, anio } = req.body;
  try {
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
          UPDATE SET tipo_restriccion_id=src.tipo_restriccion_id, semana=src.semana, anio=src.anio, actualizado_en=GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (fecha,hora_inicio,tipo_restriccion_id,semana,anio)
          VALUES (src.fecha,src.hora_inicio,src.tipo_restriccion_id,src.semana,src.anio);
      `);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/turnos-restricciones/:id", async (req, res) => {
  try {
    const p = await getPool();
    await p.request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM turnos_restricciones WHERE id=@id");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/turnos", async (req, res) => {
  const { fecha, hora_inicio, exportadora_id, semana, anio, es_hora_extra } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input("fecha",          sql.Date,     fecha)
      .input("hora_inicio",    sql.NVarChar,  hora_inicio)
      .input("exportadora_id", sql.Int,       exportadora_id)
      .input("semana",         sql.Int,       semana)
      .input("anio",           sql.Int,       anio)
      .input("es_hora_extra",  sql.Bit,       es_hora_extra ? 1 : 0)
      .query(`
        MERGE INTO turnos AS tgt
        USING (VALUES (@fecha,@hora_inicio,@exportadora_id,@semana,@anio,@es_hora_extra))
          AS src(fecha,hora_inicio,exportadora_id,semana,anio,es_hora_extra)
        ON tgt.fecha=src.fecha AND tgt.hora_inicio=src.hora_inicio
        WHEN MATCHED THEN
          UPDATE SET exportadora_id=src.exportadora_id, semana=src.semana, anio=src.anio, es_hora_extra=src.es_hora_extra
        WHEN NOT MATCHED THEN
          INSERT (fecha,hora_inicio,exportadora_id,semana,anio,es_hora_extra)
          VALUES (src.fecha,src.hora_inicio,src.exportadora_id,src.semana,src.anio,src.es_hora_extra);
      `);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/horas-extra-dia", async (req, res) => {
  try {
    const p = await getPool();
    const r = await p.request().query(`
      SELECT
        exportadora_id,
        CONVERT(VARCHAR, fecha, 23) AS fecha,
        CAST(COUNT(*) AS DECIMAL(10,1)) * 0.5 AS horas_extra
      FROM turnos
      WHERE es_hora_extra = 1
      GROUP BY exportadora_id, fecha
    `);
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/turnos/:id", async (req, res) => {
  try {
    const p = await getPool();
    await p.request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM turnos WHERE id=@id");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET config turnos
app.get("/api/turnos-config", async (req, res) => {
  try {
    const p = await getPool();
    const r = await p.request().query(
      "SELECT * FROM turnos_config WHERE activo=1 ORDER BY turno"
    );
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT config turnos
app.put("/api/turnos-config/:id", async (req, res) => {
  const { hora_inicio, hora_fin, colacion_ini, colacion_fin, restriccion_ini, restriccion_fin } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input("id", sql.Int, req.params.id)
      .input("hi", sql.NVarChar, hora_inicio)
      .input("hf", sql.NVarChar, hora_fin)
      .input("ci", sql.NVarChar, colacion_ini    || null)
      .input("cf", sql.NVarChar, colacion_fin    || null)
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// ENDPOINTS NUEVOS - SISTEMA DE FAMILIAS Y ESPECIES
// ═══════════════════════════════════════════════════════════════════════════
// ─── PARÁMETROS POR DÍA ESPECÍFICO ───────────────────────────────────────────
app.get("/api/parametros-dia", async (req, res) => {
  try {
    const p = await getPool();
    const r = await p.request().query("SELECT * FROM parametros_dia_especifico ORDER BY fecha DESC");
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/parametros-dia", async (req, res) => {
  const { exportadora_id, especie_id, variedad, fecha, bins_por_hora } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input("eid",  sql.Int,          Number(exportadora_id) || null)
      .input("esid", sql.Int,          Number(especie_id)     || null)
      .input("var",  sql.NVarChar(100), variedad              || null)
      .input("f",    sql.Date,          fecha)
      .input("bph",  sql.Decimal(10,2), Number(bins_por_hora))
      .query(`
        MERGE parametros_dia_especifico AS t
        USING (VALUES(@eid,@esid,@var,@f,@bph))
          AS s(exportadora_id,especie_id,variedad,fecha,bins_por_hora)
        ON  (t.fecha = s.fecha)
        AND (t.exportadora_id IS NULL AND s.exportadora_id IS NULL OR t.exportadora_id = s.exportadora_id)
        AND (t.especie_id     IS NULL AND s.especie_id     IS NULL OR t.especie_id     = s.especie_id)
        AND (t.variedad       IS NULL AND s.variedad       IS NULL OR t.variedad       = s.variedad)
        WHEN MATCHED THEN
          UPDATE SET bins_por_hora = s.bins_por_hora, actualizado_en = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (exportadora_id, especie_id, variedad, fecha, bins_por_hora)
          VALUES (s.exportadora_id, s.especie_id, s.variedad, s.fecha, s.bins_por_hora);
      `);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/parametros-dia/:id", async (req, res) => {
  try {
    const p = await getPool();
    await p.request()
      .input("id", sql.Int, Number(req.params.id))
      .query("DELETE FROM parametros_dia_especifico WHERE id = @id");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TEMPORADAS POR FAMILIA ────────────────────────────────────────────────
app.get("/api/temporadas-familia", async (req, res) => {
  try {
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
        CONVERT(VARCHAR, tf.fecha_fin,    23) AS fecha_fin,
        tf.activa
      FROM temporadas_familia tf
      JOIN familias_especies f ON f.id = tf.familia_id
      WHERE tf.activa = 1
      ORDER BY f.orden, f.id
    `);

    res.json(result.recordset);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/temporadas-familia", async (req, res) => {
  const { familia_id, fecha_inicio, fecha_fin, activa } = req.body;
  try {
    const p = await getPool();
    const existe = await p.request().query(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='temporadas_familia'
    `);

    if (!existe.recordset[0].total) {
      return res.status(400).json({
        error: "Falta la tabla dbo.temporadas_familia.",
      });
    }

    const result = await p.request()
      .input("familia_id",   sql.Int,  Number(familia_id))
      .input("fecha_inicio", sql.Date, fecha_inicio)
      .input("fecha_fin",    sql.Date, fecha_fin)
      .input("activa",       sql.Bit,  activa === undefined ? 1 : (activa ? 1 : 0))
      .query(`
        MERGE dbo.temporadas_familia AS tgt
        USING (VALUES (@familia_id, @fecha_inicio, @fecha_fin, @activa))
          AS src(familia_id, fecha_inicio, fecha_fin, activa)
        ON tgt.familia_id = src.familia_id
        WHEN MATCHED THEN
          UPDATE SET
            fecha_inicio   = src.fecha_inicio,
            fecha_fin      = src.fecha_fin,
            activa         = src.activa,
            actualizado_en = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (familia_id, fecha_inicio, fecha_fin, activa)
          VALUES (src.familia_id, src.fecha_inicio, src.fecha_fin, src.activa)
        OUTPUT INSERTED.*;
      `);
    res.json(result.recordset[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FAMILIAS DE ESPECIES ────────────────────────────────────────────────────
app.get("/api/familias", async (req, res) => {
  try {
    const p = await getPool();
    const existe = await p.request().query(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='temporadas_familia'
    `);

    const query = existe.recordset[0].total ? `
      SELECT
        f.id, f.nombre, f.orden, f.usa_curado, f.activa,
        CONVERT(VARCHAR, tf.fecha_inicio, 23) AS fecha_inicio,
        CONVERT(VARCHAR, tf.fecha_fin,    23) AS fecha_fin
      FROM familias_especies f
      LEFT JOIN temporadas_familia tf ON tf.familia_id = f.id AND tf.activa = 1
      WHERE f.activa=1
      ORDER BY f.orden, f.id
    ` : `
      SELECT id, nombre, orden, usa_curado, activa,
             NULL AS fecha_inicio, NULL AS fecha_fin
      FROM familias_especies
      WHERE activa=1
      ORDER BY orden, id
    `;

    const result = await p.request().query(query);
    res.json(result.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/familias", async (req, res) => {
  const { nombre, usa_curado, orden } = req.body;
  try {
    const p = await getPool();
    const result = await p.request()
      .input("nombre",     sql.NVarChar, nombre.toUpperCase())
      .input("usa_curado", sql.Bit,      usa_curado || 0)
      .input("orden",      sql.Int,      orden || 0)
      .query(`
        INSERT INTO familias_especies (nombre, usa_curado, orden)
        OUTPUT INSERTED.*
        VALUES (@nombre, @usa_curado, @orden)
      `);
    res.json(result.recordset[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/familias/:id", async (req, res) => {
  const { nombre, usa_curado, orden } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input("id",         sql.Int,      req.params.id)
      .input("nombre",     sql.NVarChar, nombre.toUpperCase())
      .input("usa_curado", sql.Bit,      usa_curado)
      .input("orden",      sql.Int,      orden)
      .query(`
        UPDATE familias_especies
        SET nombre=@nombre, usa_curado=@usa_curado, orden=@orden
        WHERE id=@id
      `);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ESPECIES ────────────────────────────────────────────────────────────────
app.get("/api/especies", async (req, res) => {
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/especies", async (req, res) => {
  const { nombre, familia_id } = req.body;
  try {
    const p = await getPool();
    const existing = await p.request()
      .input("nombre",    sql.NVarChar, nombre.toUpperCase())
      .input("familia_id", sql.Int,    familia_id)
      .query("SELECT * FROM especies WHERE nombre=@nombre AND familia_id=@familia_id");

    if (existing.recordset.length > 0) {
      const result = await p.request()
        .input("nombre",    sql.NVarChar, nombre.toUpperCase())
        .input("familia_id", sql.Int,    familia_id)
        .query(`
          UPDATE especies SET activa=1
          OUTPUT INSERTED.*
          WHERE nombre=@nombre AND familia_id=@familia_id
        `);
      res.json(result.recordset[0]);
    } else {
      const result = await p.request()
        .input("nombre",    sql.NVarChar, nombre.toUpperCase())
        .input("familia_id", sql.Int,    familia_id)
        .query(`
          INSERT INTO especies (nombre, familia_id)
          OUTPUT INSERTED.*
          VALUES (@nombre, @familia_id)
        `);
      res.json(result.recordset[0]);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/especies/:id", async (req, res) => {
  try {
    const p = await getPool();
    await p.request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE especies SET activa=0 WHERE id=@id");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PARÁMETROS POR ESPECIE ──────────────────────────────────────────────────
app.get("/api/parametros-especie", async (req, res) => {
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/parametros-especie", async (req, res) => {
  const { especie_id, bins_por_hora, horas_por_dia, kg_por_bin } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input("especie_id", sql.Int,          especie_id || null)
      .input("bph",        sql.Decimal(10,2), bins_por_hora)
      .input("hpd",        sql.Decimal(10,2), horas_por_dia)
      .input("kpb",        sql.Decimal(10,2), kg_por_bin)
      .query(`
        MERGE INTO parametros_especie AS tgt
        USING (VALUES (@especie_id, @bph, @hpd, @kpb))
          AS src(especie_id, bins_por_hora, horas_por_dia, kg_por_bin)
        ON (tgt.especie_id = src.especie_id
            OR (tgt.especie_id IS NULL AND src.especie_id IS NULL))
        WHEN MATCHED THEN
          UPDATE SET
            bins_por_hora  = src.bins_por_hora,
            horas_por_dia  = src.horas_por_dia,
            kg_por_bin     = src.kg_por_bin,
            actualizado_en = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (especie_id, bins_por_hora, horas_por_dia, kg_por_bin)
          VALUES (src.especie_id, src.bins_por_hora, src.horas_por_dia, src.kg_por_bin);
      `);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TIPOS DE RESTRICCIÓN ────────────────────────────────────────────────────
app.get("/api/tipos-restriccion", async (req, res) => {
  try {
    const p = await getPool();
    const result = await p.request().query(`
      SELECT id, nombre, color, activa
      FROM tipos_restriccion
      WHERE activa=1
      ORDER BY nombre
    `);
    res.json(result.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/tipos-restriccion", async (req, res) => {
  const { nombre, color } = req.body;
  try {
    const p = await getPool();
    const existing = await p.request()
      .input("nombre", sql.NVarChar, nombre)
      .query("SELECT * FROM tipos_restriccion WHERE nombre=@nombre");

    if (existing.recordset.length > 0) {
      const result = await p.request()
        .input("nombre", sql.NVarChar, nombre)
        .input("color",  sql.NVarChar, color || "#ef4444")
        .query(`
          UPDATE tipos_restriccion
          SET activa=1, color=@color
          OUTPUT INSERTED.*
          WHERE nombre=@nombre
        `);
      res.json(result.recordset[0]);
    } else {
      const result = await p.request()
        .input("nombre", sql.NVarChar, nombre)
        .input("color",  sql.NVarChar, color || "#ef4444")
        .query(`
          INSERT INTO tipos_restriccion (nombre, color)
          OUTPUT INSERTED.*
          VALUES (@nombre, @color)
        `);
      res.json(result.recordset[0]);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/tipos-restriccion/:id", async (req, res) => {
  const { nombre, color } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input("id",     sql.Int,      req.params.id)
      .input("nombre", sql.NVarChar, nombre)
      .input("color",  sql.NVarChar, color || '#dc2626')
      .query("UPDATE tipos_restriccion SET nombre=@nombre, color=@color WHERE id=@id");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/tipos-restriccion/:id", async (req, res) => {
  try {
    const p = await getPool();
    await p.request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE tipos_restriccion SET activa=0 WHERE id=@id");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DEFINICIONES DE TURNO ───────────────────────────────────────────────────
app.get("/api/turnos-definicion", async (req, res) => {
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/turnos-definicion", async (req, res) => {
  const { nombre, hora_inicio, hora_fin, colacion_inicio, colacion_fin, orden, horas_extra, horas_extra_inicio } = req.body;
  try {
    const validarHora = (hora, campo) => {
      if (hora === null || hora === undefined) return null;
      if (typeof hora !== "string") throw new Error(`${campo}: debe ser una cadena`);
      if (!/^\d{2}:\d{2}:\d{2}$/.test(hora))
        throw new Error(`${campo}: formato inválido (esperado HH:MM:SS, recibido: ${hora})`);
      return hora;
    };

    const hi = validarHora(hora_inicio,    "hora_inicio");
    const hf = validarHora(hora_fin,       "hora_fin");
    const ci = validarHora(colacion_inicio, "colacion_inicio");
    const cf = validarHora(colacion_fin,    "colacion_fin");

    if (!hi || !hf) throw new Error("hora_inicio y hora_fin son obligatorias");

    const he  = horas_extra        != null ? Number(horas_extra)        : null;
    const hei = horas_extra_inicio != null ? Number(horas_extra_inicio) : null;

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
        .input("he",  sql.Decimal(4,1), he)
        .input("hei", sql.Decimal(4,1), hei)
        .query(`
          UPDATE turnos_definicion
          SET activa=1,
              hora_inicio        = CAST(@hi AS TIME),
              hora_fin           = CAST(@hf AS TIME),
              colacion_inicio    = CASE WHEN @ci IS NULL THEN NULL ELSE CAST(@ci AS TIME) END,
              colacion_fin       = CASE WHEN @cf IS NULL THEN NULL ELSE CAST(@cf AS TIME) END,
              orden              = @orden,
              horas_extra        = @he,
              horas_extra_inicio = @hei
          OUTPUT INSERTED.*
          WHERE nombre=@nombre
        `);
      res.json(result.recordset[0]);
    } else {
      const result = await p.request()
        .input("nombre", sql.NVarChar, nombre)
        .input("hi", sql.VarChar(8), hi)
        .input("hf", sql.VarChar(8), hf)
        .input("ci", sql.VarChar(8), ci)
        .input("cf", sql.VarChar(8), cf)
        .input("orden", sql.Int, orden || 0)
        .input("he",  sql.Decimal(4,1), he)
        .input("hei", sql.Decimal(4,1), hei)
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
    }
  } catch (e) {
    console.error("Error en POST turnos-definicion:", e);
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/turnos-definicion/:id", async (req, res) => {
  const { nombre, hora_inicio, hora_fin, colacion_inicio, colacion_fin, orden, horas_extra, horas_extra_inicio } = req.body;
  try {
    const validarHora = (hora, campo) => {
      if (hora === null || hora === undefined) return null;
      if (typeof hora !== "string") throw new Error(`${campo}: debe ser una cadena`);
      if (!/^\d{2}:\d{2}:\d{2}$/.test(hora))
        throw new Error(`${campo}: formato inválido (esperado HH:MM:SS, recibido: ${hora})`);
      return hora;
    };

    const hi = validarHora(hora_inicio,    "hora_inicio");
    const hf = validarHora(hora_fin,       "hora_fin");
    const ci = validarHora(colacion_inicio, "colacion_inicio");
    const cf = validarHora(colacion_fin,    "colacion_fin");

    if (!hi || !hf) throw new Error("hora_inicio y hora_fin son obligatorias");

    const he  = horas_extra        != null ? Number(horas_extra)        : null;
    const hei = horas_extra_inicio != null ? Number(horas_extra_inicio) : null;

    const p = await getPool();
    await p.request()
      .input("id",     sql.Int,      req.params.id)
      .input("nombre", sql.NVarChar, nombre)
      .input("hi",     sql.VarChar(8), hi)
      .input("hf",     sql.VarChar(8), hf)
      .input("ci",     sql.VarChar(8), ci)
      .input("cf",     sql.VarChar(8), cf)
      .input("orden",  sql.Int,      orden)
      .input("he",     sql.Decimal(4,1), he)
      .input("hei",    sql.Decimal(4,1), hei)
      .query(`
        UPDATE turnos_definicion SET
          nombre             = @nombre,
          hora_inicio        = CAST(@hi AS TIME),
          hora_fin           = CAST(@hf AS TIME),
          colacion_inicio    = CASE WHEN @ci IS NULL THEN NULL ELSE CAST(@ci AS TIME) END,
          colacion_fin       = CASE WHEN @cf IS NULL THEN NULL ELSE CAST(@cf AS TIME) END,
          orden              = @orden,
          horas_extra        = @he,
          horas_extra_inicio = @hei
        WHERE id=@id
      `);
    res.json({ ok: true });
  } catch (e) {
    console.error("Error en PUT turnos-definicion:", e);
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/turnos-definicion/:id", async (req, res) => {
  try {
    const p = await getPool();
    await p.request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE turnos_definicion SET activa=0 WHERE id=@id");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ─── CONFIGURACIÓN HORAS CURADO POR EXPORTADORA (KIWI) ───────────────────────
app.get("/api/curado-horas-config", async (req, res) => {
  try {
    const p = await getPool();
    const r = await p.request().query("SELECT * FROM curado_horas_config");
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/curado-horas-config/:exportadora_id", async (req, res) => {
  const { horas_curado } = req.body;
  try {
    const p = await getPool();
    await p.request()
      .input("eid", sql.Int, Number(req.params.exportadora_id))
      .input("hc",  sql.Int, Number(horas_curado) || 48)
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════
const PORT = Number(process.env.PORT || 4001);
app.listen(PORT, () => {
  console.log(`\n✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🗄️  Conectando a SQL Server ${dbConfig.server} / ${dbConfig.database}\n`);
});
