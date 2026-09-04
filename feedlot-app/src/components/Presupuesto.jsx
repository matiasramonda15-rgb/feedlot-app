import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './UI'

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

// La plata de un cheque (propio o de tercero) recién se mueve de verdad
// cuando el cheque se hace efectivo, no el día que se entregó/recibió el
// recibo — un cheque a 60 días entregado hoy no sale de la cuenta hoy.
// Para todo lo demás (efectivo, transferencia) la fecha del pago ya es la
// fecha real, así que se usa tal cual.
function fechaRealPago(p) {
  if (!p) return null
  const fechaCheque = p.cheque_propio?.fecha_vencimiento || p.fecha_vencimiento_cheque || p.cheque_tercero_detalle?.[0]?.fecha_vencimiento
  if (fechaCheque) return fechaCheque
  return p.fecha
}

function fmt(n) {
  if (n == null || n === 0) return ''
  return Math.round(n).toLocaleString('es-AR')
}

// Trae y agrupa los ingresos/egresos reales de UNA actividad, desde fechaDesde.
// Devuelve { ingresos: {categoria: {'anio-mes': monto}}, egresos: {...} }
// Compras de insumos que ya están cubiertas por un crédito (directo, o
// "hermanas" del mismo remito/fecha/proveedor) — no deben contarse como
// salida de caja en el mes de la compra, porque la plata real recién sale
// después, con cada cuota del crédito (esa sí ya se cuenta aparte).
async function idsComprasConCredito() {
  const { data: creditos } = await supabase.from('creditos').select('compra_insumos_id').not('compra_insumos_id', 'is', null)
  const idsDirectos = (creditos || []).map(c => c.compra_insumos_id)
  if (idsDirectos.length === 0) return new Set()
  const { data: comprasBase } = await supabase.from('compras_insumos').select('id, proveedor, fecha').in('id', idsDirectos)
  const claves = new Set((comprasBase || []).map(c => `${c.proveedor}|${c.fecha}`))
  const { data: todas } = await supabase.from('compras_insumos').select('id, proveedor, fecha')
  return new Set((todas || []).filter(c => claves.has(`${c.proveedor}|${c.fecha}`)).map(c => c.id))
}

async function cargarDatosActividad(actividad, fechaDesde, idsCredito) {
  const ingresos = {}
  const egresos = {}
  const suma = (obj, categoria, fecha, monto) => {
    if (!fecha || !monto) return
    const d = new Date(fecha + 'T12:00:00')
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    if (!obj[categoria]) obj[categoria] = {}
    obj[categoria][key] = (obj[categoria][key] || 0) + monto
  }
  // La mano de obra se resume en una sola fila — el detalle por empleado ya
  // está en Personal, acá solo interesa el total mensual por actividad.
  const MANO_DE_OBRA = 'Mano de obra'

  // Para compras/gastos/ventas que se pagan o cobran en cuotas (insumos a
  // 30/60 días, ventas de granos, servicios): cada pago dentro de
  // pagos_detalle cuenta en el mes de SU PROPIA fecha, no en el mes del
  // registro original. Si un registro pendiente todavía no tiene ningún
  // pago cargado, no suma nada todavía — es correcto, esa plata no se
  // movió. Los pagos viejos que no tengan fecha propia (de antes de este
  // cambio) usan la fecha del registro como respaldo.
  const sumaPorPagos = (obj, categoria, pagosDetalle, fechaFallback) => {
    ;(pagosDetalle || []).forEach(p => {
      const monto = parseFloat(p.monto) || 0
      if (!monto) return
      suma(obj, categoria, fechaRealPago(p) || fechaFallback, monto)
    })
  }

  if (actividad === 'Feedlot') {
    const [{ data: pagosVentasHacienda }, { data: comprasVentas }, { data: pagosCompraHacienda }, { data: compras }, { data: pagosEmp }, { data: gastos }, { data: fletes }] = await Promise.all([
      // Se cuenta la plata cuando se COBRA (fecha real del pago), no cuando
      // se hizo la venta — hasta que no se cobra, esa plata no entró a la
      // cuenta de verdad, así que no puede figurar como ingreso del mes de
      // la venta.
      supabase.from('pagos_ventas').select('venta_id, fecha, monto, subtipo_cheque, fecha_vencimiento_cheque').gte('fecha', fechaDesde),
      supabase.from('ventas').select('id, comprador'),
      // Igual del otro lado: una invernada comprada hoy pero pactada a
      // 30/60 días recién sale de la cuenta cuando se paga esa cuota, no
      // cuando se hizo la compra.
      supabase.from('pagos_compras').select('lote_id, fecha, monto, subtipo_cheque, cheque_propio, cheque_tercero_detalle').not('lote_id', 'is', null).gte('fecha', fechaDesde),
      supabase.from('compras_insumos').select('id, total, fecha, proveedor, insumo_tipo, pagos_detalle').gte('fecha', fechaDesde).in('insumo_tipo', ['alimentacion', 'sanitario']),
      supabase.from('pagos_empleados').select('monto, fecha, creado_en, empleados(actividad)').gte('fecha', fechaDesde),
      supabase.from('gastos_generales').select('monto, fecha, categoria, actividad, pagos_detalle').gte('fecha', fechaDesde).in('actividad', ['Feedlot', 'General']),
      supabase.from('fletes').select('monto, fecha, transportista, estado_pago').gte('fecha', fechaDesde).eq('estado_pago', 'pagado'),
    ])
    const { data: procedenciaPorLote } = await supabase.from('lotes').select('id, procedencia')
    const procPorLote = {}
    ;(procedenciaPorLote || []).forEach(l => { procPorLote[l.id] = l.procedencia })
    const compradorPorVenta = {}
    ;(comprasVentas || []).forEach(v => { compradorPorVenta[v.id] = v.comprador })
    ;(pagosVentasHacienda || []).forEach(p => suma(ingresos, `Venta hacienda — ${compradorPorVenta[p.venta_id] || 'sin comprador'}`, fechaRealPago(p), p.monto))
    ;(pagosCompraHacienda || []).forEach(p => suma(egresos, `Compra hacienda — ${procPorLote[p.lote_id] || 'sin procedencia'}`, fechaRealPago(p), p.monto))
    ;(compras || []).forEach(c => { if (idsCredito.has(c.id)) return; sumaPorPagos(egresos, `Insumos — ${c.proveedor || 'sin proveedor'}`, c.pagos_detalle, c.fecha) })
    ;(pagosEmp || []).forEach(p => {
      const act = p.empleados?.actividad
      if (act !== 'Feedlot' && act !== 'General') return
      suma(egresos, MANO_DE_OBRA, p.fecha || p.creado_en?.split('T')[0], act === 'General' ? (p.monto || 0) / 3 : (p.monto || 0))
    })
    ;(gastos || []).forEach(g => {
      const divisor = g.actividad === 'General' ? 3 : 1
      const pagosAjustados = (g.pagos_detalle || []).map(p => ({ ...p, monto: (parseFloat(p.monto) || 0) / divisor }))
      sumaPorPagos(egresos, `Gastos generales — ${g.categoria || 'otro'}`, pagosAjustados, g.fecha)
    })
    // Fletes: no tienen actividad propia — por ahora se asumen todos de
    // Feedlot (transporte de hacienda), que es el caso más común.
    ;(fletes || []).forEach(f => suma(egresos, `Fletes — ${f.transportista || 'sin transportista'}`, f.fecha, f.monto))
  } else if (actividad === 'Agricultura') {
    const [{ data: ventasG }, { data: compras }, { data: ordenes }, { data: gastosAgro }, { data: pagosEmp }, { data: gastosGen }] = await Promise.all([
      supabase.from('ventas_granos').select('total, monto_negro, fecha, comprador, estado, pagos_detalle').gte('fecha', fechaDesde).neq('estado', 'pactada'),
      supabase.from('compras_insumos').select('id, total, fecha, proveedor, pagos_detalle').gte('fecha', fechaDesde).eq('insumo_tipo', 'agro'),
      supabase.from('ordenes_trabajo').select('costo_total, fecha, proveedor, tipo, pagos_detalle').gte('fecha', fechaDesde).eq('es_propia', false),
      supabase.from('gastos_generales').select('monto, fecha, categoria, pagos_detalle').gte('fecha', fechaDesde).eq('actividad', 'Agricultura'),
      supabase.from('pagos_empleados').select('monto, fecha, creado_en, empleados(actividad)').gte('fecha', fechaDesde),
      supabase.from('gastos_generales').select('monto, fecha, categoria, pagos_detalle').gte('fecha', fechaDesde).eq('actividad', 'General'),
    ])
    // "total" en ventas_granos ya es el monto completo (facturado + negro
    // incluidos, no aparte) — sumarle monto_negro de nuevo duplicaba
    // cualquier venta con parte negro (la venta interna a Feedlot, por
    // ejemplo, aparecía el doble). Al sumar por pago individual esto ya no
    // aplica: cada pago (blanco o negro) ya viene por separado en el array.
    ;(ventasG || []).forEach(v => sumaPorPagos(ingresos, `Venta granos — ${v.comprador || 'sin comprador'}`, v.pagos_detalle, v.fecha))
    ;(compras || []).forEach(c => { if (idsCredito.has(c.id)) return; sumaPorPagos(egresos, `Insumos — ${c.proveedor || 'sin proveedor'}`, c.pagos_detalle, c.fecha) })
    ;(ordenes || []).forEach(o => sumaPorPagos(egresos, `${o.tipo || 'Orden de trabajo'} — ${o.proveedor || 'sin proveedor'}`, o.pagos_detalle, o.fecha))
    ;(gastosAgro || []).forEach(g => sumaPorPagos(egresos, `Gastos generales — ${g.categoria || 'otro'}`, g.pagos_detalle, g.fecha))
    ;(pagosEmp || []).forEach(p => {
      const act = p.empleados?.actividad
      if (act !== 'Agricultura' && act !== 'General') return
      suma(egresos, MANO_DE_OBRA, p.fecha || p.creado_en?.split('T')[0], act === 'General' ? (p.monto || 0) / 3 : (p.monto || 0))
    })
    ;(gastosGen || []).forEach(g => {
      const pagosAjustados = (g.pagos_detalle || []).map(p => ({ ...p, monto: (parseFloat(p.monto) || 0) / 3 }))
      sumaPorPagos(egresos, `Gastos generales — ${g.categoria || 'otro'}`, pagosAjustados, g.fecha)
    })
  } else if (actividad === 'Servicios') {
    const [{ data: servicios }, { data: pagosEmp }, { data: gastosServ }, { data: gastosGen }] = await Promise.all([
      supabase.from('servicios_terceros').select('total, monto_negro, fecha, creado_en, cliente, tipo_servicio, orden_trabajo_id, labor, pagos_detalle').gte('fecha', fechaDesde),
      supabase.from('pagos_empleados').select('monto, fecha, creado_en, empleados(actividad)').gte('fecha', fechaDesde),
      supabase.from('gastos_generales').select('monto, fecha, categoria, pagos_detalle').gte('fecha', fechaDesde).eq('actividad', 'Servicios'),
      supabase.from('gastos_generales').select('monto, fecha, categoria, pagos_detalle').gte('fecha', fechaDesde).eq('actividad', 'General'),
    ])
    ;(servicios || []).forEach(s => {
      if (s.tipo_servicio === 'propio' && !s.orden_trabajo_id) return
      sumaPorPagos(ingresos, `${s.labor || 'Servicio'} — ${s.cliente || 'sin cliente'}`, s.pagos_detalle, s.fecha || s.creado_en?.split('T')[0])
    })
    ;(gastosServ || []).forEach(g => sumaPorPagos(egresos, `Gastos generales — ${g.categoria || 'otro'}`, g.pagos_detalle, g.fecha))
    ;(pagosEmp || []).forEach(p => {
      const act = p.empleados?.actividad
      if (act !== 'Servicios' && act !== 'General') return
      suma(egresos, MANO_DE_OBRA, p.fecha || p.creado_en?.split('T')[0], act === 'General' ? (p.monto || 0) / 3 : (p.monto || 0))
    })
    ;(gastosGen || []).forEach(g => {
      const pagosAjustados = (g.pagos_detalle || []).map(p => ({ ...p, monto: (parseFloat(p.monto) || 0) / 3 }))
      sumaPorPagos(egresos, `Gastos generales — ${g.categoria || 'otro'}`, pagosAjustados, g.fecha)
    })
  }
  return { ingresos, egresos }
}

// Movimientos que no pertenecen a ninguna actividad puntual — retiros de
// socios e inversiones en activos. Se muestran aparte, solo en "Resumen".
async function cargarDatosGenerales(fechaDesde) {
  const egresos = {}
  const suma = (categoria, fecha, monto) => {
    if (!fecha || !monto) return
    const d = new Date(fecha + 'T12:00:00')
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    if (!egresos[categoria]) egresos[categoria] = {}
    egresos[categoria][key] = (egresos[categoria][key] || 0) + monto
  }
  const [{ data: retiros }, { data: activosComprados }] = await Promise.all([
    supabase.from('retiros_socios').select('monto, fecha, socio').gte('fecha', fechaDesde),
    supabase.from('activos').select('valor_compra, fecha_compra, nombre').gte('fecha_compra', fechaDesde),
  ])
  ;(retiros || []).forEach(r => suma(`Retiro socios — ${r.socio || 'sin socio'}`, r.fecha, r.monto))
  ;(activosComprados || []).forEach(a => suma(`Inversión — ${a.nombre || 'activo'}`, a.fecha_compra, a.valor_compra))
  return { ingresos: {}, egresos }
}

// Cuotas de crédito (pagadas o pendientes con fecha ya conocida), repartidas
// por actividad: si el crédito está vinculado a un activo (ej. la
// sembradora), se usa el mismo % de uso que ya tiene cargado ese activo —
// igual criterio que la amortización en Reportes. Si viene de una compra de
// insumos, va entera a la actividad de ese insumo (Agro → Agricultura, el
// resto → Feedlot). Si no hay ninguna referencia, se asume Feedlot.
async function cargarCreditosPorActividad(fechaDesde) {
  const [{ data: cuotas }, { data: activos }, { data: cfg }] = await Promise.all([
    supabase.from('pagos_creditos').select('monto, monto_usd, fecha, fecha_pago, estado, creditos(entidad, activo_id, compras_insumos(insumo_tipo))').gte('fecha', fechaDesde),
    supabase.from('activos').select('id, pct_feedlot, pct_agricultura, pct_servicios, pct_alfalfa'),
    supabase.from('configuracion').select('valor').eq('clave', 'cotizacion_dolar_agro').maybeSingle(),
  ])
  const cotizacionHoy = parseFloat(cfg?.valor) || 0
  const resultado = { Feedlot: {}, Agricultura: {}, Servicios: {} }
  const suma = (act, categoria, fecha, monto) => {
    if (!fecha || !monto) return
    const d = new Date(fecha + 'T12:00:00')
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    if (!resultado[act][categoria]) resultado[act][categoria] = {}
    resultado[act][categoria][key] = (resultado[act][categoria][key] || 0) + monto
  }
  ;(cuotas || []).forEach(c => {
    const fecha = c.fecha_pago || c.fecha
    // Si es una cuota en dólares todavía sin pagar, no tiene monto en pesos
    // cargado (recién se sabe al pagarla) — se estima con la cotización de
    // hoy, aclarando en el nombre que es una proyección, no el monto real.
    let monto = c.monto
    let esEstimado = false
    if (!monto && c.monto_usd && c.estado !== 'pagado' && cotizacionHoy > 0) {
      monto = c.monto_usd * cotizacionHoy
      esEstimado = true
    }
    if (!monto) return
    const nombre = `Cuotas de crédito — ${c.creditos?.entidad || 'sin entidad'}${esEstimado ? ' (USD, estimado a hoy)' : ''}`
    const activo = c.creditos?.activo_id ? activos?.find(a => a.id === c.creditos.activo_id) : null
    if (activo) {
      if (activo.pct_feedlot > 0) suma('Feedlot', nombre, fecha, monto * (activo.pct_feedlot / 100))
      if ((activo.pct_agricultura || 0) + (activo.pct_alfalfa || 0) > 0) suma('Agricultura', nombre, fecha, monto * (((activo.pct_agricultura || 0) + (activo.pct_alfalfa || 0)) / 100))
      if (activo.pct_servicios > 0) suma('Servicios', nombre, fecha, monto * (activo.pct_servicios / 100))
    } else {
      const tipoInsumo = c.creditos?.compras_insumos?.insumo_tipo
      suma(tipoInsumo === 'agro' ? 'Agricultura' : 'Feedlot', nombre, fecha, monto)
    }
  })
  return resultado
}

// Compras de hacienda (terneros) que todavía no se terminaron de pagar, con
// una fecha de vencimiento cargada en Ingresos — se muestran como egreso
// proyectado de Feedlot en el mes que corresponda, para no perderlas de
// vista al planificar los próximos meses.
async function cargarCuotasTerneros(fechaDesde) {
  const [{ data: lotes }, { data: pagos }] = await Promise.all([
    supabase.from('lotes').select('id, procedencia, monto_total_con_iva, fecha_vencimiento_pago, estado_pago').eq('estado_pago', 'pendiente').not('fecha_vencimiento_pago', 'is', null),
    supabase.from('pagos_compras').select('lote_id, monto'),
  ])
  const pagadoPorLote = {}
  ;(pagos || []).forEach(p => { pagadoPorLote[p.lote_id] = (pagadoPorLote[p.lote_id] || 0) + (parseFloat(p.monto) || 0) })
  const resultado = { Feedlot: {} }
  ;(lotes || []).forEach(l => {
    const total = parseFloat(l.monto_total_con_iva) || 0
    const pendiente = Math.max(0, total - (pagadoPorLote[l.id] || 0))
    if (pendiente <= 0 || !l.fecha_vencimiento_pago) return
    const d = new Date(l.fecha_vencimiento_pago + 'T12:00:00')
    // Solo interesan los vencimientos de acá en adelante (los ya vencidos y
    // sin pagar son otro problema — se ven en el Diagnóstico, no en la
    // proyección de meses futuros).
    if (`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` < fechaDesde) return
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    const nombre = `Cuotas terneros — ${l.procedencia || 'sin procedencia'}`
    if (!resultado.Feedlot[nombre]) resultado.Feedlot[nombre] = {}
    resultado.Feedlot[nombre][key] = (resultado.Feedlot[nombre][key] || 0) + pendiente
  })
  return resultado
}

export default function Presupuesto({ usuario }) {
  const [vista, setVista] = useState('Feedlot')  // 'Feedlot' | 'Agricultura' | 'Servicios' | 'Resumen'
  const [loading, setLoading] = useState(true)
  const [datosPorActividad, setDatosPorActividad] = useState({})  // { Feedlot: {ingresos, egresos}, ... }
  const [proyecciones, setProyecciones] = useState({})  // clave `${actividad}|${tipo}|${categoria}|${anio}|${mes}` -> { monto }
  const [editando, setEditando] = useState(null)
  const [valorEditando, setValorEditando] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Categorías que llevan detalle (ej. "Insumos") se muestran resumidas por
  // defecto — se abren tocándolas, para ver el desglose por proveedor/cliente.
  const [gruposAbiertos, setGruposAbiertos] = useState(new Set())

  const hoy = new Date()
  const MESES_ATRAS = 6, MESES_ADELANTE = 12
  const meses = []
  for (let i = -MESES_ATRAS; i <= MESES_ADELANTE; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    meses.push({ anio: d.getFullYear(), mes: d.getMonth() + 1, key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, esFuturo: i > 0, esActual: i === 0 })
  }
  const mesesPasados = meses.filter(m => !m.esFuturo)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const anioDesde = meses[0].anio, mesDesde = meses[0].mes
    const fechaDesde = `${anioDesde}-${String(mesDesde).padStart(2, '0')}-01`

    const resultados = {}
    const idsCredito = await idsComprasConCredito()
    for (const act of ACTIVIDADES) resultados[act] = await cargarDatosActividad(act, fechaDesde, idsCredito)
    resultados['Generales'] = await cargarDatosGenerales(fechaDesde)

    // Mezclar las cuotas de crédito (ya repartidas por actividad) en los
    // egresos de cada una — separado de cargarDatosActividad porque necesita
    // mirar los % de uso de Activos, algo transversal a las tres.
    const creditosPorActividad = await cargarCreditosPorActividad(fechaDesde)
    for (const act of ACTIVIDADES) {
      Object.entries(creditosPorActividad[act] || {}).forEach(([cat, meses]) => {
        if (!resultados[act].egresos[cat]) resultados[act].egresos[cat] = {}
        Object.entries(meses).forEach(([mkey, monto]) => {
          resultados[act].egresos[cat][mkey] = (resultados[act].egresos[cat][mkey] || 0) + monto
        })
      })
    }

    // Mismo criterio para los saldos de hacienda todavía pendientes de pago
    // (cargados en Ingresos, con su fecha de vencimiento) — quedan en el mes
    // que corresponda, dentro de los egresos de Feedlot.
    const cuotasTerneros = await cargarCuotasTerneros(fechaDesde)
    Object.entries(cuotasTerneros.Feedlot || {}).forEach(([cat, meses]) => {
      if (!resultados.Feedlot.egresos[cat]) resultados.Feedlot.egresos[cat] = {}
      Object.entries(meses).forEach(([mkey, monto]) => {
        resultados.Feedlot.egresos[cat][mkey] = (resultados.Feedlot.egresos[cat][mkey] || 0) + monto
      })
    })

    const { data: proy } = await supabase.from('presupuesto_lineas').select('*').gte('anio', anioDesde)
    const proyMap = {}
    ;(proy || []).forEach(p => { proyMap[`${p.actividad}|${p.tipo}|${p.categoria}|${p.anio}|${p.mes}`] = p })

    setDatosPorActividad(resultados)
    setProyecciones(proyMap)
    setLoading(false)
  }

  // Promedio de los últimos meses con datos reales (hasta 6) para una
  // categoría — se usa como sugerencia automática en los meses futuros que
  // todavía no tienen ninguna proyección cargada a mano.
  function promedioCategoria(actividad, tipo, categoria) {
    const filas = datosPorActividad[actividad]?.[tipo === 'ingreso' ? 'ingresos' : 'egresos']?.[categoria] || {}
    const valoresRecientes = mesesPasados.slice(-6).map(m => filas[m.key] || 0)
    const conDatos = valoresRecientes.filter(v => v > 0)
    if (conDatos.length < 3) return null  // hace falta un mínimo de historial para que el promedio sirva
    return conDatos.reduce((s, v) => s + v, 0) / conDatos.length
  }

  // Devuelve { valor, estado } — estado: 'real' | 'corregido' | 'estimado' | 'vacio'
  function celda(actividad, tipo, categoria, m) {
    const clave = `${actividad}|${tipo}|${categoria}|${m.anio}|${m.mes}`
    const proy = proyecciones[clave]
    const filas = datosPorActividad[actividad]?.[tipo === 'ingreso' ? 'ingresos' : 'egresos']?.[categoria] || {}
    const v = filas[m.key] || 0
    // Si la corrección guardada era una ESTIMACIÓN hecha cuando este mes
    // todavía era futuro (es_proyeccion=true en la base), y el mes ya pasó
    // a ser real, esa estimación quedó vieja — no tiene sentido que siga
    // tapando el dato real de la app para siempre. Se ignora automáticamente
    // en ese caso. Una corrección hecha a propósito sobre un mes que YA era
    // real al momento de guardarla (es_proyeccion=false) sigue respetándose,
    // porque ahí la intención era corregir un dato puntual, no adivinar.
    if (proy && !(proy.es_proyeccion && !m.esFuturo)) return { valor: proy.monto, estado: 'corregido' }
    if (!m.esFuturo) return { valor: v, estado: v ? 'real' : 'vacio' }
    // En meses futuros, si ya hay un dato real conocido para ese mes puntual
    // (ej. una cuota de crédito ya programada, con fecha y monto fijos), se
    // usa ese — es más confiable que un promedio estimado.
    if (v) return { valor: v, estado: 'real' }
    const prom = promedioCategoria(actividad, tipo, categoria)
    return prom ? { valor: prom, estado: 'estimado' } : { valor: 0, estado: 'vacio' }
  }

  async function guardarCelda(actividad, tipo, categoria, m) {
    const monto = parseFloat(valorEditando) || 0
    setGuardando(true)
    const { error } = await supabase.from('presupuesto_lineas').upsert({
      actividad, tipo, categoria, anio: m.anio, mes: m.mes, monto, es_proyeccion: m.esFuturo,
    }, { onConflict: 'actividad,tipo,categoria,anio,mes' })
    if (error) { alert('Error al guardar: ' + error.message); setGuardando(false); return }
    setProyecciones({...proyecciones, [`${actividad}|${tipo}|${categoria}|${m.anio}|${m.mes}`]: { monto }})
    setEditando(null)
    setGuardando(false)
  }

  if (loading) return <Loader />

  // Total de ingresos/egresos de una actividad, en un mes (suma de todas sus filas)
  function totalActividadMes(actividad, tipo, m) {
    const filas = datosPorActividad[actividad]?.[tipo === 'ingreso' ? 'ingresos' : 'egresos'] || {}
    return Object.keys(filas).reduce((s, cat) => s + celda(actividad, tipo, cat, m).valor, 0)
  }
  function balanceActividadMes(actividad, m) {
    return totalActividadMes(actividad, 'ingreso', m) - totalActividadMes(actividad, 'egreso', m)
  }

  const COLOR_ESTADO = { real: null, corregido: S.amber, estimado: '#B8A088', vacio: S.hint }

  // Agrupa categorías tipo "Insumos — Fulano" bajo "Insumos". Si un grupo
  // tiene un solo elemento sin " — " (ej. "Mano de obra"), queda como fila
  // simple, sin flecha de desplegar.
  function agruparCategorias(categorias) {
    const grupos = {}
    categorias.forEach(cat => {
      const [grupo] = cat.split(' — ')
      if (!grupos[grupo]) grupos[grupo] = []
      grupos[grupo].push(cat)
    })
    return grupos
  }

  const Fila = ({ actividad, tipo, categoria, color, indent }) => (
    <tr style={{ borderBottom: `1px solid ${S.border}` }}>
      <td style={{ padding: '6px 12px', paddingLeft: indent ? 28 : 12, fontSize: 12, color: indent ? S.muted : S.text, position: 'sticky', left: 0, background: S.surface, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {indent ? (categoria.split(' — ')[1] || categoria) : categoria}
      </td>
      {meses.map(m => {
        const clave = `${actividad}|${tipo}|${categoria}|${m.anio}|${m.mes}`
        const { valor, estado } = celda(actividad, tipo, categoria, m)
        const esEdit = editando === clave
        return (
          <td key={m.key} onClick={() => { if (!esEdit) { setEditando(clave); setValorEditando(valor ? String(Math.round(valor)) : '') } }}
            style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontStyle: estado === 'estimado' ? 'italic' : 'normal', cursor: 'pointer', background: m.esActual ? '#FFFBEA' : esEdit ? S.accentLight : 'transparent', color: COLOR_ESTADO[estado] || color, minWidth: 78 }}>
            {esEdit ? (
              <input autoFocus type="number" value={valorEditando} onChange={e => setValorEditando(e.target.value)}
                onBlur={() => guardarCelda(actividad, tipo, categoria, m)}
                onKeyDown={e => { if (e.key === 'Enter') guardarCelda(actividad, tipo, categoria, m); if (e.key === 'Escape') setEditando(null) }}
                style={{ width: 70, fontSize: 12, fontFamily: 'monospace', textAlign: 'right', border: `1px solid ${S.accent}`, borderRadius: 3, padding: '2px 4px' }} />
            ) : (fmt(valor) || <span style={{ color: S.hint }}>—</span>)}
          </td>
        )
      })}
    </tr>
  )

  // Una "sección" es un grupo (ej. "Insumos") con sus categorías dentro (ej.
  // "Insumos — Fulano", "Insumos — Mengano"). Si tiene una sola categoría sin
  // desglose (ej. "Mano de obra"), se muestra directo, sin flecha. Si tiene
  // varias, se muestra el total resumido y se despliega tocándola.
  const Seccion = ({ actividad, tipo, grupo, categorias, color }) => {
    if (categorias.length === 1 && categorias[0] === grupo) {
      return <Fila actividad={actividad} tipo={tipo} categoria={grupo} color={color} />
    }
    const abierto = gruposAbiertos.has(`${actividad}|${tipo}|${grupo}`)
    const toggle = () => {
      const n = new Set(gruposAbiertos)
      const k = `${actividad}|${tipo}|${grupo}`
      if (n.has(k)) n.delete(k); else n.add(k)
      setGruposAbiertos(n)
    }
    return (
      <>
        <tr style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }} onClick={toggle}>
          <td style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, color: S.text, position: 'sticky', left: 0, background: S.surface, whiteSpace: 'nowrap' }}>
            <span style={{ display: 'inline-block', width: 14, color: S.muted, fontSize: 10 }}>{abierto ? '▾' : '▸'}</span>
            {grupo} <span style={{ color: S.hint, fontWeight: 400 }}>({categorias.length})</span>
          </td>
          {meses.map(m => {
            const total = categorias.reduce((s, c) => s + celda(actividad, tipo, c, m).valor, 0)
            return <td key={m.key} style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color, background: m.esActual ? '#FFFBEA' : 'transparent' }}>{fmt(total)}</td>
          })}
        </tr>
        {abierto && categorias.map(c => <Fila key={c} actividad={actividad} tipo={tipo} categoria={c} color={color} indent />)}
      </>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0 }}>Presupuesto</h1>
        <div style={{ fontSize: 13, color: S.muted, marginTop: 4 }}>
          Meses pasados: datos reales de la app. Meses futuros: promedio de los últimos meses como sugerencia (en itálica) — tocá cualquier celda para corregirla a mano.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        {[...ACTIVIDADES, 'Resumen'].map(a => (
          <button key={a} onClick={() => setVista(a)}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: `1px solid ${vista === a ? S.accent : S.border}`, background: vista === a ? S.accent : (a === 'Resumen' ? S.purpleLight : S.surface), color: vista === a ? '#fff' : (a === 'Resumen' ? S.purple : S.muted), cursor: 'pointer' }}>
            {a}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: S.hint, marginBottom: 8 }}>
        <span style={{ color: S.amber, fontWeight: 600 }}>■</span> corregido a mano &nbsp;
        <span style={{ color: '#B8A088', fontWeight: 600, fontStyle: 'italic' }}>■ itálica</span> = estimado (promedio), todavía sin confirmar
      </div>

      {vista === 'Resumen' ? (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto', maxHeight: '75vh' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: S.bg, zIndex: 2 }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: S.muted, position: 'sticky', left: 0, background: S.bg, zIndex: 3 }}>Todas las actividades</th>
                {meses.map(m => (
                  <th key={m.key} style={{ padding: '8px 8px', textAlign: 'right', fontSize: 11, color: m.esFuturo ? S.accent : S.muted, fontWeight: m.esActual ? 700 : 600, background: m.esActual ? '#FFFBEA' : S.bg }}>{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACTIVIDADES.map(act => (
                <tr key={act} style={{ borderBottom: `1px solid ${S.border}` }}>
                  <td style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, position: 'sticky', left: 0, background: S.surface }}>{act}</td>
                  {meses.map(m => {
                    const bal = balanceActividadMes(act, m)
                    return <td key={m.key} style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: bal >= 0 ? S.green : S.red, background: m.esActual ? '#FFFBEA' : 'transparent' }}>{fmt(bal)}</td>
                  })}
                </tr>
              ))}
              <tr><td colSpan={meses.length + 1} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: S.purple, textTransform: 'uppercase', letterSpacing: '.05em', background: S.purpleLight, position: 'sticky', left: 0 }}>Retiros de socios e inversiones (no son de ninguna actividad puntual)</td></tr>
              {Object.entries(agruparCategorias(Object.keys(datosPorActividad['Generales']?.egresos || {}))).map(([grupo, cats]) => (
                <Seccion key={grupo} actividad="Generales" tipo="egreso" grupo={grupo} categorias={cats} color={S.purple} />
              ))}
              {Object.keys(datosPorActividad['Generales']?.egresos || {}).length === 0 && <tr><td colSpan={meses.length + 1} style={{ padding: '10px 12px', fontSize: 12, color: S.hint }}>Sin retiros ni inversiones en este período.</td></tr>}
              <tr style={{ borderTop: `2px solid ${S.border}`, background: S.bg }}>
                <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, position: 'sticky', left: 0, background: S.bg }}>Balance total del mes</td>
                {meses.map(m => {
                  const bal = ACTIVIDADES.reduce((s, act) => s + balanceActividadMes(act, m), 0) + balanceActividadMes('Generales', m)
                  return <td key={m.key} style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: bal >= 0 ? S.green : S.red, background: m.esActual ? '#FFFBEA' : S.bg }}>{fmt(bal)}</td>
                })}
              </tr>
              {(() => { let ac = 0; return (
                <tr style={{ background: S.accentLight }}>
                  <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: S.accent, position: 'sticky', left: 0, background: S.accentLight }}>Acumulado total</td>
                  {meses.map(m => {
                    ac += ACTIVIDADES.reduce((s, act) => s + balanceActividadMes(act, m), 0) + balanceActividadMes('Generales', m)
                    return <td key={m.key} style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: ac >= 0 ? S.accent : S.red }}>{fmt(ac)}</td>
                  })}
                </tr>
              )})()}
            </tbody>
          </table>
        </div>
      ) : (() => {
        const datos = datosPorActividad[vista] || { ingresos: {}, egresos: {} }
        const categoriasIngreso = Object.keys(datos.ingresos).sort()
        const categoriasEgreso = Object.keys(datos.egresos).sort()
        const gruposIngreso = agruparCategorias(categoriasIngreso)
        const gruposEgreso = agruparCategorias(categoriasEgreso)
        let acumulado = 0
        return (
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto', maxHeight: '75vh' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: S.bg, zIndex: 2 }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: S.muted, position: 'sticky', left: 0, background: S.bg, zIndex: 3 }}>{vista}</th>
                  {meses.map(m => (
                    <th key={m.key} style={{ padding: '8px 8px', textAlign: 'right', fontSize: 11, color: m.esFuturo ? S.accent : S.muted, fontWeight: m.esActual ? 700 : 600, background: m.esActual ? '#FFFBEA' : S.bg }}>{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={meses.length + 1} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: S.green, textTransform: 'uppercase', letterSpacing: '.05em', background: S.greenLight, position: 'sticky', left: 0 }}>Ingresos</td></tr>
                {Object.entries(gruposIngreso).map(([grupo, cats]) => <Seccion key={grupo} actividad={vista} tipo="ingreso" grupo={grupo} categorias={cats} color={S.green} />)}
                {categoriasIngreso.length === 0 && <tr><td colSpan={meses.length + 1} style={{ padding: '10px 12px', fontSize: 12, color: S.hint }}>Sin datos de ingresos en este período.</td></tr>}

                <tr><td colSpan={meses.length + 1} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: S.red, textTransform: 'uppercase', letterSpacing: '.05em', background: S.redLight, position: 'sticky', left: 0 }}>Egresos</td></tr>
                {Object.entries(gruposEgreso).map(([grupo, cats]) => <Seccion key={grupo} actividad={vista} tipo="egreso" grupo={grupo} categorias={cats} color={S.red} />)}
                {categoriasEgreso.length === 0 && <tr><td colSpan={meses.length + 1} style={{ padding: '10px 12px', fontSize: 12, color: S.hint }}>Sin datos de egresos en este período.</td></tr>}

                <tr style={{ borderTop: `2px solid ${S.border}`, background: S.bg }}>
                  <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, position: 'sticky', left: 0, background: S.bg }}>Balance del mes</td>
                  {meses.map(m => {
                    const bal = balanceActividadMes(vista, m)
                    return <td key={m.key} style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: bal >= 0 ? S.green : S.red, background: m.esActual ? '#FFFBEA' : S.bg }}>{fmt(bal)}</td>
                  })}
                </tr>
                <tr style={{ background: S.accentLight }}>
                  <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: S.accent, position: 'sticky', left: 0, background: S.accentLight }}>Acumulado</td>
                  {meses.map(m => {
                    acumulado += balanceActividadMes(vista, m)
                    return <td key={m.key} style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: acumulado >= 0 ? S.accent : S.red }}>{fmt(acumulado)}</td>
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )
      })()}
    </div>
  )
}
