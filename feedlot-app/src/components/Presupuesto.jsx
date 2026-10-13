import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { Loader } from './UI'

// ─────────────────────────────────────────────────────────────────────────────
// Presupuesto (flujo de fondos)
//
//  · Meses pasados: salen DIRECTO de las cajas (Caja 1 + Caja 2), a través de
//    la vista v_caja_movimientos, que dice de qué actividad y de qué origen es
//    cada movimiento. Así el presupuesto coincide con la caja por construcción:
//    el saldo acumulado de la columna "hasta hoy" es el saldo de caja de hoy.
//  · Meses futuros (y el resto del mes en curso): lo que ya está cargado como
//    pendiente en la app (Cuentas a cobrar / Cuentas a pagar: ventas sin
//    cobrar, compras sin pagar, cuotas de crédito, lotes, fletes, órdenes…),
//    más un promedio de los últimos meses para los gastos que se repiten todos
//    los meses (sueldos, gastos generales, arriendos), más lo que se cargue a
//    mano tocando cualquier celda.
//  · Lo que no es ingreso ni gasto de una actividad (retiros de socios, cuotas
//    de crédito, compra de dólares, ajustes de conciliación) va en renglones
//    aparte, en el Resumen.
//  · Lo "General" (gastos y sueldos de toda la empresa) se reparte en tercios
//    entre las tres actividades, igual que en Reportes.
//  · Igual que la caja: un cheque cuenta el día que se recibe/entrega. Abajo
//    del saldo se muestra cuánto de ese saldo son cheques todavía no cobrados.
// ─────────────────────────────────────────────────────────────────────────────

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const ACTIVIDADES = ['Feedlot', 'Agricultura', 'Servicios']
// Bloques que no son resultado de ninguna actividad — solo en el Resumen
const NO_RESULTADO = [
  { act: 'Socios', label: 'Retiros de socios' },
  { act: 'Financiero', label: 'Créditos (cuotas)' },
  { act: 'Impuestos', label: 'Impuestos / retenciones' },
  { act: 'Inversiones', label: 'Venta de activos' },
  { act: 'Movimiento interno', label: 'Movimientos internos (compra de dólares)' },
  { act: 'Ajuste', label: 'Ajustes de conciliación' },
  { act: 'Otros', label: 'Otros (cargados a mano)' },
  { act: 'Sin clasificar', label: 'Sin clasificar' },
]
const NOMBRE_GRUPO = {
  'Ventas de hacienda': 'Venta de hacienda',
  'Compras de hacienda': 'Compra de hacienda',
  'Ventas de granos': 'Venta de granos',
  'Servicios': 'Servicios a terceros',
  'Retiros de socios': 'Retiros',
  'Créditos': 'Cuotas',
}
const ORDEN_GRUPOS = ['Venta de hacienda', 'Venta de granos', 'Servicios a terceros', 'Compra de hacienda', 'Compra de insumos', 'Fletes', 'Órdenes de trabajo', 'Arriendos', 'Sueldos', 'Mano de obra servicios', 'Gastos generales', 'Cargado a mano']
// Gastos que se repiten todos los meses: si no hay nada cargado para un mes
// futuro, se sugiere el promedio de los últimos meses (en itálica).
const RECURRENTES = ['Sueldos', 'Gastos generales', 'Mano de obra servicios', 'Arriendos']
const MANO = 'Cargado a mano'
const FINALES = ['cobrado', 'rechazado', 'anulado']

const pad = n => String(n).padStart(2, '0')
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const sumarDias = (f, d) => { const x = new Date(f + 'T12:00:00'); x.setDate(x.getDate() + d); return iso(x) }
const finDeMes = mk => { const [y, m] = mk.split('-').map(Number); return iso(new Date(y, m, 0)) }
const num = v => parseFloat(v) || 0
const sumaPagos = arr => (Array.isArray(arr) ? arr : []).reduce((t, p) => t + num(p?.monto), 0)
const fmtF = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'
const $ = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-AR')
function fmt(n) {
  if (!n || Math.abs(n) < 0.5) return ''
  return Math.round(n).toLocaleString('es-AR')
}
// Cheques: igual criterio que la Conciliación
const fechaCobroCheque = c => c.tipo === 'emitido'
  ? (c.fecha_vencimiento || c.fecha_cobro || null)
  : (c.fecha_cobro || (c.fecha_vencimiento ? sumarDias(c.fecha_vencimiento, -30) : null))

// Saca de la descripción del movimiento de caja el "de quién" (cliente,
// proveedor, empleado, categoría de gasto…) para el desglose de cada renglón.
function detalleDe(origen, desc) {
  const d = (desc || '').replace(/\s+/g, ' ').trim()
  const sinParen = s => s.replace(/\s*\([^)]*\)?/g, ' ').trim()
  const tras = s => { const i = s.indexOf(' — '); return i >= 0 ? s.slice(i + 3) : '' }
  const corta = s => s.split(' · ')[0].split(' — ')[0]
  let r
  if (origen === 'Ventas de hacienda') r = d.split(' — ')[0].replace(/^(Cobro )?venta( hacienda)?\s*/i, '').replace(/C-[\wáéíóú]+,?/gi, '').split(' · ')[0]
  else if (origen === 'Compras de hacienda') r = d.split(' — ')[0].replace(/^Pago compra\s*/i, '').replace(/\s+C-[\wáéíóú]+.*$/i, '')
  else if (origen === 'Fletes') r = sinParen(corta(d.replace(/^Flete\s*/i, '')))
  else if (origen === 'Gastos generales') r = (tras(d) || d).split(/:| \(| — /)[0]
  else if (origen === 'Arriendos') r = d.replace(/^Arriendo\s*/i, '').split(' — ')[0]
  else r = sinParen(corta(tras(d)))
  r = sinParen(r || '').replace(/\s+/g, ' ').trim()
  if (!r) r = origen === 'Compra de insumos' ? 'Varios' : (sinParen(corta(d)).slice(0, 40) || 'Sin detalle')
  return r
}

// Trae todas las filas (la API corta en 1000 por consulta)
async function traerTodo(armar) {
  const TAM = 1000
  const out = []
  for (let desde = 0; ; desde += TAM) {
    const { data, error } = await armar().range(desde, desde + TAM - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < TAM) break
  }
  return out
}

// Compras de insumos financiadas con un crédito: la plata sale con las cuotas
// (que ya están en Créditos), no con la compra.
async function idsComprasConCredito() {
  const { data: creditos } = await supabase.from('creditos').select('compra_insumos_id').not('compra_insumos_id', 'is', null)
  const idsDirectos = (creditos || []).map(c => c.compra_insumos_id)
  if (idsDirectos.length === 0) return new Set()
  const { data: comprasBase } = await supabase.from('compras_insumos').select('id, proveedor, fecha').in('id', idsDirectos)
  const claves = new Set((comprasBase || []).map(c => `${c.proveedor}|${c.fecha}`))
  const { data: todas } = await supabase.from('compras_insumos').select('id, proveedor, fecha')
  return new Set((todas || []).filter(c => claves.has(`${c.proveedor}|${c.fecha}`)).map(c => c.id))
}

// Todo lo que está pendiente de cobro o de pago, con su fecha esperada.
// Mismos criterios que Cuentas a cobrar / Cuentas a pagar.
async function cargarPendientes() {
  const [{ data: ve }, { data: sv }, { data: vg }, { data: va }, { data: ci }, { data: gg },
    { data: pc }, { data: fl }, { data: lo }, { data: ot }, { data: arr }, { data: cfg }, idsCredito] = await Promise.all([
    supabase.from('ventas').select('*').neq('estado_comercial', 'cobrado'),
    supabase.from('servicios_terceros').select('*'),
    supabase.from('ventas_granos').select('*'),
    supabase.from('ventas_activos').select('*').neq('estado_cobro', 'cobrado'),
    supabase.from('compras_insumos').select('id, fecha, total, proveedor, insumo_tipo, insumo_nombre, canje_usd, pagos_detalle, es_prueba').in('estado_pago', ['pendiente', 'parcial']).eq('marcado_resuelto', false),
    supabase.from('gastos_generales').select('id, fecha, monto, proveedor, categoria, actividad, pagos_detalle').eq('estado_pago', 'pendiente').eq('marcado_resuelto', false),
    supabase.from('pagos_creditos').select('id, fecha, monto, monto_usd, nro_cuota, creditos(entidad, descripcion, es_dolares)').eq('estado', 'pendiente').eq('marcado_resuelto', false),
    supabase.from('fletes').select('id, fecha, monto, transportista, pagos_detalle').eq('estado_pago', 'pendiente').eq('marcado_resuelto', false),
    supabase.from('lotes').select('*').neq('estado_pago', 'pagado').eq('marcado_resuelto', false),
    supabase.from('ordenes_trabajo').select('id, fecha, costo_total, estado, proveedor, tipo, pagos_detalle').eq('estado_pago', 'pendiente').eq('marcado_resuelto', false).eq('es_propia', false),
    supabase.from('vencimientos_arriendo').select('id, fecha_vencimiento, monto_total, estado, pagos_detalle, campos(nombre)').neq('estado', 'pagado'),
    supabase.from('configuracion').select('valor').eq('clave', 'cotizacion_dolar_agro').maybeSingle(),
    idsComprasConCredito(),
  ])
  const dolar = num(cfg?.valor)
  const p = []
  const add = (act, tipo, grupo, detalle, fecha, monto, nota) => { if (monto > 1000 && fecha) p.push({ act, tipo, grupo, detalle: (detalle || 'Sin detalle').trim(), fecha, monto, nota }) }

  // ── Hacienda: igual que la Gestión Comercial (por grupo de venta) ──
  const ventas = (ve || []).filter(v => !v.es_prueba)
  const pagosV = {}
  if (ventas.length) {
    const pv = await traerTodo(() => supabase.from('pagos_ventas').select('venta_id, monto').in('venta_id', ventas.map(v => v.id)))
    pv.forEach(x => { pagosV[x.venta_id] = (pagosV[x.venta_id] || 0) + num(x.monto) })
  }
  const vistos = new Set()
  ventas.forEach(v => {
    if (v.grupo_venta_id) { if (vistos.has(v.grupo_venta_id)) return; vistos.add(v.grupo_venta_id) }
    const grupo = v.grupo_venta_id ? ventas.filter(x => x.grupo_venta_id === v.grupo_venta_id) : [v]
    const s = k => grupo.reduce((t, x) => t + num(x[k]), 0)
    const totalFact = s('monto_facturado'), totalNegro = s('monto_negro'), totalIva = s('iva_monto'), totalRet = s('retencion_monto')
    const totalCom = grupo.reduce((t, x) => t + ((!x.comision_es_paralela && x.comision_monto) ? num(x.comision_monto) : 0), 0)
    const totalReal = (totalFact + totalIva > 0 || totalNegro > 0) ? (totalFact + totalIva - totalCom - totalRet + totalNegro) : s('total')
    const saldo = totalReal - grupo.reduce((t, x) => t + (pagosV[x.id] || 0), 0)
    const fechaVenta = (v.creado_en || '').slice(0, 10)
    let vence = grupo.map(x => x.fecha_vencimiento_cobro).filter(Boolean).sort()[0]
    if (!vence && fechaVenta) vence = sumarDias(fechaVenta, parseInt(v.plazo_dias) || 0)
    add('Feedlot', 'ingreso', 'Venta de hacienda', v.comprador, vence, saldo, `${v.comprador || ''} · venta ${fmtF(fechaVenta)}`)
  })

  // ── Servicios a terceros sin cobrar ──
  ;(sv || []).filter(s => !s.es_prueba && !['cobrado', 'pagado'].includes(s.estado_pago) && !/ramonda hnos/i.test(s.cliente || '')).forEach(s => {
    const saldo = num(s.total) + num(s.monto_negro) - sumaPagos(s.pagos_detalle)
    const vence = s.fecha_cobro || (s.fecha ? sumarDias(s.fecha, parseInt(s.plazo_pago) || 0) : null)
    add('Servicios', 'ingreso', 'Servicios a terceros', s.cliente, vence, saldo, `${s.cliente || ''} · ${s.labor || 'servicio'}`)
  })

  // ── Granos vendidos a terceros sin cobrar ──
  ;(vg || []).filter(v => !/ramonda hnos/i.test(v.comprador || '') && !/traspaso interno/i.test(v.observaciones || '')).forEach(v => {
    add('Agricultura', 'ingreso', 'Venta de granos', v.comprador, v.fecha, num(v.total) - sumaPagos(v.pagos_detalle), `${v.comprador || ''} · ${v.cultivo || 'grano'}`)
  })

  // ── Activos vendidos sin cobrar (no es resultado) ──
  ;(va || []).forEach(a => add('Inversiones', 'ingreso', 'Venta de activos', a.activo_nombre, a.fecha, num(a.monto) - sumaPagos(a.pagos_detalle), `${a.activo_nombre || ''} · ${a.comprador || ''}`))

  // ── Compras de insumos sin pagar (las de canje se pagan con grano, no con plata) ──
  ;(ci || []).filter(c => !c.es_prueba && !idsCredito.has(c.id) && !(num(c.canje_usd) > 0)).forEach(c => {
    add(c.insumo_tipo === 'agro' ? 'Agricultura' : 'Feedlot', 'egreso', 'Compra de insumos', c.proveedor, c.fecha, num(c.total) - sumaPagos(c.pagos_detalle), `${c.proveedor || ''} · ${c.insumo_nombre || ''}`)
  })

  // ── Gastos generales sin pagar ──
  ;(gg || []).forEach(g => add(g.actividad || 'General', 'egreso', 'Gastos generales', g.categoria, g.fecha, num(g.monto) - sumaPagos(g.pagos_detalle), `${g.categoria || ''} · ${g.proveedor || ''}`))

  // ── Cuotas de crédito (las de dólares, al dólar de hoy) ──
  ;(pc || []).forEach(c => {
    let monto = num(c.monto)
    let nota = `${c.creditos?.descripcion || c.creditos?.entidad || ''} · cuota ${c.nro_cuota || ''}`
    if (!monto && num(c.monto_usd) && dolar) { monto = num(c.monto_usd) * dolar; nota += ` · US$${Math.round(num(c.monto_usd)).toLocaleString('es-AR')} al dólar de hoy` }
    add('Financiero', 'egreso', 'Cuotas', c.creditos?.descripcion || c.creditos?.entidad, c.fecha, monto, nota)
  })

  // ── Fletes sin pagar ──
  ;(fl || []).forEach(f => add('Feedlot', 'egreso', 'Fletes', f.transportista, f.fecha, num(f.monto) - sumaPagos(f.pagos_detalle), f.transportista))

  // ── Órdenes de trabajo contratadas sin pagar (las emitidas todavía no se hicieron) ──
  ;(ot || []).filter(o => o.estado !== 'emitida').forEach(o => add('Agricultura', 'egreso', 'Órdenes de trabajo', o.proveedor, o.fecha, num(o.costo_total) - sumaPagos(o.pagos_detalle), `${o.proveedor || ''} · ${o.tipo || ''}`))

  // ── Arriendos con monto cargado ──
  ;(arr || []).forEach(a => add('Agricultura', 'egreso', 'Arriendos', a.campos?.nombre, a.fecha_vencimiento, num(a.monto_total) - sumaPagos(a.pagos_detalle), a.campos?.nombre))

  // ── Compras de hacienda con saldo ──
  const lotesPend = (lo || []).filter(l => !l.es_prueba)
  if (lotesPend.length) {
    const pagosL = await traerTodo(() => supabase.from('pagos_compras').select('lote_id, monto').in('lote_id', lotesPend.map(l => l.id)))
    const pag = {}
    pagosL.forEach(x => { pag[x.lote_id] = (pag[x.lote_id] || 0) + num(x.monto) })
    lotesPend.forEach(l => {
      const totalFacturasReal = (l.facturas_feria || []).reduce((s, f) => s + (num(f.total_factura_manual) || f.total_factura || 0), 0)
      const ivaMontoCalc = l.monto_facturado != null ? Math.round(l.monto_facturado * (l.iva_pct || 10.5) / 100) : (l.iva_monto || 0)
      const totalGC = (l.monto_facturado != null || l.monto_negro != null) ? (l.monto_facturado || 0) + ivaMontoCalc + (l.monto_negro || 0) : null
      const total = totalFacturasReal > 0 ? totalFacturasReal : (totalGC || num(l.monto_total_con_iva))
      add('Feedlot', 'egreso', 'Compra de hacienda', l.procedencia, l.fecha_vencimiento_pago || l.fecha_ingreso, total - (pag[l.id] || 0), `${l.procedencia || ''} · ${l.codigo || ''}`)
    })
  }
  return p
}

export default function Presupuesto() {
  const [vista, setVista] = useState('Resumen')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [movs, setMovs] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [cheques, setCheques] = useState([])
  const [lineas, setLineas] = useState([])
  const [filasExtra, setFilasExtra] = useState([])  // renglones agregados a mano todavía sin ningún valor
  const [editando, setEditando] = useState(null)
  const [valorEditando, setValorEditando] = useState('')
  const [abiertos, setAbiertos] = useState(new Set())

  // ── Columnas: 6 meses atrás · mes actual (hasta hoy | resto) · 12 adelante ──
  const hoyS = iso(new Date())
  const mkHoy = hoyS.slice(0, 7)
  const columnas = useMemo(() => {
    const h = new Date()
    const cols = []
    for (let i = -6; i <= 12; i++) {
      const d = new Date(h.getFullYear(), h.getMonth() + i, 1)
      const mk = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
      const label = `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
      const base = { mk, anio: d.getFullYear(), mes: d.getMonth() + 1, actual: i === 0 }
      if (i < 0) cols.push({ ...base, id: `${mk}|r`, proy: false, label, fin: finDeMes(mk) })
      else if (i === 0) {
        cols.push({ ...base, id: `${mk}|r`, proy: false, label, sub: 'hasta hoy', fin: hoyS, hoy: true })
        cols.push({ ...base, id: `${mk}|p`, proy: true, label, sub: 'resto', fin: finDeMes(mk) })
      } else cols.push({ ...base, id: `${mk}|p`, proy: true, label, fin: finDeMes(mk) })
    }
    return cols
  }, [hoyS])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const [m, p, { data: ch }, { data: li }] = await Promise.all([
        traerTodo(() => supabase.from('v_caja_movimientos').select('caja, id, fecha, tipo, monto, descripcion, origen, actividad, inferido').order('fecha').order('id')),
        cargarPendientes(),
        supabase.from('cheques').select('id, tipo, estado, monto, fecha_cobro, fecha_vencimiento, es_paralelo'),
        supabase.from('presupuesto_lineas').select('*').eq('es_proyeccion', true),
      ])
      setMovs(m)
      setPendientes(p)
      setCheques(ch || [])
      setLineas(li || [])
    } catch (e) {
      setError(e.message || String(e))
    }
    setLoading(false)
  }

  // ── Modelo: renglones con sus valores por columna ──
  const modelo = useMemo(() => {
    const colIds = new Set(columnas.map(c => c.id))
    const inicio = columnas[0].mk + '-01'
    const filas = new Map()
    const fila = (act, tipo, grupo, detalle) => {
      const id = `${act}|${tipo}|${grupo}|${detalle}`
      if (!filas.has(id)) filas.set(id, { id, act, tipo, grupo, detalle, label: `${grupo} — ${detalle}`, real: {}, auto: {}, items: {}, estim: {}, manual: {} })
      return filas.get(id)
    }
    const colReal = fecha => { const mk = fecha.slice(0, 7); return mk <= mkHoy ? `${mk}|r` : `${mk}|p` }
    const colProy = fecha => { const mk = fecha.slice(0, 7); return mk <= mkHoy ? `${mkHoy}|p` : `${mk}|p` }

    // Real: movimientos de caja
    let saldoInicial = 0, saldoHoy = 0
    const saldoCaja = { O: 0, P: 0 }
    movs.forEach(m => {
      const signo = m.tipo === 'ingreso' ? 1 : -1
      const monto = num(m.monto)
      if (m.fecha <= hoyS) { saldoHoy += signo * monto; saldoCaja[m.caja] = (saldoCaja[m.caja] || 0) + signo * monto }
      if (m.fecha < inicio) { saldoInicial += signo * monto; return }
      const col = colReal(m.fecha)
      if (!colIds.has(col)) return
      const act = m.actividad || 'Sin clasificar'
      const grupo = NOMBRE_GRUPO[m.origen] || m.origen || 'Sin clasificar'
      const det = act === 'Ajuste' ? (m.caja === 'O' ? 'Caja 1' : 'Caja 2') : detalleDe(m.origen, m.descripcion)
      const f = fila(act, m.tipo === 'ingreso' ? 'ingreso' : 'egreso', grupo, det)
      f.real[col] = (f.real[col] || 0) + monto
    })

    // Proyectado: pendientes de cobro / pago (lo vencido va al resto de este mes)
    pendientes.forEach(p => {
      const col = colProy(p.fecha)
      if (!colIds.has(col)) return
      const f = fila(p.act, p.tipo, p.grupo, p.detalle)
      f.auto[col] = (f.auto[col] || 0) + p.monto
      if (!f.items[col]) f.items[col] = []
      f.items[col].push(`${p.nota || p.detalle} · ${p.fecha < hoyS ? 'vencido ' : ''}${fmtF(p.fecha)} · ${$(p.monto)}`)
    })

    // A mano (presupuesto_lineas) — reemplazan el valor de esa celda
    lineas.forEach(l => {
      const mk = `${l.anio}-${pad(l.mes)}`
      if (mk < mkHoy) return
      const col = `${mk}|p`
      if (!colIds.has(col)) return
      const [grupo, ...resto] = (l.categoria || '').split(' — ')
      const detalle = resto.join(' — ') || grupo
      const id = `${l.actividad}|${l.tipo}|${grupo}|${detalle}`
      if (!filas.has(id) && !num(l.monto)) return
      fila(l.actividad, l.tipo, grupo, detalle).manual[col] = num(l.monto)
    })
    // Estimado: promedio de los últimos 3 meses cerrados, para lo que se repite
    const ultimos3 = columnas.filter(c => !c.proy && c.mk < mkHoy).slice(-3)
    const colActualReal = `${mkHoy}|r`
    const gruposRec = new Map()
    filas.forEach(f => {
      if (f.tipo !== 'egreso' || !RECURRENTES.includes(f.grupo)) return
      const k = `${f.act}|${f.grupo}`
      if (!gruposRec.has(k)) gruposRec.set(k, [])
      gruposRec.get(k).push(f)
    })
    gruposRec.forEach((fs, k) => {
      const [act, grupo] = k.split('|')
      const totales = ultimos3.map(c => fs.reduce((t, f) => t + (f.real[c.id] || 0), 0))
      const conDatos = totales.filter(v => v > 0)
      if (conDatos.length < 2) return
      const prom = conDatos.reduce((a, b) => a + b, 0) / conDatos.length
      const est = fila(act, 'egreso', grupo, 'estimado (promedio)')
      columnas.filter(c => c.proy).forEach(c => {
        if (fs.some(f => f.auto[c.id] || f.real[c.id] || f.manual[c.id] != null)) return
        const v = c.actual ? Math.max(0, prom - fs.reduce((t, f) => t + (f.real[colActualReal] || 0), 0)) : prom
        if (v > 0) est.estim[c.id] = v
      })
    })

    filasExtra.forEach(x => fila(x.act, x.tipo, x.grupo, x.detalle))

    return { filas: [...filas.values()], saldoInicial, saldoHoy, saldoCaja, inicio }
  }, [movs, pendientes, lineas, filasExtra, columnas, hoyS, mkHoy])

  // ── Valor de una celda ──
  function celda(f, c) {
    if (!c.proy) { const v = f.real[c.id] || 0; return { v, estado: v ? 'real' : 'vacio' } }
    if (f.manual[c.id] != null) return { v: f.manual[c.id], estado: 'manual' }
    const r = f.real[c.id] || 0, a = f.auto[c.id] || 0, e = f.estim[c.id] || 0
    return { v: r + a + e, estado: e ? 'estimado' : a ? 'auto' : r ? 'real' : 'vacio' }
  }
  const signo = f => f.tipo === 'ingreso' ? 1 : -1
  const neto = (fs, c, factor = 1) => fs.reduce((t, f) => t + signo(f) * celda(f, c).v * factor, 0)
  const filasDe = act => modelo.filas.filter(f => f.act === act)
  const balanceActividad = (act, c) => neto(filasDe(act), c) + neto(filasDe('General'), c, 1 / 3)
  const balanceTotal = c => neto(modelo.filas, c)

  // ── Guardar / borrar un valor a mano ──
  async function guardarCelda(f, c) {
    const txt = String(valorEditando).trim()
    const clave = { actividad: f.act, tipo: f.tipo, categoria: f.label, anio: c.anio, mes: c.mes }
    setEditando(null)
    if (txt === '') {
      const { error: e } = await supabase.from('presupuesto_lineas').delete().match(clave)
      if (e) { alert('Error al borrar: ' + e.message); return }
      setLineas(ls => ls.filter(l => !(l.actividad === clave.actividad && l.tipo === clave.tipo && l.categoria === clave.categoria && l.anio === clave.anio && l.mes === clave.mes)))
      return
    }
    const monto = parseFloat(txt.replace(/\./g, '').replace(',', '.')) || 0
    const { data, error: e } = await supabase.from('presupuesto_lineas')
      .upsert({ ...clave, monto, es_proyeccion: true }, { onConflict: 'actividad,tipo,categoria,anio,mes' }).select().single()
    if (e) { alert('Error al guardar: ' + e.message); return }
    setLineas(ls => [...ls.filter(l => l.id !== data.id), data])
  }

  function agregarRenglon(act, tipo) {
    const nombre = prompt(`Nombre del nuevo renglón de ${tipo === 'ingreso' ? 'ingreso' : 'egreso'} (ej. "Venta de novillos", "Compra de terneros")`)
    if (!nombre || !nombre.trim()) return
    setFilasExtra(xs => [...xs, { act, tipo, grupo: MANO, detalle: nombre.trim() }])
    setAbiertos(a => new Set([...a, `${act}|${tipo}|${MANO}`]))
  }

  if (loading) return <Loader />
  if (error) return <div style={{ padding: 20, color: S.red }}>Error al cargar el presupuesto: {error}</div>

  const COLOR_ESTADO = { real: null, auto: S.accent, manual: S.amber, estimado: '#B8A088', vacio: S.hint }
  const bgCol = c => c.actual ? (c.proy ? '#FFF6D8' : '#FFFBEA') : 'transparent'
  const tdNum = { padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, minWidth: 82, whiteSpace: 'nowrap' }
  const tdNombre = { padding: '6px 12px', fontSize: 12, position: 'sticky', left: 0, background: S.surface, whiteSpace: 'nowrap', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', zIndex: 1 }
  const toggle = k => { const n = new Set(abiertos); if (n.has(k)) n.delete(k); else n.add(k); setAbiertos(n) }
  const ordenGrupo = g => { const i = ORDEN_GRUPOS.indexOf(g); return i < 0 ? 99 : i }

  // Un renglón de detalle (editable en las columnas proyectadas)
  const renderFila = (f, { color, factor = 1, editable = true, indent = 28, nombre } = {}) => (
    <tr key={f.id + factor} style={{ borderBottom: `1px solid ${S.border}` }}>
      <td style={{ ...tdNombre, paddingLeft: indent, color: S.muted }} title={f.label}>{nombre || f.detalle}{factor !== 1 ? ' (⅓)' : ''}</td>
      {columnas.map(c => {
        const { v, estado } = celda(f, c)
        const clave = `${f.id}|${c.id}`
        const puede = editable && c.proy && factor === 1
        const esEdit = editando === clave
        const items = c.proy && estado === 'auto' ? (f.items[c.id] || []) : []
        return (
          <td key={c.id} title={items.length ? items.join('\n') : (estado === 'estimado' ? 'Promedio de los últimos meses (sugerido)' : estado === 'manual' ? 'Cargado a mano — borrá el número para volver al automático' : undefined)}
            onClick={() => { if (puede && !esEdit) { setEditando(clave); setValorEditando(estado === 'manual' ? String(Math.round(v)) : '') } }}
            style={{ ...tdNum, fontStyle: estado === 'estimado' ? 'italic' : 'normal', cursor: puede ? 'pointer' : 'default', background: esEdit ? S.accentLight : bgCol(c), color: COLOR_ESTADO[estado] || color }}>
            {esEdit ? (
              <input autoFocus type="text" inputMode="numeric" value={valorEditando} placeholder={v ? String(Math.round(v)) : ''} onChange={e => setValorEditando(e.target.value)}
                onBlur={() => guardarCelda(f, c)}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditando(null) }}
                style={{ width: 80, fontSize: 12, fontFamily: 'monospace', textAlign: 'right', border: `1px solid ${S.accent}`, borderRadius: 3, padding: '2px 4px' }} />
            ) : (fmt(v * factor) || <span style={{ color: S.hint }}>—</span>)}
          </td>
        )
      })}
    </tr>
  )

  // Un grupo (ej. "Compra de insumos") con su total y, desplegado, el detalle
  const renderGrupo = (clave, titulo, fs, { color, factor = 1, editable = true, conSigno = false } = {}) => {
    const abierto = abiertos.has(clave)
    const ultimo = f => f.detalle.startsWith('estimado') ? 1 : 0
    const ordenadas = [...fs].sort((a, b) => ultimo(a) - ultimo(b) || a.detalle.localeCompare(b.detalle))
    return [
      <tr key={clave} style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }} onClick={() => toggle(clave)}>
        <td style={{ ...tdNombre, fontWeight: 600, color: S.text }}>
          <span style={{ display: 'inline-block', width: 14, color: S.muted, fontSize: 10 }}>{abierto ? '▾' : '▸'}</span>
          {titulo} <span style={{ color: S.hint, fontWeight: 400 }}>({fs.length})</span>
        </td>
        {columnas.map(c => {
          const t = conSigno ? neto(fs, c, factor) : fs.reduce((s, f) => s + celda(f, c).v * factor, 0)
          const soloEstimado = c.proy && fs.every(f => ['estimado', 'vacio'].includes(celda(f, c).estado)) && t
          return <td key={c.id} style={{ ...tdNum, fontWeight: 600, fontStyle: soloEstimado ? 'italic' : 'normal', color: conSigno ? (t >= 0 ? S.green : S.red) : color, background: bgCol(c) }}>{fmt(t)}</td>
        })}
      </tr>,
      ...(abierto ? ordenadas.map(f => renderFila(f, { color, factor, editable, nombre: conSigno ? `${f.tipo === 'ingreso' ? '+' : '−'} ${f.grupo === f.detalle ? f.detalle : `${f.grupo} · ${f.detalle}`}` : undefined })) : []),
    ]
  }

  const renderSeparador = (texto, color, bg, accion) => (
    <tr key={'sep-' + texto}>
      <td style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.05em', background: bg, position: 'sticky', left: 0, zIndex: 1, whiteSpace: 'nowrap' }}>
        {texto}
        {accion && <button onClick={accion.fn} style={{ marginLeft: 10, fontSize: 10, padding: '2px 8px', borderRadius: 4, border: `1px solid ${color}`, background: S.surface, color, cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>{accion.label}</button>}
      </td>
      <td colSpan={columnas.length} style={{ background: bg }} />
    </tr>
  )

  const renderTotal = (texto, fn, { bg = S.bg, colorFijo, mostrarEn } = {}) => (
    <tr key={'tot-' + texto} style={{ borderTop: `2px solid ${S.border}`, background: bg }}>
      <td style={{ ...tdNombre, fontWeight: 700, background: bg, color: colorFijo || S.text }}>{texto}</td>
      {columnas.map(c => {
        if (mostrarEn && !mostrarEn(c)) return <td key={c.id} style={{ ...tdNum, background: bg }} />
        const v = fn(c)
        return <td key={c.id} style={{ ...tdNum, fontWeight: 700, color: colorFijo ? (v >= 0 ? colorFijo : S.red) : (v >= 0 ? S.green : S.red), background: c.actual ? bgCol(c) : bg }}>{fmt(v) || '0'}</td>
      })}
    </tr>
  )

  // Secciones de ingresos/egresos de una actividad (+ su tercio de lo General)
  const seccionesActividad = (act, tipo, color) => {
    const propias = filasDe(act).filter(f => f.tipo === tipo)
    const generales = filasDe('General').filter(f => f.tipo === tipo)
    const porGrupo = {}
    propias.forEach(f => { (porGrupo[f.grupo] = porGrupo[f.grupo] || []).push(f) })
    const out = []
    Object.keys(porGrupo).sort((a, b) => ordenGrupo(a) - ordenGrupo(b) || a.localeCompare(b))
      .forEach(g => out.push(...renderGrupo(`${act}|${tipo}|${g}`, g, porGrupo[g], { color })))
    if (generales.length) {
      const porGrupoG = {}
      generales.forEach(f => { (porGrupoG[f.grupo] = porGrupoG[f.grupo] || []).push(f) })
      Object.keys(porGrupoG).sort((a, b) => ordenGrupo(a) - ordenGrupo(b))
        .forEach(g => out.push(...renderGrupo(`${act}|General|${tipo}|${g}`, `${g} · empresa (⅓)`, porGrupoG[g], { color, factor: 1 / 3, editable: false })))
    }
    if (!out.length) out.push(<tr key={`vacio-${tipo}`}><td colSpan={columnas.length + 1} style={{ padding: '10px 12px', fontSize: 12, color: S.hint }}>Sin {tipo === 'ingreso' ? 'ingresos' : 'egresos'} en este período.</td></tr>)
    return out
  }

  // Cheques todavía no cobrados (incluidos en el saldo de caja) a una fecha
  const chequesAl = c => {
    const fin = c.fin
    const cartera = cheques.filter(ch => ch.tipo === 'recibido' && ch.estado === 'en_cartera' && (c.hoy || (fechaCobroCheque(ch) || '') > fin))
    const propios = cheques.filter(ch => {
      if (ch.tipo !== 'emitido' || FINALES.includes(ch.estado)) return false
      const fc = fechaCobroCheque(ch)
      if (!fc) return false
      return c.hoy ? sumarDias(fc, 30) >= hoyS : fc > fin
    })
    return { cartera: cartera.reduce((s, x) => s + num(x.monto), 0), propios: propios.reduce((s, x) => s + num(x.monto), 0) }
  }
  const acumulados = {}
  { let ac = modelo.saldoInicial; columnas.forEach(c => { ac += balanceTotal(c); acumulados[c.id] = ac }) }

  const cabecera = titulo => (
    <thead>
      <tr style={{ position: 'sticky', top: 0, background: S.bg, zIndex: 3 }}>
        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: S.muted, position: 'sticky', left: 0, background: S.bg, zIndex: 4 }}>{titulo}</th>
        {columnas.map(c => (
          <th key={c.id} style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, color: c.proy ? S.accent : S.muted, fontWeight: c.actual ? 700 : 600, background: c.actual ? bgCol(c) : S.bg, whiteSpace: 'nowrap', lineHeight: 1.2 }}>
            {c.label}{c.sub && <div style={{ fontSize: 9, fontWeight: 500 }}>{c.sub}</div>}
          </th>
        ))}
      </tr>
    </thead>
  )
  const marco = children => <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto', maxHeight: '75vh' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table></div>

  const inferidos = movs.filter(m => m.inferido && m.fecha >= modelo.inicio).length
  const sinClasificar = movs.filter(m => m.actividad === 'Sin clasificar' && m.fecha >= modelo.inicio).length

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0 }}>Presupuesto</h1>
        <div style={{ fontSize: 13, color: S.muted, marginTop: 4, maxWidth: 900 }}>
          Meses pasados: lo que realmente entró y salió de las cajas (Caja 1 + Caja 2). Del resto del mes en adelante: lo pendiente de cobro y de pago cargado en la app, más el promedio de los gastos de todos los meses. Tocá cualquier celda proyectada para cargarla a mano.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {['Resumen', ...ACTIVIDADES].map(a => (
          <button key={a} onClick={() => setVista(a)}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: `1px solid ${vista === a ? S.accent : S.border}`, background: vista === a ? S.accent : (a === 'Resumen' ? S.purpleLight : S.surface), color: vista === a ? '#fff' : (a === 'Resumen' ? S.purple : S.muted), cursor: 'pointer' }}>
            {a}
          </button>
        ))}
        <button onClick={cargar} style={{ marginLeft: 'auto', padding: '8px 12px', fontSize: 12, borderRadius: 6, border: `1px solid ${S.border}`, background: S.surface, color: S.muted, cursor: 'pointer' }}>↻ Actualizar</button>
      </div>

      <div style={{ fontSize: 11, color: S.hint, marginBottom: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span><b style={{ color: S.text }}>■</b> real (caja)</span>
        <span><b style={{ color: S.accent }}>■</b> pendiente cargado en la app (pasá el mouse para ver el detalle)</span>
        <span style={{ fontStyle: 'italic' }}><b style={{ color: '#B8A088' }}>■</b> estimado (promedio)</span>
        <span><b style={{ color: S.amber }}>■</b> cargado a mano</span>
        {inferidos > 0 && <span>· {inferidos} movimientos de caja sin vínculo se clasificaron por su descripción</span>}
        {sinClasificar > 0 && <span style={{ color: S.red }}>· {sinClasificar} sin clasificar</span>}
      </div>

      {vista === 'Resumen' ? (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            {[
              { t: `Saldo de caja al ${fmtF(sumarDias(modelo.inicio, -1))}`, v: modelo.saldoInicial },
              { t: 'Saldo de caja hoy', v: modelo.saldoHoy, sub: `Caja 1 ${$(modelo.saldoCaja.O || 0)} · Caja 2 ${$(modelo.saldoCaja.P || 0)}` },
              { t: `Saldo proyectado a ${columnas[columnas.length - 1].label}`, v: acumulados[columnas[columnas.length - 1].id] },
            ].map(x => (
              <div key={x.t} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 14px', minWidth: 200 }}>
                <div style={{ fontSize: 11, color: S.muted }}>{x.t}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: x.v >= 0 ? S.text : S.red }}>{$(x.v)}</div>
                {x.sub && <div style={{ fontSize: 10, color: S.hint }}>{x.sub}</div>}
              </div>
            ))}
          </div>
          {marco(<>
            {cabecera('Todas las actividades')}
            <tbody>
              {renderSeparador('Resultado de caja por actividad (incluye ⅓ de lo general)', S.green, S.greenLight)}
              {ACTIVIDADES.map(act => (
                <tr key={act} style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }} onClick={() => setVista(act)} title={`Ver el detalle de ${act}`}>
                  <td style={{ ...tdNombre, fontWeight: 600 }}>{act} <span style={{ color: S.hint, fontSize: 10 }}>›</span></td>
                  {columnas.map(c => { const v = balanceActividad(act, c); return <td key={c.id} style={{ ...tdNum, color: v >= 0 ? S.green : S.red, background: bgCol(c) }}>{fmt(v)}</td> })}
                </tr>
              ))}
              {renderTotal('Resultado de las actividades', c => ACTIVIDADES.reduce((s, a) => s + balanceActividad(a, c), 0))}

              {renderSeparador('No son resultado — movimientos de plata aparte', S.purple, S.purpleLight, { label: '+ renglón', fn: () => {
                const tipo = confirm('¿Es un INGRESO de plata?\n\nAceptar = ingreso · Cancelar = egreso') ? 'ingreso' : 'egreso'
                agregarRenglon('Otros', tipo)
              } })}
              {NO_RESULTADO.flatMap(b => {
                const fs = filasDe(b.act)
                return fs.length ? renderGrupo(`NR|${b.act}`, b.label, fs, { color: S.purple, conSigno: true }) : []
              })}
              {renderTotal('Total no resultado', c => NO_RESULTADO.reduce((s, b) => s + neto(filasDe(b.act), c), 0))}

              {renderTotal('Movimiento total del mes', c => balanceTotal(c))}
              {renderTotal('Saldo de caja (acumulado)', c => acumulados[c.id], { bg: S.accentLight, colorFijo: S.accent })}
              {renderTotal('↳ cheques de terceros en cartera', c => chequesAl(c).cartera, { bg: S.surface, colorFijo: S.muted, mostrarEn: c => c.hoy || c.proy })}
              {renderTotal('↳ cheques propios sin debitar', c => -chequesAl(c).propios, { bg: S.surface, colorFijo: S.muted, mostrarEn: c => c.hoy || c.proy })}
              {renderTotal('Disponible sin contar cheques', c => { const x = chequesAl(c); return acumulados[c.id] - x.cartera + x.propios }, { bg: S.accentLight, colorFijo: S.accent, mostrarEn: c => c.hoy || c.proy })}
            </tbody>
          </>)}
          <div style={{ fontSize: 11, color: S.hint, marginTop: 8, maxWidth: 900 }}>
            El saldo de la columna "hasta hoy" es el saldo de las cajas hoy. Igual que en la caja, un cheque cuenta el día que se recibe o se entrega; las dos filas de abajo muestran cuánto de ese saldo son cheques todavía no cobrados/debitados. Las cuotas en dólares se proyectan al dólar de hoy. Las compras pagadas con canje de grano no se proyectan (no salen de caja).
          </div>
        </>
      ) : marco(<>
        {cabecera(vista)}
        <tbody>
          {renderSeparador('Ingresos', S.green, S.greenLight, { label: '+ renglón', fn: () => agregarRenglon(vista, 'ingreso') })}
          {seccionesActividad(vista, 'ingreso', S.green)}
          {renderSeparador('Egresos', S.red, S.redLight, { label: '+ renglón', fn: () => agregarRenglon(vista, 'egreso') })}
          {seccionesActividad(vista, 'egreso', S.red)}
          {renderTotal('Resultado de caja del mes', c => balanceActividad(vista, c))}
          {(() => { let ac = 0; const acu = {}; columnas.forEach(c => { ac += balanceActividad(vista, c); acu[c.id] = ac }); return renderTotal(`Acumulado desde ${columnas[0].label}`, c => acu[c.id], { bg: S.accentLight, colorFijo: S.accent }) })()}
        </tbody>
      </>)}
    </div>
  )
}
