import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { hoyLocal, fechaLocal } from '../shared/dateUtils'
import { Btn, Loader } from './UI'
import { confirmarRacionesDia, agregarRolloExtra } from '../shared/alimentacionLogic'

const CM = { bg: '#1A2E1A', surface: '#243324', surface2: '#2E3F2E', border: '#3A4F3A', text: '#E8F0E8', muted: '#8FA88F', green: '#7EC87E', amber: '#F5C97A', red: '#F09595', blue: '#7EB8F7', mono: "'IBM Plex Mono', monospace", sans: "'IBM Plex Sans', sans-serif" }
function MobileTopbar({ titulo, sub, onBack }) {
  return (
    <div style={{ background: CM.surface, padding: '1rem', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: `1px solid ${CM.border}` }}>
      {onBack && <button onClick={onBack} style={{ background: 'none', border: 'none', color: CM.green, fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: CM.text }}>{titulo}</div>
        {sub && <div style={{ fontSize: 11, color: CM.muted, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}
function MobileScroll({ children }) {
  return <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: CM.bg, color: CM.text }}>{children}</div>
}

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', borderStrong: '#C8C2B8',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
}

const CAP_MIXER = 4000

const FORMULAS = {
  seco: {
    acostumbramiento: [
      {n:'Rollo (heno)',     kg:38,  c:'#639922'},
      {n:'Maiz grano seco', kg:39,  c:'#E8A020'},
      {n:'Vitaminas',       kg:2,   c:'#5090E0'},
      {n:'Urea',            kg:0.5, c:'#9060C0'},
      {n:'Antibiotico',     kg:0.2, c:'#E05050'},
      {n:'Desparasitante',  kg:0.1, c:'#C06030'},
      {n:'Soja (expeller)', kg:3,   c:'#20A060'},
      {n:'Agua',            kg:17,  c:'#60A0E0'},
    ],
    recria: [
      {n:'Rollo (heno)',     kg:26,  c:'#639922'},
      {n:'Maiz grano seco', kg:55,  c:'#E8A020'},
      {n:'Vitaminas',       kg:2,   c:'#5090E0'},
      {n:'Urea',            kg:1,   c:'#9060C0'},
      {n:'Agua',            kg:17,  c:'#60A0E0'},
    ],
    terminacion: [
      {n:'Rollo (heno)',     kg:13,  c:'#639922'},
      {n:'Maiz grano seco', kg:68,  c:'#E8A020'},
      {n:'Vitaminas',       kg:1,   c:'#5090E0'},
      {n:'Urea',            kg:1,   c:'#9060C0'},
      {n:'Agua',            kg:17,  c:'#60A0E0'},
    ],
  },
  humedo: {
    acostumbramiento: [
      {n:'Rollo (heno)',        kg:27,  c:'#639922'},
      {n:'Maiz grano seco',    kg:21,  c:'#E8A020'},
      {n:'Maiz grano humedo',  kg:27,  c:'#C08000'},
      {n:'Vitaminas',          kg:2,   c:'#5090E0'},
      {n:'Urea',               kg:0.6, c:'#9060C0'},
      {n:'Antibiotico',        kg:0.3, c:'#E05050'},
      {n:'Desparasitante',     kg:0.2, c:'#C06030'},
      {n:'Soja (expeller)',    kg:3,   c:'#20A060'},
      {n:'Agua',               kg:21,  c:'#60A0E0'},
    ],
    recria: [
      {n:'Rollo (heno)',       kg:21,  c:'#639922'},
      {n:'Maiz grano seco',   kg:24,  c:'#E8A020'},
      {n:'Maiz grano humedo', kg:33,  c:'#C08000'},
      {n:'Vitaminas',         kg:1,   c:'#5090E0'},
      {n:'Urea',              kg:1,   c:'#9060C0'},
      {n:'Agua',              kg:20,  c:'#60A0E0'},
    ],
    terminacion: [
      {n:'Rollo (heno)',       kg:13,  c:'#639922'},
      {n:'Maiz grano seco',   kg:28,  c:'#E8A020'},
      {n:'Maiz grano humedo', kg:38,  c:'#C08000'},
      {n:'Vitaminas',         kg:1,   c:'#5090E0'},
      {n:'Urea',              kg:1,   c:'#9060C0'},
      {n:'Agua',              kg:20,  c:'#60A0E0'},
    ],
  },
}

const ETAPA_INFO = [
  { key: 'acostumbramiento', label: 'Mixer 1 - Acostumbramiento - 0 a 10 dias', badge: 'warn' },
  { key: 'recria',           label: 'Mixer 2 - Recria - 11 dias hasta 290 kg',  badge: 'info' },
  { key: 'terminacion',      label: 'Mixer 3 - Terminacion - 291 kg hasta venta', badge: 'ok' },
]

function generarArchivoRaciones(porFecha, titulo) {
  const fechasOrdenadas = Object.entries(porFecha).sort((a, b) => a[0].localeCompare(b[0]))
  const totalGeneral = fechasOrdenadas.reduce((s, [, items]) => s + items.reduce((ss, h) => ss + (h.kg_total || 0), 0), 0)

  const bloquesDias = fechasOrdenadas.map(([fecha, items]) => {
    const totalDia = items.reduce((s, h) => s + (h.kg_total || 0), 0)
    const filas = items
      .sort((a, b) => parseInt(a.corrales?.numero || 99) - parseInt(b.corrales?.numero || 99))
      .map(h => {
        const rango = h.corrales?.rol === 'clasificado' && h.corrales?.sub ? `Rango ${h.corrales.sub}` : '—'
        return `<tr>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;font-weight:600;">C-${h.corrales?.numero || '—'}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;color:#666;">${rango}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;color:#666;">${h.mezclador || h.mixer || '—'}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:700;font-family:monospace;color:#1A6B3C;">${(h.kg_total || 0).toLocaleString('es-AR')} kg</td>
      </tr>`
      }).join('')
    const nombreFecha = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    return `
      <div style="margin-bottom:28px;page-break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#1A3D6B;color:#fff;padding:10px 14px;border-radius:6px 6px 0 0;">
          <div style="font-size:14px;font-weight:700;text-transform:capitalize;">${nombreFecha}</div>
          <div style="font-size:13px;font-family:monospace;font-weight:700;">Total: ${totalDia.toLocaleString('es-AR')} kg</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #ddd;border-top:none;">
          <thead><tr style="background:#f5f5f5;">
            <th style="padding:7px 12px;text-align:left;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;border-bottom:1px solid #ddd;">Corral</th>
            <th style="padding:7px 12px;text-align:left;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;border-bottom:1px solid #ddd;">Rango</th>
            <th style="padding:7px 12px;text-align:left;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;border-bottom:1px solid #ddd;">Etapa</th>
            <th style="padding:7px 12px;text-align:right;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;border-bottom:1px solid #ddd;">Kg cargados</th>
          </tr></thead>
          <tbody>${filas}</tbody>
          <tfoot><tr style="background:#f0f7f1;">
            <td colspan="3" style="padding:7px 12px;font-weight:700;font-size:12px;">Total del día</td>
            <td style="padding:7px 12px;text-align:right;font-weight:700;font-family:monospace;color:#1A6B3C;">${totalDia.toLocaleString('es-AR')} kg</td>
          </tr></tfoot>
        </table>
      </div>`
  }).join('')

  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Raciones — ${titulo}</title>
  <style>@media print{.no-print{display:none;}body{margin:0;}}body{font-family:Arial,sans-serif;background:#fff;padding:20px;color:#222;}*{box-sizing:border-box;}@page{margin:15mm;}</style>
  </head><body>
  <div class="no-print" style="position:fixed;top:10px;right:10px;z-index:999;">
    <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#1A3D6B;color:#fff;border:none;border-radius:6px;margin-right:6px;">🖨️ Imprimir / PDF</button>
    <button onclick="window.close()" style="padding:8px 14px;font-size:13px;cursor:pointer;background:#fff;border:1px solid #ccc;border-radius:6px;">Cerrar</button>
  </div>
  <div style="max-width:720px;margin:0 auto;">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #1A3D6B;">
      <div>
        <div style="font-size:22px;font-weight:900;color:#1A3D6B;">RAMONDA HNOS S.A.</div>
        <div style="font-size:14px;font-weight:600;color:#444;margin-top:2px;">Registro de alimentación — ${titulo}</div>
      </div>
      <div style="text-align:right;font-size:12px;color:#666;">
        <div>${fechasOrdenadas.length} día${fechasOrdenadas.length !== 1 ? 's' : ''} · Total: <strong style="color:#1A6B3C;font-family:monospace;">${totalGeneral.toLocaleString('es-AR')} kg</strong></div>
      </div>
    </div>
    ${bloquesDias}
  </div></body></html>`)
  win.document.close()
}

export default function Alimentacion({ usuario, mobile, nav }) {
  const [tab, setTab] = useState('formulas')
  const [loading, setLoading] = useState(true)
  const [corrales, setCorrales] = useState([])
  const [stockDB, setStockDB] = useState([])
  const [contactos, setContactos] = useState([])
  const [historial, setHistorial] = useState([])
  const [historialArchivo, setHistorialArchivo] = useState([])
  const [historialInsumos, setHistorialInsumos] = useState([])
  const [historialLegacy, setHistorialLegacy] = useState([])
  const [archivoOffset, setArchivoOffset] = useState(100)
  const [cargandoArchivo, setCargandoArchivo] = useState(false)

  async function cargarArchivo() {
    setCargandoArchivo(true)
    // Fecha de corte: inicio del día de hace 7 días
    const hace7dias = new Date()
    hace7dias.setDate(hace7dias.getDate() - 7)
    hace7dias.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('raciones_app')
      .select('*, corrales(numero, rol, sub)')
      .lt('creado_en', hace7dias.toISOString())
      .order('creado_en', { ascending: false })
      .limit(2000)
    setHistorialArchivo(data || [])
    setCargandoArchivo(false)
  }
  const [verArchivo, setVerArchivo] = useState(false)
  // Estado propio de la carga diaria simple que usa el celular
  const [kgsM, setKgsM] = useState({})
  const [pilsM, setPilsM] = useState({})
  const [tabM, setTabM] = useState(() => {
    const destino = typeof window !== 'undefined' ? window.__alimentacionTab : null
    if (destino) window.__alimentacionTab = null
    return destino || 'piletas'
  })
  const [mostrarMixerM, setMostrarMixerM] = useState(false)
  const [mostrarConfirmReemplazoM, setMostrarConfirmReemplazoM] = useState(false)
  const [mostrarAgregarRolloM, setMostrarAgregarRolloM] = useState(false)
  const [kgsRolloExtraM, setKgsRolloExtraM] = useState({})
  const [guardandoRolloM, setGuardandoRolloM] = useState(false)
  const [guardandoM, setGuardandoM] = useState(false)

  useEffect(() => {
    if (!mobile) return
    const corralesAlimEff = corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado')
    if (Object.keys(kgsM).length === 0 && corralesAlimEff.length > 0) {
      const fechasHist = [...new Set(historial.map(h => h.fecha || (h.creado_en || '').split('T')[0]))].filter(Boolean).sort().reverse()
      const fechaAyer = fechasHist[0]
      const kgsAyerEff = {}
      if (fechaAyer) historial.filter(h => (h.fecha || (h.creado_en || '').split('T')[0]) === fechaAyer).forEach(h => { kgsAyerEff[h.corral_id] = h.kg_total })
      const inicial = {}
      corralesAlimEff.forEach(c => {
        inicial[c.id] = kgsAyerEff[c.id] !== undefined ? kgsAyerEff[c.id] : Math.round(Math.round((c.animales || 0) * 10) / 100) * 100
      })
      setKgsM(inicial)
    }
  }, [corrales, historial, mobile])
  const [archivoFechaDesde, setArchivoFechaDesde] = useState('')
  const [archivoFechaHasta, setArchivoFechaHasta] = useState('')


  const [cfgCapState, setCfgCapState] = useState([])
  const [formulaActiva, setFormulaActiva] = useState('seco')
  const primeraCargaRef = useRef(true)
  const [pctMS, setPctMS] = useState({}) // { [insumo_id]: pct_ms } — se inicializa desde la base y se persiste ahí

  useEffect(() => {
    if (stockDB.length === 0) return
    setPctMS(prev => {
      const next = {...prev}
      stockDB.forEach(s => { if (next[s.id] === undefined) next[s.id] = s.pct_ms || 0 })
      return next
    })
  }, [stockDB])
  const [formulaDieta, setFormulaDieta] = useState('seco')
  const [formulas, setFormulas] = useState(JSON.parse(JSON.stringify(FORMULAS)))
  const [caps, setCaps] = useState([CAP_MIXER, CAP_MIXER, CAP_MIXER])
  const [editando, setEditando] = useState({})
  const [showFormIngreso, setShowFormIngreso] = useState(false)
  const [formIngreso, setFormIngreso] = useState({ insumo: 'Rollo (heno)', fecha: hoyLocal(), cantidad: '', proveedor: '', remito: '', pct_ms: '', retirado: true })
  const [guardando, setGuardando] = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  const [kgsHoy, setKgsHoy] = useState([[800, 2400], [840, 900], [1160, 1225]])
  const [piletas, setPiletas] = useState([[null, null], [null, null], [null, null]])

  const MIXERS_CONFIG = [
    { id: 'acost', num: 'Mixer 1', nombre: 'Acostumbramiento', etapa: 'acostumbramiento', headerGrad: '#FDF0E0', corralesRoles: ['cuarentena'] },
    { id: 'recria', num: 'Mixer 2', nombre: 'Recria', etapa: 'recria', headerGrad: '#E8EFF8', corralesRoles: ['acumulacion', 'enfermeria', 'clasificado'] },
    { id: 'term', num: 'Mixer 3', nombre: 'Terminacion', etapa: 'terminacion', headerGrad: '#E8F4EB', corralesRoles: ['clasificado'] },
  ]

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const hace7dias = new Date()
    hace7dias.setDate(hace7dias.getDate() - 7)
    const hace7diasISO = hace7dias.toISOString()

    const [{ data: c }, { data: s }, { data: h }, { data: ha }, { data: fdb }, { data: cfgCap }, { data: rapp }, { data: compras }, { data: legacy }, { data: ct }] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('stock_insumos').select('*').order('insumo'),
      supabase.from('raciones_app').select('*, corrales(numero, rol, sub)').order('creado_en', { ascending: false }).limit(200),
      supabase.from('raciones_app').select('*, corrales(numero, rol, sub)').order('creado_en', { ascending: false }).limit(100).range(200, 299),
      supabase.from('formulas_mixer').select('*').order('orden'),
      supabase.from('configuracion').select('clave, valor').in('clave', ['capacidad_mixer_acostumbramiento', 'capacidad_mixer_recria', 'capacidad_mixer_terminacion', 'fecha_term_c']),
      supabase.from('raciones_app').select('*, corrales(numero, rol, sub)').gte('creado_en', hace7diasISO).order('creado_en', { ascending: false }),
      supabase.from('compras_insumos').select('*').eq('insumo_tipo', 'alimentacion').order('fecha', { ascending: false }).limit(50),
      supabase.from('ingresos_stock').select('*').eq('tipo', 'alimentacion').order('creado_en', { ascending: false }).limit(10),
      supabase.from('contactos').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setCorrales(c || [])
    setStockDB(s || [])
    setContactos(ct || [])
    setHistorial(rapp || [])
    setHistorialInsumos(compras || [])
    setHistorialLegacy(legacy || [])
    setHistorialArchivo([])
    setArchivoOffset(100)

    // Al abrir la pantalla por primera vez, marcar como predeterminada la dieta
    // (seco/húmedo) que más se usó el día más reciente con carga registrada,
    // para no arrancar siempre en "seco" si en la práctica vienen usando húmedo.
    if (primeraCargaRef.current && rapp && rapp.length > 0) {
      primeraCargaRef.current = false
      const fechas = [...new Set(rapp.map(r => r.fecha || (r.creado_en || '').split('T')[0]))].filter(Boolean).sort().reverse()
      const fechaMasReciente = fechas[0]
      if (fechaMasReciente) {
        const kgPorDieta = {}
        rapp.filter(r => (r.fecha || (r.creado_en || '').split('T')[0]) === fechaMasReciente).forEach(r => {
          const d = r.tipo_dieta || 'seco'
          kgPorDieta[d] = (kgPorDieta[d] || 0) + (r.kg_total || 0)
        })
        const dietaPredominante = Object.entries(kgPorDieta).sort((a, b) => b[1] - a[1])[0]?.[0]
        if (dietaPredominante === 'seco' || dietaPredominante === 'humedo') setFormulaActiva(dietaPredominante)
      }
    }
    // Cargar capacidades desde BD
    if (cfgCap && cfgCap.length > 0) {
      setCfgCapState(cfgCap)
      const capAcost = parseInt(cfgCap.find(c => c.clave === 'capacidad_mixer_acostumbramiento')?.valor || '2000')
      const capRecria = parseInt(cfgCap.find(c => c.clave === 'capacidad_mixer_recria')?.valor || '2500')
      const capTerm = parseInt(cfgCap.find(c => c.clave === 'capacidad_mixer_terminacion')?.valor || '4200')
      setCaps([capAcost, capRecria, capTerm])
    }

    // Construir formulas desde BD
    if (fdb && fdb.length > 0) {
      const formulasDB = { seco: { acostumbramiento: [], recria: [], terminacion: [] }, humedo: { acostumbramiento: [], recria: [], terminacion: [] } }
      fdb.forEach(row => {
        if (formulasDB[row.dieta]?.[row.etapa]) {
          formulasDB[row.dieta][row.etapa].push({ n: row.ingrediente, kg: row.kg, c: row.color || '#888888', id: row.id, ms: row.pct_ms != null ? row.pct_ms : null })
        }
      })
      setFormulas(formulasDB)
    }

    setLoading(false)
  }

  const fechaTermC = cfgCapState.find(c => c.clave === 'fecha_term_c')?.valor || null
  const hoyStr = hoyLocal()
  const cEnTerminacion = fechaTermC && hoyStr >= fechaTermC

  const RANGOS_RECRIA = cEnTerminacion ? ['A','B'] : ['A','B','C']
  const RANGOS_TERM = cEnTerminacion ? ['C','D','E','F','G','H'] : ['D','E','F','G','H']
  const corralesMixer = [
    corrales.filter(c => c.rol === 'cuarentena'),
    corrales.filter(c => c.rol === 'acumulacion' || c.rol === 'enfermeria' || (c.rol === 'clasificado' && RANGOS_RECRIA.includes(c.sub))),
    corrales.filter(c => c.rol === 'clasificado' && RANGOS_TERM.includes(c.sub)),
  ]

  useEffect(() => {
    if (corrales.length > 0) {
      const nuevosKgs = corralesMixer.map(grupo => grupo.map(c => Math.round((c.animales || 0) * 10)))
      setKgsHoy(nuevosKgs)
      setPiletas(corralesMixer.map(g => g.map(() => null)))
    }
  }, [corrales])

  function setPileta(mi, ci, tipo) {
    const base = kgsHoy[mi]?.[ci] || 0
    const newKgs = kgsHoy.map(g => [...g])
    newKgs[mi][ci] = tipo === 'bajo' ? Math.max(0, base - 100) : tipo === 'normal' ? base : base + 100
    setKgsHoy(newKgs)
    const newPils = piletas.map(g => [...g])
    newPils[mi][ci] = tipo
    setPiletas(newPils)
  }

  function updateKg(mi, ci, val) {
    const newKgs = kgsHoy.map(g => [...g])
    newKgs[mi][ci] = parseInt(val) || 0
    setKgsHoy(newKgs)
  }

  function calcIngredientes(etapa, totalKg) {
    return formulas[formulaActiva][etapa].map(ing => ({
      ...ing, kgTotal: Math.round(ing.kg * totalKg / 100)
    }))
  }

  // Calcula el costo estimado de una ración dado etapa y kg totales
  function calcCosto(etapa, totalKg) {
    if (!totalKg || totalKg === 0) return null
    const ings = formulas[formulaActiva][etapa]
    let costo = 0
    let tienePrecio = false
    ings.forEach(ing => {
      // Busca el insumo en stockDB por nombre exacto o por coincidencia parcial
      const ingLower = ing.n.toLowerCase()
      const stock = stockDB.find(s => s.insumo.toLowerCase() === ingLower)
        || stockDB.find(s => s.insumo.toLowerCase().includes(ingLower.split(' ')[0]))
      if (stock?.precio_referencia) {
        costo += (ing.kg / 100) * totalKg * stock.precio_referencia
        tienePrecio = true
      }
    })
    return tienePrecio ? Math.round(costo) : null
  }

  async function actualizarPrecioReferencia(insumoId) {
    // Promedio de las últimas 3 compras
    const { data: ultimas } = await supabase
      .from('compras_insumos')
      .select('precio_unitario')
      .eq('insumo_id', insumoId)
      .not('precio_unitario', 'is', null)
      .order('fecha', { ascending: false })
      .limit(3)
    if (ultimas && ultimas.length > 0) {
      const promedio = Math.round(ultimas.reduce((s, c) => s + (c.precio_unitario || 0), 0) / ultimas.length * 100) / 100
      await supabase.from('stock_insumos').update({ precio_referencia: promedio, precio_referencia_actualizado_en: new Date().toISOString() }).eq('id', insumoId)
    } else {
      // Fallback: ingresos_stock legacy (últimas 3)
      const { data: legacy } = await supabase.from('ingresos_stock').select('precio_por_kg').eq('insumo_id', insumoId).not('precio_por_kg', 'is', null).order('creado_en', { ascending: false }).limit(3)
      if (legacy && legacy.length > 0) {
        const promedio = Math.round(legacy.reduce((s, i) => s + (i.precio_por_kg || 0), 0) / legacy.length * 100) / 100
        await supabase.from('stock_insumos').update({ precio_referencia: promedio, precio_referencia_actualizado_en: new Date().toISOString() }).eq('id', insumoId)
      }
    }
  }

  // (confirmarTodo fue retirada — escribía en raciones_diarias, una tabla que
  // nadie leía; la carga real de la ración diaria vive en raciones_app)

  async function eliminarRacion(id) {
    if (!confirm('¿Eliminar esta racion?')) return
    await supabase.from('raciones_app').delete().eq('id', id)
    await cargarDatos()
  }

  async function eliminarTodasRaciones() {
    if (!confirm('¿Eliminar TODAS las raciones de los últimos 7 días? Esta acción no se puede deshacer.')) return
    const hace7dias = new Date()
    hace7dias.setDate(hace7dias.getDate() - 7)
    await supabase.from('raciones_app').delete().gte('creado_en', hace7dias.toISOString())
    await cargarDatos()
  }

  async function guardarIngreso() {
    if (!formIngreso.cantidad) { alert('Ingresa la cantidad'); return }
    const item = stockDB.find(s => s.insumo === formIngreso.insumo)
    if (!item) { alert(`No se encontró el insumo "${formIngreso.insumo}" en el stock. Probá recargar la página y volver a intentar.`); return }
    setGuardando(true)
    const cant = parseFloat(formIngreso.cantidad)
    const pctMsForm = parseFloat(formIngreso.pct_ms) || null
    const kgMsForm = pctMsForm ? Math.round(cant * pctMsForm / 100 * 10) / 10 : null
    // La cantidad solo se suma al stock si ya se retiró físicamente — si se dejó
    // marcado "todavía no lo retiramos", el stock queda igual hasta que se
    // marque como retirado más adelante (desde Insumos).
    if (formIngreso.retirado) {
      // Actualizar stock de forma atómica (suma en la base, no en la app) para
      // no pisar otra operación que toque el mismo insumo casi al mismo tiempo
      const { error: errRpc } = await supabase.rpc('incrementar_stock_insumo', { p_id: item.id, p_delta: cant })
      if (errRpc) { alert('Error al actualizar el stock: ' + errRpc.message); setGuardando(false); return }
    }
    await supabase.from('stock_insumos').update({ pedido_realizado: false, ...(pctMsForm ? { pct_ms: pctMsForm } : {}) }).eq('id', item.id)
    // Nota: ya no se usa ingresos_stock — todo va a compras_insumos
    // Crear compra pendiente en compras_insumos para que Paula complete precio y pague
    const { error: errCompra } = await supabase.from('compras_insumos').insert({
      fecha: formIngreso.fecha,
      insumo_id: item.id,
      insumo_tipo: 'alimentacion',
      insumo_nombre: formIngreso.insumo,
      cantidad: cant,
      unidad: 'kg',
      pct_ms: pctMsForm,
      kg_ms: kgMsForm,
      proveedor: formIngreso.proveedor || null,
      numero_factura: formIngreso.remito || null,
      precio_unitario: null,
      total: null,
      estado_pago: 'pendiente',
      registrado_por: usuario?.id,
      retirado: formIngreso.retirado,
    })
    if (errCompra) { alert('El stock se actualizó, pero no se pudo guardar el registro de compra: ' + errCompra.message); setGuardando(false); return }
    await cargarDatos()
    setShowFormIngreso(false)
    setFormIngreso({ insumo: 'Rollo (heno)', fecha: hoyLocal(), cantidad: '', proveedor: '', remito: '', pct_ms: '', retirado: true })
    setGuardando(false)
  }

  function updateIng(fKey, eKey, idx, val) {
    const newF = JSON.parse(JSON.stringify(formulas))
    newF[fKey][eKey][idx].kg = parseFloat(val) || 0
    setFormulas(newF)
  }


  function moverIngrediente(fKey, eKey, idx, direccion) {
    const newF = JSON.parse(JSON.stringify(formulas))
    const arr = newF[fKey][eKey]
    const nuevoIdx = idx + direccion
    if (nuevoIdx < 0 || nuevoIdx >= arr.length) return
    const temp = arr[idx]
    arr[idx] = arr[nuevoIdx]
    arr[nuevoIdx] = temp
    setFormulas(newF)
  }

  async function guardarDieta(fKey, eKey) {
    const ings = formulas[fKey][eKey]
    const total = ings.reduce((a, x) => a + x.kg, 0)
    if (Math.abs(total - 100) > 0.1) { alert(`La suma debe ser 100 kg. Actualmente: ${total.toFixed(1)} kg`); return }

    // Actualizar cada ingrediente en la BD
    for (let i = 0; i < ings.length; i++) {
      const ing = ings[i]
      if (ing.id) {
        await supabase.from('formulas_mixer').update({ kg: ing.kg, orden: i + 1 }).eq('id', ing.id)
      } else {
        await supabase.from('formulas_mixer').insert({ dieta: fKey, etapa: eKey, ingrediente: ing.n, kg: ing.kg, color: ing.c, orden: i + 1 })
      }
    }
    setEditando({ ...editando, [`${fKey}_${eKey}`]: false })
    await cargarDatos()
  }

  if (loading) return <Loader />

  // ── MODO CELULAR: carga diaria simple (piletas/mixer) ──
  if (mobile) {
    const dieta = formulaActiva
    const corralesAlim = corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado').sort((a, b) => parseInt(a.numero) - parseInt(b.numero))
    // Para "Agregar rollo" sí se incluyen los corrales vacíos (libres) — por ejemplo,
    // para dejar rollo listo antes de que llegue una tropa nueva a la tarde.
    const corralesParaRollo = corrales.filter(c => c.rol !== 'deshabilitado').sort((a, b) => parseInt(a.numero) - parseInt(b.numero))
    function getEtapaM(c) {
      if (c.rol === 'cuarentena') return 'acostumbramiento'
      if (c.rol === 'acumulacion' || c.rol === 'enfermeria') return 'recria'
      if (c.rol === 'clasificado') return RANGOS_RECRIA.includes(c.sub) ? 'recria' : 'terminacion'
      return 'recria'
    }
    const FRML = formulas?.[dieta] || { acostumbramiento: [], recria: [], terminacion: [] }

    // Kg de ayer por corral, para prellenar el formulario
    const fechasHist = [...new Set(historial.map(h => h.fecha || (h.creado_en || '').split('T')[0]))].filter(Boolean).sort().reverse()
    const fechaAyer = fechasHist[0]
    const kgsAyerM = {}
    if (fechaAyer) historial.filter(h => (h.fecha || (h.creado_en || '').split('T')[0]) === fechaAyer).forEach(h => { kgsAyerM[h.corral_id] = h.kg_total })

    function setPiletaM(id, tipo) {
      const base = kgsM[id] || 0
      const newKgs = {...kgsM}
      newKgs[id] = tipo === 'bajo' ? Math.max(0, base - 100) : tipo === 'normal' ? base : base + 100
      setKgsM(newKgs)
      setPilsM({...pilsM, [id]: tipo})
    }

    const totalM = Object.values(kgsM).reduce((a, b) => a + b, 0)
    const capAcost = caps[0] || 2000
    const capRecria = caps[1] || 2500
    const capTerm = caps[2] || 4200
    const MIXERS_M = [
      { nombre: 'Mixer 1 - Acostumbramiento', etapa: 'acostumbramiento', corrales: corralesAlim.filter(c => getEtapaM(c) === 'acostumbramiento'), cap: capAcost },
      { nombre: 'Mixer 2 - Recria', etapa: 'recria', corrales: corralesAlim.filter(c => getEtapaM(c) === 'recria'), cap: capRecria },
      { nombre: 'Mixer 3 - Terminacion', etapa: 'terminacion', corrales: corralesAlim.filter(c => getEtapaM(c) === 'terminacion'), cap: capTerm },
    ].filter(m => m.corrales.length > 0)

    // Reparte los corrales de un mixer en la MÍNIMA cantidad de cargas posible.
    // Prioridad total: menos cargas preparadas, aunque el mixer tenga que
    // recorrer corrales no consecutivos dentro de una misma carga. Se arma con
    // "First Fit Decreasing": primero los corrales más pesados (así entran
    // los que menos margen dejan), y cada uno va a la primera carga donde
    // todavía entre; si no entra en ninguna, recién ahí se abre una carga nueva.
    function repartirCorralesEnCargas(corralesConKg, cap) {
      const ordenados = [...corralesConKg].sort((a, b) => b.kg - a.kg)
      const cargas = []
      const sumas = []
      for (const c of ordenados) {
        let colocado = false
        for (let i = 0; i < cargas.length; i++) {
          if (sumas[i] + c.kg <= cap) {
            cargas[i].push(c)
            sumas[i] += c.kg
            colocado = true
            break
          }
        }
        if (!colocado) {
          cargas.push([c])
          sumas.push(c.kg)
        }
      }
      // Dentro de cada carga, ordenar por número de corral para que al menos
      // la recorrida DENTRO de esa carga sea lo más prolija posible.
      return cargas.map(carga => [...carga].sort((a, b) => parseInt(a.numero) - parseInt(b.numero)))
    }

    async function agregarRolloHoyM() {
      setGuardandoRolloM(true)
      const hoy = hoyLocal()
      const corralesConKg = corralesParaRollo
        .filter(c => (kgsRolloExtraM[c.id] || 0) > 0)
        .map(c => ({ corralId: c.id, kg: parseInt(kgsRolloExtraM[c.id]) || 0, animales: c.animales || 0 }))
      const kgRolloTotal = await agregarRolloExtra(supabase, { fecha: hoy, corralesConKg, dieta })
      setKgsRolloExtraM({})
      setMostrarAgregarRolloM(false)
      setGuardandoRolloM(false)
      alert(`Rollo extra registrado: ${kgRolloTotal} kg`)
    }

    async function ejecutarConfirmarM(hoy) {
      setMostrarConfirmReemplazoM(false)
      setGuardandoM(true)
      const formulasPorEtapa = { acostumbramiento: FRML.acostumbramiento || [], recria: FRML.recria || [], terminacion: FRML.terminacion || [] }
      const corralesConEtapaYKg = corralesAlim.map(c => ({ corralId: c.id, etapa: getEtapaM(c), kg: kgsM[c.id] || 0, animales: c.animales || 0 }))
      await confirmarRacionesDia(supabase, { fecha: hoy, corralesConEtapaYKg, dieta, formulasPorEtapa, reemplazarExistente: true })
      await cargarDatos()
      alert(`Raciones confirmadas. ${totalM.toLocaleString('es-AR')} kg totales.`)
      nav && nav('home')
      setGuardandoM(false)
    }

    async function confirmarM() {
      setGuardandoM(true)
      const hoy = hoyLocal()
      const { data: yaConfirmadas } = await supabase.from('raciones_app').select('id').eq('fecha', hoy).limit(1)
      if (yaConfirmadas && yaConfirmadas.length > 0) {
        setGuardandoM(false)
        setMostrarConfirmReemplazoM(true)
        return
      }
      await ejecutarConfirmarM(hoy)
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <MobileTopbar titulo="Alimentacion" sub="Racion diaria" onBack={() => nav && nav('home')} />
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: CM.surface, borderBottom: `1px solid ${CM.border}` }}>
          <div style={{ fontSize: 11, color: CM.muted, alignSelf: 'center' }}>Dieta:</div>
          {['seco', 'humedo'].map(d => (
            <button key={d} onClick={() => setFormulaActiva(d)}
              style={{ flex: 1, padding: '7px', fontSize: 13, fontWeight: dieta === d ? 700 : 400,
                background: dieta === d ? CM.green : CM.surface2,
                color: dieta === d ? '#0A1A0A' : CM.muted,
                border: `1px solid ${dieta === d ? CM.green : CM.border}`,
                borderRadius: 8, cursor: 'pointer', fontFamily: CM.sans }}>
              {d === 'seco' ? 'Maiz seco' : 'Maiz humedo'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', background: CM.surface, borderBottom: `1px solid ${CM.border}`, flexShrink: 0 }}>
          {[['piletas','Piletas y mixer'],['stock','Stock']].map(([t, l]) => (
            <button key={t} onClick={() => setTabM(t)}
              style={{ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: CM.sans, background: tabM === t ? CM.green : 'transparent', color: tabM === t ? '#0A1A0A' : CM.muted, borderBottom: tabM === t ? `2px solid ${CM.green}` : '2px solid transparent' }}>
              {l}
            </button>
          ))}
        </div>
        <MobileScroll>
          {tabM === 'piletas' && (
            <>
              {corralesAlim.map(c => {
                const kgHoy = kgsM[c.id] || 0
                return (
                  <div key={c.id} style={{ background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 12, padding: '.9rem', marginBottom: '.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Corral {c.numero}</div>
                        <div style={{ fontSize: 11, color: CM.muted }}>{c.rol === 'clasificado' && c.sub ? `Rango ${c.sub}` : c.rol} · {c.animales || 0} animales</div>
                        <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: getEtapaM(c) === 'acostumbramiento' ? CM.amber : getEtapaM(c) === 'recria' ? CM.blue : CM.green }}>
                          {getEtapaM(c) === 'acostumbramiento' ? '🌱 Acostumbramiento' : getEtapaM(c) === 'recria' ? '🌾 Recría' : '🏁 Terminación'}
                        </div>
                        {kgsAyerM[c.id] > 0 && (
                          <div style={{ fontSize: 10, color: CM.muted, marginTop: 1 }}>Ayer: {kgsAyerM[c.id].toLocaleString('es-AR')} kg</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: CM.mono }}>{kgHoy.toLocaleString('es-AR')}</div>
                        <div style={{ fontSize: 11, color: CM.muted }}>kg hoy</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginBottom: '.5rem' }}>
                      {[['bajo','Sobro -100',CM.green,'#1A3D26'],['normal','Normal',CM.blue,'#0F2040'],['vacio','Vacio +100',CM.amber,'#3D2A00']].map(([tipo,label,color,bg]) => (
                        <button key={tipo} onClick={() => setPiletaM(c.id, tipo)}
                          style={{ flex: 1, padding: '7px 4px', fontSize: 10, fontWeight: 600, borderRadius: 6, cursor: 'pointer', fontFamily: CM.sans, border: `1px solid ${pilsM[c.id] === tipo ? color : CM.border}`, background: pilsM[c.id] === tipo ? bg : 'transparent', color: pilsM[c.id] === tipo ? color : CM.muted }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <input type="number" inputMode="numeric" value={kgHoy}
                      onChange={e => setKgsM({...kgsM, [c.id]: parseInt(e.target.value) || 0})}
                      style={{ width: '100%', background: CM.surface2, border: `1px solid ${CM.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 15, fontFamily: CM.mono, fontWeight: 600, color: CM.green, textAlign: 'right', boxSizing: 'border-box' }} />
                  </div>
                )
              })}
              <div style={{ background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Total mixer hoy</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: CM.mono, color: CM.green }}>{totalM.toLocaleString('es-AR')} kg</div>
                </div>
                <button onClick={() => setMostrarMixerM(!mostrarMixerM)}
                  style={{ width: '100%', background: CM.green, border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: CM.sans }}>
                  {mostrarMixerM ? 'Ocultar ingredientes' : 'Ver ingredientes del mixer'}
                </button>
              </div>
              {mostrarMixerM && MIXERS_M.map((mx, mi) => {
                const corralesConKg = mx.corrales.map(c => ({ numero: c.numero, kg: kgsM[c.id] || 0 })).filter(c => c.kg > 0)
                const totalMx = corralesConKg.reduce((a, c) => a + c.kg, 0)
                if (totalMx === 0) return null
                const f = FRML[mx.etapa] || []
                const factor = totalMx / 100
                const superaCap = totalMx > mx.cap
                const cargas = superaCap ? repartirCorralesEnCargas(corralesConKg, mx.cap) : [corralesConKg]
                return (
                  <div key={mi} style={{ background: CM.surface, border: `1px solid ${superaCap ? CM.amber : CM.border}`, borderRadius: 12, marginBottom: '.65rem', overflow: 'hidden' }}>
                    <div style={{ padding: '.75rem 1rem', borderBottom: `1px solid ${CM.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: CM.green }}>{mx.nombre}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: CM.mono, color: superaCap ? CM.amber : CM.green }}>{totalMx.toLocaleString('es-AR')} kg</div>
                    </div>
                    {superaCap && (
                      <div style={{ background: '#3D2A00', padding: '.75rem 1rem', borderBottom: `1px solid ${CM.border}` }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: CM.amber }}>⚠ Supera la capacidad ({mx.cap.toLocaleString('es-AR')} kg) — preparar {cargas.length} cargas</div>
                      </div>
                    )}
                    {cargas.map((carga, ci) => {
                      const kgCarga = carga.reduce((a, c) => a + c.kg, 0)
                      const factorCarga = kgCarga / 100
                      let acum = 0
                      return (
                        <div key={ci}>
                          <div style={{ padding: '10px 1rem', background: CM.surface2, borderBottom: `1px solid ${CM.border}`, borderTop: (superaCap && ci > 0) ? `2px solid ${CM.amber}` : 'none' }}>
                            {superaCap && (
                              <div style={{ fontSize: 13, fontWeight: 700, color: CM.amber }}>Carga {ci + 1} de {cargas.length} — {kgCarga.toLocaleString('es-AR')} kg</div>
                            )}
                          </div>
                          {f.map((ing, ii) => {
                            const kg = Math.round(ing.kg * (superaCap ? factorCarga : factor))
                            acum += kg
                            return (
                              <div key={ii} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 1rem', borderBottom: `1px solid ${CM.border}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ing.c }} />{ing.n}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: CM.mono, color: CM.green }}>{kg.toLocaleString('es-AR')} kg</div>
                                  <div style={{ fontSize: 13, fontFamily: CM.mono, fontWeight: 700, color: CM.amber }}>↑ {acum.toLocaleString('es-AR')} kg</div>
                                </div>
                              </div>
                            )
                          })}
                          <div style={{ padding: '10px 1rem', background: CM.surface2, borderTop: `1px solid ${CM.border}` }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: CM.blue, textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                              🚚 Descargar en cada corral
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {(() => {
                                let restante = kgCarga
                                return carga.map(c => {
                                  restante -= c.kg
                                  return (
                                    <div key={c.numero} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, fontWeight: 600, color: CM.blue, background: 'rgba(126,184,247,0.08)', border: `1px solid rgba(126,184,247,0.25)`, borderRadius: 6, padding: '5px 10px' }}>
                                      <span>C-{c.numero}</span>
                                      <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontFamily: CM.mono, fontWeight: 700 }}>{c.kg.toLocaleString('es-AR')} kg</span>
                                        <div style={{ fontSize: 12, fontFamily: CM.mono, fontWeight: 700, color: restante > 0 ? CM.amber : CM.muted }}>↓ queda {Math.max(0, restante).toLocaleString('es-AR')} kg</div>
                                      </div>
                                    </div>
                                  )
                                })
                              })()}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              {mostrarConfirmReemplazoM && (
                <div style={{ background: '#FFF3CD', border: '2px solid #FFC107', borderRadius: 12, padding: '1.25rem', marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#7A4500', marginBottom: 8 }}>⚠ Ya se confirmaron raciones hoy</div>
                  <div style={{ fontSize: 13, color: '#7A4500', marginBottom: 12 }}>¿Querés reemplazar las raciones de hoy con los valores actuales?</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => ejecutarConfirmarM(hoyLocal())}
                      style={{ flex: 1, background: CM.green, border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer' }}>
                      Sí, reemplazar
                    </button>
                    <button onClick={() => setMostrarConfirmReemplazoM(false)}
                      style={{ flex: 1, background: '#fff', border: '1px solid #CCC', borderRadius: 8, padding: 12, fontSize: 14, color: '#555', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
              <button onClick={confirmarM} disabled={guardandoM || mostrarConfirmReemplazoM}
                style={{ width: '100%', background: guardandoM || mostrarConfirmReemplazoM ? '#4A6A4A' : CM.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: guardandoM || mostrarConfirmReemplazoM ? 'default' : 'pointer', fontFamily: CM.sans, marginBottom: 8 }}>
                {guardandoM ? 'Guardando...' : mostrarConfirmReemplazoM ? 'Respondé el cartel de arriba ↑' : 'Confirmar raciones'}
              </button>
              {!mostrarAgregarRolloM ? (
                <button onClick={() => setMostrarAgregarRolloM(true)}
                  style={{ width: '100%', background: 'transparent', border: `1px solid #639922`, borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, color: '#639922', cursor: 'pointer', fontFamily: CM.sans, marginTop: 8 }}>
                  🌿 Agregar rollo
                </button>
              ) : (
                <div style={{ background: '#F0F7E6', border: '1px solid #639922', borderRadius: 10, padding: '1rem', marginTop: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#639922', marginBottom: 12 }}>🌿 Agregar rollo</div>
                  {corralesParaRollo.map(c => (
                    <div key={c.id} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: '#639922', fontWeight: 600, marginBottom: 4 }}>
                        Corral {c.numero} ({c.animales || 0} animales{c.rol === 'libre' ? ' · vacío, tropa por llegar' : ''})
                      </div>
                      <input type="number" inputMode="numeric" placeholder="0 kg" value={kgsRolloExtraM[c.id] || ''}
                        onChange={e => setKgsRolloExtraM({...kgsRolloExtraM, [c.id]: parseInt(e.target.value) || 0})}
                        style={{ width: '100%', background: '#fff', border: '1px solid #639922', borderRadius: 8, padding: '10px 12px', fontSize: 16, fontFamily: CM.mono, fontWeight: 600, color: '#639922', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => { setMostrarAgregarRolloM(false); setKgsRolloExtraM({}) }}
                      style={{ flex: 1, background: '#fff', border: '1px solid #CCC', borderRadius: 8, padding: 12, fontSize: 14, color: '#555', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button onClick={agregarRolloHoyM} disabled={guardandoRolloM || !Object.values(kgsRolloExtraM).some(v => v > 0)}
                      style={{ flex: 1, background: '#639922', border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                      {guardandoRolloM ? 'Guardando...' : '💾 Confirmar rollo'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {tabM === 'stock' && (() => {
            const COLORES_M = { 'Rollo (heno)': '#639922', 'Maiz grano seco': '#E8A020', 'Vitaminas': '#5090E0', 'Urea': '#9060C0', 'Soja grano': '#20A060' }
            return (
              <>
                <div style={{ fontSize: 12, color: CM.muted, marginBottom: '1rem', padding: '8px 12px', background: CM.surface, borderRadius: 8, border: `1px solid ${CM.border}` }}>
                  📋 Solo lectura — los ingresos (remitos) se registran desde la PC, en la pestaña "Stock de insumos".
                </div>
                {stockDB.map(s => {
                  const bajo = s.cantidad_kg <= s.minimo_kg
                  const color = bajo ? CM.amber : CM.green
                  const c = COLORES_M[s.insumo] || CM.green
                  const pct = Math.min(100, Math.round(s.cantidad_kg / Math.max(s.minimo_kg * 3, s.cantidad_kg) * 100))
                  return (
                    <div key={s.id} style={{ padding: '.75rem 0', borderBottom: `1px solid ${CM.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{s.insumo}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: CM.mono, color }}>{bajo ? '⚠ ' : ''}{(s.cantidad_kg || 0).toLocaleString('es-AR')} kg</div>
                      </div>
                      <div style={{ height: 4, background: CM.surface2, borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
                        <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%` }} />
                      </div>
                      {bajo && <div style={{ fontSize: 11, color: CM.amber }}>⚠ Bajo mínimo ({(s.minimo_kg || 0).toLocaleString('es-AR')} kg) — avisar para reponer</div>}
                    </div>
                  )
                })}

                <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', letterSpacing: '.05em', margin: '1.25rem 0 .65rem' }}>Últimos 5 ingresos registrados</div>
                {(() => {
                  const nuevos = historialInsumos.map(ing => ({ id: 'n'+ing.id, nombre: ing.insumo_nombre, cantidad: ing.cantidad, fecha: ing.fecha, proveedor: ing.proveedor, estadoPago: ing.estado_pago, tienePrecio: !!ing.precio_unitario }))
                  const viejos = historialLegacy.map(ing => ({ id: 'l'+ing.id, nombre: ing.insumo_nombre, cantidad: ing.cantidad_kg, fecha: (ing.creado_en || '').split('T')[0], proveedor: ing.proveedor, estadoPago: ing.estado_pago, tienePrecio: !!ing.precio_por_kg }))
                  const todos = [...nuevos, ...viejos].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 5)
                  if (todos.length === 0) return <div style={{ fontSize: 12, color: CM.muted, textAlign: 'center', padding: '1rem' }}>Todavía no hay ingresos cargados.</div>
                  return todos.map(ing => (
                    <div key={ing.id} style={{ background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '.7rem .9rem', marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{ing.nombre}</div>
                          <div style={{ fontSize: 11, color: CM.muted, marginTop: 2 }}>
                            {ing.fecha ? new Date(ing.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'}
                            {ing.proveedor ? ` · ${ing.proveedor}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: CM.mono, color: CM.green }}>{(ing.cantidad || 0).toLocaleString('es-AR')} kg</div>
                        </div>
                      </div>
                    </div>
                  ))
                })()}
              </>
            )
          })()}
        </MobileScroll>
      </div>
    )
  }
  // ── FIN MODO CELULAR — de acá para abajo sigue el modo PC, sin cambios ──

  const hoy = new Date()

  const TABS = [
    { key: 'formulas', label: 'Formulas de mixer' },
    { key: 'stock', label: 'Stock de insumos' },
    { key: 'historial', label: 'Historial' },
  ]

  // Costo total del día
  const costoTotalDia = MIXERS_CONFIG.reduce((total, mx, mi) => {
    const kgsMixer = kgsHoy[mi] || []
    const totalMixer = kgsMixer.reduce((a, b) => a + b, 0)
    const costo = calcCosto(mx.etapa, totalMixer)
    return total + (costo || 0)
  }, 0)

  const tienePreciosReferencia = stockDB.some(s => s.precio_referencia)

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── FORMULAS ── */}
      {tab === 'formulas' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Formulas de mixer</h1>
              <div style={{ fontSize: 12, color: S.muted }}>Kg por cada 100 kg de mezcla</div>
            </div>
          </div>
          <div style={{ background: S.accentLight, border: '1px solid #85B7EB', borderRadius: 8, padding: '.9rem 1rem', fontSize: 13, color: S.accent, marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Cada 100 kg de mixer, el sistema multiplica por el total del dia.
          </div>
          <div style={{ display: 'flex', border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden', width: 'fit-content', marginBottom: '1.5rem' }}>
            {[['seco', 'Maiz seco'], ['humedo', 'Maiz humedo']].map(([key, label]) => (
              <button key={key} onClick={() => setFormulaDieta(key)}
                style={{ padding: '8px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', background: formulaDieta === key ? S.accent : 'transparent', color: formulaDieta === key ? '#fff' : S.muted, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                {label}
              </button>
            ))}
          </div>
          {ETAPA_INFO.map(e => {
            const key = `${formulaDieta}_${e.key}`
            const ings = formulas[formulaDieta][e.key]
            const total = ings.reduce((a, x) => a + x.kg, 0)
            const totalOk = Math.abs(total - 100) < 0.1
            const modoEdit = editando[key] || false
            const kgMSDieta = ings.reduce((a, x) => {
              const ingLower = x.n.toLowerCase()
              const stockItem = stockDB.find(s => s.insumo.toLowerCase() === ingLower) || stockDB.find(s => s.insumo.toLowerCase().includes(ingLower.split(' ')[0]))
              const ms = stockItem?.pct_ms || 0
              return a + x.kg * ms / 100
            }, 0)
            const pctMSDieta = total > 0 ? (kgMSDieta / total * 100) : 0
            let acum = 0
            return (
              <div key={key} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{e.label}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: S.accent, fontWeight: 600, padding: '3px 9px', background: S.accentLight, borderRadius: 5 }}>% Materia seca: {pctMSDieta.toFixed(1)}%</span>
                    <span style={{ fontSize: 12, color: totalOk ? S.green : S.red, fontWeight: 600 }}>Total: {total.toFixed(1)} / 100 kg {!totalOk && '⚠'}</span>
                    {!modoEdit
                      ? <button onClick={() => setEditando({ ...editando, [key]: true })}
                          style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Editar</button>
                      : <>
                          <button onClick={() => guardarDieta(formulaDieta, e.key)}
                            style={{ padding: '5px 10px', fontSize: 12, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600 }}>Guardar</button>
                          <button onClick={() => { setEditando({ ...editando, [key]: false }); cargarDatos() }}
                            style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Cancelar</button>
                        </>
                    }
                  </div>
                </div>
                <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: S.bg }}>
                        {['', 'Ingrediente', 'Kg / 100', '% aprox', 'Acumulado', 'Precio ref.'].map((h, i) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: i <= 1 ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ings.map((ing, ii) => {
                        acum += ing.kg
                        const ingLower = ing.n.toLowerCase()
                        const stockItem = stockDB.find(s => s.insumo.toLowerCase() === ingLower)
                          || stockDB.find(s => s.insumo.toLowerCase().includes(ingLower.split(' ')[0]))
                        return (
                          <tr key={ii} style={{ borderBottom: `1px solid ${S.border}` }}>
                            <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                              {modoEdit && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <button onClick={() => moverIngrediente(formulaDieta, e.key, ii, -1)} disabled={ii === 0}
                                    style={{ padding: '1px 5px', fontSize: 10, background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 3, cursor: ii === 0 ? 'not-allowed' : 'pointer', opacity: ii === 0 ? 0.3 : 1 }}>↑</button>
                                  <button onClick={() => moverIngrediente(formulaDieta, e.key, ii, 1)} disabled={ii === ings.length - 1}
                                    style={{ padding: '1px 5px', fontSize: 10, background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 3, cursor: ii === ings.length - 1 ? 'not-allowed' : 'pointer', opacity: ii === ings.length - 1 ? 0.3 : 1 }}>↓</button>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 9, height: 9, borderRadius: '50%', background: ing.c, flexShrink: 0 }} />{ing.n}
                              </div>
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                              {modoEdit
                                ? <input type="number" step="0.1" min="0" max="100" value={ing.kg}
                                    onChange={ev => updateIng(formulaDieta, e.key, ii, ev.target.value)}
                                    style={{ width: 72, border: `1px solid ${S.border}`, borderRadius: 5, padding: '5px 8px', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, textAlign: 'right', background: S.surface }} />
                                : <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ing.kg}</span>
                              }
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                              <div>
                                <div style={{ fontSize: 11, fontFamily: 'monospace', color: S.muted, marginBottom: 3 }}>{(ing.kg).toFixed(1)}%</div>
                                <div style={{ height: 4, background: S.border, borderRadius: 2, overflow: 'hidden', width: 80, marginLeft: 'auto' }}>
                                  <div style={{ width: `${Math.min(100, ing.kg)}%`, height: '100%', borderRadius: 2, background: ing.c }} />
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{acum.toFixed(1)}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                              {stockItem?.precio_referencia
                                ? <span style={{ color: S.green, fontWeight: 600 }}>${stockItem.precio_referencia.toLocaleString('es-AR')}/kg</span>
                                : <span style={{ color: S.hint }}>—</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                      <tr style={{ background: S.bg, borderTop: `2px solid ${S.borderStrong}` }}>
                        <td style={{ padding: '9px 12px', fontWeight: 700 }}>Total</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: totalOk ? S.green : S.red }}>{total.toFixed(1)}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: totalOk ? S.green : S.red }}>100%</td>
                        <td /><td /><td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        {/* ── INGREDIENTES (STOCK-PRECIO) ── */}
        <div style={{ marginTop: '2rem' }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Ingredientes — Stock y precio</div>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: '.75rem' }}>El precio de cada insumo es el promedio de sus últimas 3 compras con precio cargado (se actualiza solo desde Insumos).</div>
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: S.bg }}>
                  {['Nombre', 'Base húmeda', '% MS', 'Materia seca', 'Precio/kg', 'Precio/kg MS', 'Total stock'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Nombre' ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stockDB.map(s => {
                  const ms = pctMS[s.id] !== undefined ? pctMS[s.id] : (s.pct_ms || 0)
                  const kgMS = Math.round(s.cantidad_kg * ms / 100)
                  const precioKgMS = s.precio_referencia && ms > 0 ? Math.round(s.precio_referencia * 100 / ms) : null
                  const totalStock = s.precio_referencia ? Math.round(s.cantidad_kg * s.precio_referencia) : null
                  const stockOk = s.cantidad_kg > (s.minimo_kg || 0)
                  return (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ fontWeight: 600 }}>{s.insumo}</div>
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: stockOk ? S.greenLight : S.redLight, color: stockOk ? S.green : S.red }}>
                          {stockOk ? 'EN STOCK' : 'SIN STOCK'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{s.cantidad_kg.toLocaleString('es-AR')} kg</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                        <input type="number" value={ms} min="0" max="100" step="0.5"
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0
                            setPctMS(prev => ({...prev, [s.id]: val}))
                          }}
                          onBlur={async e => {
                            const val = parseFloat(e.target.value) || 0
                            const { error } = await supabase.from('stock_insumos').update({ pct_ms: val }).eq('id', s.id)
                            if (error) alert('Error al guardar el % de materia seca: ' + error.message)
                          }}
                          style={{ width: 65, padding: '4px 6px', border: `1px solid ${S.accent}`, borderRadius: 5, fontSize: 12, fontFamily: 'monospace', textAlign: 'right', background: S.surface }} />
                        <span style={{ fontSize: 11, color: S.muted, marginLeft: 2 }}>%</span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{kgMS.toLocaleString('es-AR')} kg</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: s.precio_referencia ? S.text : S.hint }}>
                        {s.precio_referencia ? `$${Math.round(s.precio_referencia).toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: precioKgMS ? S.green : S.hint, fontWeight: 600 }}>
                        {precioKgMS ? `$${precioKgMS.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                        {totalStock ? `$${totalStock.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {/* ── STOCK ── */}
      {tab === 'stock' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Stock de insumos</h1>
              <div style={{ fontSize: 12, color: S.muted }}>Se descuenta al confirmar cada jornada</div>
            </div>
            <button onClick={() => setShowFormIngreso(!showFormIngreso)}
              style={{ padding: '8px 16px', fontSize: 13, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500 }}>
              + Registrar ingreso
            </button>
          </div>

          {stockDB.some(s => s.cantidad_kg <= s.minimo_kg) && (
            <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 8, padding: '.9rem 1rem', fontSize: 13, color: S.amber, marginBottom: '1rem', lineHeight: 1.6 }}>
              Algunos insumos estan bajos. Verifica antes de la proxima racion.
            </div>
          )}

          {showFormIngreso && (
            <div style={{ background: S.surface, border: `2px solid ${S.accent}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Registrar ingreso de insumo</div>
                <button onClick={() => setShowFormIngreso(false)} style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cerrar</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Insumo</label>
                  <select value={formIngreso.insumo} onChange={e => setFormIngreso({...formIngreso, insumo: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface }}>
                    {stockDB.map(s => <option key={s.id} value={s.insumo}>{s.insumo}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Fecha</label>
                  <input type="date" value={formIngreso.fecha} onChange={e => setFormIngreso({...formIngreso, fecha: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Kg materia fresca</label>
                  <input type="number" placeholder="ej. 5000" value={formIngreso.cantidad} onChange={e => setFormIngreso({...formIngreso, cantidad: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>% Materia seca</label>
                  <input type="number" min="0" max="100" step="0.1" placeholder="ej. 87.5" value={formIngreso.pct_ms} onChange={e => setFormIngreso({...formIngreso, pct_ms: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                {formIngreso.cantidad && formIngreso.pct_ms && (
                  <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: S.green, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Kg materia seca</label>
                      <div style={{ padding: '9px 12px', background: S.greenLight, border: `1px solid ${S.green}`, borderRadius: 6, fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: S.green }}>
                        {(parseFloat(formIngreso.cantidad) * parseFloat(formIngreso.pct_ms) / 100).toFixed(1)} kg MS
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>$/kg MS (se calcula al pagar)</label>
                      <div style={{ padding: '9px 12px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 6, fontFamily: 'monospace', fontSize: 13, color: S.muted }}>
                        Disponible al registrar pago
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Proveedor</label>
                  <select value={formIngreso.proveedor} onChange={e => setFormIngreso({...formIngreso, proveedor: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }}>
                    <option value="">— Seleccioná —</option>
                    {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                  <div style={{ fontSize: 10, color: S.hint, marginTop: 3 }}>¿No aparece? Cargalo primero en Contactos.</div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Remito</label>
                  <input type="text" value={formIngreso.remito} onChange={e => setFormIngreso({...formIngreso, remito: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                <input type="checkbox" id="alim_no_retirado" checked={!formIngreso.retirado} onChange={e => setFormIngreso({...formIngreso, retirado: !e.target.checked})} />
                <label htmlFor="alim_no_retirado" style={{ fontSize: 13, cursor: 'pointer' }}>
                  Todavía no lo retiramos (no suma al stock hasta que se marque como retirado)
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowFormIngreso(false)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Cancelar</button>
                <button onClick={guardarIngreso} disabled={guardando} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  {guardando ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </div>
          )}



          <StockABM stockDB={stockDB} onReload={cargarDatos} onShowIngreso={() => setShowFormIngreso(true)} historial={historial} formulas={formulas} formulaActiva={formulaActiva} historialInsumos={historialInsumos} />
        </div>
      )}

      {/* ── HISTORIAL DE RACIONES ── */}
      {tab === 'historial' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Historial de raciones</div>
              <div style={{ fontSize: 12, color: S.muted }}>{historial.length} registros · cargados desde la app móvil</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {historial.length > 0 && (
                <button onClick={() => {
                  // Exportar todo el historial visible
                  const porFecha = {}
                  historial.forEach(h => {
                    const fecha = h.fecha || h.creado_en?.split('T')[0]
                    if (!porFecha[fecha]) porFecha[fecha] = []
                    porFecha[fecha].push(h)
                  })
                  generarArchivoRaciones(porFecha, 'Historial completo')
                }}
                  style={{ padding: '8px 14px', fontSize: 12, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600 }}>
                  📄 Exportar todo
                </button>
              )}
            </div>
          </div>

          {/* Agrupar por fecha */}
          {(() => {
            const porFecha = {}
            historial.forEach(h => {
              const fecha = h.fecha || h.creado_en?.split('T')[0]
              if (!porFecha[fecha]) porFecha[fecha] = []
              porFecha[fecha].push(h)
            })
            return Object.entries(porFecha).sort((a, b) => b[0].localeCompare(a[0])).map(([fecha, items]) => {
              const totalKg = items.reduce((s, h) => s + (h.kg_total || 0), 0)
              const filasConAnimales = items.map(h => ({ animales: h.cantidad_animales ?? h.corrales?.animales ?? null, kg: h.kg_total || 0 })).filter(f => f.animales > 0)
              const promedioConsumoAnimal = filasConAnimales.length > 0
                ? filasConAnimales.reduce((s, f) => s + f.kg / f.animales, 0) / filasConAnimales.length
                : null

              // Resumen de kilos de cada insumo (maíz seco, maíz húmedo, rollo, etc.)
              // realmente usados ese día — separa la parte de rollo extra del mixer.
              const resumenInsumos = {}
              items.forEach(h => {
                const kgRollo = h.kg_rollo_extra || (h.solo_rollo ? (h.kg_total || 0) : 0)
                const kgMixer = (h.kg_total || 0) - kgRollo
                if (kgRollo > 0) resumenInsumos['Rollo'] = (resumenInsumos['Rollo'] || 0) + kgRollo
                if (kgMixer > 0) {
                  const etapa = h.mezclador === 'Acostumbramiento' ? 'acostumbramiento' : h.mezclador === 'Recria' ? 'recria' : 'terminacion'
                  const dietaH = h.tipo_dieta || 'seco'
                  const formulaDia = formulas?.[dietaH]?.[etapa] || []
                  formulaDia.forEach(ing => {
                    const kgIng = Math.round(ing.kg * kgMixer / 100)
                    if (kgIng) resumenInsumos[ing.n] = (resumenInsumos[ing.n] || 0) + kgIng
                  })
                }
              })

              return (
                <div key={fecha} style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.accent }}>
                      {new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: S.green }}>
                        Total: {totalKg.toLocaleString('es-AR')} kg
                      </div>
                      {promedioConsumoAnimal != null && (
                        <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: S.accent }}>
                          Promedio: {promedioConsumoAnimal.toFixed(1)} kg/cab
                        </div>
                      )}
                      <button onClick={() => generarArchivoRaciones({ [fecha]: items }, fecha)}
                        style={{ padding: '4px 10px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                        📄 Exportar día
                      </button>
                    </div>
                  </div>
                  {Object.keys(resumenInsumos).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {Object.entries(resumenInsumos).sort((a, b) => b[1] - a[1]).map(([nombre, kg]) => (
                        <div key={nombre} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 12 }}>
                          <span style={{ color: S.muted }}>{nombre}: </span>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', color: nombre === 'Rollo' ? '#639922' : S.text }}>{kg.toLocaleString('es-AR')} kg</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: S.bg }}>
                          {['Corral', 'Categoría', 'Etapa', 'Dieta', 'Kg cargados', 'Animales', 'Consumo/animal'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.sort((a, b) => parseInt(a.corrales?.numero || 99) - parseInt(b.corrales?.numero || 99)).map(h => {
                          const animalesFila = h.cantidad_animales ?? h.corrales?.animales ?? null
                          const consumoAnimal = animalesFila > 0 ? (h.kg_total || 0) / animalesFila : null
                          return (
                          <tr key={h.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>C-{h.corrales?.numero || '—'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              {h.corrales?.rol === 'clasificado' && h.corrales?.sub ? (
                                <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.accentLight, color: S.accent }}>
                                  Rango {h.corrales.sub}
                                </span>
                              ) : h.corrales?.rol ? (
                                <span style={{ fontSize: 11, color: S.muted, textTransform: 'capitalize' }}>{h.corrales.rol}</span>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '8px 12px', color: S.muted }}>{h.mezclador || h.mixer || '—'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: h.tipo_dieta === 'humedo' ? '#FFF3DC' : '#E8F4FF', color: h.tipo_dieta === 'humedo' ? '#B07000' : '#1A5A8A' }}>
                                {h.tipo_dieta === 'humedo' ? 'Maíz húmedo' : 'Maíz seco'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                              {h.rollo_y_mixer ? (
                                <span>
                                  <span style={{ color: S.green }}>{((h.kg_total || 0) - (h.kg_rollo_extra || 0)).toLocaleString('es-AR')} kg mixer</span>
                                  {' + '}
                                  <span style={{ color: '#639922' }}>{(h.kg_rollo_extra || 0).toLocaleString('es-AR')} kg rollo</span>
                                </span>
                              ) : h.solo_rollo ? (
                                <span style={{ color: '#639922' }}>{(h.kg_total || 0).toLocaleString('es-AR')} kg rollo</span>
                              ) : (
                                <span style={{ color: S.green }}>{(h.kg_total || 0).toLocaleString('es-AR')} kg</span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{animalesFila != null ? animalesFila.toLocaleString('es-AR') : '—'}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.accent }}>{consumoAnimal != null ? `${consumoAnimal.toFixed(1)} kg/cab` : '—'}</td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          })()}

          {historial.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: S.hint, background: S.surface, borderRadius: 10, border: `1px solid ${S.border}` }}>
              No hay raciones registradas. Se cargan desde la app móvil.
            </div>
          )}

          {/* ARCHIVO */}
          <button onClick={() => { if (!verArchivo && historialArchivo.length === 0) cargarArchivo(); setVerArchivo(!verArchivo) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", marginBottom: '1rem' }}>
            {verArchivo ? '▾' : '▸'} {cargandoArchivo ? 'Cargando...' : `Archivo (días anteriores a los últimos 7 días)`}
          </button>
          {verArchivo && (
            <div>
              {cargandoArchivo && (
                <div style={{ padding: '2rem', textAlign: 'center', color: S.muted, fontSize: 13 }}>Cargando archivo...</div>
              )}
              {!cargandoArchivo && historialArchivo.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay raciones archivadas.</div>
              )}
              {!cargandoArchivo && historialArchivo.length > 0 && (() => {
                const porFecha = {}
                historialArchivo.forEach(h => {
                  const fecha = h.fecha || h.creado_en?.split('T')[0]
                  if (!porFecha[fecha]) porFecha[fecha] = []
                  porFecha[fecha].push(h)
                })
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                      <button onClick={() => {
                        generarArchivoRaciones(porFecha, 'Archivo completo')
                      }} style={{ padding: '7px 14px', fontSize: 12, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                        📄 Exportar archivo completo
                      </button>
                    </div>
                    {Object.entries(porFecha).sort((a, b) => b[0].localeCompare(a[0])).map(([fecha, items]) => {
                      const totalKg = items.reduce((s, h) => s + (h.kg_total || 0), 0)
                      const filasConAnimales = items.map(h => ({ animales: h.cantidad_animales ?? h.corrales?.animales ?? null, kg: h.kg_total || 0 })).filter(f => f.animales > 0)
                      const promedioConsumoAnimal = filasConAnimales.length > 0
                        ? filasConAnimales.reduce((s, f) => s + f.kg / f.animales, 0) / filasConAnimales.length
                        : null
                      return (
                        <div key={fecha} style={{ marginBottom: '1.25rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: S.accent }}>
                              {new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: S.green }}>
                                Total: {totalKg.toLocaleString('es-AR')} kg
                              </div>
                              {promedioConsumoAnimal != null && (
                                <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: S.accent }}>
                                  Promedio: {promedioConsumoAnimal.toFixed(1)} kg/cab
                                </div>
                              )}
                              <button onClick={() => generarArchivoRaciones({ [fecha]: items }, fecha)}
                                style={{ padding: '4px 10px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                                📄 Exportar día
                              </button>
                            </div>
                          </div>
                          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead>
                                <tr style={{ background: S.bg }}>
                                  {['Corral', 'Categoría', 'Etapa', 'Dieta', 'Kg cargados', 'Animales', 'Consumo/animal'].map(h => (
                                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {items.sort((a, b) => parseInt(a.corrales?.numero || 99) - parseInt(b.corrales?.numero || 99)).map(h => {
                                  const animalesFila = h.cantidad_animales ?? h.corrales?.animales ?? null
                                  const consumoAnimal = animalesFila > 0 ? (h.kg_total || 0) / animalesFila : null
                                  return (
                                  <tr key={h.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>C-{h.corrales?.numero || '—'}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                      {h.corrales?.rol === 'clasificado' && h.corrales?.sub ? (
                                        <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.accentLight, color: S.accent }}>
                                          Rango {h.corrales.sub}
                                        </span>
                                      ) : h.corrales?.rol ? (
                                        <span style={{ fontSize: 11, color: S.muted, textTransform: 'capitalize' }}>{h.corrales.rol}</span>
                                      ) : '—'}
                                    </td>
                                    <td style={{ padding: '8px 12px', color: S.muted }}>{h.mezclador || h.mixer || '—'}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                      <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: h.tipo_dieta === 'humedo' ? '#FFF3DC' : '#E8F4FF', color: h.tipo_dieta === 'humedo' ? '#B07000' : '#1A5A8A' }}>
                                        {h.tipo_dieta === 'humedo' ? 'Maíz húmedo' : 'Maíz seco'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                                      {h.rollo_y_mixer ? (
                                        <span>
                                          <span style={{ color: S.green }}>{((h.kg_total || 0) - (h.kg_rollo_extra || 0)).toLocaleString('es-AR')} kg mixer</span>
                                          {' + '}
                                          <span style={{ color: '#639922' }}>{(h.kg_rollo_extra || 0).toLocaleString('es-AR')} kg rollo</span>
                                        </span>
                                      ) : h.solo_rollo ? (
                                        <span style={{ color: '#639922' }}>{(h.kg_total || 0).toLocaleString('es-AR')} kg rollo</span>
                                      ) : (
                                        <span style={{ color: S.green }}>{(h.kg_total || 0).toLocaleString('es-AR')} kg</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{animalesFila != null ? animalesFila.toLocaleString('es-AR') : '—'}</td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.accent }}>{consumoAnimal != null ? `${consumoAnimal.toFixed(1)} kg/cab` : '—'}</td>
                                  </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StockABM({ stockDB, onReload, onShowIngreso, historial, formulas, formulaActiva, historialInsumos = [] }) {
  const kgDiaPorInsumo = {}
  if (historial && historial.length > 0 && formulas && formulaActiva) {
    const porFecha = {}
    historial.forEach(h => {
      const fecha = new Date(h.creado_en || h.fecha).toDateString()
      if (!porFecha[fecha]) porFecha[fecha] = {}
      const etapa = (h.mezclador || h.mixer || '').toLowerCase().replace('mixer 1 - ', '').replace('mixer 2 - ', '').replace('mixer 3 - ', '') || 'recria'
      const dietaRacion = h.tipo_dieta || formulaActiva
      const formula = formulas[dietaRacion]?.[etapa] || []
      formula.forEach(ing => {
        const kgIng = Math.round(ing.kg * (h.kg_total || 0) / 100)
        if (!porFecha[fecha][ing.n]) porFecha[fecha][ing.n] = 0
        porFecha[fecha][ing.n] += kgIng
      })
    })
    const fechas = Object.keys(porFecha)
    if (fechas.length > 0) {
      const allInsumos = new Set(fechas.flatMap(f => Object.keys(porFecha[f])))
      allInsumos.forEach(ing => {
        const total = fechas.reduce((s, f) => s + (porFecha[f][ing] || 0), 0)
        kgDiaPorInsumo[ing] = total / fechas.length
      })
    }
  }

  const [nuevoInsumo, setNuevoInsumo] = useState({ show: false, nombre: '', minimo_kg: '' })
  const [editMinimo, setEditMinimo] = useState({})
  const [editInsumo, setEditInsumo] = useState({})
  const [guardando, setGuardando] = useState(false)
  const COLORES = { 'Rollo (heno)': '#639922', 'Maiz grano seco': '#E8A020', 'Vitaminas': '#5090E0', 'Urea': '#9060C0', 'Soja (expeller)': '#20A060' }

  async function agregarInsumo() {
    if (!nuevoInsumo.nombre.trim()) { alert('Ingresa el nombre del insumo'); return }
    setGuardando(true)
    await supabase.from('stock_insumos').insert({ insumo: nuevoInsumo.nombre.trim(), cantidad_kg: 0, minimo_kg: parseInt(nuevoInsumo.minimo_kg) || 0 })
    await onReload()
    setNuevoInsumo({ show: false, nombre: '', minimo_kg: '' })
    setGuardando(false)
  }

  async function eliminarInsumo(id, nombre) {
    if (!confirm(`Eliminar "${nombre}" del stock?`)) return
    await supabase.from('stock_insumos').delete().eq('id', id)
    await onReload()
  }

  async function guardarInsumo(id, campos) {
    await supabase.from('stock_insumos').update(campos).eq('id', id)
    setEditInsumo({ ...editInsumo, [id]: false })
    await onReload()
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 10, padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.07em' }}>Estado actual</div>
        <button onClick={() => setNuevoInsumo({ show: true, nombre: '', minimo_kg: '' })}
          style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: '1px solid #E2DDD6', color: '#6B6760', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Nuevo insumo
        </button>
      </div>

      {nuevoInsumo.show && (
        <div style={{ background: '#F7F5F0', border: '1px solid #E2DDD6', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '.75rem' }}>Nuevo insumo</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Nombre</label>
              <input type="text" placeholder="ej. Pellet de soja" value={nuevoInsumo.nombre}
                onChange={e => setNuevoInsumo({ ...nuevoInsumo, nombre: e.target.value })}
                style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 6, padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Minimo de alerta (kg)</label>
              <input type="number" placeholder="ej. 500" value={nuevoInsumo.minimo_kg}
                onChange={e => setNuevoInsumo({ ...nuevoInsumo, minimo_kg: e.target.value })}
                style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 6, padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setNuevoInsumo({ show: false, nombre: '', minimo_kg: '' })}
              style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', border: '1px solid #E2DDD6', color: '#6B6760', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={agregarInsumo} disabled={guardando}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: '#1E5C2E', border: '1px solid #1E5C2E', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              {guardando ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      )}

      {stockDB.length === 0 && <p style={{ fontSize: 13, color: '#9E9A94' }}>No hay insumos registrados.</p>}
      {stockDB.map(s => {
        const bajo = s.cantidad_kg <= s.minimo_kg
        const pct = Math.min(100, Math.round(s.cantidad_kg / Math.max(s.minimo_kg * 3, s.cantidad_kg, 1) * 100))
        const barColor = bajo ? '#E24B4A' : pct < 40 ? '#EF9F27' : '#1E5C2E'
        const c = COLORES[s.insumo] || '#808080'
        const isEditing = editInsumo[s.id]
        const insumoLower = s.insumo.toLowerCase()
        const kgDia = (
          Object.entries(kgDiaPorInsumo).find(([k]) => k.toLowerCase() === insumoLower) ||
          Object.entries(kgDiaPorInsumo).find(([k]) =>
            insumoLower.includes(k.toLowerCase().split(' ')[0]) ||
            k.toLowerCase().includes(insumoLower.split(' ')[0])
          )
        )?.[1]
        const diasRestantes = kgDia > 0 ? Math.floor(s.cantidad_kg / kgDia) : null
        return (
          <div key={s.id} style={{ padding: '.85rem 0', borderBottom: '1px solid #E2DDD6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0 }} />
                {s.insumo}
                {kgDia > 0 && <span style={{ fontSize: 11, color: '#6B6760', fontFamily: 'monospace' }}>· ~{Math.round(kgDia).toLocaleString('es-AR')} kg/día</span>}
                {s.precio_referencia && (
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#1E5C2E', background: '#E8F4EB', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                    ${s.precio_referencia.toLocaleString('es-AR')}/kg
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: barColor }}>{s.cantidad_kg.toLocaleString('es-AR')} kg</span>
                {diasRestantes !== null && (
                  <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                    background: diasRestantes <= 7 ? '#FDF0E0' : '#E8F4EB',
                    color: diasRestantes <= 7 ? '#7A4500' : '#1E5C2E' }}>
                    {diasRestantes <= 7 ? `⚠ Solo ${diasRestantes} días` : `${diasRestantes} días`}
                  </span>
                )}
                <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                  background: bajo ? '#FDF0F0' : pct < 40 ? '#FDF0E0' : '#E8F4EB',
                  color: bajo ? '#7A1A1A' : pct < 40 ? '#7A4500' : '#1E5C2E' }}>
                  {bajo ? '⚠ Bajo minimo' : 'OK'}
                </span>
                <button onClick={() => onShowIngreso()}
                  style={{ padding: '4px 8px', fontSize: 11, background: 'transparent', border: '1px solid #E2DDD6', color: '#6B6760', borderRadius: 5, cursor: 'pointer' }}>+ Ingreso</button>
                <button onClick={() => setEditInsumo({ ...editInsumo, [s.id]: !isEditing })}
                  style={{ padding: '4px 8px', fontSize: 11, background: isEditing ? '#E8EFF8' : 'transparent', border: '1px solid #E2DDD6', color: '#1A3D6B', borderRadius: 5, cursor: 'pointer' }}>
                  {isEditing ? 'Cancelar' : 'Editar'}
                </button>
                <button onClick={() => eliminarInsumo(s.id, s.insumo)}
                  style={{ padding: '4px 8px', fontSize: 11, background: '#FDF0F0', border: '1px solid #F09595', color: '#7A1A1A', borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
              </div>
            </div>

            {isEditing && (
              <div style={{ background: '#F7F5F0', border: '1px solid #E2DDD6', borderRadius: 8, padding: '1rem', marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Nombre</label>
                    <input type="text" defaultValue={s.insumo} id={`nombre_${s.id}`}
                      style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 6, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Stock actual (kg)</label>
                    <input type="number" defaultValue={s.cantidad_kg} id={`cant_${s.id}`}
                      style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Mínimo (kg)</label>
                    <input type="number" defaultValue={s.minimo_kg} id={`minimo_${s.id}`}
                      style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setEditInsumo({ ...editInsumo, [s.id]: false })}
                    style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', border: '1px solid #E2DDD6', color: '#6B6760', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={() => guardarInsumo(s.id, {
                    insumo: document.getElementById(`nombre_${s.id}`).value,
                    cantidad_kg: parseFloat(document.getElementById(`cant_${s.id}`).value) || 0,
                    minimo_kg: parseInt(document.getElementById(`minimo_${s.id}`).value) || 0,
                  })}
                    style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: '#1E5C2E', border: '1px solid #1E5C2E', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                    Guardar
                  </button>
                </div>
              </div>
            )}

            <div style={{ height: 6, background: '#F7F5F0', borderRadius: 3, overflow: 'hidden', border: '1px solid #E2DDD6', marginBottom: 4 }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: barColor }} />
            </div>
            <div style={{ fontSize: 11, color: '#6B6760' }}>
              Mínimo de alerta: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.minimo_kg.toLocaleString('es-AR')} kg</span>
            </div>
          </div>
        )
      })}

      {/* Historial de ingresos */}
      {historialInsumos.length > 0 && (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #E2DDD6', paddingTop: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.75rem' }}>Historial de ingresos</div>
          <div style={{ border: '1px solid #E2DDD6', borderRadius: 8, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F7F5F0' }}>
                  {['Fecha', 'Insumo', 'Kg MF', '% MS', 'Kg MS', 'Proveedor', 'Remito', '$/kg MF', '$/kg MS', 'Estado', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', borderBottom: '1px solid #E2DDD6', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historialInsumos.map(c => {
                  const pctMs = c.pct_ms
                  const kgMs = c.kg_ms || (pctMs && c.cantidad ? Math.round(c.cantidad * pctMs / 100 * 10) / 10 : null)
                  const precioKgMf = c.precio_unitario
                  const precioKgMs = (precioKgMf && pctMs) ? Math.round(precioKgMf / (pctMs / 100)) : null
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #E2DDD6' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {c.fecha ? new Date(c.fecha+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{c.insumo_nombre || '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right' }}>{c.cantidad ? `${c.cantidad.toLocaleString('es-AR')} kg` : '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', color: '#1A3D6B' }}>{pctMs ? `${pctMs}%` : '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', color: '#1E5C2E', fontWeight: 600 }}>{kgMs ? `${kgMs.toLocaleString('es-AR')} kg` : '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#6B6760', fontSize: 12 }}>{c.proveedor || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#6B6760', fontSize: 12 }}>{c.numero_factura || '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right' }}>{precioKgMf ? `$${precioKgMf.toLocaleString('es-AR')}` : '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', color: '#1A3D6B', fontWeight: 600 }}>{precioKgMs ? `$${precioKgMs.toLocaleString('es-AR')}` : '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: c.estado_pago === 'pagado' ? '#E8F4EB' : '#FDF0E0', color: c.estado_pago === 'pagado' ? '#1E5C2E' : '#7A4500' }}>
                          {c.estado_pago === 'pagado' ? '✓ Pagado' : '⏳ Pendiente'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {c.retirado === false && (
                            <button onClick={async () => {
                              const { error: errRpc } = await supabase.rpc('incrementar_stock_insumo', { p_id: c.insumo_id, p_delta: c.cantidad })
                              if (errRpc) { alert('Error al sumar al stock: ' + errRpc.message); return }
                              await supabase.from('compras_insumos').update({ retirado: true }).eq('id', c.id)
                              onReload()
                            }} style={{ padding: '3px 8px', fontSize: 11, background: '#F0EAFB', border: '1px solid #9F8ED4', color: '#3D1A6B', borderRadius: 5, cursor: 'pointer' }}>
                              📦 Marcar retirado
                            </button>
                          )}
                          <button onClick={async () => {
                            const nuevaCant = prompt('Nueva cantidad (kg):', c.cantidad)
                            if (!nuevaCant) return
                            const nuevoPct = prompt('% Materia seca:', c.pct_ms || '')
                            const nuevoProveedor = prompt('Proveedor (tal cual figura en Contactos):', c.proveedor || '')
                            if (nuevoProveedor && !contactos.some(ct => ct.nombre === nuevoProveedor)) {
                              alert(`"${nuevoProveedor}" no coincide con ningún contacto cargado. Escribilo tal cual figura en Contactos, o cargalo ahí primero.`)
                              return
                            }
                            const nuevoRemito = prompt('N° Remito:', c.numero_factura || '')
                            const pctMsNew = parseFloat(nuevoPct) || null
                            const kgMsNew = pctMsNew ? Math.round(parseFloat(nuevaCant) * pctMsNew / 100 * 10) / 10 : null
                            await supabase.from('compras_insumos').update({ cantidad: parseFloat(nuevaCant), pct_ms: pctMsNew, kg_ms: kgMsNew, proveedor: nuevoProveedor || null, numero_factura: nuevoRemito || null }).eq('id', c.id)
                            onReload()
                          }} style={{ padding: '3px 8px', fontSize: 11, background: 'transparent', border: '1px solid #E2DDD6', color: '#6B6760', borderRadius: 5, cursor: 'pointer' }}>✏</button>
                          <button onClick={async () => {
                            if (!confirm(`¿Eliminar ingreso de ${c.insumo_nombre}? ${c.retirado !== false ? `Esto también va a descontar ${c.cantidad?.toLocaleString('es-AR')} kg del stock.` : ''}`)) return
                            if (c.insumo_id && c.cantidad && c.retirado !== false) {
                              const { error: errStock } = await supabase.rpc('incrementar_stock_insumo', { p_id: c.insumo_id, p_delta: -c.cantidad })
                              if (errStock) { alert('No se pudo descontar del stock: ' + errStock.message + ' — no se borró el ingreso.'); return }
                            }
                            await supabase.from('compras_insumos').delete().eq('id', c.id)
                            onReload()
                          }} style={{ padding: '3px 8px', fontSize: 11, background: '#FDF0F0', border: '1px solid #F09595', color: '#7A1A1A', borderRadius: 5, cursor: 'pointer' }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
