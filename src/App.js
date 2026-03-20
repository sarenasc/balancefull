import { useState, useMemo, useCallback, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";

const API = "http://localhost:4001/api";
const TODAY = new Date().toISOString().split("T")[0];
const START = "2026-03-12";
const TOTAL_DAYS = 100;

const COLOR_PALETTE = [
  { color:"#1d4ed8", bg:"#dbeafe" }, { color:"#7c3aed", bg:"#ede9fe" },
  { color:"#059669", bg:"#d1fae5" }, { color:"#ea580c", bg:"#ffedd5" },
  { color:"#db2777", bg:"#fce7f3" }, { color:"#ca8a04", bg:"#fef9c3" },
  { color:"#0284c7", bg:"#e0f2fe" }, { color:"#9333ea", bg:"#f3e8ff" },
  { color:"#dc2626", bg:"#fee2e2" }, { color:"#16a34a", bg:"#dcfce7" },
];

const addDays  = (s,n) => { const d=new Date(s+"T12:00:00"); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; };
const fmtDate  = (s)   => new Date(s+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit"});
const fmtDay   = (s)   => ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][new Date(s+"T12:00:00").getDay()];
const isSunday = (s)   => new Date(s+"T12:00:00").getDay()===0;
const isPast   = (d)   => d < TODAY;
const isToday  = (d)   => d === TODAY;
const getWeekNumber = (dateStr) => {
  const d=new Date(dateStr+"T12:00:00"), jan1=new Date(d.getFullYear(),0,1);
  return Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7);
};
const DATES     = Array.from({length:TOTAL_DAYS},(_,i)=>addDays(START,i));
const DATES_HOY = DATES.filter(d=>d<=TODAY);
const fmt       = (v) => v==null?"—":Number(v).toLocaleString("es-CL");
const fmtLinea   = (v) => (v==null || Number(v)===0) ? "-" : Number(v).toLocaleString("es-CL");
const entColor  = (e) => COLOR_PALETTE[e.colorIdx%COLOR_PALETTE.length]?.color||"#38bdf8";
const entBg     = (e) => COLOR_PALETTE[e.colorIdx%COLOR_PALETTE.length]?.bg||"#0c1e2e";
const timeToMin = (t) => { const [h,m]=(t||"00:00").split(":").map(Number); return h*60+m; };
const minToTime = (min) => { const h=Math.floor(min/60); const m=min%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; };
const normalizeText = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
const buildDateRange = (start, end) => {
  if (!start || !end) return [];
  const out = [];
  let cursor = start;
  let safety = 0;
  while (cursor <= end && safety < 800) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    safety++;
  }
  return out;
};

// Función para formatear hora desde timestamp SQL a HH:MM:SS
const formatearHoraSql = (timeValue) => {
  if (!timeValue) return null;
  
  // Si ya viene en formato HH:MM o HH:MM:SS
  if (typeof timeValue === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(timeValue)) {
    const parts = timeValue.split(':');
    if (parts.length === 2) return `${parts[0].padStart(2,'0')}:${parts[1]}:00`;
    return `${parts[0].padStart(2,'0')}:${parts[1]}:${parts[2]}`;
  }
  
  // Si viene como timestamp completo (1970-01-01T08:00:00.000Z)
  if (typeof timeValue === 'string' && timeValue.includes('T')) {
    const timePart = timeValue.split('T')[1];
    return timePart.split('.')[0]; // Retorna HH:MM:SS
  }
  
  // Si viene como Date object
  if (timeValue instanceof Date) {
    const hours = String(timeValue.getHours()).padStart(2, '0');
    const minutes = String(timeValue.getMinutes()).padStart(2, '0');
    const seconds = String(timeValue.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  
  return timeValue;
};

const normalizarFechaSql = (v) => {
  if (!v) return null;
  if (typeof v === "string" && v.includes("T")) return v.split("T")[0];
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v);
};

const getDayStyle = (d,hol) =>
  isSunday(d)?{background:"#fee2e2"}:hol.includes(d)?{background:"#fef9c3"}:isToday(d)?{background:"#dbeafe"}:isPast(d)?{background:"#f1f5f9"}:{};
const getHdrStyle = (d,hol) =>
  isSunday(d)?{background:"#fecaca",color:"#dc2626",borderBottom:"2px solid #dc2626"}:
  hol.includes(d)?{background:"#fde68a",color:"#92400e",borderBottom:"2px solid #d97706"}:
  isToday(d)?{background:"#bfdbfe",color:"#1d4ed8",borderBottom:"2px solid #2563eb"}:{};

const apiFetch = async (path,opts={}) => {
  const r=await fetch(API+path,{headers:{"Content-Type":"application/json"},...opts});
  if(!r.ok) throw new Error(await r.text());
  return r.json();
};

const BLINK_STYLE=`
  @keyframes blink-red{0%,100%{opacity:1}50%{opacity:0.2}}
  .balance-neg{color:#dc2626!important;animation:blink-red 1s infinite;font-weight:700;}
`;

const S={
  app:    {background:"#eef2f7",minHeight:"100vh",color:"#1e293b",fontFamily:"'IBM Plex Mono','Courier New',monospace",fontSize:12},
  header: {background:"#ffffff",borderBottom:"1px solid #cbd5e1",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8},
  logo:   {color:"#2563eb",fontWeight:700,fontSize:15,letterSpacing:2},
  tab:    (a)=>({background:a?"#dbeafe":"transparent",border:`1px solid ${a?"#2563eb":"#cbd5e1"}`,color:a?"#1d4ed8":"#64748b",padding:"5px 14px",borderRadius:4,cursor:"pointer",fontSize:11,letterSpacing:1,fontFamily:"inherit"}),
  main:   {padding:16,maxWidth:1800,margin:"0 auto"},
  card:   {background:"#ffffff",border:"1px solid #cbd5e1",borderRadius:6,padding:14,marginBottom:12,boxShadow:"0 1px 4px rgba(30,41,59,0.06)"},
  sT:     {color:"#2563eb",fontSize:10,letterSpacing:3,textTransform:"uppercase",marginBottom:10,borderBottom:"1px solid #cbd5e1",paddingBottom:6},
  kpi:    {background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:6,padding:"12px 16px",flex:1,minWidth:130},
  table:  {width:"100%",borderCollapse:"collapse",fontSize:11},
  th:     {background:"#f1f5f9",color:"#64748b",padding:"5px 8px",textAlign:"center",fontSize:10,letterSpacing:1,borderBottom:"1px solid #cbd5e1",whiteSpace:"nowrap"},
  thL:    {background:"#f1f5f9",color:"#64748b",padding:"5px 8px",textAlign:"left",fontSize:10,letterSpacing:1,borderBottom:"1px solid #cbd5e1"},
  td:     {padding:"4px 8px",textAlign:"center",borderBottom:"1px solid #e2e8f0"},
  tdL:    {padding:"4px 8px",textAlign:"left",borderBottom:"1px solid #e2e8f0"},
  btn:    (c="#2563eb",bg="#dbeafe")=>({background:bg,border:`1px solid ${c}`,color:c,padding:"6px 14px",borderRadius:4,cursor:"pointer",fontSize:11,fontFamily:"inherit",letterSpacing:1}),
  overlay:{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"},
  modal:  {background:"#ffffff",border:"1px solid #cbd5e1",borderRadius:8,padding:24,width:480,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto"},
  input:  {background:"#f8fafc",border:"1px solid #cbd5e1",color:"#1e293b",borderRadius:4,padding:"6px 10px",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,width:"100%",boxSizing:"border-box"},
  lbl:    {color:"#64748b",fontSize:10,letterSpacing:1,display:"block",marginBottom:4,marginTop:10},
};

export default function BalanceFruta(){
  const [tab,setTab]               = useState("dashboard");
  const [entities,setEntities]     = useState([]);
  const [data,setData]             = useState({});
  const [settings,setSettings]     = useState({bph:18,hpd:16,kpb:460});
  const [curadoHorasConfig, setCuradoHorasConfig] = useState({});
  const [holidays,setHolidays]     = useState([]);
  const [temporadaId,setTemporadaId] = useState(null);
  
  // NUEVOS ESTADOS
  const [familias, setFamilias] = useState([]);
  const [especies, setEspecies] = useState([]);
  const [parametrosEspecie, setParametrosEspecie] = useState([]);
  const [parametrosDia, setParametrosDia] = useState([]);
  const [tiposRestriccion, setTiposRestriccion] = useState([]);
  const [turnosDefinicion, setTurnosDefinicion] = useState([]);
  const [restriccionesDia, setRestriccionesDia] = useState([]);
  const [familiaActiva, setFamiliaActiva] = useState(null);
  const [operacionVista, setOperacionVista] = useState("resumen");
  const [configTab, setConfigTab] = useState("parametros");
  const [dashboardFamilias, setDashboardFamilias] = useState(new Set(["all"]));
  const [projectionEntityFilter, setProjectionEntityFilter] = useState("all");
  const [projectionFrom, setProjectionFrom] = useState(START);
  const [projectionDays, setProjectionDays] = useState(55);
  
  // Estados de modales
  const [showFamiliaModal, setShowFamiliaModal] = useState(false);
  const [showEspecieModal, setShowEspecieModal] = useState(false);
  const [showTurnoDefModal, setShowTurnoDefModal] = useState(false);
  const [showRestriccionModal, setShowRestriccionModal] = useState(false);
  const [showExcepcionModal, setShowExcepcionModal] = useState(false);
  const [newFamilia, setNewFamilia] = useState({ nombre: "", usa_curado: false, orden: 0 });
  const [newEspecie, setNewEspecie] = useState({ nombre: "", familia_id: "" });
  const [newExportadora, setNewExportadora] = useState({
    nombre: "",
    especie_id: "",
    variedad: "",
    color_idx: 0
  });
  const [savingExportadora, setSavingExportadora] = useState(false);
  const [formDia, setFormDia] = useState({ exportadora_id: "", especie_id: "", variedad: "", fecha: TODAY, bins_por_hora: "" });
  const [lineaCargaRapida, setLineaCargaRapida] = useState({
    exportadora_id: "",
    seccion: "cosecha",
    fecha_desde: TODAY,
    fecha_hasta: TODAY,
    bins: ""
  });
  const [savingCargaRapida, setSavingCargaRapida] = useState(false);
  const [temporadasFamilia, setTemporadasFamilia] = useState({});
  const [newTurnoDef, setNewTurnoDef] = useState({
    nombre: "",
    hora_inicio: "08:00",
    hora_fin: "17:00",
    colacion_inicio: "",
    colacion_fin: "",
    orden: 0,
  });

  const [newTipoRestriccion, setNewTipoRestriccion] = useState({ nombre: "", color: "#dc2626" });
  const [newFeriado, setNewFeriado] = useState({ fecha: TODAY, nombre: "" });
  const [showTipoRestriccionModal, setShowTipoRestriccionModal] = useState(false);
  const [showFeriadoModal, setShowFeriadoModal] = useState(false);

  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingCell, setSavingCell] = useState(false);

  // Estados para programa de turnos (persistencia en base de datos)
  const [semanaSeleccionada, setSemanaSeleccionada] = useState(getWeekNumber(TODAY));
  const [anoSeleccionado, setAnoSeleccionado] = useState(new Date().getFullYear());
  const [intervaloMinutos, setIntervaloMinutos] = useState(30);
  const [asignacionesTurno, setAsignacionesTurno] = useState({});
  const [restriccionesTurno, setRestriccionesTurno] = useState({});
  const [turnosSemanaDb, setTurnosSemanaDb] = useState([]);
  const [restriccionesSemanaDb, setRestriccionesSemanaDb] = useState([]);
  const [savingTurnos, setSavingTurnos] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    exportadora_id: "",
    fecha: "",
    hora_desde: "",
    hora_hasta: ""
  });
  const [draggingItem, setDraggingItem] = useState(null);
  const [draggingFrom, setDraggingFrom] = useState(null);
  const [filtroExportadora, setFiltroExportadora] = useState("todos");
  const [vistaTurnosPrograma, setVistaTurnosPrograma] = useState('all');


  const cargarTurnosSemana = useCallback(async () => {
    try {
      const [rows, restriccionesRows] = await Promise.all([
        apiFetch(`/turnos?semana=${semanaSeleccionada}&anio=${anoSeleccionado}`),
        apiFetch(`/turnos-restricciones?semana=${semanaSeleccionada}&anio=${anoSeleccionado}`).catch(() => [])
      ]);
      const rowsNormalizados = rows.map(row => ({
        ...row,
        hora_inicio: String(row.hora_inicio || "").substring(0, 5)
      }));
      const restriccionesNormalizadas = restriccionesRows.map(row => ({
        ...row,
        hora_inicio: String(row.hora_inicio || "").substring(0, 5)
      }));

      const asignaciones = {};
      rowsNormalizados.forEach(row => {
        const key = `${row.fecha}_${String(row.hora_inicio || "").substring(0, 5)}`;
        const ent = entities.find(e => String(e.id) === String(row.exportadora_id));

        asignaciones[key] = [
          ent
            ? { ...ent, turnoDbId: row.id }
            : {
                id: row.exportadora_id,
                dbId: row.exportadora_id,
                exportadora: row.exportadora,
                label: row.exportadora,
                colorIdx: row.color_idx ?? 0,
                turnoDbId: row.id
              }
        ];
      });

      const restricciones = {};
      restriccionesNormalizadas.forEach(row => {
        const key = `${row.fecha}_${String(row.hora_inicio || "").substring(0, 5)}`;
        const tipo = tiposRestriccion.find(t => String(t.id) === String(row.tipo_restriccion_id));
        restricciones[key] = tipo
          ? { ...tipo, restriccionDbId: row.id }
          : {
              id: row.tipo_restriccion_id,
              nombre: row.nombre,
              color: row.color || '#ef4444',
              restriccionDbId: row.id
            };
      });

      setTurnosSemanaDb(rowsNormalizados);
      setRestriccionesSemanaDb(restriccionesNormalizadas);
      setAsignacionesTurno(asignaciones);
      setRestriccionesTurno(restricciones);
    } catch (e) {
      console.error('Error cargando turnos de la semana:', e);
    }
  }, [semanaSeleccionada, anoSeleccionado, entities, tiposRestriccion]);

  useEffect(() => {
    if (entities.length > 0) {
      cargarTurnosSemana();
    }
  }, [cargarTurnosSemana, entities.length]);

  // CARGA INICIAL MEJORADA
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [
          entRes, tempRes, dataRes, setRes, holRes,
          famRes, espRes, paramEspRes, tipoRestRes, turnoDefRes, temporadasFamRes, curadoCfgRes, paramsDiaRes
        ] = await Promise.all([
          apiFetch("/exportadoras"),
          apiFetch("/temporada"),
          apiFetch("/datos"),
          apiFetch("/configuracion"),
          apiFetch("/feriados"),
          apiFetch("/familias"),
          apiFetch("/especies"),
          apiFetch("/parametros-especie"),
          apiFetch("/tipos-restriccion"),
          apiFetch("/turnos-definicion"),
          apiFetch("/temporadas-familia").catch(() => []),
          apiFetch("/curado-horas-config").catch(() => []),
          apiFetch("/parametros-dia").catch(() => [])
        ]);

        const processedEntities = entRes.map(e => {
          const especieNombre = String(e.especie || "").trim();
          const especieMatch = espRes.find(esp => normalizeText(esp.nombre) === normalizeText(especieNombre));
          return {
            dbId: Number(e.id),
            id: Number(e.id),
            exportadora: e.nombre,
            especie: especieNombre,
            variedad: e.variedad || "",
            colorIdx: Number(e.color_idx || 0),
            especieId: e.especie_id != null ? Number(e.especie_id) : (especieMatch ? Number(especieMatch.id) : null),
            visibleLinea: Number(e.visible_linea ?? 1),
            label: [e.nombre, e.variedad].filter(Boolean).join(" ")
          };
        });

        const processedFamilias = famRes.map(f => ({
          ...f,
          id: Number(f.id),
          orden: Number(f.orden || 0),
          usa_curado: Boolean(f.usa_curado)
        }));

        const processedEspecies = espRes.map(e => ({
          ...e,
          id: Number(e.id),
          familia_id: e.familia_id != null ? Number(e.familia_id) : null
        }));

        setEntities(processedEntities);
        setTemporadaId(tempRes?.id || null);
        setSettings(setRes);
        setHolidays(holRes);
        setFamilias(processedFamilias);
        setEspecies(processedEspecies);
        setParametrosEspecie(paramEspRes);
        setTiposRestriccion(tipoRestRes);
        const hmap = {};
        setParametrosDia(paramsDiaRes || []);
        (curadoCfgRes || []).forEach(r => { hmap[r.exportadora_id] = r.horas_curado; });
        setCuradoHorasConfig(hmap);
        
        // Procesar turnos para formatear horas correctamente
        const processedTurnos = turnoDefRes.map(turno => ({
          ...turno,
          hora_inicio: formatearHoraSql(turno.hora_inicio),
          hora_fin: formatearHoraSql(turno.hora_fin),
          colacion_inicio: formatearHoraSql(turno.colacion_inicio),
          colacion_fin: formatearHoraSql(turno.colacion_fin)
        }));
        setTurnosDefinicion(processedTurnos);

        const temporadasMap = {};
        (temporadasFamRes || []).forEach(tf => {
          const famId = Number(tf.familia_id);
          if (!Number.isNaN(famId)) {
            temporadasMap[famId] = {
              id: tf.id != null ? Number(tf.id) : null,
              familia_id: famId,
              fecha_inicio: normalizarFechaSql(tf.fecha_inicio) || normalizarFechaSql(tempRes?.fecha_inicio) || START,
              fecha_fin: normalizarFechaSql(tf.fecha_fin) || normalizarFechaSql(tempRes?.fecha_fin) || addDays(START, TOTAL_DAYS - 1),
              activa: Number(tf.activa ?? 1)
            };
          }
        });
        processedFamilias.forEach(fam => {
          if (!temporadasMap[fam.id]) {
            temporadasMap[fam.id] = {
              id: null,
              familia_id: fam.id,
              fecha_inicio: normalizarFechaSql(tempRes?.fecha_inicio) || START,
              fecha_fin: normalizarFechaSql(tempRes?.fecha_fin) || addDays(START, TOTAL_DAYS - 1),
              activa: 1
            };
          }
        });
        setTemporadasFamilia(temporadasMap);

        // Establecer primera familia como activa
        if (processedFamilias.length > 0 && !familiaActiva) {
          setFamiliaActiva(processedFamilias[0].id);
        }

        // Procesar datos
        const newData = {};
        for (const e of processedEntities) {
          newData[e.id] = {};
          for (const d of DATES) {
            newData[e.id][d] = { cosecha: 0, curado: 0, proceso: 0 };
          }
        }

        dataRes.cosechas.forEach(row => {
          const eid = row.exportadora_id;
          const d = row.fecha;
          if (newData[eid]?.[d]) newData[eid][d].cosecha = row.bins;
        });
        dataRes.curado.forEach(row => {
          const eid = row.exportadora_id;
          const d = row.fecha;
          if (newData[eid]?.[d]) newData[eid][d].curado = row.bins;
        });
        dataRes.procesos.forEach(row => {
          const eid = row.exportadora_id;
          const d = row.fecha;
          if (newData[eid]?.[d]) newData[eid][d].proceso = row.bins;
        });

        setData(newData);
      } catch (e) {
        console.error("Error loading:", e);
      }
    };
    loadAll();
  }, []);

  // HANDLERS PARA FAMILIAS
  const handleSaveFamilia = async (familia) => {
    try {
      if (familia.id) {
        await apiFetch(`/familias/${familia.id}`, {
          method: "PUT",
          body: JSON.stringify(familia)
        });
      } else {
        await apiFetch("/familias", {
          method: "POST",
          body: JSON.stringify(familia)
        });
      }
      // Recargar familias
      const famRes = await apiFetch("/familias");
      setFamilias(famRes);
      setShowFamiliaModal(false);
      setNewFamilia({ nombre: "", usa_curado: false, orden: 0 });
    } catch (e) {
      console.error("Error guardando familia:", e);
    }
  };

  // HANDLERS PARA ESPECIES
  const handleSaveEspecie = async (especie) => {
    try {
      await apiFetch("/especies", {
        method: "POST",
        body: JSON.stringify(especie)
      });
      const espRes = await apiFetch("/especies");
      setEspecies(espRes);
      setShowEspecieModal(false);
      setNewEspecie({ nombre: "", familia_id: "" });
    } catch (e) {
      console.error("Error guardando especie:", e);
    }
  };

  const handleDeleteEspecie = async (id) => {
    try {
      await apiFetch(`/especies/${id}`, { method: "DELETE" });
      const espRes = await apiFetch("/especies");
      setEspecies(espRes);
      setShowEspecieModal(false);
      setNewEspecie({ nombre: "", familia_id: "" });
    } catch (e) {
      console.error("Error eliminando especie:", e);
    }
  };


  const normalizarHora = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const valor = String(v).trim();

    // Formato HH:MM
    if (/^\d{1,2}:\d{2}$/.test(valor)) {
      const [hh, mm] = valor.split(":");
      const hours = String(hh).padStart(2, "0");
      const minutes = String(mm).padStart(2, "0");
      // SQL Server TIME acepta HH:MM:SS.nnnnnnn, usamos formato simple
      return `${hours}:${minutes}:00`;
    }

    // Formato HH:MM:SS
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(valor)) {
      const [hh, mm, ss] = valor.split(":");
      const hours = String(hh).padStart(2, "0");
      const minutes = String(mm).padStart(2, "0");
      const seconds = String(ss).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    }

    return null;
  };

  const handleSaveTurnoDef = async (turno) => {
    try {
      // Normalizar los valores
      const turnoNormalizado = {
        ...turno,
        nombre: String(turno?.nombre || "").trim(),
        hora_inicio: normalizarHora(turno?.hora_inicio),
        hora_fin: normalizarHora(turno?.hora_fin),
        colacion_inicio: normalizarHora(turno?.colacion_inicio),
        colacion_fin: normalizarHora(turno?.colacion_fin),
        orden: Number(turno?.orden || 0),
      };

      // Validaciones
      if (!turnoNormalizado.nombre) {
        alert("Debes ingresar el nombre del turno");
        return;
      }

      if (!turnoNormalizado.hora_inicio || !turnoNormalizado.hora_fin) {
        alert("Debes ingresar hora inicio y hora fin en formato HH:MM");
        return;
      }

      // Validar duración del turno (permitir turnos nocturnos que cruzan medianoche)
      const [h1, m1] = turnoNormalizado.hora_inicio.split(":");
      const [h2, m2] = turnoNormalizado.hora_fin.split(":");
      const inicio = parseInt(h1) * 60 + parseInt(m1);
      let fin = parseInt(h2) * 60 + parseInt(m2);
      
      // Si fin < inicio, es un turno nocturno que cruza medianoche
      let duracionMinutos;
      if (fin <= inicio) {
        // Turno cruza medianoche: sumar 24 horas (1440 minutos) al fin
        duracionMinutos = (1440 - inicio) + fin;
      } else {
        // Turno normal en el mismo día
        duracionMinutos = fin - inicio;
      }
      
      // Validar que el turno tenga una duración razonable (entre 1 y 16 horas)
      if (duracionMinutos <= 0) {
        alert("El turno debe tener una duración mayor a 0 minutos");
        return;
      }
      
      if (duracionMinutos > 960) { // 960 minutos = 16 horas
        const horas = Math.floor(duracionMinutos / 60);
        const minutos = duracionMinutos % 60;
        if (!window.confirm(`Este turno tiene una duración de ${horas}h ${minutos}min. ¿Deseas continuar?`)) {
          return;
        }
      }

      console.log("Enviando turno:", JSON.stringify(turnoNormalizado, null, 2));

      await apiFetch("/turnos-definicion", {
        method: "POST",
        body: JSON.stringify(turnoNormalizado)
      });
      
      const turnosRes = await apiFetch("/turnos-definicion");
      const processedTurnos = turnosRes.map(turno => ({
        ...turno,
        hora_inicio: formatearHoraSql(turno.hora_inicio),
        hora_fin: formatearHoraSql(turno.hora_fin),
        colacion_inicio: formatearHoraSql(turno.colacion_inicio),
        colacion_fin: formatearHoraSql(turno.colacion_fin)
      }));
      setTurnosDefinicion(processedTurnos);
      setShowTurnoDefModal(false);
      setNewTurnoDef({
        nombre: "",
        hora_inicio: "08:00",
        hora_fin: "17:00",
        colacion_inicio: "",
        colacion_fin: "",
        orden: (turnosRes.length || 0) + 1,
      });
    } catch (e) {
      console.error("Error guardando turno:", e);
      alert(`No se pudo guardar el turno: ${e.message}`);
    }
  };

  const handleDeleteTurnoDef = async (id) => {
    if (!window.confirm("¿Eliminar este turno?")) return;
    try {
      await apiFetch(`/turnos-definicion/${id}`, { method: "DELETE" });
      const turnosRes = await apiFetch("/turnos-definicion");
      const processedTurnos = turnosRes.map(turno => ({
        ...turno,
        hora_inicio: formatearHoraSql(turno.hora_inicio),
        hora_fin: formatearHoraSql(turno.hora_fin),
        colacion_inicio: formatearHoraSql(turno.colacion_inicio),
        colacion_fin: formatearHoraSql(turno.colacion_fin)
      }));
      setTurnosDefinicion(processedTurnos);
    } catch (e) {
      console.error("Error eliminando turno:", e);
      alert("No se pudo eliminar el turno");
    }
  };

  const handleSaveTipoRestriccion = async (tipo) => {
    try {
      await apiFetch("/tipos-restriccion", {
        method: "POST",
        body: JSON.stringify(tipo)
      });
      const tiposRes = await apiFetch("/tipos-restriccion");
      setTiposRestriccion(tiposRes);
      setShowTipoRestriccionModal(false);
      setNewTipoRestriccion({ nombre: "", color: "#dc2626" });
    } catch (e) {
      console.error("Error guardando tipo de restricción:", e);
      alert("No se pudo guardar el tipo de restricción");
    }
  };

  const handleDeleteTipoRestriccion = async (id) => {
    if (!window.confirm("¿Eliminar este tipo de restricción?")) return;
    try {
      await apiFetch(`/tipos-restriccion/${id}`, { method: "DELETE" });
      const tiposRes = await apiFetch("/tipos-restriccion");
      setTiposRestriccion(tiposRes);
    } catch (e) {
      console.error("Error eliminando tipo de restricción:", e);
      alert("No se pudo eliminar el tipo de restricción");
    }
  };

  const handleSaveFeriado = async (feriado) => {
    try {
      await apiFetch("/feriados", {
        method: "POST",
        body: JSON.stringify(feriado)
      });
      const holRes = await apiFetch("/feriados");
      setHolidays(holRes);
      setShowFeriadoModal(false);
      setNewFeriado({ fecha: TODAY, nombre: "" });
    } catch (e) {
      console.error("Error guardando feriado:", e);
      alert("No se pudo guardar el feriado");
    }
  };

  const handleDeleteFeriado = async (fecha) => {
    if (!window.confirm(`¿Eliminar el feriado ${fmtDate(fecha)}?`)) return;
    try {
      await apiFetch(`/feriados/${fecha}`, { method: "DELETE" });
      const holRes = await apiFetch("/feriados");
      setHolidays(holRes);
    } catch (e) {
      console.error("Error eliminando feriado:", e);
      alert("No se pudo eliminar el feriado");
    }
  };

  // HANDLERS PARA PARÁMETROS

  const handleCargaRapidaLinea = async () => {
    const exportadoraId = Number(lineaCargaRapida.exportadora_id || 0);
    const seccion = String(lineaCargaRapida.seccion || "cosecha");
    const bins = Number(lineaCargaRapida.bins || 0);
    const fechaDesde = String(lineaCargaRapida.fecha_desde || "");
    const fechaHasta = String(lineaCargaRapida.fecha_hasta || "");

    if (!exportadoraId) {
      alert("Selecciona una exportadora.");
      return;
    }

    if (!["cosecha", "curado", "proceso"].includes(seccion)) {
      alert("Selecciona una sección válida.");
      return;
    }

    if (!fechaDesde || !fechaHasta) {
      alert("Selecciona fecha desde y hasta.");
      return;
    }

    if (fechaHasta < fechaDesde) {
      alert("La fecha hasta no puede ser menor a la fecha desde.");
      return;
    }

    if (Number.isNaN(bins) || bins < 0) {
      alert("Ingresa una cantidad de bins válida.");
      return;
    }

    const endpointMap = {
      cosecha: "/datos/cosecha",
      curado: "/datos/curado",
      proceso: "/datos/proceso"
    };

    const fechas = [];
    let cursor = fechaDesde;
    let guard = 0;
    while (cursor <= fechaHasta && guard < 400) {
      fechas.push(cursor);
      cursor = addDays(cursor, 1);
      guard++;
    }

    try {
      setSavingCargaRapida(true);

      for (const fecha of fechas) {
        await apiFetch(endpointMap[seccion], {
          method: "POST",
          body: JSON.stringify({
            temporada_id: temporadaId,
            exportadora_id: exportadoraId,
            fecha,
            bins
          })
        });
      }

      await reloadDatos();
      alert(`Carga rápida guardada en ${fechas.length} día(s).`);
    } catch (e) {
      console.error("Error en carga rápida de línea:", e);
      alert("No se pudo guardar la carga rápida.");
    } finally {
      setSavingCargaRapida(false);
    }
  };

  const handleSaveParamsDia = async (payload) => {
    try {
      await apiFetch("/parametros-dia", { method: "POST", body: JSON.stringify(payload) });
      const res = await apiFetch("/parametros-dia").catch(() => []);
      setParametrosDia(res || []);
    } catch (e) { alert("Error al guardar parámetro de día: " + e.message); }
  };

  const handleDeleteParamDia = async (id) => {
    if (!window.confirm("¿Eliminar este parámetro de día?")) return;
    try {
      await apiFetch(`/parametros-dia/${id}`, { method: "DELETE" });
      setParametrosDia(prev => prev.filter(p => p.id !== id));
    } catch (e) { alert("Error al eliminar: " + e.message); }
  };

  const handleSaveParamsEspecie = async (especieId, params) => {
    try {
      await apiFetch("/parametros-especie", {
        method: "POST",
        body: JSON.stringify({ especie_id: especieId, ...params })
      });
      const paramRes = await apiFetch("/parametros-especie");
      setParametrosEspecie(paramRes);
    } catch (e) {
      console.error("Error guardando parámetros:", e);
    }
  };

  const reloadExportadoras = useCallback(async () => {
    const entRes = await apiFetch("/exportadoras");
    const processedEntities = entRes.map(e => {
      const especieNombre = String(e.especie || "").trim();
      const especieMatch = especies.find(esp => normalizeText(esp.nombre) === normalizeText(especieNombre));
      return {
        dbId: Number(e.id),
        id: Number(e.id),
        exportadora: e.nombre,
        especie: especieNombre,
        variedad: e.variedad || "",
        colorIdx: Number(e.color_idx || 0),
        especieId: e.especie_id != null ? Number(e.especie_id) : (especieMatch ? Number(especieMatch.id) : null),
        visibleLinea: Number(e.visible_linea ?? 1),
        label: [e.nombre, e.variedad].filter(Boolean).join(" ")
      };
    });
    setEntities(processedEntities);
    return processedEntities;
  }, [especies]);

  const reloadDatos = useCallback(async (processed = null) => {
    const sourceEntities = processed || entities;
    const dataRes = await apiFetch("/datos");
    const newData = {};
    for (const e of sourceEntities) {
      newData[e.id] = {};
      for (const d of DATES) {
        newData[e.id][d] = { cosecha: 0, curado: 0, proceso: 0 };
      }
    }

    dataRes.cosechas.forEach(row => {
      const eid = row.exportadora_id;
      const d = row.fecha;
      if (newData[eid]?.[d]) newData[eid][d].cosecha = row.bins;
    });
    dataRes.curado.forEach(row => {
      const eid = row.exportadora_id;
      const d = row.fecha;
      if (newData[eid]?.[d]) newData[eid][d].curado = row.bins;
    });
    dataRes.procesos.forEach(row => {
      const eid = row.exportadora_id;
      const d = row.fecha;
      if (newData[eid]?.[d]) newData[eid][d].proceso = row.bins;
    });

    setData(newData);
  }, [entities]);

  const handleToggleVisibleLinea = async (entityId, visible) => {
    try {
      const ent = entities.find(e => Number(e.id) === Number(entityId));
      if (!ent) throw new Error("Exportadora no encontrada");
      await apiFetch(`/exportadoras/${entityId}`, {
        method: "PUT",
        body: JSON.stringify({
          nombre: ent.exportadora,
          especie: ent.especie,
          especie_id: ent.especieId,
          variedad: ent.variedad,
          color_idx: ent.colorIdx,
          visible_linea: visible ? 1 : 0,
          activa: 1
        })
      });
      const processed = await reloadExportadoras();
      await reloadDatos(processed);
    } catch (e) {
      console.error("Error actualizando visibilidad:", e);
      alert("No se pudo actualizar la visibilidad en línea");
    }
  };

  const handleCreateExportadora = async () => {
    const nombre = String(newExportadora.nombre || "").trim();
    const variedad = String(newExportadora.variedad || "").trim();
    const especieId = Number(newExportadora.especie_id || 0);
    const especieSel = especies.find(esp => Number(esp.id) === especieId);
    const especie = String(especieSel?.nombre || "").trim();

    if (!nombre) {
      alert("Ingresa el nombre de la exportadora.");
      return;
    }

    if (!variedad) {
      alert("Ingresa la variedad.");
      return;
    }

    if (!especieId || !especie) {
      alert("Selecciona una especie.");
      return;
    }

    try {
      setSavingExportadora(true);
      const existente = entities.find(ent =>
        String(ent.exportadora || "").trim().toUpperCase() === nombre.toUpperCase() &&
        String(ent.variedad || "").trim().toUpperCase() === variedad.toUpperCase() &&
        String(ent.especie || "").trim().toUpperCase() === especie.toUpperCase()
      );

      if (existente) {
        alert("Ya existe una exportadora con esa combinación de especie y variedad.");
        return;
      }

      const payload = {
        nombre,
        especie,
        especie_id: especieId,
        variedad,
        color_idx: Number(newExportadora.color_idx || 0)
      };

      await apiFetch("/exportadoras", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const processed = await reloadExportadoras();
      await reloadDatos(processed);
      setNewExportadora({
        nombre: "",
        especie_id: String(especieId),
        variedad: "",
        color_idx: (entities.length || 0) % COLOR_PALETTE.length
      });
      alert("Exportadora agregada correctamente.");
    } catch (e) {
      console.error("Error creando exportadora:", e);
      alert("No se pudo crear la exportadora.");
    } finally {
      setSavingExportadora(false);
    }
  };

  const startEditCell = (section, entityId, fecha, currentValue) => {
    setEditingCell({ section, entityId, fecha });
    setEditingValue(String(currentValue ?? 0));
  };

  const cancelEditCell = () => {
    setEditingCell(null);
    setEditingValue("");
  };

  const saveEditCell = async () => {
    if (!editingCell || savingCell || !temporadaId) return;

    const endpointMap = {
      cosecha: "/datos/cosecha",
      curado: "/datos/curado",
      proceso: "/datos/proceso"
    };

    const endpoint = endpointMap[editingCell.section];
    if (!endpoint) return;

    try {
      setSavingCell(true);
      const binsGuardados = Number(editingValue || 0);
      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          exportadora_id: editingCell.entityId,
          temporada_id: temporadaId,
          fecha: editingCell.fecha,
          bins: binsGuardados
        })
      });
      // Auto-fill liberacion curado al guardar cosecha (solo si familia usa_curado=true)
      if (editingCell.section === "cosecha") {
        const entObj = entities.find(e => Number(e.id) === Number(editingCell.entityId));
        const famCurado = getFamiliaByEntity(entObj);
        if (famCurado?.usa_curado) {
          const horas = curadoHorasConfig[editingCell.entityId] ?? 48;
          const diasOffset = Math.round(horas / 24) + 1;
          const curadoFecha = addDays(editingCell.fecha, diasOffset);
          // Siempre actualizar curado, sin importar valor anterior ni si es 0
          if (DATES.includes(curadoFecha)) {
            try {
              await apiFetch("/datos/curado", {
                method: "POST",
                body: JSON.stringify({
                  exportadora_id: editingCell.entityId,
                  temporada_id: temporadaId,
                  fecha: curadoFecha,
                  bins: binsGuardados
                })
              });
            } catch (e2) { console.error("Error auto curado:", e2); }
          }
        }
      }
      await reloadDatos();
      cancelEditCell();
    } catch (e) {
      console.error("Error guardando celda:", e);
      alert("No se pudo guardar la celda");
    } finally {
      setSavingCell(false);
    }
  };

  const renderEditableCell = (section, ent, d, value) => {
    const isEditing = editingCell
      && editingCell.section === section
      && editingCell.entityId === ent.id
      && editingCell.fecha === d;

    return (
      <td
        key={d}
        style={{...S.td,...getDayStyle(d,holidays), cursor:"pointer", minWidth:54}}
        onClick={() => !isEditing && startEditCell(section, ent.id, d, value)}
        title={section === "proceso" && value > 0
          ? (() => {
              const p = getParametrosForEntity(ent, d);
              const bph = p.bins_por_hora || settings.bph || 18;
              const kpb = p.kg_por_bin || settings.kpb || 460;
              return `${(value / bph).toFixed(1)} hrs · ${Number(Math.round(value * kpb)).toLocaleString("es-CL")} kg`;
            })()
          : "Click para editar"}
      >
        {isEditing ? (
          <input
            autoFocus
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value.replace(/[^0-9-]/g, ""))}
            onClick={(e) => e.stopPropagation()}
            onBlur={saveEditCell}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEditCell();
              if (e.key === "Escape") cancelEditCell();
            }}
            style={{
              width: 42,
              background: "#0f2133",
              color: "#ffffff",
              border: "1px solid #93c5fd",
              borderRadius: 4,
              padding: "2px 4px",
              textAlign: "center",
              fontFamily: "inherit",
              fontSize: 11,
              outline: "none"
            }}
          />
        ) : fmtLinea(value)}
      </td>
    );
  };

  // RENDERIZAR LÍNEA DE TIEMPO CON PESTAÑAS


  const especiesActivasDashboard = useMemo(() => {
    return especies
      .filter(e => e.activa !== 0)
      .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));
  }, [especies]);

  const dashboardEntities = useMemo(() => {
    if (dashboardFamilias.has("all")) return entities;
    return entities.filter(ent => {
      const esp = especies.find(e => Number(e.id) === Number(ent.especieId));
      return esp && dashboardFamilias.has(Number(esp.familia_id));
    });
  }, [entities, dashboardFamilias, especies]);

  const getFamiliaByEntity = useCallback((ent) => {
    const especie = especies.find(e => Number(e.id) === Number(ent.especieId));
    if (!especie) return null;
    return familias.find(f => Number(f.id) === Number(especie.familia_id)) || null;
  }, [especies, familias]);

  const entityBelongsToFamilia = useCallback((ent, familiaId) => {
    if (!familiaId) return true;
    const familiaIdNum = Number(familiaId);
    const familia = familias.find(f => Number(f.id) === familiaIdNum);
    const especiesFamilia = especies.filter(e => Number(e.familia_id) === familiaIdNum);
    const nombresEspecies = especiesFamilia.map(e => normalizeText(e.nombre));

    if (ent.especieId != null) {
      const especie = especies.find(e => Number(e.id) === Number(ent.especieId));
      if (especie && Number(especie.familia_id) === familiaIdNum) return true;
    }

    const especieNorm = normalizeText(ent.especie);
    if (nombresEspecies.includes(especieNorm)) return true;
    if (nombresEspecies.some(n => n && (n.includes(especieNorm) || especieNorm.includes(n)))) return true;
    if (familia && especieNorm === normalizeText(familia.nombre)) return true;

    return false;
  }, [familias, especies]);

  const getTemporadaFamilia = useCallback((familiaId) => {
    const saved = temporadasFamilia[String(familiaId)] || temporadasFamilia[familiaId];
    const fallbackInicio = START;
    const fallbackFin = addDays(START, TOTAL_DAYS - 1);
    return {
      id: saved?.id ?? null,
      familia_id: saved?.familia_id != null ? Number(saved.familia_id) : Number(familiaId),
      fecha_inicio: saved?.fecha_inicio || fallbackInicio,
      fecha_fin: saved?.fecha_fin || fallbackFin,
      activa: Number(saved?.activa ?? 1)
    };
  }, [temporadasFamilia]);

  const getFechasFamilia = useCallback((familiaId) => {
    const temporada = getTemporadaFamilia(familiaId);
    return buildDateRange(temporada.fecha_inicio, temporada.fecha_fin);
  }, [getTemporadaFamilia]);

  const handleSaveTemporadaFamilia = async (familiaId, payload) => {
    if (!payload?.fecha_inicio || !payload?.fecha_fin) {
      alert("Debes indicar fecha inicio y fecha fin.");
      return;
    }
    if (payload.fecha_inicio > payload.fecha_fin) {
      alert("La fecha inicio no puede ser mayor que la fecha fin.");
      return;
    }
    try {
      const body = {
        familia_id: Number(familiaId),
        fecha_inicio: payload.fecha_inicio,
        fecha_fin: payload.fecha_fin,
        activa: 1
      };
      const saved = await apiFetch("/temporadas-familia", {
        method: "POST",
        body: JSON.stringify(body)
      });
      setTemporadasFamilia(prev => ({
        ...prev,
        [familiaId]: {
          id: saved?.id != null ? Number(saved.id) : (payload?.id ?? null),
          familia_id: Number(familiaId),
          fecha_inicio: normalizarFechaSql(saved?.fecha_inicio) || payload.fecha_inicio,
          fecha_fin: normalizarFechaSql(saved?.fecha_fin) || payload.fecha_fin,
          activa: Number(saved?.activa ?? 1)
        }
      }));
      if (Number(familiaActiva) === Number(familiaId)) {
        setLineaCargaRapida(prev => ({
          ...prev,
          fecha_desde: payload.fecha_inicio,
          fecha_hasta: payload.fecha_fin
        }));
      }
      alert("Temporada de la familia guardada.");
    } catch (e) {
      console.error("Error guardando temporada por familia:", e);
      alert("No se pudo guardar la temporada por familia.");
    }
  };

  const getParametrosForEntity = useCallback((ent, fecha = null) => {
    // normalizar fecha del parámetro dia en caso que venga con timestamp de SQL
    const normFecha = fecha ? (normalizarFechaSql(fecha) || fecha) : null;
    const paramsEspecie = parametrosEspecie.find(p => Number(p.especie_id) === Number(ent.especieId));
    const paramsStd = parametrosEspecie.find(p => p.especie_id == null);
    const params = paramsEspecie || paramsStd || {};
    const bphBase = Number(params.bins_por_hora ?? settings.bph ?? 18);
    let bphDia = null;
    if (fecha && parametrosDia.length > 0) {
      const varEnt = String(ent.variedad || "").trim().toUpperCase();
      const normP = pd => normalizarFechaSql(pd.fecha) || pd.fecha;
      const match =
        parametrosDia.find(p => normP(p) === normFecha && Number(p.exportadora_id) === Number(ent.id) && Number(p.especie_id) === Number(ent.especieId) && p.variedad && String(p.variedad).trim().toUpperCase() === varEnt) ||
        parametrosDia.find(p => normP(p) === normFecha && Number(p.exportadora_id) === Number(ent.id) && Number(p.especie_id) === Number(ent.especieId) && !p.variedad) ||
        parametrosDia.find(p => normP(p) === normFecha && Number(p.exportadora_id) === Number(ent.id) && !p.especie_id) ||
        parametrosDia.find(p => normP(p) === normFecha && !p.exportadora_id && Number(p.especie_id) === Number(ent.especieId)) ||
        parametrosDia.find(p => normP(p) === normFecha && !p.exportadora_id && !p.especie_id);
      if (match) bphDia = Number(match.bins_por_hora);
    }
    return {
      bins_por_hora: bphDia ?? bphBase,
      horas_por_dia: Number(params.horas_por_dia ?? settings.hpd ?? 16),
      kg_por_bin: Number(params.kg_por_bin ?? settings.kpb ?? 460),
    };
  }, [parametrosEspecie, parametrosDia, settings]);

  const projectionEntities = useMemo(() => {
    const visibles = entities
      .filter(ent => Number(ent.visibleLinea ?? 1) === 1)
      .sort((a, b) => String(a.label || a.exportadora || '').localeCompare(String(b.label || b.exportadora || ''), 'es'));
    return projectionEntityFilter === 'all'
      ? visibles
      : visibles.filter(ent => String(ent.id) === String(projectionEntityFilter));
  }, [entities, projectionEntityFilter]);

  const projectionTo = useMemo(() => {
    const days = Math.max(1, Number(projectionDays || 1));
    const candidate = addDays(projectionFrom || START, days - 1);
    const maxDate = DATES[DATES.length - 1];
    return candidate > maxDate ? maxDate : candidate;
  }, [projectionFrom, projectionDays]);

  const projectionDates = useMemo(() => {
    const from = projectionFrom || START;
    return DATES.filter(d => d >= from && d <= projectionTo);
  }, [projectionFrom, projectionTo]);

  const projectionMetrics = useMemo(() => {
    const rowMap = new Map();
    projectionDates.forEach(d => {
      rowMap.set(d, {
        fecha: d,
        label: fmtDate(d),
        dia: fmtDay(d),
        curado: 0,
        proceso: 0,
        balance: 0,
        horas: 0,
        kg_procesados: 0,
      });
    });

    projectionEntities.forEach(ent => {
      const familia = getFamiliaByEntity(ent);
      const usaCurado = Boolean(familia?.usa_curado);
      const params = getParametrosForEntity(ent);
      const fechasEntidad = familia?.id ? getFechasFamilia(familia.id) : DATES;
      let running = 0;

      fechasEntidad.forEach(d => {
        const day = data[ent.id]?.[d] || {};
        const cosecha = Number(day.cosecha || 0);
        const curado = Number(day.curado || 0);
        const proceso = Number(day.proceso || 0);

        running += usaCurado ? (curado - proceso) : (cosecha - proceso);

        if (rowMap.has(d)) {
          const row = rowMap.get(d);
          row.curado += curado;
          row.proceso += proceso;
          row.balance += running;
          row.horas += params.bins_por_hora > 0 ? proceso / params.bins_por_hora : 0;
          row.kg_procesados += proceso * params.kg_por_bin;
          row[ent.label || ent.exportadora] = running;
        }
      });
    });

    const rows = projectionDates.map(d => {
      const row = rowMap.get(d);
      projectionEntities.forEach(ent => {
        const key = ent.label || ent.exportadora;
        if (row[key] == null) row[key] = 0;
      });
      return row;
    });

    const bphProm = projectionEntities.length > 0
      ? projectionEntities.reduce((acc, ent) => {
          const p = getParametrosForEntity(ent);
          return acc + Number(p.bins_por_hora ?? settings.bph ?? 18);
        }, 0) / projectionEntities.length
      : (settings.bph ?? 18);

    const sundayCards = rows
      .filter(r => isSunday(r.fecha) && r.fecha >= TODAY)
      .slice(0, 5)
      .map(r => ({
        fecha: r.fecha,
        balance: r.balance,
        horasRestantes: bphProm > 0 ? r.balance / bphProm : 0,
        turnosRestantes: bphProm > 0 ? (r.balance / bphProm) / 9 : 0
      }));

    return { rows, sundayCards };
  }, [projectionDates, projectionEntities, getFamiliaByEntity, getParametrosForEntity, getFechasFamilia, data]);

  const renderProjection = () => {
    return (
      <div style={S.card}>
        <div style={S.sT}>PROYECCIÓN</div>

        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14,alignItems:'center'}}>
          <span style={{fontSize:10,color:'#64748b',letterSpacing:2}}>FILTRO:</span>
          <button
            onClick={() => setProjectionEntityFilter('all')}
            style={S.tab(projectionEntityFilter === 'all')}
          >
            TODAS
          </button>
          {entities
            .filter(ent => Number(ent.visibleLinea ?? 1) === 1)
            .sort((a, b) => String(a.label || a.exportadora || '').localeCompare(String(b.label || b.exportadora || ''), 'es'))
            .map(ent => (
              <button
                key={`proj_${ent.id}`}
                onClick={() => setProjectionEntityFilter(ent.id)}
                style={S.tab(String(projectionEntityFilter) === String(ent.id))}
              >
                {ent.label || ent.exportadora}
              </button>
            ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:14}}>
          <div>
            <label style={S.lbl}>Desde</label>
            <input
              type="date"
              value={projectionFrom}
              min={START}
              max={DATES[DATES.length - 1]}
              onChange={(e) => setProjectionFrom(e.target.value || START)}
              style={S.input}
            />
          </div>
          <div>
            <label style={S.lbl}>Días a mostrar</label>
            <input
              type="number"
              min="1"
              max={DATES.length}
              value={projectionDays}
              onChange={(e) => setProjectionDays(Math.max(1, Number(e.target.value || 1)))}
              style={S.input}
            />
          </div>
          <div>
            <label style={S.lbl}>Hasta</label>
            <input
              type="date"
              value={projectionTo}
              readOnly
              style={{...S.input, opacity:0.8}}
            />
          </div>
        </div>

        <div style={S.card}>
          <div style={S.sT}>BALANCE A LOS 5 DOMINGOS FUTUROS</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
            {projectionMetrics.sundayCards.length ? projectionMetrics.sundayCards.map(card => (
              <div key={`sun_${card.fecha}`} style={S.kpi}>
                <div style={{fontSize:10,color:'#64748b',letterSpacing:2}}>DOM {fmtDate(card.fecha)}</div>
                <div style={{fontSize:22,fontWeight:700,color:'#34d399',marginTop:8}}>{fmt(card.balance)}</div>
                <div style={{fontSize:10,color:'#64748b',letterSpacing:2}}>BINS EN BALANCE</div>
                <div style={{marginTop:8,borderTop:'1px solid #1e3a4c',paddingTop:6,display:'flex',flexDirection:'column',gap:3}}>
                  <div style={{fontSize:11,color:'#a78bfa'}}>
                    ≈ {card.horasRestantes.toFixed(1)} <span style={{color:'#64748b',fontSize:9}}>hrs proceso</span>
                  </div>
                  <div style={{fontSize:11,color:'#fb923c'}}>
                    ≈ {card.turnosRestantes.toFixed(1)} <span style={{color:'#64748b',fontSize:9}}>turnos de 9h</span>
                  </div>
                </div>
              </div>
            )) : (
              <div style={{color:'#64748b'}}>No hay domingos dentro del rango seleccionado.</div>
            )}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.sT}>BALANCE PROYECTADO</div>
          <div style={{width:'100%',height:260}}>
            <ResponsiveContainer>
              <AreaChart data={projectionMetrics.rows} margin={{top:10,right:20,left:0,bottom:0}}>
                <CartesianGrid stroke="#163041" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{fill:'#64748b',fontSize:10}} />
                <YAxis tick={{fill:'#64748b',fontSize:10}} />
                <Tooltip contentStyle={{background:'#0a141e',border:'1px solid #1e3a4c',borderRadius:6,color:'#e2e8f0'}} />
                <Legend wrapperStyle={{fontSize:11,color:"#1e293b"}} />
                {projectionEntities.map((ent, idx) => (
                  <Area
                    key={`proj_area_${ent.id}`}
                    type="monotone"
                    dataKey={ent.label || ent.exportadora}
                    stroke={entColor(ent)}
                    fill={entColor(ent)}
                    fillOpacity={0.1 + ((idx % 3) * 0.05)}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.sT}>TABLA PROYECCIÓN — {projectionDates.length} DÍAS</div>
          <div style={{overflowX:'auto'}}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.thL}>Día</th>
                  <th style={S.thL}>Fecha</th>
                  <th style={S.th}>Curado</th>
                  <th style={S.th}>Proceso</th>
                  <th style={S.th}>Balance</th>
                  <th style={S.th}>Horas</th>
                  <th style={S.th}>Kg procesados</th>
                </tr>
              </thead>
              <tbody>
                {projectionMetrics.rows.map(row => (
                  <tr key={`proj_row_${row.fecha}`}>
                    <td style={{...S.tdL, ...getDayStyle(row.fecha, holidays)}}>{row.dia}</td>
                    <td style={{...S.tdL, ...getDayStyle(row.fecha, holidays)}}>{fmtDate(row.fecha)}</td>
                    <td style={{...S.td, ...getDayStyle(row.fecha, holidays), color:'#a78bfa'}}>{row.curado ? fmt(row.curado) : '·'}</td>
                    <td style={{...S.td, ...getDayStyle(row.fecha, holidays), color:'#f59e0b'}}>{row.proceso ? fmt(row.proceso) : '·'}</td>
                    <td style={{...S.td, ...getDayStyle(row.fecha, holidays), color:'#34d399', fontWeight:700}}>{fmt(row.balance)}</td>
                    <td style={{...S.td, ...getDayStyle(row.fecha, holidays)}}>{row.horas ? Number(row.horas).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '·'}</td>
                    <td style={{...S.td, ...getDayStyle(row.fecha, holidays)}}>{row.kg_procesados ? Number(row.kg_procesados).toLocaleString('es-CL') : '·'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const dashboardMetrics = useMemo(() => {
    const chartRows = DATES_HOY.map(d => {
      const row = { fecha: d, label: fmtDate(d), curado: 0, proceso: 0, totalBalance: 0 };
      dashboardEntities.forEach(ent => {
        const day = data[ent.id]?.[d] || {};
        row.curado += Number(day.curado || 0);
        row.proceso += Number(day.proceso || 0);
      });
      return row;
    });

    const cards = [];
    let totalCosecha = 0;
    let totalCurado = 0;
    let totalProceso = 0;
    let totalBalanceHoy = 0;

    dashboardEntities.forEach(ent => {
      const familia = getFamiliaByEntity(ent);
      const usaCurado = Boolean(familia?.usa_curado);
      let cosecha = 0;
      let curado = 0;
      let proceso = 0;
      let runningBalance = 0;

      DATES_HOY.forEach(d => {
        const day = data[ent.id]?.[d] || {};
        cosecha += Number(day.cosecha || 0);
        curado += Number(day.curado || 0);
        proceso += Number(day.proceso || 0);
        runningBalance += usaCurado
          ? Number(day.curado || 0) - Number(day.proceso || 0)
          : Number(day.cosecha || 0) - Number(day.proceso || 0);

        const chartRow = chartRows.find(r => r.fecha === d);
        if (chartRow) {
          chartRow[ent.label || ent.exportadora] = runningBalance;
          chartRow.totalBalance += runningBalance;
        }
      });

      totalCosecha += cosecha;
      totalCurado += curado;
      totalProceso += proceso;
      totalBalanceHoy += runningBalance;

      cards.push({
        id: ent.id,
        title: [ent.exportadora, ent.especie, ent.variedad].filter(Boolean).join(' · '),
        color: entColor(ent),
        bg: entBg(ent),
        cosecha,
        curado,
        proceso,
        balance: runningBalance,
      });
    });

    chartRows.forEach(row => {
      dashboardEntities.forEach(ent => {
        const key = ent.label || ent.exportadora;
        if (row[key] == null) row[key] = 0;
      });
    });

    return {
      totals: {
        cosecha: totalCosecha,
        curado: totalCurado,
        proceso: totalProceso,
        balance: totalBalanceHoy,
      },
      cards,
      balanceSeries: chartRows,
      curadoProcesoSeries: chartRows.map(r => ({
        fecha: r.fecha,
        label: r.label,
        curado: r.curado,
        proceso: r.proceso,
      })),
    };
  }, [dashboardEntities, data, getFamiliaByEntity]);

  const renderDashboard = () => {
    return (
      <>
        <div style={S.card}>
          <div style={S.sT}>DASHBOARD</div>

          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14,alignItems:'center'}}>
            <button
              onClick={() => setDashboardFamilias(new Set(['all']))}
              style={S.tab(dashboardFamilias.has('all'))}
            >
              TODAS LAS FAMILIAS
            </button>
            {familias.filter(f => f.activa !== 0).sort((a,b) => (a.orden||0)-(b.orden||0)).map(fam => (
              <button
                key={fam.id}
                onClick={() => setDashboardFamilias(prev => {
                  const next = new Set(prev);
                  next.delete('all');
                  if (next.has(Number(fam.id))) {
                    next.delete(Number(fam.id));
                    if (next.size === 0) return new Set(['all']);
                  } else {
                    next.add(Number(fam.id));
                  }
                  return next;
                })}
                style={S.tab(dashboardFamilias.has(Number(fam.id)))}
              >
                {fam.nombre}
              </button>
            ))}
          </div>

          <div style={{fontSize:10,color:'#64748b',marginBottom:10}}>
            KPI globales calculados solo hasta fecha <span style={{color:'#38bdf8'}}>{fmtDate(TODAY)}</span>
          </div>

          <div style={S.card}>
            <div style={S.sT}>KPIs GLOBALES</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
              <div style={S.kpi}>
                <div style={{fontSize:18,fontWeight:700,color:'#38bdf8'}}>{fmt(dashboardMetrics.totals.cosecha)}</div>
                <div style={{fontSize:10,color:'#64748b',letterSpacing:2}}>BINS COSECHADOS</div>
              </div>
              <div style={S.kpi}>
                <div style={{fontSize:18,fontWeight:700,color:'#a78bfa'}}>{fmt(dashboardMetrics.totals.curado)}</div>
                <div style={{fontSize:10,color:'#64748b',letterSpacing:2}}>BINS EN CURADO</div>
              </div>
              <div style={S.kpi}>
                <div style={{fontSize:18,fontWeight:700,color:'#f59e0b'}}>{fmt(dashboardMetrics.totals.proceso)}</div>
                <div style={{fontSize:10,color:'#64748b',letterSpacing:2}}>BINS PROCESADOS</div>
              </div>
              <div style={S.kpi}>
                <div style={{fontSize:18,fontWeight:700,color:'#34d399'}}>{fmt(dashboardMetrics.totals.balance)}</div>
                <div style={{fontSize:10,color:'#64748b',letterSpacing:2}}>BALANCE HOY</div>
              </div>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sT}>BALANCE POR EXPORTADORA</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12}}>
              {dashboardMetrics.cards.length ? dashboardMetrics.cards.map(card => (
                <div key={card.id} style={{background:card.bg,border:`1px solid ${card.color}`,borderRadius:6,padding:12}}>
                  <div style={{color:card.color,fontWeight:700,marginBottom:10,textTransform:'uppercase'}}>{card.title}</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>
                    <div>
                      <div style={{fontSize:22,color:'#e2e8f0',fontWeight:700}}>{fmt(card.cosecha)}</div>
                      <div style={{fontSize:10,color:'#64748b'}}>COSECHA</div>
                    </div>
                    <div>
                      <div style={{fontSize:22,color:'#a78bfa',fontWeight:700}}>{fmt(card.curado)}</div>
                      <div style={{fontSize:10,color:'#64748b'}}>CURADO</div>
                    </div>
                    <div>
                      <div style={{fontSize:22,color:'#f59e0b',fontWeight:700}}>{fmt(card.proceso)}</div>
                      <div style={{fontSize:10,color:'#64748b'}}>PROCESO</div>
                    </div>
                    <div>
                      <div style={{fontSize:22,color:'#34d399',fontWeight:700}}>{fmt(card.balance)}</div>
                      <div style={{fontSize:10,color:'#64748b'}}>BALANCE</div>
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{color:'#64748b'}}>No hay exportadoras para la especie seleccionada.</div>
              )}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sT}>BALANCE ACUMULADO</div>
            <div style={{width:'100%',height:320}}>
              <ResponsiveContainer>
                <AreaChart data={dashboardMetrics.balanceSeries} margin={{top:10,right:20,left:0,bottom:0}}>
                  <CartesianGrid stroke="#163041" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{fill:'#64748b',fontSize:10}} />
                  <YAxis tick={{fill:'#64748b',fontSize:10}} />
                  <Tooltip
                    contentStyle={{background:'#0a141e',border:'1px solid #1e3a4c',borderRadius:6,color:'#e2e8f0'}}
                    labelStyle={{color:'#38bdf8'}}
                  />
                  <Legend wrapperStyle={{fontSize:11,color:"#1e293b"}} />
                  {dashboardEntities.map((ent, idx) => (
                    <Area
                      key={ent.id}
                      type="monotone"
                      dataKey={ent.label || ent.exportadora}
                      stroke={entColor(ent)}
                      fill={entColor(ent)}
                      fillOpacity={0.12 + ((idx % 3) * 0.05)}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sT}>CURADO VS PROCESO</div>
            <div style={{width:'100%',height:260}}>
              <ResponsiveContainer>
                <BarChart data={dashboardMetrics.curadoProcesoSeries} margin={{top:10,right:20,left:0,bottom:0}}>
                  <CartesianGrid stroke="#163041" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{fill:'#64748b',fontSize:10}} />
                  <YAxis tick={{fill:'#64748b',fontSize:10}} />
                  <Tooltip contentStyle={{background:'#0a141e',border:'1px solid #1e3a4c',borderRadius:6,color:'#e2e8f0'}} />
                  <Legend wrapperStyle={{fontSize:11,color:"#1e293b"}} />
                  <Bar dataKey="curado" name="Curado" fill="#a78bfa" radius={[4,4,0,0]} />
                  <Bar dataKey="proceso" name="Proceso" fill="#f59e0b" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </>
    );
  };
  useEffect(() => {
    if (!familiaActiva) return;
    const temporadaFam = getTemporadaFamilia(familiaActiva);
    setLineaCargaRapida(prev => ({
      ...prev,
      fecha_desde: temporadaFam.fecha_inicio,
      fecha_hasta: temporadaFam.fecha_fin
    }));
  }, [familiaActiva, getTemporadaFamilia]);

  useEffect(() => {
    if (!familiaActiva || operacionVista !== "curado") return;
    const familia = familias.find(f => Number(f.id) === Number(familiaActiva));
    if (familia && !familia.usa_curado) {
      setOperacionVista("resumen");
    }
  }, [familiaActiva, familias, operacionVista]);

  const OPERACION_VISTAS = [
    { id: "resumen", label: "Resumen" },
    { id: "cosecha", label: "Cosecha" },
    { id: "curado", label: "Curado" },
    { id: "proceso", label: "Proceso" },
    { id: "balance", label: "Balance" }
  ];

  const renderLineaTiempoConPestanas = () => {
    if (!familias.length) return <div>Cargando familias...</div>;

    return (
      <>
        {/* Pestañas de familias */}
        <div style={{
          display: "flex", 
          gap: 8, 
          marginBottom: 12,
          borderBottom: "1px solid #1e3a4c",
          paddingBottom: 8
        }}>
          {familias.map(fam => (
            <button
              key={fam.id}
              onClick={() => setFamiliaActiva(Number(fam.id))}
              style={{
                ...S.tab(familiaActiva === fam.id),
                textTransform: "uppercase"
              }}
            >
              {fam.nombre}
            </button>
          ))}
        </div>

        <div style={{ ...S.card, marginTop: 8 }}>
          <div style={S.sT}>Carga rápida en operación</div>
          {familiaActiva && (() => {
            const tFam = getTemporadaFamilia(familiaActiva);
            return (
              <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 10 }}>
                Ventana visible de la familia activa: <span style={{ color: "#2563eb" }}>{tFam.fecha_inicio}</span> a <span style={{ color: "#2563eb" }}>{tFam.fecha_fin}</span>
              </div>
            );
          })()}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <div>
              <label style={S.lbl}>Exportadora</label>
              <select
                value={lineaCargaRapida.exportadora_id}
                onChange={(e) => setLineaCargaRapida({ ...lineaCargaRapida, exportadora_id: e.target.value })}
                style={S.input}
              >
                <option value="">Selecciona exportadora</option>
                {entities
                  .filter(ent => Number(ent.visibleLinea ?? 1) === 1)
                  .filter(ent => entityBelongsToFamilia(ent, familiaActiva))
                  .sort((a, b) => (a.label || "").localeCompare(b.label || ""))
                  .map(ent => (
                    <option key={ent.id} value={ent.id}>
                      {ent.label || ent.exportadora}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label style={S.lbl}>Sección</label>
              <select
                value={lineaCargaRapida.seccion}
                onChange={(e) => setLineaCargaRapida({ ...lineaCargaRapida, seccion: e.target.value })}
                style={S.input}
              >
                <option value="cosecha">Cosecha</option>
                <option value="curado">Curado</option>
                <option value="proceso">Proceso</option>
              </select>
            </div>

            <div>
              <label style={S.lbl}>Desde</label>
              <input
                type="date"
                value={lineaCargaRapida.fecha_desde}
                onChange={(e) => setLineaCargaRapida({ ...lineaCargaRapida, fecha_desde: e.target.value })}
                style={S.input}
              />
            </div>

            <div>
              <label style={S.lbl}>Hasta</label>
              <input
                type="date"
                value={lineaCargaRapida.fecha_hasta}
                onChange={(e) => setLineaCargaRapida({ ...lineaCargaRapida, fecha_hasta: e.target.value })}
                style={S.input}
              />
            </div>

            <div>
              <label style={S.lbl}>Bins</label>
              <input
                type="number"
                min="0"
                value={lineaCargaRapida.bins}
                onChange={(e) => setLineaCargaRapida({ ...lineaCargaRapida, bins: e.target.value })}
                style={S.input}
                placeholder="0"
              />
            </div>

            <button
              style={S.btn()}
              onClick={handleCargaRapidaLinea}
              disabled={savingCargaRapida}
            >
              {savingCargaRapida ? "Guardando..." : "+ CARGAR"}
            </button>
          </div>
          <div style={{ color: "#64748b", fontSize: 10, marginTop: 8 }}>
            Sirve para poblar rápido una exportadora nueva en cosecha, curado o proceso durante un rango de fechas.
          </div>
        </div>

        <div style={{ ...S.card, marginTop: 8 }}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:10,color:"#64748b",letterSpacing:2}}>VISTA:</span>
            {OPERACION_VISTAS
              .filter(v => v.id !== "curado" || Boolean(familias.find(f => Number(f.id) === Number(familiaActiva))?.usa_curado))
              .map(v => (
                <button
                  key={v.id}
                  onClick={() => setOperacionVista(v.id)}
                  style={S.tab(operacionVista === v.id)}
                >
                  {v.label.toUpperCase()}
                </button>
              ))}
          </div>
        </div>

        {/* Tabla filtrada por familia */}
        {renderTablaLineaTiempo(familiaActiva, operacionVista)}
      </>
    );
  };

  const renderTablaLineaTiempo = (familiaId, vistaOperacion = "resumen") => {
    const familia = familias.find(f => Number(f.id) === Number(familiaId));
    if (!familia) return null;

    const fechasFamilia = getFechasFamilia(familiaId);
    const especiesDeFamilia = especies.filter(e => Number(e.familia_id) === Number(familiaId));
    const exportadorasFiltradas = entities.filter(ent => Number(ent.visibleLinea ?? 1) === 1 && entityBelongsToFamilia(ent, familiaId));

    const usaCurado = familia.usa_curado;
    const mostrarResumen = vistaOperacion === "resumen";
    const mostrarCosecha = mostrarResumen || vistaOperacion === "cosecha";
    const mostrarCurado = usaCurado && (mostrarResumen || vistaOperacion === "curado");
    const mostrarProceso = mostrarResumen || vistaOperacion === "proceso";
    const mostrarBalance = mostrarResumen || vistaOperacion === "balance";
    const stickyLeftStyle = {
      position: "sticky",
      left: 0,
      zIndex: 3,
      background: "#ffffff",
      minWidth: 165,
      maxWidth: 165,
      boxShadow: "2px 0 0 #0f1e2c"
    };
    const stickySectionStyle = {
      ...stickyLeftStyle,
      zIndex: 4,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 1,
      background: "#0a1424"
    };

    const balancePorExportadora = {};
    exportadorasFiltradas.forEach(ent => {
      let running = 0;
      balancePorExportadora[ent.id] = {};
      fechasFamilia.forEach(d => {
        const row = data[ent.id]?.[d] || {};
        running = usaCurado
          ? running + (row.curado || 0) - (row.proceso || 0)
          : running + (row.cosecha || 0) - (row.proceso || 0);
        balancePorExportadora[ent.id][d] = running;
      });
    });

    const totalBalancePorDia = {};
    fechasFamilia.forEach(d => {
      totalBalancePorDia[d] = exportadorasFiltradas.reduce(
        (acc, ent) => acc + (balancePorExportadora[ent.id]?.[d] || 0),
        0
      );
    });

    const renderSectionHeader = (label, color) => (
      <tr style={{ background: "#0a1424" }}>
        <td style={{ ...S.tdL, ...stickySectionStyle, color }}>{label}</td>
        <td style={{ ...S.td, position: "sticky", left: 165, zIndex: 4, background: "#0a1424", minWidth: 80, maxWidth: 80 }}></td>
        {fechasFamilia.map(d => (
          <td key={`${label}_${d}`} style={{ ...S.td, ...getDayStyle(d, holidays), background: getDayStyle(d, holidays).background || "#0a1424" }} />
        ))}
      </tr>
    );

    return (
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 180px)", border: "1px solid #102235", borderRadius: 6 }}>
        {exportadorasFiltradas.length === 0 && (
          <div style={{ padding: 12, color: "#94a3b8", borderBottom: "1px solid #102235" }}>
            No hay exportadoras visibles en esta familia todavía. Puedes agregarla en Config &gt; Visibilidad y luego cargar bins desde el formulario de arriba.
          </div>
        )}
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.thL, position: "sticky", left: 0, top: 0, zIndex: 6, background: "#0d1b27", minWidth: 165, maxWidth: 165, boxShadow: "1px 0 0 #1e3a4c" }}>
                Exportadora
              </th>
              <th style={{ ...S.th, position: "sticky", left: 165, top: 0, zIndex: 6, background: "#0d1b27", minWidth: 80, maxWidth: 80, boxShadow: "2px 0 0 #1e3a4c", lineHeight: 1.6 }}>
                <div style={{color:"#38bdf8",fontSize:9}}>COS</div>
                <div style={{color:"#a78bfa",fontSize:9}}>CUR</div>
                <div style={{color:"#34d399",fontSize:9}}>PRO</div>
              </th>
              {fechasFamilia.map(d => (
                <th key={d} style={{ ...S.th, ...getHdrStyle(d, holidays), position: "sticky", top: 0, zIndex: 5 }}>
                  <div>{fmtDate(d)}</div>
                  <div style={{ fontSize: 9, color: "#64748b" }}>{fmtDay(d)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mostrarCosecha && renderSectionHeader("COSECHA", "#38bdf8")}
            {mostrarCosecha && exportadorasFiltradas.map(ent => (
              <tr key={`cosecha_${ent.id}`}>
                <td style={{ ...S.tdL, ...stickyLeftStyle }}>
                  <span style={{ color: entColor(ent) }}>{ent.label || ent.exportadora}</span>
                </td>
                <td style={{ ...S.td, position: "sticky", left: 165, zIndex: 2, background: "#0a141e", minWidth: 80, maxWidth: 80, boxShadow: "2px 0 0 #1e3a4c", fontWeight: 700, fontSize: 10, color: "#38bdf8" }}>
                  {fmt(fechasFamilia.reduce((acc,d)=>acc+(data[ent.id]?.[d]?.cosecha||0),0))||"-"}
                </td>
                {fechasFamilia.map(d => renderEditableCell("cosecha", ent, d, data[ent.id]?.[d]?.cosecha))}
              </tr>
            ))}
            {mostrarCosecha && <tr style={{ background: "#071020" }}>
              <td style={{ ...S.tdL, ...stickyLeftStyle, color: "#38bdf8", fontWeight: 700, fontSize: 10, letterSpacing: 1 }}>TOTAL COSECHA</td>
              <td style={{ ...S.td, position: "sticky", left: 165, zIndex: 2, background: "#0a141e", minWidth: 80, maxWidth: 80, boxShadow: "2px 0 0 #1e3a4c", fontWeight: 700, fontSize: 10, color: "#38bdf8" }}> </td>
              {fechasFamilia.map(d => {
                const tot = exportadorasFiltradas.reduce((acc, ent) => acc + (data[ent.id]?.[d]?.cosecha || 0), 0);
                return <td key={d} style={{ ...S.td, ...getDayStyle(d, holidays), fontWeight: 700, color: "#38bdf8" }}>{tot > 0 ? fmt(tot) : "-"}</td>;
              })}
            </tr>}

            {mostrarCurado && (
              <>
                {renderSectionHeader("LIBERACIÓN CURADO", "#a78bfa")}
                {exportadorasFiltradas.map(ent => (
                  <tr key={`curado_${ent.id}`}>
                    <td style={{ ...S.tdL, ...stickyLeftStyle }}>
                      <span style={{ color: entColor(ent) }}>{ent.label || ent.exportadora}</span>
                    </td>
                    <td style={{ ...S.td, position: "sticky", left: 165, zIndex: 2, background: "#0a141e", minWidth: 80, maxWidth: 80, boxShadow: "2px 0 0 #1e3a4c", fontWeight: 700, fontSize: 10, color: "#a78bfa" }}>
                      {fmt(fechasFamilia.reduce((acc,d)=>acc+(data[ent.id]?.[d]?.curado||0),0))||"-"}
                    </td>
                    {fechasFamilia.map(d => renderEditableCell("curado", ent, d, data[ent.id]?.[d]?.curado))}
                  </tr>
                ))}
                <tr style={{ background: "#071020" }}>
                  <td style={{ ...S.tdL, ...stickyLeftStyle, color: "#a78bfa", fontWeight: 700, fontSize: 10, letterSpacing: 1 }}>TOTAL CURADO</td>
                  <td style={{ ...S.td, position: "sticky", left: 165, zIndex: 2, background: "#0a141e", minWidth: 80, maxWidth: 80, boxShadow: "2px 0 0 #1e3a4c", fontWeight: 700, fontSize: 10, color: "#a78bfa" }}> </td>
                  {fechasFamilia.map(d => {
                    const tot = exportadorasFiltradas.reduce((acc, ent) => acc + (data[ent.id]?.[d]?.curado || 0), 0);
                    return <td key={d} style={{ ...S.td, ...getDayStyle(d, holidays), fontWeight: 700, color: "#a78bfa" }}>{tot > 0 ? fmt(tot) : "-"}</td>;
                  })}
                </tr>
              </>
            )}

            {mostrarProceso && renderSectionHeader("PROCESO", "#34d399")}
            {mostrarProceso && exportadorasFiltradas.map(ent => (
              <tr key={`proceso_${ent.id}`}>
                <td style={{ ...S.tdL, ...stickyLeftStyle }}>
                  <span style={{ color: entColor(ent) }}>{ent.label || ent.exportadora}</span>
                </td>
                <td style={{ ...S.td, position: "sticky", left: 165, zIndex: 2, background: "#0a141e", minWidth: 80, maxWidth: 80, boxShadow: "2px 0 0 #1e3a4c" }}></td>
                {fechasFamilia.map(d => renderEditableCell("proceso", ent, d, data[ent.id]?.[d]?.proceso))}
              </tr>
            ))}
            {mostrarProceso && <tr style={{ background: "#071020" }}>
              <td style={{ ...S.tdL, ...stickyLeftStyle, color: "#34d399", fontWeight: 700, fontSize: 10, letterSpacing: 1 }}>TOTAL PROCESO</td>
              <td style={{ ...S.td, position: "sticky", left: 165, zIndex: 2, background: "#071020", minWidth: 80, maxWidth: 80, boxShadow: "2px 0 0 #1e3a4c" }}></td>
              {fechasFamilia.map(d => {
                const tot = exportadorasFiltradas.reduce((acc, ent) => acc + (data[ent.id]?.[d]?.proceso || 0), 0);
                const kgTot = exportadorasFiltradas.reduce((acc, ent) => {
                  const params = getParametrosForEntity(ent, d);
                  return acc + (data[ent.id]?.[d]?.proceso || 0) * (params.kg_por_bin || settings.kpb || 460);
                }, 0);
                const horasTot = exportadorasFiltradas.reduce((acc, ent) => {
                  const params = getParametrosForEntity(ent, d);
                  const bph = params.bins_por_hora || settings.bph || 18;
                  return acc + (bph > 0 ? (data[ent.id]?.[d]?.proceso || 0) / bph : 0);
                }, 0);
                // bph efectivo del día: promedio ponderado por bins
                const bphDiaMostrar = (() => {
                  const entConProceso = exportadorasFiltradas.filter(ent => (data[ent.id]?.[d]?.proceso || 0) > 0);
                  if (!entConProceso.length) return settings.bph || 18;
                  const sumBph = entConProceso.reduce((acc, ent) => acc + (getParametrosForEntity(ent, d).bins_por_hora || settings.bph || 18), 0);
                  return sumBph / entConProceso.length;
                })();
                return (
                  <td key={d} style={{ ...S.td, ...getDayStyle(d, holidays), fontWeight: 700, color: "#34d399", lineHeight: 1.5 }}>
                    {tot > 0 ? (<>
                      <div style={{color:"#34d399"}}>{fmt(tot)}</div>
                      <div style={{color:"#64748b",fontSize:9}}>{(kgTot/1000).toFixed(1)}t</div>
                      <div style={{color:"#fb923c",fontSize:9}}>{horasTot.toFixed(1)}h · <span style={{color:"#a78bfa"}}>{bphDiaMostrar.toFixed(0)}bph</span></div>
                    </>) : "-"}
                  </td>
                );
              })}
            </tr>}

            {mostrarBalance && renderSectionHeader("BALANCE", "#fb923c")}
            {mostrarBalance && exportadorasFiltradas.map(ent => (
              <tr key={`balance_${ent.id}`}>
                <td style={{ ...S.tdL, ...stickyLeftStyle }}>
                  <span style={{ color: entColor(ent) }}>{ent.label || ent.exportadora}</span>
                </td>
                <td style={{ ...S.td, position: "sticky", left: 165, zIndex: 2, background: "#0a141e", minWidth: 80, maxWidth: 80, boxShadow: "2px 0 0 #1e3a4c", fontWeight: 700, fontSize: 10, color: "#fb923c" }}>
                  {fmtLinea(balancePorExportadora[ent.id]?.[TODAY] ?? 0)}
                </td>
                {fechasFamilia.map(d => (
                  <td
                    key={d}
                    style={{ ...S.td, ...getDayStyle(d, holidays) }}
                    className={balancePorExportadora[ent.id]?.[d] < 0 ? "balance-neg" : ""}
                  >
                    {fmtLinea(balancePorExportadora[ent.id]?.[d])}
                  </td>
                ))}
              </tr>
            ))}
            {mostrarBalance && <tr style={{ background: "#0a1424" }}>
              <td style={{ ...S.tdL, ...stickySectionStyle, color: "#d97706", background: "#0a1424", borderTop: "2px solid #d97706" }}>
                TOTAL BALANCE ACUM.
              </td>
              <td style={{ ...S.td, position: "sticky", left: 165, zIndex: 4, background: "#0a1424", minWidth: 80, maxWidth: 80, borderTop: "2px solid #d97706" }}></td>
              {fechasFamilia.map(d => {
                // Calcular tooltip para domingos
                const esDomingo = isSunday(d);
                let tooltipData = null;
                if (esDomingo) {
                  // Obtener los 7 días de la semana (lun-dom)
                  const semanaFechas = [];
                  for (let i = 6; i >= 0; i--) {
                    const f = addDays(d, -i);
                    if (fechasFamilia.includes(f)) semanaFechas.push(f);
                  }
                  // Inicio semana = balance acumulado del día anterior al lunes (o 0 si es el primer día)
                  const lunesDeSemana = semanaFechas[0];
                  const idxLunes = fechasFamilia.indexOf(lunesDeSemana);
                  const diaAnterior = idxLunes > 0 ? fechasFamilia[idxLunes - 1] : null;
                  const inicioSemana = diaAnterior != null ? totalBalancePorDia[diaAnterior] ?? 0 : 0;

                  // Sumar cosecha/curado y proceso de la semana por exportadora
                  let totalEntradaSemana = 0;
                  let totalProcesoSemana = 0;
                  const rowsPorExportadora = exportadorasFiltradas.map(ent => {
                    let entradaSemana = 0;
                    let procesoSemana = 0;
                    semanaFechas.forEach(f => {
                      const row = data[ent.id]?.[f] || {};
                      entradaSemana += usaCurado ? (row.curado || 0) : (row.cosecha || 0);
                      procesoSemana += (row.proceso || 0);
                    });
                    totalEntradaSemana += entradaSemana;
                    totalProcesoSemana += procesoSemana;
                    return {
                      ent,
                      inicioSem: diaAnterior != null ? (balancePorExportadora[ent.id]?.[diaAnterior] ?? 0) : 0,
                      entrada: entradaSemana,
                      proceso: procesoSemana,
                      finSem: balancePorExportadora[ent.id]?.[d] ?? 0
                    };
                  });

                  const finSemanaTotal = totalBalancePorDia[d] ?? 0;
                  const totalDisp = inicioSemana + totalEntradaSemana;
                  const pct = totalDisp > 0 ? Math.round((totalProcesoSemana / totalDisp) * 100) : 0;

                  tooltipData = {
                    semana: getWeekNumber(d),
                    inicioSemana,
                    entrada: totalEntradaSemana,
                    proceso: totalProcesoSemana,
                    totalDisp,
                    pct,
                    finSemana: finSemanaTotal,
                    rowsPorExportadora,
                    etiquetaEntrada: usaCurado ? "S. Curado" : "Cosechas"
                  };
                }

                return (
                  <td
                    key={`total_balance_${d}`}
                    style={{ ...S.td, ...getDayStyle(d, holidays), fontWeight: 700, color: "#d97706", borderTop: "2px solid #d97706", background: esDomingo ? "#1a0808" : holidays.includes(d) ? "#1a1008" : isToday(d) ? "#0e2030" : "#0a1424", position: "relative", cursor: esDomingo ? "pointer" : "default" }}
                    className={totalBalancePorDia[d] < 0 ? "balance-neg" : ""}
                  >
                    {fmtLinea(totalBalancePorDia[d])}
                    {esDomingo && tooltipData && (
                      <div className="sunday-tooltip" style={{
                        display: "none",
                        position: "absolute",
                        bottom: "calc(100% + 6px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 999,
                        background: "#ffffff",
                        border: "1px solid #2563eb",
                        borderRadius: 6,
                        padding: "10px 14px",
                        minWidth: 340,
                        boxShadow: "0 4px 24px rgba(0,0,0,0.7)",
                        pointerEvents: "none",
                        color: "#e2e8f0",
                        fontSize: 11,
                        fontWeight: 400,
                        textAlign: "left",
                        whiteSpace: "nowrap"
                      }}>
                        <div style={{color:"#2563eb",fontWeight:700,letterSpacing:2,marginBottom:8,fontSize:12}}>
                          BALANCE SEMANA {tooltipData.semana} — DOM {fmtDate(d)}
                        </div>
                        {/* Tabla por exportadora */}
                        <table style={{width:"100%",borderCollapse:"collapse",marginBottom:8,fontSize:10}}>
                          <thead>
                            <tr>
                              <th style={{textAlign:"left",color:"#64748b",paddingBottom:4,paddingRight:8}}>Exportadora</th>
                              <th style={{textAlign:"right",color:"#64748b",paddingBottom:4,paddingRight:8}}>Inicio sem.</th>
                              <th style={{textAlign:"right",color:"#64748b",paddingBottom:4,paddingRight:8}}>{tooltipData.etiquetaEntrada}</th>
                              <th style={{textAlign:"right",color:"#64748b",paddingBottom:4,paddingRight:8}}>Proceso</th>
                              <th style={{textAlign:"right",color:"#64748b",paddingBottom:4}}>%</th>
                              <th style={{textAlign:"right",color:"#64748b",paddingBottom:4,paddingLeft:8}}>Fin sem.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tooltipData.rowsPorExportadora.map(r => {
                              const dispEnt = r.inicioSem + r.entrada;
                              const pctEnt = dispEnt > 0 ? Math.round((r.proceso / dispEnt) * 100) : 0;
                              return (
                                <tr key={r.ent.id}>
                                  <td style={{paddingRight:8,color:entColor(r.ent),fontWeight:700}}>{r.ent.exportadora}</td>
                                  <td style={{textAlign:"right",paddingRight:8,color:"#1e293b"}}>{fmt(r.inicioSem)}</td>
                                  <td style={{textAlign:"right",paddingRight:8,color:usaCurado?"#7c3aed":"#2563eb"}}>{fmt(r.entrada)}</td>
                                  <td style={{textAlign:"right",paddingRight:8,color:"#d97706"}}>{r.proceso > 0 ? fmt(r.proceso) : "-"}</td>
                                  <td style={{textAlign:"right",color:"#64748b"}}>{r.proceso > 0 ? pctEnt+"%" : "0%"}</td>
                                  <td style={{textAlign:"right",paddingLeft:8,color:"#059669",fontWeight:700}}>{fmt(r.finSem)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {/* Fila TOTAL */}
                        <div style={{borderTop:"1px solid #334155",paddingTop:6,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                          <div>
                            <div style={{color:"#64748b",fontSize:9,letterSpacing:1}}>TOTAL DISP.</div>
                            <div style={{color:"#1e293b",fontWeight:700,fontSize:13}}>{fmt(tooltipData.totalDisp)}</div>
                          </div>
                          <div>
                            <div style={{color:"#64748b",fontSize:9,letterSpacing:1}}>PROCESO</div>
                            <div style={{color:"#d97706",fontWeight:700,fontSize:13}}>{fmt(tooltipData.proceso)}</div>
                            <div style={{color:"#64748b",fontSize:10}}>{tooltipData.pct}% uso línea</div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{color:"#64748b",fontSize:9,letterSpacing:1}}>SALDO DOM.</div>
                            <div style={{color:"#059669",fontWeight:700,fontSize:13}}>{fmt(tooltipData.finSemana)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>}
          </tbody>
        </table>
      </div>
    );
  };

  const guardarCalendarioTurnos = async () => {
    try {
      setSavingTurnos(true);

      const actualMap = {};
      Object.entries(asignacionesTurno).forEach(([key, value]) => {
        if (!Array.isArray(value) || value.length === 0) return;
        const [fecha, hora] = key.split('_');
        const ent = value[0];
        if (!fecha || !hora || !ent?.id) return;
        actualMap[key] = {
          fecha,
          hora_inicio: hora,
          exportadora_id: ent.id
        };
      });

      const dbMap = {};
      turnosSemanaDb.forEach(row => {
        const key = `${row.fecha}_${String(row.hora_inicio || "").substring(0, 5)}`;
        dbMap[key] = row;
      });

      const actualRestriccionesMap = {};
      Object.entries(restriccionesTurno).forEach(([key, value]) => {
        const [fecha, hora] = key.split('_');
        if (!fecha || !hora || !value?.id) return;
        actualRestriccionesMap[key] = {
          fecha,
          hora_inicio: hora,
          tipo_restriccion_id: value.id
        };
      });

      const dbRestriccionesMap = {};
      restriccionesSemanaDb.forEach(row => {
        const key = `${row.fecha}_${String(row.hora_inicio || "").substring(0, 5)}`;
        dbRestriccionesMap[key] = row;
      });

      const toDelete = turnosSemanaDb.filter(row => !actualMap[`${row.fecha}_${String(row.hora_inicio || "").substring(0, 5)}`]);
      for (const row of toDelete) {
        await apiFetch(`/turnos/${row.id}`, { method: "DELETE" });
      }

      const restriccionesToDelete = restriccionesSemanaDb.filter(row => !actualRestriccionesMap[`${row.fecha}_${String(row.hora_inicio || "").substring(0, 5)}`]);
      for (const row of restriccionesToDelete) {
        await apiFetch(`/turnos-restricciones/${row.id}`, { method: "DELETE" });
      }

      for (const [key, item] of Object.entries(actualMap)) {
        const dbRow = dbMap[key];
        if (!dbRow || String(dbRow.exportadora_id) !== String(item.exportadora_id)) {
          await apiFetch("/turnos", {
            method: "POST",
            body: JSON.stringify({
              fecha: item.fecha,
              hora_inicio: item.hora_inicio,
              exportadora_id: item.exportadora_id,
              semana: semanaSeleccionada,
              anio: anoSeleccionado
            })
          });
        }
      }

      for (const [key, item] of Object.entries(actualRestriccionesMap)) {
        const dbRow = dbRestriccionesMap[key];
        if (!dbRow || String(dbRow.tipo_restriccion_id) !== String(item.tipo_restriccion_id)) {
          await apiFetch("/turnos-restricciones", {
            method: "POST",
            body: JSON.stringify({
              fecha: item.fecha,
              hora_inicio: item.hora_inicio,
              tipo_restriccion_id: item.tipo_restriccion_id,
              semana: semanaSeleccionada,
              anio: anoSeleccionado
            })
          });
        }
      }

      await cargarTurnosSemana();
      alert("Calendario guardado correctamente.");
    } catch (e) {
      console.error("Error guardando calendario:", e);
      alert(`No se pudo guardar el calendario: ${e.message}`);
    } finally {
      setSavingTurnos(false);
    }
  };

  // PROGRAMA DE TURNOS - CALENDARIO VISUAL
  const renderProgramaTurnos = () => {
    const obtenerFechasSemana = (semana, ano) => {
      if (!semana || !ano || semana < 1 || semana > 53) {
        console.error('Semana o año inválidos:', semana, ano);
        return Array(7).fill(null).map((_, i) => addDays(TODAY, i));
      }

      const primerDia = new Date(ano, 0, 1);
      const diasHastaSemana = (semana - 1) * 7;
      const inicioSemana = new Date(primerDia);
      inicioSemana.setDate(primerDia.getDate() + diasHastaSemana - primerDia.getDay() + 1);

      const fechas = [];
      for (let i = 0; i < 7; i++) {
        const fecha = new Date(inicioSemana);
        fecha.setDate(fecha.getDate() + i);
        fechas.push(isNaN(fecha.getTime()) ? addDays(TODAY, i) : fecha.toISOString().split('T')[0]);
      }
      return fechas;
    };

    const fechasSemana = obtenerFechasSemana(semanaSeleccionada, anoSeleccionado);
    const diasSemana = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    const turnosOrdenados = turnosDefinicion.length > 0
      ? [...turnosDefinicion].sort((a, b) => (a.orden || 0) - (b.orden || 0))
      : [];

    const calcularBloquesHorarios = (fecha, exportadoraId) => {
      const bins = data[exportadoraId]?.[fecha]?.proceso || 0;
      if (bins === 0) return { bins: 0, horasNecesarias: 0, binsHora: settings.bph || 18 };

      const ent = entities.find(e => e.id === exportadoraId);
      const params = parametrosEspecie.find(p => p.especie_id === ent?.especieId) ||
                     parametrosEspecie.find(p => p.especie_id === null) ||
                     { bins_por_hora: settings.bph };

      const binsHora = Number(params.bins_por_hora || settings.bph || 18);
      const horasNecesarias = binsHora > 0 ? (bins / binsHora) : 0;
      return { bins, horasNecesarias, binsHora };
    };

    const generarHoras = () => {
      const primerTurno = turnosOrdenados[0] || null;
      const ultimoTurno = turnosOrdenados[turnosOrdenados.length - 1] || null;

      const toMinutes = (hhmm) => {
        if (!hhmm || typeof hhmm !== 'string') return null;
        const partes = hhmm.split(':');
        if (partes.length < 2) return null;
        const h = parseInt(partes[0], 10);
        const m = parseInt(partes[1], 10);
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        return h * 60 + m;
      };

      const toHHMM = (totalMinutes) => {
        const mins = ((totalMinutes % 1440) + 1440) % 1440;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      let minutoInicio = 8 * 60;
      let minutoFin = 24 * 60;

      if (primerTurno?.hora_inicio) {
        const mi = toMinutes(primerTurno.hora_inicio);
        if (mi !== null) minutoInicio = mi;
      }

      if (ultimoTurno?.hora_fin) {
        const mf = toMinutes(ultimoTurno.hora_fin);
        if (mf !== null) {
          minutoFin = mf;
          if (minutoFin <= minutoInicio) minutoFin += 1440;
        }
      }

      const marcas = new Set();
      let actual = minutoInicio;
      let seguridad = 0;

      while (actual <= minutoFin && seguridad < 500) {
        marcas.add(actual);
        actual += intervaloMinutos;
        seguridad++;
      }
      marcas.add(minutoFin);

      turnosOrdenados.forEach(turno => {
        [turno.hora_inicio, turno.hora_fin, turno.colacion_inicio, turno.colacion_fin].forEach(hora => {
          const minutos = toMinutes(hora);
          if (minutos === null) return;
          let minutoReal = minutos;
          if (minutoReal < minutoInicio) minutoReal += 1440;
          marcas.add(minutoReal);
        });
      });

      return [...marcas]
        .filter(min => min >= minutoInicio && min <= minutoFin)
        .sort((a, b) => a - b)
        .map(toHHMM);
    };

    const horas = generarHoras();

    const timeToMinuteExtended = (hora, anchor = 0) => {
      const min = timeToMin(hora);
      if (min == null) return null;
      return min < anchor ? min + 1440 : min;
    };

    const getHoraTurno = (hora) => {
      const min = timeToMinuteExtended(hora, timeToMin(turnosOrdenados[0]?.hora_inicio?.substring(0, 5) || '00:00'));
      for (const t of turnosOrdenados) {
        const ti = timeToMinuteExtended(String(t.hora_inicio || '').substring(0, 5), timeToMin(turnosOrdenados[0]?.hora_inicio?.substring(0, 5) || '00:00'));
        let tf = timeToMinuteExtended(String(t.hora_fin || '').substring(0, 5), timeToMin(turnosOrdenados[0]?.hora_inicio?.substring(0, 5) || '00:00'));
        if (ti == null || tf == null || min == null) continue;
        if (tf < ti) tf += 1440;
        if (min === tf || (min >= ti && min < tf)) return t;
      }
      return null;
    };

    const horasPorTurno = turnosOrdenados.map(turno => ({
      ...turno,
      horas: horas.filter(h => String(getHoraTurno(h)?.id) === String(turno.id))
    })).filter(t => t.horas.length > 0);

    const horasLibres = horas.filter(h => !getHoraTurno(h));

    const aplicarRangoMasivo = () => {
      const fechaObjetivo = bulkForm.fecha || fechasSemana[0];
      if (!bulkForm.exportadora_id || !fechaObjetivo || !bulkForm.hora_desde || !bulkForm.hora_hasta) {
        alert('Selecciona exportadora, día, hora desde y hora hasta.');
        return;
      }
      const ent = entities.find(e => String(e.id) === String(bulkForm.exportadora_id));
      if (!ent) {
        alert('No se encontró la exportadora seleccionada.');
        return;
      }
      const desde = timeToMin(bulkForm.hora_desde);
      const hasta = timeToMin(bulkForm.hora_hasta);
      setAsignacionesTurno(prev => {
        const next = { ...prev };
        horas.forEach(hora => {
          let minHora = timeToMin(hora);
          let minDesde = desde;
          let minHasta = hasta;
          if (minHasta < minDesde) {
            if (minHora < minDesde) minHora += 24 * 60;
            minHasta += 24 * 60;
          }
          if (minHora >= minDesde && minHora <= minHasta) next[`${fechaObjetivo}_${hora}`] = [ent];
        });
        return next;
      });
    };

    const handleDragStart = (e, tipo, data, fromKey = null) => {
      setDraggingItem({ tipo, data });
      setDraggingFrom(fromKey);
      e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, fecha, hora) => {
      e.preventDefault();
      if (!draggingItem) return;
      const key = `${fecha}_${hora}`;
      if (draggingItem.tipo === 'exportadora') {
        setAsignacionesTurno(prev => {
          const newState = { ...prev };
          if (draggingFrom) {
            newState[draggingFrom] = (newState[draggingFrom] || []).filter(item => item.id !== draggingItem.data.id);
            if (newState[draggingFrom].length === 0) delete newState[draggingFrom];
          }
          newState[key] = [{ ...draggingItem.data }];
          return newState;
        });
      } else if (draggingItem.tipo === 'restriccion') {
        setRestriccionesTurno(prev => {
          const newState = { ...prev };
          if (draggingFrom) delete newState[draggingFrom];
          newState[key] = draggingItem.data;
          return newState;
        });
      }
      setDraggingItem(null);
      setDraggingFrom(null);
    };

    const handleEliminarAsignacion = (key, exportadoraId) => {
      setAsignacionesTurno(prev => {
        const newState = { ...prev };
        newState[key] = (newState[key] || []).filter(item => item.id !== exportadoraId);
        if (newState[key].length === 0) delete newState[key];
        return newState;
      });
    };

    const handleEliminarRestriccion = (key) => {
      setRestriccionesTurno(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    };

    const exportarAImagen = async () => {
      const elemento = document.getElementById('programa-turnos');
      if (!elemento) return;
      try {
        if (window.html2canvas) {
          const canvas = await window.html2canvas(elemento, { scale: 2, backgroundColor: '#f8fafc' });
          const link = document.createElement('a');
          link.download = `programa-turnos-semana-${semanaSeleccionada}.png`;
          link.href = canvas.toDataURL();
          link.click();
        } else {
          alert('Instalando librería html2canvas...\nRecarga la página después de aceptar.');
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          document.head.appendChild(script);
        }
      } catch (e) {
        console.error('Error exportando imagen:', e);
        alert('Error al exportar. Usa imprimir y guardar como PDF.');
      }
    };

    const imprimirPrograma = () => window.print();

    const handleLimpiarCalendario = () => {
      if (window.confirm('¿Estás seguro de que quieres limpiar todo el calendario? Esta acción no se puede deshacer.')) {
        setAsignacionesTurno({});
        setRestriccionesTurno({});
      }
    };

    const entitiesVisibles = entities.filter(e => Number(e.visibleLinea) === 1);
    const entitiesFiltradasPanel = filtroExportadora === 'todos'
      ? entitiesVisibles
      : entitiesVisibles.filter(ent => String(ent.id) === String(filtroExportadora));

    const resumenExportadoras = entitiesVisibles.map(ent => {
      const bloques = fechasSemana.map(f => calcularBloquesHorarios(f, ent.id));
      const bins = bloques.reduce((sum, b) => sum + Number(b.bins || 0), 0);
      const horasReq = bloques.reduce((sum, b) => sum + Number(b.horasNecesarias || 0), 0);
      const horasAsign = Object.entries(asignacionesTurno).reduce((acc, [key, value]) => {
        const [fecha, hora] = key.split('_');
        if (!fechasSemana.includes(fecha)) return acc;
        const asign = Array.isArray(value) ? value : [];
        if (asign.some(item => String(item.id) === String(ent.id))) return acc + (intervaloMinutos / 60);
        return acc;
      }, 0);
      const horasFaltan = Math.max(horasReq - horasAsign, 0);
      return { ent, bins, horasReq, horasAsign, horasFaltan };
    }).sort((a, b) => b.bins - a.bins || a.ent.label.localeCompare(b.ent.label, 'es'));

    const totalBinsSemana = resumenExportadoras.reduce((acc, item) => acc + item.bins, 0);
    const totalHorasReq = resumenExportadoras.reduce((acc, item) => acc + item.horasReq, 0);
    const totalHorasAsign = resumenExportadoras.reduce((acc, item) => acc + item.horasAsign, 0);
    const totalHorasFaltan = Math.max(totalHorasReq - totalHorasAsign, 0);
    const cobertura = totalHorasReq > 0 ? Math.min((totalHorasAsign / totalHorasReq) * 100, 100) : 100;

    const compactInput = { ...S.input, height: 30, padding: '4px 8px', fontSize: 11, borderRadius: 4 };
    const compactButton = (c = '#2563eb', bg = '#eff6ff') => ({ ...S.btn(c, bg), padding: '4px 10px', fontSize: 10, borderRadius: 4 });
    const panelStyle = { background: '#ffffff', border: '1px solid #cfe0f4', borderRadius: 8, padding: 10, marginBottom: 10 };

    const renderTurnoSection = (turno, idxColor = 0) => {
      const horasTurno = turno.horas || [];
      const turnoColor = idxColor % 2 === 0 ? '#234b9a' : '#0d5b4a';
      const turnoFondo = idxColor % 2 === 0 ? '#f3f7ff' : '#eefbf7';
      const exportadorasTurno = resumenExportadoras
        .map(item => {
          const horasAsign = Object.entries(asignacionesTurno).reduce((acc, [key, value]) => {
            const [fecha, hora] = key.split('_');
            if (!fechasSemana.includes(fecha) || !horasTurno.includes(hora)) return acc;
            const asign = Array.isArray(value) ? value : [];
            if (asign.some(a => String(a.id) === String(item.ent.id))) return acc + (intervaloMinutos / 60);
            return acc;
          }, 0);
          return { ...item, horasAsignTurno: horasAsign };
        })
        .filter(item => item.bins > 0 || item.horasAsignTurno > 0);

      const binsTurno = exportadorasTurno.reduce((acc, item) => acc + item.bins, 0);
      const horasAsignTurno = exportadorasTurno.reduce((acc, item) => acc + item.horasAsignTurno, 0);
      const coberturaTurno = totalHorasReq > 0 ? Math.min((horasAsignTurno / totalHorasReq) * 100, 100) : 100;

      return (
        <div key={`turno_block_${turno.id}`} style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{
            background: turnoColor,
            color: '#fff',
            padding: '8px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap'
          }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.9 }}>PLANIFICACIÓN SEMANAL</div>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{turno.nombre}</div>
              <div style={{ fontSize: 11, opacity: 0.95 }}>
                {String(turno.hora_inicio || '').substring(0,5)} - {String(turno.hora_fin || '').substring(0,5)}
                {turno.colacion_inicio ? ` · Colación ${String(turno.colacion_inicio || '').substring(0,5)}-${String(turno.colacion_fin || '').substring(0,5)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 6, padding: '6px 10px', minWidth: 90 }}>
                <div style={{ fontSize: 9, opacity: 0.8 }}>Bins estimados</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(binsTurno)}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 6, padding: '6px 10px', minWidth: 90 }}>
                <div style={{ fontSize: 9, opacity: 0.8 }}>Horas asig.</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{horasAsignTurno.toFixed(1)}h</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 6, padding: '6px 10px', minWidth: 90 }}>
                <div style={{ fontSize: 9, opacity: 0.8 }}>Cobertura</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{Math.round(coberturaTurno)}%</div>
              </div>
            </div>
          </div>

          <div style={{ padding: 10, background: turnoFondo, borderBottom: '1px solid #d7e3f2' }}>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2, marginBottom: 6 }}>EXPORTADORAS A PROGRAMAR EN ESTE TURNO</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 8 }}>
              {exportadorasTurno.length ? exportadorasTurno.map(item => {
                const porcentaje = item.horasReq > 0 ? Math.min((item.horasAsignTurno / item.horasReq) * 100, 100) : 0;
                return (
                  <div key={`turno_res_${turno.id}_${item.ent.id}`} style={{ background: '#fff', border: `1px solid ${entColor(item.ent)}55`, borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div style={{ color: entColor(item.ent), fontWeight: 700, fontSize: 11 }}>{item.ent.label || item.ent.exportadora}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{fmt(item.bins)} bins</div>
                    </div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                      Requiere {item.horasReq.toFixed(1)}h · asignada {item.horasAsignTurno.toFixed(1)}h · faltan {Math.max(item.horasReq - item.horasAsignTurno, 0).toFixed(1)}h
                    </div>
                    <div style={{ marginTop: 6, height: 6, background: '#dbe3ec', borderRadius: 999 }}>
                      <div style={{ width: `${porcentaje}%`, height: '100%', borderRadius: 999, background: entColor(item.ent) }} />
                    </div>
                  </div>
                );
              }) : <div style={{ color: '#64748b', fontSize: 11 }}>Sin exportadoras con bins estimados en este turno.</div>}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1250, fontSize: 10 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, minWidth: 80 }}>Hora</th>
                  {diasSemana.map((dia, idx) => (
                    <th
                      key={`turno_${turno.id}_${dia}`}
                      style={{
                        ...S.th,
                        background: idx === 6 ? '#f8e1e1' : '#dbe5f1',
                        color: '#0f172a',
                        borderBottom: '1px solid #cbd5e1',
                        minWidth: 160,
                        padding: '5px 6px'
                      }}
                    >
                      <div style={{ textTransform: 'capitalize', fontSize: 11, fontWeight: 700 }}>{dia}</div>
                      <div style={{ fontSize: 9, fontWeight: 400 }}>{fmtDate(fechasSemana[idx])}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horasTurno.map(hora => {
                  const horaEspecial = turnosOrdenados.some(turnoDef => [turnoDef.hora_inicio, turnoDef.hora_fin, turnoDef.colacion_inicio, turnoDef.colacion_fin].filter(Boolean).some(h => String(h).substring(0,5) === hora));
                  return (
                    <tr key={`row_${turno.id}_${hora}`}>
                      <td style={{
                        ...S.td,
                        background: horaEspecial ? turnoColor : '#f1f5f9',
                        color: horaEspecial ? '#fff' : '#0f172a',
                        fontWeight: 700,
                        minWidth: 78,
                        padding: '4px 6px',
                        borderBottom: '1px solid #d9e3ee'
                      }}>
                        {hora}
                      </td>
                      {fechasSemana.map(fecha => {
                        const key = `${fecha}_${hora}`;
                        const todasAsignaciones = asignacionesTurno[key] || [];
                        const asignaciones = filtroExportadora === 'todos'
                          ? todasAsignaciones
                          : todasAsignaciones.filter(ent => String(ent.id) === String(filtroExportadora));
                        const restriccion = restriccionesTurno[key];
                        return (
                          <td
                            key={`cell_${turno.id}_${fecha}_${hora}`}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, fecha, hora)}
                            style={{
                              ...S.td,
                              background: restriccion
                                ? `${restriccion.color}22`
                                : asignaciones.length > 0
                                  ? '#f8fbff'
                                  : '#ffffff',
                              borderBottom: '1px solid #e2e8f0',
                              borderRight: '1px solid #e2e8f0',
                              minHeight: 22,
                              padding: 2,
                              verticalAlign: 'top'
                            }}
                          >
                            {restriccion && (
                              <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, 'restriccion', restriccion, key)}
                                style={{
                                  fontSize: 10,
                                  color: restriccion.color,
                                  fontWeight: 700,
                                  background: '#fff',
                                  border: `1px solid ${restriccion.color}55`,
                                  borderRadius: 4,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '1px 4px',
                                  gap: 4
                                }}
                              >
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{restriccion.nombre}</span>
                                <span onClick={(e) => { e.stopPropagation(); handleEliminarRestriccion(key); }} style={{ cursor: 'pointer' }}>×</span>
                              </div>
                            )}
                            {asignaciones.map((ent, idx) => (
                              <div
                                key={`asg_${turno.id}_${fecha}_${hora}_${idx}`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, 'exportadora', ent, key)}
                                style={{
                                  fontSize: 10,
                                  color: entColor(ent),
                                  fontWeight: 700,
                                  background: '#ffffff',
                                  borderLeft: `3px solid ${entColor(ent)}`,
                                  borderRadius: 4,
                                  boxShadow: 'inset 0 0 0 1px #dbe5f0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '2px 4px',
                                  gap: 4,
                                  minHeight: 18
                                }}
                                title={`${ent.label || ent.exportadora}`}
                              >
                                <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ent.label || ent.exportadora}</div>
                                  <div style={{ fontSize: 9, color: '#64748b', fontWeight: 400 }}>
                                    {(data[ent.id]?.[fecha]?.proceso || 0) > 0 ? `${fmt(data[ent.id]?.[fecha]?.proceso || 0)} bins` : '0 bins'}
                                  </div>
                                </div>
                                <span onClick={(e) => { e.stopPropagation(); handleEliminarAsignacion(key, ent.id); }} style={{ cursor: 'pointer', color: '#94a3b8' }}>×</span>
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    const turnosMostrados = vistaTurnosPrograma === 'all'
      ? horasPorTurno
      : horasPorTurno.filter(t => String(t.id) === String(vistaTurnosPrograma));

    return (
      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ ...S.sT, marginBottom: 8 }}>PROGRAMA DE TURNOS</div>
        <div style={{ color: '#475569', fontSize: 11, marginBottom: 10 }}>
          Vista compacta para planta. Pensada para compartir por imagen con clientes y facilitar el armado semanal.
        </div>

        <div style={{ ...panelStyle, padding: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 8 }}>
            <div>
              <label style={{ ...S.lbl, marginTop: 0 }}>Semana</label>
              <input type="number" min="1" max="53" value={semanaSeleccionada} onChange={(e) => setSemanaSeleccionada(Number(e.target.value))} style={{ ...compactInput, width: 64 }} />
            </div>
            <div>
              <label style={{ ...S.lbl, marginTop: 0 }}>Año</label>
              <input type="number" value={anoSeleccionado} onChange={(e) => setAnoSeleccionado(Number(e.target.value))} style={{ ...compactInput, width: 74 }} />
            </div>
            <div>
              <label style={{ ...S.lbl, marginTop: 0 }}>Intervalo</label>
              <select value={intervaloMinutos} onChange={(e) => setIntervaloMinutos(Number(e.target.value))} style={{ ...compactInput, width: 94 }}>
                <option value="15">15 min</option>
                <option value="20">20 min</option>
                <option value="25">25 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </select>
            </div>
            <div>
              <label style={{ ...S.lbl, marginTop: 0 }}>Filtro</label>
              <select value={filtroExportadora} onChange={(e) => setFiltroExportadora(e.target.value)} style={{ ...compactInput, width: 170 }}>
                <option value="todos">Todas las exportadoras</option>
                {entitiesVisibles.map(ent => <option key={`flt_${ent.id}`} value={ent.id}>{ent.label || ent.exportadora}</option>)}
              </select>
            </div>
            <button style={compactButton('#16a34a', '#dcfce7')} onClick={guardarCalendarioTurnos} disabled={savingTurnos}>{savingTurnos ? 'GUARDANDO...' : '💾 GUARDAR'}</button>
            <button style={compactButton()} onClick={exportarAImagen}>📷 EXPORTAR</button>
            <button style={compactButton('#334155', '#f8fafc')} onClick={imprimirPrograma}>🖨️ IMPRIMIR</button>
            <button style={compactButton('#dc2626', '#fee2e2')} onClick={handleLimpiarCalendario}>🗑️ LIMPIAR</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={compactButton('#1d4ed8', vistaTurnosPrograma === 'all' ? '#dbeafe' : '#f8fafc')} onClick={() => setVistaTurnosPrograma('all')}>VER / IMPRIMIR AMBOS</button>
            {horasPorTurno.map(t => (
              <button key={`btn_turno_${t.id}`} style={compactButton('#1d4ed8', String(vistaTurnosPrograma) === String(t.id) ? '#dbeafe' : '#f8fafc')} onClick={() => setVistaTurnosPrograma(String(t.id))}>
                SOLO {String(t.nombre || '').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginBottom: 10 }}>
          <div style={{ ...panelStyle, borderColor: '#2563eb' }}>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2 }}>BINS ESTIMADOS SEMANA</div>
            <div style={{ fontSize: 34, color: '#2563eb', fontWeight: 700, lineHeight: 1, marginTop: 4 }}>{fmt(totalBinsSemana)}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{resumenExportadoras.filter(x => x.bins > 0).length} exportadoras con proceso</div>
          </div>
          <div style={{ ...panelStyle, borderColor: '#7c3aed' }}>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2 }}>HORAS REQUERIDAS</div>
            <div style={{ fontSize: 34, color: '#7c3aed', fontWeight: 700, lineHeight: 1, marginTop: 4 }}>{totalHorasReq.toFixed(1)}h</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{intervaloMinutos} min por bloque</div>
          </div>
          <div style={{ ...panelStyle, borderColor: '#059669' }}>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2 }}>HORAS ASIGNADAS</div>
            <div style={{ fontSize: 34, color: '#059669', fontWeight: 700, lineHeight: 1, marginTop: 4 }}>{totalHorasAsign.toFixed(1)}h</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Se descuentan al llenar las celdas</div>
          </div>
          <div style={{ ...panelStyle, borderColor: totalHorasFaltan > 0 ? '#f59e0b' : '#16a34a' }}>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2 }}>HORAS POR ARMAR</div>
            <div style={{ fontSize: 34, color: totalHorasFaltan > 0 ? '#f59e0b' : '#16a34a', fontWeight: 700, lineHeight: 1, marginTop: 4 }}>{totalHorasFaltan.toFixed(1)}h</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{totalHorasFaltan > 0 ? 'Quedan bloques por cubrir' : 'Semana cubierta'}</div>
          </div>
        </div>

        <div style={panelStyle}>
          <div style={{ color: '#64748b', fontSize: 10, marginBottom: 8, letterSpacing: 2 }}>CARGA RÁPIDA POR RANGO</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
            <div>
              <div style={{ ...S.lbl, marginTop: 0 }}>Exportadora</div>
              <select value={bulkForm.exportadora_id} onChange={(e) => setBulkForm(prev => ({ ...prev, exportadora_id: e.target.value }))} style={{ ...compactInput, width: 190 }}>
                <option value="">Selecciona exportadora</option>
                {entitiesVisibles.map(ent => <option key={`bulk_${ent.id}`} value={ent.id}>{ent.label || ent.exportadora}</option>)}
              </select>
            </div>
            <div>
              <div style={{ ...S.lbl, marginTop: 0 }}>Día</div>
              <select value={bulkForm.fecha && fechasSemana.includes(bulkForm.fecha) ? bulkForm.fecha : (fechasSemana[0] || '')} onChange={(e) => setBulkForm(prev => ({ ...prev, fecha: e.target.value }))} style={{ ...compactInput, width: 140 }}>
                {fechasSemana.map((fecha, idx) => <option key={`fd_${fecha}`} value={fecha}>{`${diasSemana[idx].slice(0,3)} ${fmtDate(fecha)}`}</option>)}
              </select>
            </div>
            <div>
              <div style={{ ...S.lbl, marginTop: 0 }}>Desde</div>
              <select value={bulkForm.hora_desde} onChange={(e) => setBulkForm(prev => ({ ...prev, hora_desde: e.target.value }))} style={{ ...compactInput, width: 98 }}>
                <option value="">Hora inicio</option>
                {horas.map(h => <option key={`desde_${h}`} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <div style={{ ...S.lbl, marginTop: 0 }}>Hasta</div>
              <select value={bulkForm.hora_hasta} onChange={(e) => setBulkForm(prev => ({ ...prev, hora_hasta: e.target.value }))} style={{ ...compactInput, width: 98 }}>
                <option value="">Hora término</option>
                {horas.map(h => <option key={`hasta_${h}`} value={h}>{h}</option>)}
              </select>
            </div>
            <button style={compactButton('#f59e0b', '#fff7ed')} onClick={aplicarRangoMasivo}>+ CARGAR RANGO</button>
          </div>
        </div>

        <div style={panelStyle}>
          <div style={{ color: '#64748b', fontSize: 10, marginBottom: 8, letterSpacing: 2 }}>EXPORTADORAS PARA ARMAR</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 8 }}>
            {resumenExportadoras.filter(item => filtroExportadora === 'todos' || String(item.ent.id) === String(filtroExportadora)).map(item => {
              const progreso = item.horasReq > 0 ? Math.min((item.horasAsign / item.horasReq) * 100, 100) : 0;
              return (
                <div
                  key={`drag_ent_${item.ent.id}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'exportadora', item.ent)}
                  style={{ background: '#fff', border: `1px solid ${entColor(item.ent)}88`, borderRadius: 6, padding: '8px 10px', cursor: 'grab' }}
                >
                  <div style={{ color: entColor(item.ent), fontWeight: 700, fontSize: 11 }}>{item.ent.label || item.ent.exportadora}</div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>{fmt(item.bins)} bins estimados · {item.horasReq.toFixed(1)}h requeridas</div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Asignadas {item.horasAsign.toFixed(1)}h · faltan {item.horasFaltan.toFixed(1)}h</div>
                  <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: '#e2e8f0' }}><div style={{ width: `${progreso}%`, height: '100%', borderRadius: 999, background: entColor(item.ent) }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={{ color: '#64748b', fontSize: 10, marginBottom: 8, letterSpacing: 2 }}>RESTRICCIONES</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tiposRestriccion.map(tipo => (
              <div key={`rest_${tipo.id}`} draggable onDragStart={(e) => handleDragStart(e, 'restriccion', tipo)} style={{ background: '#fff', border: `1px solid ${tipo.color}`, color: tipo.color, borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: 'grab' }}>
                {tipo.nombre}
              </div>
            ))}
          </div>
        </div>

        <div id="programa-turnos" style={{ background: '#f8fbff', border: '1px solid #d7e3f2', borderRadius: 8, padding: 10 }}>
          {turnosMostrados.map((turno, idx) => renderTurnoSection(turno, idx))}
          {horasLibres.length > 0 && vistaTurnosPrograma === 'all' && (
            <div style={{ ...panelStyle, background: '#f8fafc' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Horas sin turno definido</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{horasLibres.join(' · ')}</div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>
          • Arrastra exportadoras o restricciones al bloque horario. • Usa GUARDAR para persistir la semana. • EXPORTAR genera imagen. • El botón de vista permite imprimir solo un turno o ambos.
        </div>
      </div>
    );
  };
  // HANDLER HORAS CURADO
  const handleSaveCuradoHoras = async (exportadora_id, horas_curado) => {
    try {
      await apiFetch("/curado-horas-config", {
        method: "POST",
        body: JSON.stringify({ exportadora_id, horas_curado })
      });
      setCuradoHorasConfig(prev => ({ ...prev, [exportadora_id]: horas_curado }));
    } catch (e) { console.error("Error guardando horas curado:", e); }
  };

  // CONFIG TAB MEJORADO
  const renderConfigTab = () => {
    return (
      <div>
        <style>{BLINK_STYLE}{`
  td:hover .sunday-tooltip { display: block !important; }
`}</style>
        
        {/* Sub-pestañas de configuración */}
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {["parametros","familias","especies","visibilidad","restricciones","turnos","feriados","curado"].map(t => (
            <button
              key={t}
              onClick={() => setConfigTab(t)}
              style={S.tab(configTab === t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* PARÁMETROS */}
        {configTab === "parametros" && (
          <>
            <div style={S.card}>
              <div style={S.sT}>CONFIGURACIÓN ESTÁNDAR</div>
              <ParamsForm 
                params={parametrosEspecie.find(p => p.especie_id === null)}
                onSave={params => handleSaveParamsEspecie(null, params)}
              />
            </div>

            <div style={S.card}>
              <div style={S.sT}>CONFIGURACIÓN POR ESPECIE</div>
              {especies.map(esp => {
                const params = parametrosEspecie.find(p => p.especie_id === esp.id);
                return (
                  <div key={esp.id} style={{marginBottom:16,paddingBottom:16,borderBottom:"1px solid #1e3a4c"}}>
                    <div style={{color:"#2563eb",marginBottom:8}}>{esp.nombre}</div>
                    <ParamsForm
                      params={params || {bins_por_hora: 18, horas_por_dia: 16, kg_por_bin: 460}}
                      onSave={p => handleSaveParamsEspecie(esp.id, p)}
                    />
                  </div>
                );
              })}
            </div>

            {/* PARÁMETROS POR DÍA ESPECÍFICO */}
            {(true) && (
                <div style={S.card}>
                  <div style={S.sT}>PARÁMETROS POR DÍA ESPECÍFICO</div>
                  <div style={{color:"#64748b",fontSize:10,marginBottom:12}}>
                    Override de bins/hora para un día puntual. Si no hay override, se usa el parámetro de especie.
                    Especificidad: exportadora+especie+variedad &gt; exportadora+especie &gt; exportadora &gt; especie &gt; global del día.
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8,marginBottom:12}}>
                    <div>
                      <label style={S.lbl}>EXPORTADORA (opcional)</label>
                      <select style={S.input} value={formDia.exportadora_id} onChange={e => setFormDia(p=>({...p,exportadora_id:e.target.value}))}>
                        <option value="">— Todas —</option>
                        {entities.map(ent => <option key={ent.id} value={ent.id}>{ent.label || ent.exportadora}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.lbl}>ESPECIE (opcional)</label>
                      <select style={S.input} value={formDia.especie_id} onChange={e => setFormDia(p=>({...p,especie_id:e.target.value}))}>
                        <option value="">— Todas —</option>
                        {especies.map(esp => <option key={esp.id} value={esp.id}>{esp.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.lbl}>VARIEDAD (opcional)</label>
                      <input style={S.input} value={formDia.variedad} onChange={e => setFormDia(p=>({...p,variedad:e.target.value}))} placeholder="Ej: HAYWARD" />
                    </div>
                    <div>
                      <label style={S.lbl}>FECHA</label>
                      <input type="date" style={S.input} value={formDia.fecha} onChange={e => setFormDia(p=>({...p,fecha:e.target.value}))} />
                    </div>
                    <div>
                      <label style={S.lbl}>BINS / HORA</label>
                      <input type="number" min="1" style={S.input} value={formDia.bins_por_hora} onChange={e => setFormDia(p=>({...p,bins_por_hora:e.target.value}))} placeholder="Ej: 24" />
                    </div>
                    <div style={{display:"flex",alignItems:"flex-end"}}>
                      <button style={S.btn()} onClick={() => {
                        if (!formDia.fecha || !formDia.bins_por_hora) { alert("Fecha y bins/hora son obligatorios."); return; }
                        handleSaveParamsDia({
                          exportadora_id: formDia.exportadora_id || null,
                          especie_id: formDia.especie_id || null,
                          variedad: formDia.variedad || null,
                          fecha: formDia.fecha,
                          bins_por_hora: Number(formDia.bins_por_hora)
                        });
                      }}>GUARDAR</button>
                    </div>
                  </div>
                  {parametrosDia.length > 0 && (
                    <table style={{...S.table,marginTop:8}}>
                      <thead>
                        <tr>
                          <th style={S.thL}>FECHA</th>
                          <th style={S.thL}>EXPORTADORA</th>
                          <th style={S.thL}>ESPECIE</th>
                          <th style={S.thL}>VARIEDAD</th>
                          <th style={S.th}>BPH</th>
                          <th style={S.th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {parametrosDia.map(p => {
                          const ent = entities.find(e => Number(e.id) === Number(p.exportadora_id));
                          const esp = especies.find(e => Number(e.id) === Number(p.especie_id));
                          return (
                            <tr key={p.id}>
                              <td style={{...S.tdL,color:"#38bdf8"}}>{fmtDate(normalizarFechaSql(p.fecha) || p.fecha)}</td>
                              <td style={S.tdL}>{ent ? (ent.label || ent.exportadora) : <span style={{color:"#64748b"}}>Todas</span>}</td>
                              <td style={S.tdL}>{esp ? esp.nombre : <span style={{color:"#64748b"}}>Todas</span>}</td>
                              <td style={S.tdL}>{p.variedad || <span style={{color:"#64748b"}}>Todas</span>}</td>
                              <td style={{...S.td,fontWeight:700,color:"#34d399"}}>{p.bins_por_hora}</td>
                              <td style={S.td}>
                                <button style={{...S.btn(),background:"#fee2e2",borderColor:"#ef4444",color:"#ef4444"}} onClick={() => handleDeleteParamDia(p.id)}>✕</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {parametrosDia.length === 0 && <div style={{color:"#64748b",fontSize:11}}>No hay overrides por día configurados.</div>}
                </div>
            )}
          </>
        )}

        {/* FAMILIAS */}
        {configTab === "familias" && (
          <div style={S.card}>
            <div style={S.sT}>FAMILIAS DE ESPECIES</div>
            <div style={{display:'flex',gap:8,marginBottom:12}}>
              <button style={S.btn()} onClick={() => { setNewFamilia({ nombre: "", usa_curado: false, orden: (familias.length || 0) + 1 }); setShowFamiliaModal(true); }}>
                + NUEVA FAMILIA
              </button>
              <button 
                style={{...S.btn(), background:'#dc2626', borderColor:'#dc2626'}} 
                onClick={() => {
                  if (window.confirm('¿Limpiar todas las temporadas guardadas y volver a valores por defecto?')) {
                    setTemporadasFamilia({});
                    localStorage.removeItem('temporadasFamilia');
                    alert('Temporadas limpiadas. Recarga la página para ver los cambios.');
                  }
                }}
              >
                🗑️ LIMPIAR TEMPORADAS
              </button>
            </div>
            <div style={{marginTop:12}}>
              {familias.map(fam => {
                const temporadaFam = getTemporadaFamilia(fam.id);
                const tempEstado = temporadasFamilia[fam.id] || {};
                return (
                  <div key={fam.id} style={{
                    padding:10,
                    background:"#0d1b27",
                    marginBottom:8,
                    borderRadius:4,
                    border:"1px solid #163047"
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontWeight:700}}>{fam.nombre}</div>
                        <div style={{fontSize:9,color:"#64748b"}}>
                          {fam.usa_curado ? "✓ Usa curado" : "✗ No usa curado"} · Orden: {fam.orden}
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3, minmax(120px, 1fr)) auto",gap:8,alignItems:"end",minWidth:"min(100%, 520px)"}}>
                        <div>
                          <label style={S.lbl}>Inicio temporada</label>
                          <input
                            type="date"
                            style={S.input}
                            value={tempEstado.fecha_inicio || temporadaFam.fecha_inicio || ""}
                            onChange={(e) => setTemporadasFamilia(prev => ({ ...prev, [fam.id]: { ...(prev[fam.id] || {}), fecha_inicio: e.target.value, fecha_fin: (prev[fam.id]?.fecha_fin || temporadaFam.fecha_fin) } }))}
                            placeholder="dd-mm-aaaa"
                          />
                          <div style={{fontSize:9,color:'#64748b',marginTop:2}}>
                            Nota: Al cambiar el mes, el día se ajusta automáticamente si no existe en ese mes
                          </div>
                        </div>
                        <div>
                          <label style={S.lbl}>Fin temporada</label>
                          <input
                            type="date"
                            style={S.input}
                            value={tempEstado.fecha_fin || temporadaFam.fecha_fin || ""}
                            onChange={(e) => setTemporadasFamilia(prev => ({ ...prev, [fam.id]: { ...(prev[fam.id] || {}), fecha_inicio: (prev[fam.id]?.fecha_inicio || temporadaFam.fecha_inicio), fecha_fin: e.target.value } }))}
                            placeholder="dd-mm-aaaa"
                          />
                        </div>
                        <div style={{color:"#64748b",fontSize:10,paddingBottom:6}}>
                          {buildDateRange(tempEstado.fecha_inicio || temporadaFam.fecha_inicio, tempEstado.fecha_fin || temporadaFam.fecha_fin).length || 0} días visibles
                        </div>
                        <button style={S.btn()} onClick={() => handleSaveTemporadaFamilia(fam.id, tempEstado.fecha_inicio || tempEstado.fecha_fin ? { ...temporadaFam, ...tempEstado } : temporadaFam)}>
                          GUARDAR TEMPORADA
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ESPECIES */}
        {configTab === "especies" && (
          <div style={S.card}>
            <div style={S.sT}>ESPECIES POR FAMILIA</div>
            <button style={S.btn()} onClick={() => { setNewEspecie({ nombre: "", familia_id: familias[0]?.id || "" }); setShowEspecieModal(true); }}>
              + NUEVA ESPECIE
            </button>
            <div style={{marginTop:12}}>
              {familias.map(fam => {
                const especiesFam = especies.filter(e => e.familia_id === fam.id);
                return (
                  <div key={fam.id} style={{marginBottom:16}}>
                    <div style={{color:"#2563eb",marginBottom:8,fontWeight:700}}>{fam.nombre}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {especiesFam.map(esp => (
                        <div key={esp.id} style={{
                          padding:"4px 10px",
                          background:"#0d1b27",
                          borderRadius:4,
                          display:"flex",
                          alignItems:"center",
                          gap:6
                        }}>
                          <span>{esp.nombre}</span>
                          <span 
                            onClick={() => handleDeleteEspecie(esp.id)}
                            style={{cursor:"pointer",color:"#dc2626",fontSize:14}}
                          >
                            ×
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VISIBILIDAD EN LÍNEA */}
        {configTab === "visibilidad" && (
          <div style={S.card}>
            <div style={S.sT}>VISIBILIDAD VISUAL EN LÍNEA</div>
            <div style={{fontSize:10,color:"#64748b",marginBottom:12}}>
              Aquí solo ocultas o muestras filas en la pestaña línea. No elimina datos ni desactiva la exportadora.
            </div>

            <div style={{
              background:"#0d1b27",
              border:"1px solid #1e3a4c",
              borderRadius:6,
              padding:12,
              marginBottom:14
            }}>
              <div style={{color:"#2563eb",fontSize:10,letterSpacing:2,marginBottom:10}}>AGREGAR EXPORTADORA / VARIEDAD</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,alignItems:"end"}}>
                <div>
                  <label style={S.lbl}>Nombre exportadora</label>
                  <input
                    style={S.input}
                    value={newExportadora.nombre}
                    onChange={(e) => setNewExportadora(prev => ({ ...prev, nombre: e.target.value.toUpperCase() }))}
                    placeholder="Ej: AGUA SANTA"
                  />
                </div>

                <div>
                  <label style={S.lbl}>Especie</label>
                  <select
                    style={S.input}
                    value={newExportadora.especie_id}
                    onChange={(e) => setNewExportadora(prev => ({ ...prev, especie_id: e.target.value }))}
                  >
                    <option value="">Selecciona especie</option>
                    {especies.map(esp => (
                      <option key={`exp_esp_${esp.id}`} value={String(esp.id)}>{esp.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={S.lbl}>Variedad</label>
                  <input
                    style={S.input}
                    value={newExportadora.variedad}
                    onChange={(e) => setNewExportadora(prev => ({ ...prev, variedad: e.target.value.toUpperCase() }))}
                    placeholder="Ej: HAYWARD"
                  />
                </div>

                <div>
                  <label style={S.lbl}>Color</label>
                  <select
                    style={S.input}
                    value={newExportadora.color_idx}
                    onChange={(e) => setNewExportadora(prev => ({ ...prev, color_idx: Number(e.target.value) }))}
                  >
                    {COLOR_PALETTE.map((c, idx) => (
                      <option key={`color_idx_${idx}`} value={idx}>Color {idx + 1}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <button style={S.btn()} onClick={handleCreateExportadora} disabled={savingExportadora}>
                    {savingExportadora ? "GUARDANDO..." : "+ AGREGAR"}
                  </button>
                </div>
              </div>

              <div style={{marginTop:10,fontSize:10,color:"#64748b"}}>
                Se creará una nueva combinación de <span style={{color:"#1e293b"}}>exportadora + especie + variedad</span> para usarla en línea, dashboard y turnos.
              </div>
            </div>

            <div style={{overflowX:"auto"}}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.thL}>Exportadora</th>
                    <th style={S.thL}>Variedad</th>
                    <th style={S.thL}>Especie</th>
                    <th style={S.th}>Visible</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map(ent => (
                    <tr key={`visible_${ent.id}`}>
                      <td style={S.tdL}>{ent.exportadora}</td>
                      <td style={S.tdL}>{ent.variedad || "-"}</td>
                      <td style={S.tdL}>{ent.especie || "-"}</td>
                      <td style={S.td}>
                        <input
                          type="checkbox"
                          checked={Number(ent.visibleLinea ?? 1) === 1}
                          onChange={(e) => handleToggleVisibleLinea(ent.id, e.target.checked)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TIPOS DE RESTRICCIÓN */}
        {configTab === "restricciones" && (
          <div style={S.card}>
            <div style={S.sT}>TIPOS DE RESTRICCIÓN</div>
            <button
              style={S.btn()}
              onClick={() => {
                setNewTipoRestriccion({ nombre: "", color: "#dc2626" });
                setShowTipoRestriccionModal(true);
              }}
            >
              + NUEVA RESTRICCIÓN
            </button>
            <div style={{marginTop:12}}>
              {tiposRestriccion.map(tipo => (
                <div key={tipo.id} style={{
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"space-between",
                  gap:12,
                  padding:8,
                  background:"#0d1b27",
                  marginBottom:6,
                  borderRadius:4
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div 
                      style={{
                        width:20,
                        height:20,
                        background:tipo.color,
                        borderRadius:"50%",
                        flexShrink:0
                      }}
                    />
                    <span>{tipo.nombre}</span>
                  </div>
                  <button style={S.btn("#ef4444", "#220b0b")} onClick={() => handleDeleteTipoRestriccion(tipo.id)}>
                    ELIMINAR
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEFINICIONES DE TURNOS */}
        {configTab === "turnos" && (
          <div style={S.card}>
            <div style={S.sT}>DEFINICIONES DE TURNOS</div>
            <button style={S.btn()} onClick={() => { setNewTurnoDef({ nombre: "", hora_inicio: "08:00", hora_fin: "17:00", colacion_inicio: "", colacion_fin: "", orden: (turnosDefinicion.length || 0) + 1 }); setShowTurnoDefModal(true); }}>
              + NUEVO TURNO
            </button>
            <div style={{marginTop:12}}>
              {turnosDefinicion.map(turno => (
                <div key={turno.id} style={{
                  padding:10,
                  background:"#0d1b27",
                  marginBottom:6,
                  borderRadius:4,
                  display:"flex",
                  justifyContent:"space-between",
                  alignItems:"center",
                  gap:12
                }}>
                  <div>
                    <div style={{fontWeight:700,marginBottom:4}}>{turno.nombre}</div>
                    <div style={{fontSize:10,color:"#64748b"}}>
                      {turno.hora_inicio} - {turno.hora_fin}
                      {turno.colacion_inicio && (
                        <> · Colación: {turno.colacion_inicio} - {turno.colacion_fin}</>
                      )}
                    </div>
                  </div>
                  <button style={S.btn("#ef4444", "#220b0b")} onClick={() => handleDeleteTurnoDef(turno.id)}>
                    ELIMINAR
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HORAS CURADO POR EXPORTADORA */}
        {configTab === "curado" && (
          <div style={S.card}>
            <div style={S.sT}>HORAS CURADO / PREFRÍO POR EXPORTADORA</div>
            <div style={{color:"#64748b",fontSize:11,marginBottom:12}}>
              Al ingresar cosecha, LIBERACIÓN CURADO se autorrellena en la fecha cosecha + offset.
              Ej: 24h = cosecha +2 días, 48h = cosecha +3 días. Solo aplica si la celda curado está en 0.
              Cambios afectan solo entradas nuevas (desde hoy en adelante).
            </div>
            <CuradoHorasTable entities={entities} curadoHorasConfig={curadoHorasConfig} onSave={handleSaveCuradoHoras} S={S} entColor={entColor} />
          </div>
        )}

        {/* FERIADOS */}
        {configTab === "feriados" && (
          <div style={S.card}>
            <div style={S.sT}>FERIADOS</div>
            <button
              style={S.btn()}
              onClick={() => {
                setNewFeriado({ fecha: TODAY, nombre: "" });
                setShowFeriadoModal(true);
              }}
            >
              + NUEVO FERIADO
            </button>
            <div style={{marginTop:12, overflowX:"auto"}}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.thL}>Fecha</th>
                    <th style={S.thL}>Nombre</th>
                    <th style={S.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.slice().sort().map(fecha => (
                    <tr key={fecha}>
                      <td style={S.tdL}>{fmtDate(fecha)}</td>
                      <td style={S.tdL}>{fmtDay(fecha)}</td>
                      <td style={S.td}>
                        <button style={S.btn("#ef4444", "#220b0b")} onClick={() => handleDeleteFeriado(fecha)}>
                          ELIMINAR
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={S.app}>
      <style>{BLINK_STYLE}{`
  td:hover .sunday-tooltip { display: block !important; }
`}</style>
      
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.logo}>ALMAHUE · BALANCE DE FRUTA</div>
        <div style={{display:"flex",gap:8}}>
          {["dashboard","operacion","proyeccion","turnos","config"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={S.tab(tab === t)}>
              {t === "operacion" ? "OPERACIÓN" : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={S.main}>
        {/* DASHBOARD */}
        {tab === "dashboard" && renderDashboard()}

        {/* LÍNEA DE TIEMPO */}
        {tab === "operacion" && renderLineaTiempoConPestanas()}

        {/* PROYECCIÓN */}
        {tab === "proyeccion" && renderProjection()}

        {/* TURNOS */}
        {tab === "turnos" && renderProgramaTurnos()}

        {/* CONFIG */}
        {tab === "config" && renderConfigTab()}
      </div>

      {showFamiliaModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{color:"#2563eb",fontSize:13,letterSpacing:2,marginBottom:12}}>NUEVA FAMILIA</div>
            <label style={S.lbl}>Nombre</label>
            <input
              style={S.input}
              value={newFamilia.nombre}
              onChange={(e) => setNewFamilia({ ...newFamilia, nombre: e.target.value })}
            />
            <label style={S.lbl}>Orden</label>
            <input
              type="number"
              style={S.input}
              value={newFamilia.orden}
              onChange={(e) => setNewFamilia({ ...newFamilia, orden: Number(e.target.value || 0) })}
            />
            <label style={{...S.lbl,display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
              <input
                type="checkbox"
                checked={!!newFamilia.usa_curado}
                onChange={(e) => setNewFamilia({ ...newFamilia, usa_curado: e.target.checked })}
              />
              Usa curado
            </label>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <button style={S.btn("#94a3b8", "#0c1824")} onClick={() => setShowFamiliaModal(false)}>CANCELAR</button>
              <button
                style={S.btn()}
                onClick={() => handleSaveFamilia(newFamilia)}
                disabled={!String(newFamilia.nombre || "").trim()}
              >
                GUARDAR
              </button>
            </div>
          </div>
        </div>
      )}

      {showEspecieModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{color:"#2563eb",fontSize:13,letterSpacing:2,marginBottom:12}}>NUEVA ESPECIE</div>
            <label style={S.lbl}>Nombre</label>
            <input
              style={S.input}
              value={newEspecie.nombre}
              onChange={(e) => setNewEspecie({ ...newEspecie, nombre: e.target.value })}
            />
            <label style={S.lbl}>Familia</label>
            <select
              style={S.input}
              value={newEspecie.familia_id}
              onChange={(e) => setNewEspecie({ ...newEspecie, familia_id: Number(e.target.value) })}
            >
              <option value="">SELECCIONE...</option>
              {familias.map(fam => (
                <option key={fam.id} value={fam.id}>{fam.nombre}</option>
              ))}
            </select>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <button style={S.btn("#94a3b8", "#0c1824")} onClick={() => setShowEspecieModal(false)}>CANCELAR</button>
              <button
                style={S.btn()}
                onClick={() => handleSaveEspecie({ ...newEspecie, familia_id: Number(newEspecie.familia_id) })}
                disabled={!String(newEspecie.nombre || "").trim() || !newEspecie.familia_id}
              >
                GUARDAR
              </button>
            </div>
          </div>
        </div>
      )}

      {showTurnoDefModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{color:"#2563eb",fontSize:13,letterSpacing:2,marginBottom:12}}>NUEVO TURNO</div>
            <label style={S.lbl}>Nombre</label>
            <input
              style={S.input}
              value={newTurnoDef.nombre}
              onChange={(e) => setNewTurnoDef({ ...newTurnoDef, nombre: e.target.value })}
            />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={S.lbl}>Hora inicio</label>
                <input
                  type="time"
                  style={S.input}
                  value={newTurnoDef.hora_inicio}
                  onChange={(e) => setNewTurnoDef({ ...newTurnoDef, hora_inicio: e.target.value })}
                />
              </div>
              <div>
                <label style={S.lbl}>Hora fin</label>
                <input
                  type="time"
                  style={S.input}
                  value={newTurnoDef.hora_fin}
                  onChange={(e) => setNewTurnoDef({ ...newTurnoDef, hora_fin: e.target.value })}
                />
              </div>
              <div>
                <label style={S.lbl}>Colación inicio</label>
                <input
                  type="time"
                  style={S.input}
                  value={newTurnoDef.colacion_inicio}
                  onChange={(e) => setNewTurnoDef({ ...newTurnoDef, colacion_inicio: e.target.value })}
                />
              </div>
              <div>
                <label style={S.lbl}>Colación fin</label>
                <input
                  type="time"
                  style={S.input}
                  value={newTurnoDef.colacion_fin}
                  onChange={(e) => setNewTurnoDef({ ...newTurnoDef, colacion_fin: e.target.value })}
                />
              </div>
            </div>
            <label style={S.lbl}>Orden</label>
            <input
              type="number"
              style={S.input}
              value={newTurnoDef.orden}
              onChange={(e) => setNewTurnoDef({ ...newTurnoDef, orden: Number(e.target.value || 0) })}
            />
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <button style={S.btn("#94a3b8", "#0c1824")} onClick={() => setShowTurnoDefModal(false)}>CANCELAR</button>
              <button
                style={S.btn()}
                onClick={() => handleSaveTurnoDef({
                  ...newTurnoDef,
                  colacion_inicio: newTurnoDef.colacion_inicio || null,
                  colacion_fin: newTurnoDef.colacion_fin || null,
                })}
                disabled={!String(newTurnoDef.nombre || "").trim()}
              >
                GUARDAR
              </button>
            </div>
          </div>
        </div>
      )}
      {showTipoRestriccionModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{color:"#2563eb",fontSize:13,letterSpacing:2,marginBottom:12}}>NUEVA RESTRICCIÓN</div>
            <label style={S.lbl}>Nombre</label>
            <input
              style={S.input}
              value={newTipoRestriccion.nombre}
              onChange={(e) => setNewTipoRestriccion({ ...newTipoRestriccion, nombre: e.target.value })}
            />
            <label style={S.lbl}>Color</label>
            <input
              type="color"
              style={{...S.input, padding:4, height:40}}
              value={newTipoRestriccion.color}
              onChange={(e) => setNewTipoRestriccion({ ...newTipoRestriccion, color: e.target.value })}
            />
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <button style={S.btn("#94a3b8", "#0c1824")} onClick={() => setShowTipoRestriccionModal(false)}>CANCELAR</button>
              <button
                style={S.btn()}
                onClick={() => handleSaveTipoRestriccion(newTipoRestriccion)}
                disabled={!String(newTipoRestriccion.nombre || "").trim()}
              >
                GUARDAR
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeriadoModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{color:"#2563eb",fontSize:13,letterSpacing:2,marginBottom:12}}>NUEVO FERIADO</div>
            <label style={S.lbl}>Fecha</label>
            <input
              type="date"
              style={S.input}
              value={newFeriado.fecha}
              onChange={(e) => setNewFeriado({ ...newFeriado, fecha: e.target.value })}
            />
            <label style={S.lbl}>Nombre</label>
            <input
              style={S.input}
              value={newFeriado.nombre}
              onChange={(e) => setNewFeriado({ ...newFeriado, nombre: e.target.value })}
              placeholder="Feriado"
            />
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <button style={S.btn("#94a3b8", "#0c1824")} onClick={() => setShowFeriadoModal(false)}>CANCELAR</button>
              <button
                style={S.btn()}
                onClick={() => handleSaveFeriado(newFeriado)}
                disabled={!String(newFeriado.fecha || "").trim()}
              >
                GUARDAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente auxiliar para formulario de parámetros
function ParamsForm({ params, onSave, onReset }) {
  const [bph, setBph] = useState(params?.bins_por_hora || 18);
  const [hpd, setHpd] = useState(params?.horas_por_dia || 16);
  const [kpb, setKpb] = useState(params?.kg_por_bin || 460);

  useEffect(() => {
    if (params) {
      setBph(params.bins_por_hora || 18);
      setHpd(params.horas_por_dia || 16);
      setKpb(params.kg_por_bin || 460);
    }
  }, [params]);

  return (
    <div style={{display:"flex",gap:12,alignItems:"end",flexWrap:"wrap"}}>
      <div>
        <label style={S.lbl}>Bins / hora</label>
        <input 
          style={{...S.input,width:100}} 
          type="number" 
          step="0.1"
          value={bph} 
          onChange={e => setBph(e.target.value)}
        />
      </div>
      <div>
        <label style={S.lbl}>Horas / día</label>
        <input 
          style={{...S.input,width:100}} 
          type="number" 
          step="0.1"
          value={hpd} 
          onChange={e => setHpd(e.target.value)}
        />
      </div>
      <div>
        <label style={S.lbl}>Kg / bin</label>
        <input 
          style={{...S.input,width:100}} 
          type="number" 
          step="1"
          value={kpb} 
          onChange={e => setKpb(e.target.value)}
        />
      </div>
      <button 
        style={S.btn()} 
        onClick={() => onSave({
          bins_por_hora: +bph,
          horas_por_dia: +hpd,
          kg_por_bin: +kpb
        })}
      >
        GUARDAR
      </button>
      {onReset && (
        <button style={S.btn("#64748b","#0c1824")} onClick={onReset}>
          USAR ESTÁNDAR
        </button>
      )}
      <div style={{fontSize:10,color:"#64748b",marginTop:8}}>
        Capacidad: {(+bph * +kpb).toLocaleString("es-CL")} kg/h
      </div>
    </div>
  );
}

// Componente tabla horas curado por exportadora
function CuradoHorasTable({ entities, curadoHorasConfig, onSave, S, entColor }) {
  const [localHoras, setLocalHoras] = useState(() => {
    const init = {};
    entities.forEach(ent => { init[ent.id] = curadoHorasConfig[ent.id] ?? 48; });
    return init;
  });

  // Sincronizar si cambia curadoHorasConfig desde afuera
  useEffect(() => {
    setLocalHoras(prev => {
      const next = { ...prev };
      entities.forEach(ent => {
        if (curadoHorasConfig[ent.id] !== undefined) next[ent.id] = curadoHorasConfig[ent.id];
      });
      return next;
    });
  }, [curadoHorasConfig, entities]);

  if (entities.length === 0) {
    return <div style={{color:"#64748b",fontSize:11}}>Sin exportadoras registradas.</div>;
  }

  return (
    <table style={{...S.table, width:"auto"}}>
      <thead>
        <tr>
          <th style={{...S.thL, minWidth:180}}>EXPORTADORA</th>
          <th style={{...S.th, width:130}}>HORAS CURADO</th>
          <th style={{...S.th, width:130}}>OFFSET</th>
          <th style={{...S.th, width:100}}></th>
        </tr>
      </thead>
      <tbody>
        {entities.map(ent => {
          const h = Number(localHoras[ent.id] ?? 48);
          const diasOffset = Math.round(h / 24) + 1;
          return (
            <tr key={ent.id}>
              <td style={{...S.tdL, color: entColor(ent), fontWeight:700}}>
                {ent.exportadora}{ent.variedad ? ` · ${ent.variedad}` : ""}
              </td>
              <td style={S.td}>
                <input
                  type="number" min="1" step="1"
                  value={localHoras[ent.id] ?? 48}
                  onChange={e => setLocalHoras(prev => ({ ...prev, [ent.id]: Number(e.target.value) }))}
                  style={{
                    ...S.input, width:80, textAlign:"center"
                  }}
                />
              </td>
              <td style={{...S.td, color:"#a78bfa"}}>cosecha + {diasOffset} días</td>
              <td style={S.td}>
                <button
                  style={S.btn("#34d399","#0a1e18")}
                  onClick={() => onSave(ent.id, Number(localHoras[ent.id] ?? 48))}
                >
                  GUARDAR
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
