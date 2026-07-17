import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './UI'
import { calcularIndicadoresFeedlot } from '../shared/gdpLogic'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', borderStrong: '#C8C2B8',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

function Stat({ label, val, sub, color, size = 22 }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: size, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: color || S.text }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function Reportes({ usuario }) {
  const [tab, setTab] = useState('gdp')
  const [loading, setLoading] = useState(true)
  const [corrales, setCorrales] = useState([])
  const [pesadas, setPesadas] = useState([])
  const [raciones, setRaciones] = useState([])
  const [stock, setStock] = useState([])
  const [gastosGenerales, setGastosGenerales] = useState([])
  const [comprasSanitario, setComprasSanitario] = useState([])
  const [pagosEmpleados, setPagosEmpleados] = useState([])
  const [comprasAgro, setComprasAgro] = useState([])
  const [serviciosTerceros, setServiciosTerceros] = useState([])
  const [manoObraServicios, setManoObraServicios] = useState([])
  const [ventasGranos, setVentasGranos] = useState([])
  const [activos, setActivos] = useState([])
  const [actividadVista, setActividadVista] = useState('feedlot')
  const [lotes, setLotes] = useState([])
  const [ventas, setVentas] = useState([])
  const [formulasMixer, setFormulasMixer] = useState([])
  const [mortalidad, setMortalidad] = useState([])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: c }, { data: p }, { data: r }, { data: s }, { data: l }, { data: v }, { data: fm }, { data: m }, { data: gg }, { data: cs }, { data: pe }, { data: iag }, { data: st }, { data: mos }, { data: vg }, { data: ac }] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('pesadas').select('*, corrales(numero), pesada_animales(rango, cantidad, peso_promedio)').order('creado_en', { ascending: false }).limit(100),
      supabase.from('raciones_app').select('*, corrales(numero, animales)').order('creado_en', { ascending: false }).limit(2000),
      supabase.from('stock_insumos').select('*'),
      supabase.from('lotes').select('*').order('created_at', { ascending: false }),
      supabase.from('ventas').select('*, corrales(numero)').order('creado_en', { ascending: false }),
      supabase.from('formulas_mixer').select('*'),
      supabase.from('mortalidad').select('*').order('fecha', { ascending: false }),
      supabase.from('gastos_generales').select('*'),
      supabase.from('compras_insumos').select('total, insumo_tipo, fecha, creado_en').eq('insumo_tipo', 'sanitario'),
      supabase.from('pagos_empleados').select('*, empleados(nombre, actividad)'),
      supabase.from('compras_insumos').select('total, fecha, creado_en').eq('insumo_tipo', 'agro'),
      supabase.from('servicios_terceros').select('total, monto_negro, fecha, creado_en, tipo_servicio').eq('tipo_servicio', 'tercero'),
      supabase.from('mano_obra_servicios').select('monto_calculado, creado_en'),
      supabase.from('ventas_granos').select('total, fecha, creado_en'),
      supabase.from('activos').select('id, valor_compra, vida_util_anios, pct_feedlot, pct_agricultura, pct_servicios, pct_alfalfa, estado, fecha_compra'),
    ])
    setCorrales((c || []).sort((a, b) => parseInt(a.numero) - parseInt(b.numero)))
    setPesadas(p || [])
    setRaciones(r || [])
    setStock(s || [])
    setLotes(l || [])
    setVentas(v || [])
    setFormulasMixer(fm || [])
    setMortalidad(m || [])
    setGastosGenerales(gg || [])
    setComprasSanitario(cs || [])
    setPagosEmpleados(pe || [])
    setComprasAgro(iag || [])
    setServiciosTerceros(st || [])
    setManoObraServicios(mos || [])
    setVentasGranos(vg || [])
    setActivos(ac || [])
    setLoading(false)
  }

  // ── GDP por corral ──
  const gdpPorCorral = {}
  const porCorral = {}
  pesadas.forEach(p => {
    const num = p.corrales?.numero
    if (!num) return
    if (!porCorral[num]) porCorral[num] = []
    porCorral[num].push(p)
  })
  Object.entries(porCorral).forEach(([num, ps]) => {
    const sorted = ps.sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en))
    if (sorted.length >= 2) {
      const primera = sorted[0]
      const ultima = sorted[sorted.length - 1]
      const dias = Math.max(1, (new Date(ultima.creado_en) - new Date(primera.creado_en)) / (1000 * 60 * 60 * 24))
      const pp1 = calcPesoProm(primera.pesada_animales)
      const pp2 = calcPesoProm(ultima.pesada_animales)
      if (pp1 && pp2) {
        gdpPorCorral[num] = {
          gdp: (pp2 - pp1) / dias,
          pesoIngreso: pp1,
          pesoActual: pp2,
          diasEngorde: Math.round(dias),
          fechaInicio: primera.creado_en,
          fechaUltima: ultima.creado_en,
        }
      }
    } else if (sorted.length === 1) {
      const pp = calcPesoProm(sorted[0].pesada_animales)
      if (pp) gdpPorCorral[num] = {
        gdp: null, pesoIngreso: pp, pesoActual: pp,
        diasEngorde: 0, fechaInicio: sorted[0].creado_en, fechaUltima: sorted[0].creado_en,
      }
    }
  })

  // ── Costo alimentación por corral/día ──
  const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30)
  // Precio promedio ponderado de alimentación (kg × precio_referencia) — se usa
  // solo como respaldo cuando no se puede calcular el precio específico de la dieta
  const stockConPrecio = stock.filter(s => s.precio_referencia && s.cantidad_kg > 0)
  const totalKgStock = stockConPrecio.reduce((s, i) => s + i.cantidad_kg, 0)
  const precioPromAlim = totalKgStock > 0
    ? stockConPrecio.reduce((s, i) => s + i.precio_referencia * i.cantidad_kg, 0) / totalKgStock
    : null

  // Precio real $/kg MF de cada dieta, según su fórmula (% de cada ingrediente
  // x precio de referencia de ese ingrediente) — mucho más preciso que un
  // promedio general del stock, porque una dieta de terminación (más grano)
  // no cuesta lo mismo que una de acostumbramiento.
  const precioPorDieta = {}
  ;['seco', 'humedo'].forEach(dieta => {
    ;['acostumbramiento', 'recria', 'terminacion'].forEach(etapa => {
      const ingredientes = formulasMixer.filter(f => f.dieta === dieta && f.etapa === etapa)
      let totalKgF = 0, totalCostoF = 0, faltaPrecio = false
      ingredientes.forEach(ing => {
        const stockItem = stock.find(s => s.insumo === ing.ingrediente)
        if (!stockItem?.precio_referencia) faltaPrecio = true
        totalKgF += ing.kg || 0
        totalCostoF += (ing.kg || 0) * (stockItem?.precio_referencia || 0)
      })
      precioPorDieta[`${dieta}_${etapa}`] = totalKgF > 0 ? { precio: totalCostoF / totalKgF, completo: !faltaPrecio } : null
    })
  })
  const rolloStockItem = stock.find(s => s.insumo === 'Rollo (heno)')
  const precioRollo = rolloStockItem?.precio_referencia || null

  const raciones30 = raciones.filter(r => new Date(r.creado_en) >= hace30)

  // Consumo diario promedio de los últimos 30 días (independiente del mes calendario)
  const diasConsumo30 = {}
  raciones30.forEach(r => {
    const dia = r.creado_en.split('T')[0]
    if (!diasConsumo30[dia]) diasConsumo30[dia] = { kgTotal: 0, animales: 0, corralesVistos: new Set() }
    diasConsumo30[dia].kgTotal += r.kg_total || 0
    if (r.corral_id && !diasConsumo30[dia].corralesVistos.has(r.corral_id)) {
      diasConsumo30[dia].animales += (r.cantidad_animales ?? r.corrales?.animales) || 0
      diasConsumo30[dia].corralesVistos.add(r.corral_id)
    }
  })
  const diasConDatos30 = Object.values(diasConsumo30).filter(d => d.animales > 0 && d.kgTotal > 0)
  const consumoDiarioProm30 = diasConDatos30.length > 0
    ? diasConDatos30.reduce((s, d) => s + d.kgTotal / d.animales, 0) / diasConDatos30.length
    : null

  const costoAlimPorCorral = {}
  raciones30.forEach(r => {
    const num = r.corrales?.numero
    if (!num) return
    if (!costoAlimPorCorral[num]) costoAlimPorCorral[num] = { totalCosto: 0, totalKg: 0, dias: new Set() }
    // Separar rollo (precio propio) del resto del mixer (precio según fórmula
    // real de esa dieta/etapa) — si falta algún dato, cae al promedio general.
    const kgRollo = r.kg_rollo_extra || (r.solo_rollo ? (r.kg_total || 0) : 0)
    const kgMixer = (r.kg_total || 0) - kgRollo
    const dietaH = r.tipo_dieta || 'seco'
    const etapaH = r.mezclador === 'Acostumbramiento' ? 'acostumbramiento' : r.mezclador === 'Recria' ? 'recria' : 'terminacion'
    const precioMixer = precioPorDieta[`${dietaH}_${etapaH}`]?.precio ?? precioPromAlim ?? 0
    const precioRolloUsado = precioRollo ?? precioPromAlim ?? 0
    const costo = kgRollo * precioRolloUsado + kgMixer * precioMixer
    costoAlimPorCorral[num].totalCosto += costo
    costoAlimPorCorral[num].totalKg += r.kg_total || 0
    costoAlimPorCorral[num].dias.add(new Date(r.creado_en).toDateString())
  })

  // ── GDP GLOBAL FEEDLOT — Metodología por movimientos mensuales ──
  const hoy = new Date()
  // Calcula por mes calendario usando lotes y ventas

  // ── GDP, permanencia, conversión y consumo diario — lógica compartida con el
  // Tablero, para que los dos muestren siempre el mismo número. ──
  const { mesesGDP, mesActual, prom3, prom6, prom12 } = calcularIndicadoresFeedlot({ corrales, lotes, ventas, raciones, stock, formulasMixer })

  // GDP para display (usa mes actual o prom3 como fallback)
  const gdpFeedlotGlobal = prom6?.gdp || prom3?.gdp || mesActual?.gdp || null
  const permanenciaPromedio = prom6?.permanencia || prom3?.permanencia || mesActual?.permanencia || null
  const kgGanadosPorAnimal = mesActual ? mesActual.pesoProm_venta - mesActual.pesoProm_ingreso : null
  const conversionGlobal = prom6?.conversion || prom3?.conversion || mesActual?.conversion || null
  // Ganancia diaria estimada (movimientos de stock, no depende de repesar los
  // mismos animales en el mismo corral — los animales se mueven de corral, así
  // que esto es más confiable que comparar dos pesadas sueltas).
  const gdpEstimado = prom6?.gdp || prom3?.gdp || mesActual?.gdp || null
  const totalKgAlimConsumido = Object.values(costoAlimPorCorral).reduce((s, c) => s + c.totalKg, 0)

  // Rentabilidad por venta
  const rentabilidadVentas = ventas.map(v => {
    const lote = lotes.find(l => l.corral_cuarentena_id === v.corral_id) || lotes[0]
    const costoCompra = lote?.precio_compra && v.kg_vivo_total ? v.kg_vivo_total * lote.precio_compra : null
    const ingreso = v.total || null
    const margen = costoCompra && ingreso ? ingreso - costoCompra : null
    const margenPct = costoCompra && margen ? (margen / costoCompra * 100) : null
    return { ...v, costoCompra, ingreso, margen, margenPct }
  })

  // ── Rentabilidad mensual/anual — toda la inversión del feedlot (compra de
  // hacienda + alimentación + gastos generales) contra todo el ingreso (ventas) ──
  const mesKey = f => f ? String(f).slice(0, 7) : null
  const rentabilidadPorMes = {}
  const asegurarMes = key => {
    if (!rentabilidadPorMes[key]) rentabilidadPorMes[key] = { ingreso: 0, costoHacienda: 0, costoAlim: 0, costoSanidad: 0, costoManoObra: 0, costoGastos: 0 }
  }
  ventas.forEach(v => {
    const key = mesKey(v.fecha || v.creado_en)
    if (!key) return
    asegurarMes(key)
    rentabilidadPorMes[key].ingreso += v.total || 0
  })
  lotes.forEach(l => {
    const key = mesKey(l.fecha_ingreso || l.created_at)
    if (!key) return
    asegurarMes(key)
    rentabilidadPorMes[key].costoHacienda += (l.kg_bascula || 0) * (l.precio_compra || 0)
  })
  raciones.forEach(r => {
    const key = mesKey(r.creado_en)
    if (!key) return
    asegurarMes(key)
    const kgRollo = r.kg_rollo_extra || (r.solo_rollo ? (r.kg_total || 0) : 0)
    const kgMixer = (r.kg_total || 0) - kgRollo
    const dietaH = r.tipo_dieta || 'seco'
    const etapaH = r.mezclador === 'Acostumbramiento' ? 'acostumbramiento' : r.mezclador === 'Recria' ? 'recria' : 'terminacion'
    const precioMixer = precioPorDieta[`${dietaH}_${etapaH}`]?.precio ?? precioPromAlim ?? 0
    const precioRolloUsado = precioRollo ?? precioPromAlim ?? 0
    rentabilidadPorMes[key].costoAlim += kgRollo * precioRolloUsado + kgMixer * precioMixer
  })
  comprasSanitario.forEach(cs => {
    const key = mesKey(cs.fecha || cs.creado_en)
    if (!key || !cs.total) return
    asegurarMes(key)
    rentabilidadPorMes[key].costoSanidad += cs.total || 0
  })
  pagosEmpleados.forEach(pe => {
    const key = mesKey(pe.fecha || pe.creado_en)
    if (!key) return
    asegurarMes(key)
    const actividad = pe.empleados?.actividad
    // Feedlot = cuenta entero. General = se reparte entre las 3 actividades de
    // la empresa (Feedlot/Agricultura/Servicios). Cualquier otra (ej. Servicios,
    // Agricultura) no se cuenta acá, porque no es costo del feedlot.
    if (actividad === 'Feedlot') rentabilidadPorMes[key].costoManoObra += pe.monto || 0
    else if (actividad === 'General') rentabilidadPorMes[key].costoManoObra += (pe.monto || 0) / 3
  })
  gastosGenerales.filter(g => g.actividad === 'Feedlot').forEach(g => {
    const key = mesKey(g.fecha)
    if (!key) return
    asegurarMes(key)
    rentabilidadPorMes[key].costoGastos += g.monto || 0
  })
  const rentabilidadMensual = Object.entries(rentabilidadPorMes).sort((a, b) => b[0].localeCompare(a[0])).map(([mes, d]) => {
    const costoTotal = d.costoHacienda + d.costoAlim + d.costoSanidad + d.costoManoObra + d.costoGastos
    const resultado = d.ingreso - costoTotal
    const indice = costoTotal > 0 ? (resultado / costoTotal * 100) : null
    return { mes, ...d, costoTotal, resultado, indice }
  })
  const anioActualStr = String(new Date().getFullYear())

  // ── Amortización de maquinaria/herramientas, repartida por actividad ──
  // Reparte el valor de compra de cada activo entre los años de vida útil
  // definidos (o el estimado por tipo, si no se cargó ninguno), y ese costo
  // anual se reparte entre las actividades según el % de uso que ya tenés
  // cargado en cada activo. Si se compró durante este año, se prorratea solo
  // por los meses que ya pasaron desde la compra.
  const amortizacionPorActividad = { feedlot: 0, agricultura: 0, servicios: 0 }
  activos.filter(a => a.estado !== 'vendido' && a.valor_compra > 0 && a.vida_util_anios > 0).forEach(a => {
    const amortAnioCompleto = a.valor_compra / a.vida_util_anios
    let amortEsteAnio = amortAnioCompleto
    if (a.fecha_compra && a.fecha_compra.startsWith(anioActualStr)) {
      const mesCompra = parseInt(a.fecha_compra.slice(5, 7))
      const mesesRestantes = 13 - mesCompra // incluye el mes de compra
      amortEsteAnio = amortAnioCompleto * (mesesRestantes / 12)
    } else if (a.fecha_compra && a.fecha_compra.slice(0, 4) > anioActualStr) {
      amortEsteAnio = 0 // se compró después de este año (no debería pasar, pero por las dudas)
    }
    amortizacionPorActividad.feedlot += amortEsteAnio * ((a.pct_feedlot || 0) / 100)
    amortizacionPorActividad.agricultura += amortEsteAnio * (((a.pct_agricultura || 0) + (a.pct_alfalfa || 0)) / 100)
    amortizacionPorActividad.servicios += amortEsteAnio * ((a.pct_servicios || 0) / 100)
  })

  const mesesDelAnio = rentabilidadMensual.filter(m => m.mes.startsWith(anioActualStr))
  const rentabilidadAnual = mesesDelAnio.reduce((acc, m) => ({
    ingreso: acc.ingreso + m.ingreso, costoTotal: acc.costoTotal + m.costoTotal, resultado: acc.resultado + m.resultado,
  }), { ingreso: 0, costoTotal: 0, resultado: 0 })
  rentabilidadAnual.costoAmortizacion = amortizacionPorActividad.feedlot
  rentabilidadAnual.costoTotal += amortizacionPorActividad.feedlot
  rentabilidadAnual.resultado -= amortizacionPorActividad.feedlot
  const indiceAnual = rentabilidadAnual.costoTotal > 0 ? (rentabilidadAnual.resultado / rentabilidadAnual.costoTotal * 100) : null

  // ── Rentabilidad Agricultura (ingreso = ventas de granos; costo = agroquímicos + gastos generales + mano de obra) ──
  const rentabilidadPorMesAgro = {}
  const asegurarMesAgro = key => { if (!rentabilidadPorMesAgro[key]) rentabilidadPorMesAgro[key] = { ingreso: 0, costoInsumos: 0, costoManoObra: 0, costoGastos: 0 } }
  ventasGranos.forEach(vg => {
    const key = mesKey(vg.fecha || vg.creado_en)
    if (!key) return
    asegurarMesAgro(key)
    rentabilidadPorMesAgro[key].ingreso += vg.total || 0
  })
  comprasAgro.forEach(ca => {
    const key = mesKey(ca.fecha || ca.creado_en)
    if (!key || !ca.total) return
    asegurarMesAgro(key)
    rentabilidadPorMesAgro[key].costoInsumos += ca.total || 0
  })
  gastosGenerales.filter(g => g.actividad === 'Agricultura').forEach(g => {
    const key = mesKey(g.fecha)
    if (!key) return
    asegurarMesAgro(key)
    rentabilidadPorMesAgro[key].costoGastos += g.monto || 0
  })
  pagosEmpleados.forEach(pe => {
    const key = mesKey(pe.fecha || pe.creado_en)
    if (!key) return
    const actividad = pe.empleados?.actividad
    if (actividad === 'Agricultura') { asegurarMesAgro(key); rentabilidadPorMesAgro[key].costoManoObra += pe.monto || 0 }
    else if (actividad === 'General') { asegurarMesAgro(key); rentabilidadPorMesAgro[key].costoManoObra += (pe.monto || 0) / 3 }
  })
  const rentabilidadMensualAgro = Object.entries(rentabilidadPorMesAgro).sort((a, b) => b[0].localeCompare(a[0])).map(([mes, d]) => {
    const costoTotal = d.costoInsumos + d.costoManoObra + d.costoGastos
    const resultado = d.ingreso - costoTotal
    const indice = costoTotal > 0 ? (resultado / costoTotal * 100) : null
    return { mes, ...d, costoTotal, resultado, indice }
  })
  const mesesDelAnioAgro = rentabilidadMensualAgro.filter(mm => mm.mes.startsWith(anioActualStr))
  const rentabilidadAnualAgro = mesesDelAnioAgro.reduce((acc, mm) => ({
    ingreso: acc.ingreso + mm.ingreso, costoTotal: acc.costoTotal + mm.costoTotal, resultado: acc.resultado + mm.resultado,
  }), { ingreso: 0, costoTotal: 0, resultado: 0 })
  rentabilidadAnualAgro.costoAmortizacion = amortizacionPorActividad.agricultura
  rentabilidadAnualAgro.costoTotal += amortizacionPorActividad.agricultura
  rentabilidadAnualAgro.resultado -= amortizacionPorActividad.agricultura
  const indiceAnualAgro = rentabilidadAnualAgro.costoTotal > 0 ? (rentabilidadAnualAgro.resultado / rentabilidadAnualAgro.costoTotal * 100) : null

  // ── Rentabilidad Servicios (ingreso = servicios a terceros; costo = mano de obra de esos servicios + gastos generales + personal) ──
  const rentabilidadPorMesServ = {}
  const asegurarMesServ = key => { if (!rentabilidadPorMesServ[key]) rentabilidadPorMesServ[key] = { ingreso: 0, costoManoObraServ: 0, costoManoObra: 0, costoGastos: 0 } }
  serviciosTerceros.forEach(st => {
    const key = mesKey(st.fecha || st.creado_en)
    if (!key) return
    asegurarMesServ(key)
    rentabilidadPorMesServ[key].ingreso += (st.total || 0) + (st.monto_negro || 0)
  })
  manoObraServicios.forEach(mo => {
    const key = mesKey(mo.creado_en)
    if (!key) return
    asegurarMesServ(key)
    rentabilidadPorMesServ[key].costoManoObraServ += mo.monto_calculado || 0
  })
  gastosGenerales.filter(g => g.actividad === 'Servicios').forEach(g => {
    const key = mesKey(g.fecha)
    if (!key) return
    asegurarMesServ(key)
    rentabilidadPorMesServ[key].costoGastos += g.monto || 0
  })
  pagosEmpleados.forEach(pe => {
    const key = mesKey(pe.fecha || pe.creado_en)
    if (!key) return
    const actividad = pe.empleados?.actividad
    if (actividad === 'Servicios') { asegurarMesServ(key); rentabilidadPorMesServ[key].costoManoObra += pe.monto || 0 }
    else if (actividad === 'General') { asegurarMesServ(key); rentabilidadPorMesServ[key].costoManoObra += (pe.monto || 0) / 3 }
  })
  const rentabilidadMensualServ = Object.entries(rentabilidadPorMesServ).sort((a, b) => b[0].localeCompare(a[0])).map(([mes, d]) => {
    const costoTotal = d.costoManoObraServ + d.costoManoObra + d.costoGastos
    const resultado = d.ingreso - costoTotal
    const indice = costoTotal > 0 ? (resultado / costoTotal * 100) : null
    return { mes, ...d, costoTotal, resultado, indice }
  })
  const mesesDelAnioServ = rentabilidadMensualServ.filter(mm => mm.mes.startsWith(anioActualStr))
  const rentabilidadAnualServ = mesesDelAnioServ.reduce((acc, mm) => ({
    ingreso: acc.ingreso + mm.ingreso, costoTotal: acc.costoTotal + mm.costoTotal, resultado: acc.resultado + mm.resultado,
  }), { ingreso: 0, costoTotal: 0, resultado: 0 })
  rentabilidadAnualServ.costoAmortizacion = amortizacionPorActividad.servicios
  rentabilidadAnualServ.costoTotal += amortizacionPorActividad.servicios
  rentabilidadAnualServ.resultado -= amortizacionPorActividad.servicios
  const indiceAnualServ = rentabilidadAnualServ.costoTotal > 0 ? (rentabilidadAnualServ.resultado / rentabilidadAnualServ.costoTotal * 100) : null

  // ── Comparativa entre actividades ──
  const actividadesComparativa = [
    { key: 'feedlot', label: 'Feedlot', icon: '🐄', color: S.accent, anual: rentabilidadAnual, indice: indiceAnual, mensual: rentabilidadMensual },
    { key: 'agricultura', label: 'Agricultura', icon: '🌾', color: S.green, anual: rentabilidadAnualAgro, indice: indiceAnualAgro, mensual: rentabilidadMensualAgro },
    { key: 'servicios', label: 'Servicios', icon: '🚜', color: '#B5651D', anual: rentabilidadAnualServ, indice: indiceAnualServ, mensual: rentabilidadMensualServ },
  ]
  const ingresoTotalEmpresa = actividadesComparativa.reduce((s, a) => s + a.anual.ingreso, 0)
  const inversionTotalEmpresa = actividadesComparativa.reduce((s, a) => s + a.anual.costoTotal, 0)
  const resultadoTotalEmpresa = actividadesComparativa.reduce((s, a) => s + a.anual.resultado, 0)
  const indiceTotalEmpresa = inversionTotalEmpresa > 0 ? (resultadoTotalEmpresa / inversionTotalEmpresa * 100) : null

  if (loading) return <Loader />

  const corralesActivos = corrales.filter(c => c.rol !== 'libre')
  const totalAnimales = corralesActivos.reduce((s, c) => s + (c.animales || 0), 0)
  const corralesConGDP = corralesActivos.filter(c => gdpPorCorral[c.numero]?.gdp)
  const gdpGlobal = corralesConGDP.length
    ? corralesConGDP.reduce((s, c) => s + gdpPorCorral[c.numero].gdp * (c.animales || 0), 0) /
      corralesConGDP.reduce((s, c) => s + (c.animales || 0), 0)
    : null

  const TABS = [
    { key: 'gdp', label: 'GDP y conversión' },
    { key: 'costos', label: 'Costos' },
    { key: 'rentabilidad', label: 'Rentabilidad' },
  ]

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Reportes</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.25rem' }}>
        Análisis de performance · {new Date().getFullYear()}
      </div>

      {/* Selector de actividad */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
        {[
          { key: 'feedlot', icon: '🐄', label: 'Feedlot' },
          { key: 'agricultura', icon: '🌾', label: 'Agricultura' },
          { key: 'servicios', icon: '🚜', label: 'Servicios' },
          { key: 'comparativa', icon: '📊', label: 'Comparativa' },
        ].map(a => (
          <button key={a.key} onClick={() => setActividadVista(a.key)}
            style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${actividadVista === a.key ? S.accent : S.border}`,
              background: actividadVista === a.key ? S.accentLight : S.surface,
              color: actividadVista === a.key ? S.accent : S.muted }}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {actividadVista === 'feedlot' && (<>
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── GDP Y CONVERSIÓN ── */}
      {tab === 'gdp' && (
        <div>
          <SectionHeader title="GDP y conversión" sub="Ganancia diaria de peso · basado en ventas reales e historial de raciones" />
          <div style={{ fontSize: 11, color: S.muted, marginBottom: '.85rem', marginTop: -8 }}>
            La conversión usa el % de materia seca real de cada insumo (editable en Alimentación → Fórmulas de mixer → Ingredientes).
          </div>

          {/* Indicador principal: promedio de los últimos 6 meses — más estable que un solo mes,
              porque los animales que se venden un mes casi nunca son los que entraron ese mismo
              mes (el ciclo del feedlot dura varios meses), así que comparar un solo mes calendario
              da resultados con mucho ruido. Con 6 meses ese efecto se compensa. */}
          {prom6 && (
            <div style={{ background: S.accentLight, border: `2px solid ${S.accent}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.accent, marginBottom: '1rem' }}>📊 Indicadores — promedio últimos 6 meses (principal)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <Stat label="Ganancia diaria (por animal)" val={prom6.gdp ? `${prom6.gdp.toFixed(2)} kg/día` : '—'} sub="promedio del feedlot, por cabeza" color={prom6.gdp >= 1.1 ? S.green : prom6.gdp >= 0.9 ? S.amber : S.red} />
                <Stat label="Kg ganados x animal" val={prom6.gdp && prom6.permanencia ? `${Math.round(prom6.gdp * prom6.permanencia)} kg` : '—'} sub="total durante toda la estadía" color={S.green} />
                <Stat label="Permanencia" val={prom6.permanencia ? `${prom6.permanencia} días` : '—'} sub="tiempo promedio en el feedlot" />
                <Stat label="Conversión (6 meses)" val={prom6.conversion ? prom6.conversion.toFixed(2) : '—'} sub="kg materia seca / kg carne producido" color={prom6.conversion <= 7 ? S.green : prom6.conversion <= 9 ? S.amber : S.red} />
              </div>
              <div style={{ fontSize: 11, color: S.muted, marginTop: 10 }}>
                {prom3 && <>3 meses: GDP {prom3.gdp?.toFixed(3) || '—'} · Perm. {prom3.permanencia || '—'}d · Conv. {prom3.conversion?.toFixed(2) || '—'}{'  ·  '}</>}
                {prom12 && <>12 meses: GDP {prom12.gdp?.toFixed(3) || '—'} · Perm. {prom12.permanencia || '—'}d · Conv. {prom12.conversion?.toFixed(2) || '—'}</>}
              </div>
            </div>
          )}

          {/* GDP Global — metodología por movimientos mensuales */}
          {mesActual ? (
            <>
              {/* Tarjetas resumen mes actual */}
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Mes actual — {mesActual.mes} <span style={{ fontWeight: 400, color: S.muted, fontSize: 11 }}>(referencia — puede tener ruido, ver el promedio de 6 meses de arriba)</span></div>
                  {Math.abs(mesActual.variacionStock) > 20 && (
                    <span style={{ fontSize: 11, padding: '3px 10px', background: S.redLight, color: S.red, borderRadius: 4, fontWeight: 600 }}>⚠ Variación stock {mesActual.variacionStock.toFixed(0)}% — resultado puede tener sesgo</span>
                  )}
                  {Math.abs(mesActual.variacionStock) > 10 && Math.abs(mesActual.variacionStock) <= 20 && (
                    <span style={{ fontSize: 11, padding: '3px 10px', background: S.amberLight, color: S.amber, borderRadius: 4, fontWeight: 600 }}>⚠ Variación stock {mesActual.variacionStock.toFixed(0)}% — precaución</span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
                  <Stat label="GDP estimado" val={mesActual.gdp ? `${mesActual.gdp.toFixed(3)} kg/d` : '—'} sub="normal" color={mesActual.gdp >= 1.1 ? S.green : mesActual.gdp >= 0.9 ? S.amber : S.red} />
                  {Math.abs(mesActual.variacionStock) > 10 && <Stat label="GDP corregido" val={mesActual.gdpCorregido ? `${mesActual.gdpCorregido.toFixed(3)} kg/d` : '—'} sub="por variación stock" color={S.purple} />}
                  <Stat label="Permanencia" val={`${Math.round(mesActual.permanencia)} días`} sub={`corregida: ${Math.round(mesActual.permanenciaCorregida)} días`} />
                  <Stat label="Conversión (mes actual)" val={mesActual.conversion ? mesActual.conversion.toFixed(2) : '—'} sub="kg materia seca / kg carne producido" color={mesActual.conversion <= 7 ? S.green : mesActual.conversion <= 9 ? S.amber : S.red} />
                  <Stat label="Consumo diario (30 días)" val={consumoDiarioProm30 ? `${consumoDiarioProm30.toFixed(1)} kg/cab/d` : '—'} sub={`promedio móvil · ${diasConDatos30.length} días con datos`} color={S.accent} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <Stat label="Peso prom. ingreso" val={`${Math.round(mesActual.pesoProm_ingreso)} kg`} sub={`${mesActual.cabIngresadas} animales`} />
                  <Stat label="Peso prom. venta" val={`${Math.round(mesActual.pesoProm_venta)} kg`} sub={`${mesActual.cabVendidas} animales`} />
                  <Stat label="Existencia promedio (feedlot)" val={Math.round(mesActual.existenciaPromedio)} sub={`total de cabezas · inicio: ${mesActual.stockInicial} → fin: ${mesActual.stockFinal}`} />
                  <Stat label="Kg producidos (mes, hasta hoy)" val={(() => {
                    // Si el mes actual no tiene GDP calculable (ej. sin ventas todavía
                    // este mes), se usa el promedio de 6 o 3 meses como respaldo.
                    const kgProd = mesActual.kgProducidos || (gdpEstimado ? gdpEstimado * mesActual.existenciaPromedio * mesActual.dias : null)
                    return kgProd ? `${Math.round(kgProd).toLocaleString('es-AR')} kg` : '—'
                  })()} sub={`GDP × exist. × ${mesActual.dias} días transcurridos`} color={S.green} />
                </div>
              </div>

              {/* Promedios móviles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
                {[
                  { label: 'Prom. móvil 3 meses', data: prom3 },
                  { label: 'Prom. móvil 6 meses', data: prom6 },
                  { label: 'Prom. móvil 12 meses ★', data: prom12 },
                ].map(({ label, data }) => (
                  <div key={label} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
                    {data ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, color: S.muted }}>GDP</span>
                          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: data.gdp >= 1.1 ? S.green : data.gdp >= 0.9 ? S.amber : S.red }}>{data.gdp.toFixed(3)} kg/d</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, color: S.muted }}>Conversión</span>
                          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: data.conversion <= 7 ? S.green : data.conversion <= 9 ? S.amber : S.red }}>{data.conversion ? data.conversion.toFixed(2) : '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, color: S.muted }}>Permanencia</span>
                          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{data.permanencia} días</span>
                        </div>
                      </div>
                    ) : <div style={{ fontSize: 13, color: S.hint }}>Sin datos suficientes</div>}
                  </div>
                ))}
              </div>

              {/* Tabla historial mensual */}
              {mesesGDP.length > 1 && (
                <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>Historial mensual</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: S.bg }}>
                          {['Mes', 'Exist. prom.', 'Ingr.', 'Vend.', 'P. ingreso', 'P. venta', 'Permanencia', 'GDP', 'GDP corr.', 'Conversión', 'Var. stock'].map(h => (
                            <th key={h} style={{ padding: '7px 10px', textAlign: 'right', fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...mesesGDP].reverse().map((m, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, background: i === 0 ? S.accentLight : 'transparent' }}>
                            <td style={{ padding: '7px 10px', fontWeight: 600 }}>{m.mes}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{Math.round(m.existenciaPromedio)}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{m.cabIngresadas}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{m.cabVendidas}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{Math.round(m.pesoProm_ingreso)} kg</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{Math.round(m.pesoProm_venta)} kg</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{Math.round(m.permanencia)} d</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: m.gdp >= 1.1 ? S.green : m.gdp >= 0.9 ? S.amber : S.red }}>{m.gdp?.toFixed(3)}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: S.purple }}>{Math.abs(m.variacionStock) > 10 ? m.gdpCorregido?.toFixed(3) : '—'}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: m.conversion <= 7 ? S.green : m.conversion <= 9 ? S.amber : S.red }}>{m.conversion?.toFixed(2) || '—'}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: Math.abs(m.variacionStock) > 20 ? S.red : Math.abs(m.variacionStock) > 10 ? S.amber : S.muted }}>{m.variacionStock.toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ background: S.amberLight, border: `1px solid #EF9F27`, borderRadius: 8, padding: '1rem', marginBottom: '1.5rem', fontSize: 13, color: S.amber }}>
              ⚠ Sin datos suficientes — se necesitan ingresos y ventas en el mismo mes para calcular GDP.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
            <Stat label="GDP global ponderado" val={gdpGlobal ? gdpGlobal.toFixed(2) + ' kg/d' : '—'} sub={`${corralesConGDP.length} corrales con datos (pesadas)`} color={gdpGlobal ? (gdpGlobal >= 1.1 ? S.green : gdpGlobal >= 0.9 ? S.amber : S.red) : S.hint} />
            <Stat label="Animales activos" val={totalAnimales} sub={`${corralesActivos.length} corrales activos`} />
            <Stat label="Animales ≥ 400 kg" val={corralesActivos.filter(c => gdpPorCorral[c.numero]?.pesoActual >= 400).reduce((s, c) => s + (c.animales || 0), 0)} sub="listos para venta" color={S.green} />
            <Stat label="Pesadas registradas" val={pesadas.length} sub="en el historial" />
          </div>

          {corralesConGDP.length === 0 ? (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '3rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>
              No hay suficientes pesadas para calcular GDP.<br />
              <span style={{ fontSize: 11 }}>Se necesitan al menos 2 pesadas por corral.</span>
            </div>
          ) : (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Detalle por corral</div>
              <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: S.bg }}>
                      {['Corral', 'Rol', 'Animales', 'Peso ingreso', 'Peso actual', 'GDP kg/d', 'Días engorde', 'Días para 400kg', 'Estado'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {corralesActivos.filter(c => gdpPorCorral[c.numero]).map(c => {
                      const g = gdpPorCorral[c.numero]
                      const gdpColor = g.gdp ? (g.gdp >= 1.1 ? S.green : g.gdp >= 0.9 ? S.amber : S.red) : S.hint
                      const diasVenta = g.gdp && g.pesoActual < 400 ? Math.ceil((400 - g.pesoActual) / g.gdp) : g.pesoActual >= 400 ? 0 : null
                      let estado, estadoColor, estadoBg
                      if (g.pesoActual >= 400) { estado = 'Listo ★'; estadoColor = S.green; estadoBg = S.greenLight }
                      else if (diasVenta !== null && diasVenta <= 30) { estado = 'Pronto'; estadoColor = S.green; estadoBg = S.greenLight }
                      else if (diasVenta !== null && diasVenta <= 60) { estado = 'En curso'; estadoColor = S.accent; estadoBg = S.accentLight }
                      else { estado = 'Largo plazo'; estadoColor = S.muted; estadoBg = S.bg }
                      return (
                        <tr key={c.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'monospace' }}>C-{c.numero}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: S.muted }}>{c.rol === 'clasificado' && c.sub ? `Rango ${c.sub}` : c.rol}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{c.animales || 0}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.muted }}>{Math.round(g.pesoIngreso)} kg</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{Math.round(g.pesoActual)} kg</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: gdpColor }}>{g.gdp ? g.gdp.toFixed(2) : '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.muted }}>{g.diasEngorde > 0 ? g.diasEngorde + ' días' : '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: diasVenta === 0 ? S.green : S.text }}>{diasVenta === 0 ? 'Listo' : diasVenta !== null ? diasVenta + ' días' : '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: estadoBg, color: estadoColor }}>{estado}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Barra visual de GDP */}
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>GDP comparativo por corral</div>
                {corralesActivos.filter(c => gdpPorCorral[c.numero]?.gdp).sort((a, b) => (gdpPorCorral[b.numero]?.gdp || 0) - (gdpPorCorral[a.numero]?.gdp || 0)).map(c => {
                  const g = gdpPorCorral[c.numero]
                  const maxGDP = Math.max(...corralesActivos.filter(x => gdpPorCorral[x.numero]?.gdp).map(x => gdpPorCorral[x.numero].gdp), 1.5)
                  const pct = Math.round(g.gdp / maxGDP * 100)
                  const color = g.gdp >= 1.1 ? S.green : g.gdp >= 0.9 ? S.amber : S.red
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: S.muted, minWidth: 60, textAlign: 'right', fontFamily: 'monospace' }}>C-{c.numero}</div>
                      <div style={{ flex: 1, height: 10, background: S.bg, borderRadius: 5, overflow: 'hidden', border: `1px solid ${S.border}` }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: color, transition: 'width .5s ease' }} />
                      </div>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color, minWidth: 60 }}>{g.gdp.toFixed(2)} kg/d</div>
                      <div style={{ fontSize: 11, color: S.hint, minWidth: 80 }}>{c.animales || 0} animales</div>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: S.muted }}>
                  <span><span style={{ display: 'inline-block', width: 10, height: 4, background: S.green, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />GDP ≥ 1,1 kg/d</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 4, background: S.amber, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />0,9 – 1,1 kg/d</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 4, background: S.red, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />menor a 0,9 kg/d</span>
                </div>
              </div>
            </div>
          )}

          {/* Mortalidad anual */}
          {(() => {
            const anioActual = new Date().getFullYear()
            const anioAnterior = anioActual - 1
            const existenciaActualM = corrales.reduce((s, c) => s + (c.animales || 0), 0)
            const calcAnio = (anio) => {
              const delAnio = mortalidad.filter(m => m.fecha && new Date(m.fecha + 'T12:00:00').getFullYear() === anio)
              const total = delAnio.reduce((s, m) => s + (m.cantidad || 0), 0)
              // Mismo criterio que ya se usa en Sanidad: % sobre la población que
              // pudo haber estado expuesta (existencia actual + las que murieron)
              const pct = (existenciaActualM + total) > 0 ? (total / (existenciaActualM + total)) * 100 : 0
              const porCausa = {}
              delAnio.forEach(m => { if (m.causa) porCausa[m.causa] = (porCausa[m.causa] || 0) + (m.cantidad || 0) })
              const causaPrincipal = Object.entries(porCausa).sort((a, b) => b[1] - a[1])[0]
              return { total, pct, causaPrincipal }
            }
            const actual = calcAnio(anioActual)
            const anterior = calcAnio(anioAnterior)
            return (
              <div style={{ marginTop: '2rem' }}>
                <SectionHeader title="Mortalidad" sub={`Índice anual · ${anioActual}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <Stat label={`Muertes ${anioActual}`} val={actual.total} color={S.red} />
                  <Stat label="Índice de mortalidad" val={`${actual.pct.toFixed(2)}%`} sub="sobre la existencia actual + muertes" color={actual.pct > 2 ? S.red : actual.pct > 1 ? S.amber : S.green} />
                  <Stat label="Causa principal" val={actual.causaPrincipal?.[0] || '—'} sub={actual.causaPrincipal ? `${actual.causaPrincipal[1]} casos` : ''} />
                  <Stat label={`Año anterior (${anioAnterior})`} val={anterior.total ? `${anterior.total} · ${anterior.pct.toFixed(2)}%` : '—'} sub="para comparar" />
                </div>
                <div style={{ fontSize: 11, color: S.muted, marginTop: 10 }}>
                  El índice de mortalidad es anual (no tiene mucho sentido verlo mes a mes, dado el volumen bajo de casos) — compara cuántos animales murieron en el año contra la población total expuesta (existencia actual + las que murieron).
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── COSTOS ── */}
      {tab === 'costos' && (
        <div>
          <SectionHeader title="Costos de producción" sub="Alimentación · últimos 30 días con precios de referencia cargados" />

          {/* Precio por kg de cada dieta */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Precio por kg MF de cada dieta</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {['acostumbramiento', 'recria', 'terminacion'].map(etapa => (
                <div key={etapa} style={{ border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: S.text, textTransform: 'capitalize', marginBottom: 8 }}>{etapa}</div>
                  {['seco', 'humedo'].map(dieta => {
                    const d = precioPorDieta[`${dieta}_${etapa}`]
                    return (
                      <div key={dieta} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                        <span style={{ color: S.muted, textTransform: 'capitalize' }}>{dieta}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: d?.precio ? (d.completo ? S.text : S.amber) : S.hint }}>
                          {d?.precio ? `$${Math.round(d.precio).toLocaleString('es-AR')}/kg${!d.completo ? ' *' : ''}` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: S.hint, marginTop: 10 }}>
              Calculado con la fórmula real de cada dieta (% de cada ingrediente) y el precio de referencia de cada insumo en Insumos.
              {' * '}= a algún ingrediente de esa dieta todavía le falta precio de referencia, así que el número es aproximado.
            </div>
          </div>

          {/* Resumen global */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
            {(() => {
              const totalCostoAlim = Object.values(costoAlimPorCorral).reduce((s, c) => s + c.totalCosto, 0)
              const totalKgAlim = Object.values(costoAlimPorCorral).reduce((s, c) => s + c.totalKg, 0)
              const diasMedidos = Object.values(costoAlimPorCorral).reduce((s, c) => s + c.dias.size, 0)
              const costoPorAnimal = totalAnimales > 0 && totalCostoAlim > 0 ? totalCostoAlim / totalAnimales : null
              // Ganancia diaria: se prioriza la estimada por movimientos (no depende
              // de repesar los mismos animales) — la de pesadas queda de respaldo.
              const gdpParaCosto = gdpEstimado || gdpGlobal
              const costoPorKgProd = gdpParaCosto && costoPorAnimal ? costoPorAnimal / gdpParaCosto : null
              return [
                { label: 'Costo alim. total (30d)', val: totalCostoAlim > 0 ? `$${Math.round(totalCostoAlim).toLocaleString('es-AR')}` : '—', sub: precioPromAlim ? `$${Math.round(precioPromAlim).toLocaleString('es-AR')}/kg prom. ponderado` : 'sin precio de referencia en stock' },
                { label: 'Costo por animal/día', val: costoPorAnimal ? `$${Math.round(costoPorAnimal / 30).toLocaleString('es-AR')}` : '—', sub: 'promedio últimos 30 días' },
                { label: 'Kg alimento total', val: totalKgAlim > 0 ? totalKgAlim.toLocaleString('es-AR') + ' kg' : '—', sub: 'últimos 30 días' },
                { label: 'Costo por kg producido', val: costoPorKgProd ? `$${Math.round(costoPorKgProd).toLocaleString('es-AR')}` : '—', sub: gdpParaCosto ? `costo alim. / ${gdpParaCosto.toFixed(2)} kg/d ganados` : 'sin ganancia diaria calculable todavía' },
              ]
            })().map((m, i) => <Stat key={i} {...m} />)}
          </div>

          {/* Detalle por corral */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Costo por corral — últimos 30 días</div>
            {Object.keys(costoAlimPorCorral).length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>
                No hay raciones confirmadas con precios de referencia en los últimos 30 días.
              </div>
            ) : (
              <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: S.bg }}>
                      {['Corral', 'Animales', 'Días con datos', 'Costo total', 'Costo/día', 'Costo/animal/día', 'Kg consumidos', 'Costo/kg prod.'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(costoAlimPorCorral).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([num, datos]) => {
                      const corral = corrales.find(c => c.numero === num)
                      const animales = corral?.animales || 0
                      const diasCount = datos.dias.size
                      const costoDia = diasCount > 0 ? datos.totalCosto / diasCount : 0
                      const costoAnimalDia = animales > 0 && costoDia > 0 ? costoDia / animales : null
                      const gdp = gdpPorCorral[num]?.gdp || gdpEstimado
                      const costoKgProd = costoAnimalDia && gdp ? costoAnimalDia / gdp : null
                      return (
                        <tr key={num} style={{ borderBottom: `1px solid ${S.border}` }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'monospace' }}>C-{num}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{animales}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.muted }}>{diasCount}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>${Math.round(datos.totalCosto).toLocaleString('es-AR')}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>${Math.round(costoDia).toLocaleString('es-AR')}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.accent }}>{costoAnimalDia ? `$${Math.round(costoAnimalDia).toLocaleString('es-AR')}` : '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.muted }}>{Math.round(datos.totalKg).toLocaleString('es-AR')} kg</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: costoKgProd ? S.purple : S.hint, fontWeight: costoKgProd ? 600 : 400 }}>
                            {costoKgProd ? `$${Math.round(costoKgProd).toLocaleString('es-AR')}` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Precios de referencia de insumos */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Precios de referencia de insumos</div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Insumo', 'Stock actual', 'Precio ref. $/kg', 'Última actualización'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stock.map(s => (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.insumo}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{s.cantidad_kg?.toLocaleString('es-AR')} kg</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: s.precio_referencia ? S.green : S.hint }}>
                        {s.precio_referencia ? `$${s.precio_referencia.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: S.muted }}>
                        {s.precio_referencia_actualizado_en ? new Date(s.precio_referencia_actualizado_en).toLocaleDateString('es-AR') : '—'}
                      </td>
                    </tr>
                  ))}
                  {stock.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay insumos registrados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── RENTABILIDAD ── */}
      {tab === 'rentabilidad' && (
        <div>
          <SectionHeader title="Rentabilidad" sub="Análisis económico de ventas realizadas" />

          {/* Índice de rentabilidad — toda la inversión vs todo el ingreso */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>
              Índice de rentabilidad — {anioActualStr}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
              <Stat label={`Ingreso ${anioActualStr}`} val={rentabilidadAnual.ingreso > 0 ? `$${(rentabilidadAnual.ingreso / 1000000).toFixed(1)}M` : '—'} color={S.green} />
              <Stat label={`Inversión total ${anioActualStr}`} val={rentabilidadAnual.costoTotal > 0 ? `$${(rentabilidadAnual.costoTotal / 1000000).toFixed(1)}M` : '—'} sub="hacienda + alimentación + sanidad + mano de obra + gastos + amortización de maquinaria" />
              <Stat label="Resultado" val={rentabilidadAnual.costoTotal > 0 ? `$${(rentabilidadAnual.resultado / 1000000).toFixed(1)}M` : '—'} color={rentabilidadAnual.resultado >= 0 ? S.green : S.red} />
              <Stat label="Índice de rentabilidad anual" val={indiceAnual !== null ? `${indiceAnual.toFixed(1)}%` : '—'} sub="resultado / inversión total del año en curso" color={indiceAnual !== null ? (indiceAnual >= 0 ? S.green : S.red) : S.hint} />
            </div>
            <div style={{ fontSize: 11, color: S.hint, marginBottom: '1rem' }}>
              Compara, mes a mes, todo lo que entró (ventas) contra todo lo que salió (compra de hacienda, alimentación, sanidad, mano de obra y gastos generales del feedlot).
              La mano de obra cuenta entero para el personal asignado a Feedlot, y un tercio para el personal "General" (se reparte entre Feedlot, Agricultura y Servicios).
              La amortización de maquinaria (${(rentabilidadAnual.costoAmortizacion / 1000000).toFixed(1)}M este año) se suma solo al total anual de arriba, no a la tabla mes a mes de abajo.
            </div>
            {rentabilidadMensual.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>Sin datos suficientes todavía.</div>
            ) : (
              <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: S.bg }}>
                      {['Mes', 'Ingreso (ventas)', 'Compra hacienda', 'Alimentación', 'Sanidad', 'Mano de obra', 'Gastos generales', 'Inversión total', 'Resultado', 'Índice'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Mes' ? 'left' : 'right', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rentabilidadMensual.map(m => (
                      <tr key={m.mes} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '9px 12px', fontWeight: 600, fontFamily: 'monospace' }}>
                          {new Date(m.mes + '-01T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.green }}>{m.ingreso > 0 ? `$${(m.ingreso / 1000000).toFixed(2)}M` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{m.costoHacienda > 0 ? `$${(m.costoHacienda / 1000000).toFixed(2)}M` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{m.costoAlim > 0 ? `$${(m.costoAlim / 1000000).toFixed(2)}M` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{m.costoSanidad > 0 ? `$${(m.costoSanidad / 1000000).toFixed(2)}M` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{m.costoManoObra > 0 ? `$${(m.costoManoObra / 1000000).toFixed(2)}M` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{m.costoGastos > 0 ? `$${(m.costoGastos / 1000000).toFixed(2)}M` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{m.costoTotal > 0 ? `$${(m.costoTotal / 1000000).toFixed(2)}M` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: m.resultado >= 0 ? S.green : S.red }}>{m.costoTotal > 0 || m.ingreso > 0 ? `$${(m.resultado / 1000000).toFixed(2)}M` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: m.indice !== null ? (m.indice >= 0 ? S.green : S.red) : S.hint }}>{m.indice !== null ? `${m.indice.toFixed(1)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Resumen */}
          {(() => {
            const ventasConDatos = rentabilidadVentas.filter(v => v.total && v.costoCompra)
            const totalIngreso = ventas.reduce((s, v) => s + (v.total || 0), 0)
            const totalCostoComp = lotes.reduce((s, l) => s + ((l.kg_bascula || 0) * (l.precio_compra || 0)), 0)
            const margenBruto = totalIngreso - totalCostoComp
            const margenPct = totalCostoComp > 0 ? (margenBruto / totalCostoComp * 100) : null
            const totalAnimVendidos = ventas.reduce((s, v) => s + (v.cantidad || 0), 0)
            const precioPromVenta = (() => {
      const ventasConPrecioReal = ventas.filter(v => v.kg_neto && (v.monto_facturado || v.monto_negro))
      if (ventasConPrecioReal.length === 0) return ventas.filter(v => v.precio_kg).length > 0
        ? Math.round(ventas.filter(v => v.precio_kg).reduce((s, v) => s + v.precio_kg, 0) / ventas.filter(v => v.precio_kg).length)
        : null
      const totalNeto = ventasConPrecioReal.reduce((s, v) => s + ((v.monto_facturado||0) + (v.monto_negro||0) - (v.descuento_monto||0)), 0)
      const totalKg = ventasConPrecioReal.reduce((s, v) => s + (v.kg_neto||0), 0)
      return totalKg > 0 ? Math.round(totalNeto / totalKg) : null
    })()
            const precioPromCompra = lotes.filter(l => l.precio_compra).length > 0
              ? lotes.filter(l => l.precio_compra).reduce((s, l) => s + l.precio_compra, 0) / lotes.filter(l => l.precio_compra).length
              : null
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
                <Stat label="Ingreso total ventas" val={totalIngreso > 0 ? `$${(totalIngreso / 1000000).toFixed(1)}M` : '—'} sub={`${ventas.length} ventas · ${totalAnimVendidos} animales`} color={S.green} />
                <Stat label="Costo total compras" val={totalCostoComp > 0 ? `$${(totalCostoComp / 1000000).toFixed(1)}M` : '—'} sub={`${lotes.length} lotes ingresados`} />
                <Stat label="Margen bruto" val={totalIngreso > 0 && totalCostoComp > 0 ? `$${(margenBruto / 1000000).toFixed(1)}M` : '—'} sub={margenPct ? `${margenPct.toFixed(1)}% sobre costo` : 'sin datos suficientes'} color={margenBruto > 0 ? S.green : S.red} />
                <Stat label="Spread precio" val={precioPromVenta && precioPromCompra ? `$${Math.round(precioPromVenta - precioPromCompra).toLocaleString('es-AR')}/kg` : '—'} sub={`compra $${Math.round(precioPromCompra || 0).toLocaleString('es-AR')} · venta $${Math.round(precioPromVenta || 0).toLocaleString('es-AR')}`} color={S.accent} />
              </div>
            )
          })()}

          {/* Historial de ventas con rentabilidad */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Detalle por venta</div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Fecha', 'Corral', 'Animales', 'Kg netos', 'Precio venta', 'Total venta', 'Costo compra est.', 'Margen bruto', '%'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ventas.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay ventas registradas.</td></tr>
                  )}
                  {rentabilidadVentas.map(v => (
                    <tr key={v.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(v.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '10px 12px' }}>C-{v.corrales?.numero || v.corral_id}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{v.cantidad}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{v.kg_neto?.toLocaleString('es-AR')} kg</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{(() => {
                        if (v.kg_neto && (v.monto_facturado || v.monto_negro)) {
                          return `$${Math.round(((v.monto_facturado||0) + (v.monto_negro||0) - (v.descuento_monto||0)) / v.kg_neto).toLocaleString('es-AR')}`
                        }
                        return v.precio_kg ? `$${v.precio_kg.toLocaleString('es-AR')}` : <span style={{ color: S.amber, fontSize: 11 }}>Pendiente</span>
                      })()}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: v.total ? S.green : S.hint }}>{v.total ? `$${(v.total / 1000000).toFixed(2)}M` : '—'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.muted }}>{v.costoCompra ? `$${(v.costoCompra / 1000000).toFixed(2)}M` : '—'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: v.margen !== null ? (v.margen > 0 ? S.green : S.red) : S.hint }}>
                        {v.margen !== null ? `$${(v.margen / 1000000).toFixed(2)}M` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: v.margenPct !== null ? (v.margenPct > 0 ? S.green : S.red) : S.hint }}>
                        {v.margenPct !== null ? `${v.margenPct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historial de compras */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Historial de compras</div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Fecha', 'Lote', 'Animales', 'Procedencia', 'Kg báscula', 'Precio $/kg', 'Total compra', 'Peso prom.'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lotes.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay compras registradas.</td></tr>
                  )}
                  {lotes.map(l => {
                    const total = (l.kg_bascula || 0) * (l.precio_compra || 0)
                    return (
                      <tr key={l.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(l.fecha_ingreso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{l.codigo}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{l.cantidad}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12 }}>{l.procedencia || '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{l.kg_bascula?.toLocaleString('es-AR')} kg</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{l.precio_compra ? `$${l.precio_compra.toLocaleString('es-AR')}` : <span style={{ color: S.amber, fontSize: 11 }}>Pendiente</span>}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{total > 0 ? `$${(total / 1000000).toFixed(2)}M` : '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.muted }}>{l.peso_prom_ingreso ? `${l.peso_prom_ingreso} kg` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {tab === 'calculadora' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Calculadora de precio maximo de compra</div>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: '1.5rem' }}>Ingresa los parametros estimados y el sistema calcula el precio maximo a pagar por kg en la compra</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.green, textTransform: 'uppercase', marginBottom: '1rem' }}>Venta estimada</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Precio venta $/kg vivo', key: 'precio_venta', placeholder: '4250' },
                    { label: 'Kg venta por animal', key: 'kg_venta', placeholder: '380' },
                    { label: 'Desbaste venta %', key: 'desbaste_venta', placeholder: '8' },
                    { label: 'Flete venta $/animal', key: 'flete_venta', placeholder: '0' },
                    { label: 'Comision venta %', key: 'comision_venta_pct', placeholder: '0' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                      <input type="number" value={calc[f.key]} onChange={e => setCalc({...calc, [f.key]: e.target.value})} placeholder={f.placeholder}
                        style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, textTransform: 'uppercase', marginBottom: '1rem' }}>Parametros feedlot</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Kg compra por animal', key: 'kg_compra', placeholder: '267' },
                    { label: 'Aumento diario kg', key: 'aumento_diario', placeholder: '1.25' },
                    { label: 'Conversion MF/kg carne', key: 'conversion_mf', placeholder: '6.8' },
                    { label: 'Costo dieta $/kg comida', key: 'costo_dieta', placeholder: '220' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                      <input type="number" value={calc[f.key]} onChange={e => setCalc({...calc, [f.key]: e.target.value})} placeholder={f.placeholder}
                        style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.red, textTransform: 'uppercase', marginBottom: '1rem' }}>Gastos por animal</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Sanidad $/animal', key: 'sanidad_animal', placeholder: '9500' },
                    { label: 'Gastos fijos $/animal/mes', key: 'gastos_fijos_mes', placeholder: '20000' },
                    { label: 'Flete compra $/animal', key: 'flete_compra', placeholder: '12000' },
                    { label: 'Comision compra %', key: 'comision_compra_pct', placeholder: '0' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                      <input type="number" value={calc[f.key]} onChange={e => setCalc({...calc, [f.key]: e.target.value})} placeholder={f.placeholder}
                        style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.amber, textTransform: 'uppercase', marginBottom: 8 }}>Rentabilidad anual deseada %</div>
                <input type="number" value={calc.margen_deseado} onChange={e => setCalc({...calc, margen_deseado: e.target.value})} placeholder="15"
                  style={{ width: '100%', border: `1px solid ${S.amber}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace', fontWeight: 600 }} />
              </div>
            </div>
            <div>
              {(() => {
                const pV = parseFloat(calc.precio_venta)||0, kgV = parseFloat(calc.kg_venta)||0
                const desbaste = parseFloat(calc.desbaste_venta)/100||0.08
                const kgC = parseFloat(calc.kg_compra)||0
                const aumDia = parseFloat(calc.aumento_diario)||1.25
                const convMF = parseFloat(calc.conversion_mf)||6.8
                const costDieta = parseFloat(calc.costo_dieta)||220
                const sanidad = parseFloat(calc.sanidad_animal)||9500
                const gfMes = parseFloat(calc.gastos_fijos_mes)||20000
                const flC = parseFloat(calc.flete_compra)||0
                const flV = parseFloat(calc.flete_venta)||0
                const comV = parseFloat(calc.comision_venta_pct)/100||0
                const comC = parseFloat(calc.comision_compra_pct)/100||0
                const margen = parseFloat(calc.margen_deseado)/100||0.15
                if (!pV||!kgV||!kgC) return (
                  <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '2rem', textAlign: 'center', color: S.hint }}>
                    Completa precio de venta, kg venta y kg compra para ver el calculo.
                  </div>
                )
                const kgNetoV = kgV*(1-desbaste)
                const aumento = kgV-kgC
                const dias = aumDia>0 ? Math.round(aumento/aumDia) : 0
                const meses = dias/30
                const kgComida = aumento*convMF
                const costComida = kgComida*costDieta
                const gfTotal = gfMes*meses
                const comVMonto = kgNetoV*pV*comV
                const comCMonto = kgC*comC
                const ingresoNeto = kgNetoV*pV - flV - comVMonto
                const costosSinCompra = costComida+sanidad+gfTotal+flC+comCMonto
                const precioMaxEq = (ingresoNeto-costosSinCompra)/kgC
                const factorM = 1+(margen*meses/12)
                const precioMaxConM = (ingresoNeto-costosSinCompra*factorM)/(kgC*factorM)
                const costos = [
                  {label:'Alimentacion', val:Math.round(costComida)},
                  {label:'Sanidad', val:Math.round(sanidad)},
                  {label:'Gastos fijos', val:Math.round(gfTotal)},
                  {label:'Flete compra', val:Math.round(flC)},
                  {label:'Flete venta', val:Math.round(flV)},
                  {label:'Comision venta', val:Math.round(comVMonto)},
                ].filter(c=>c.val>0)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                      {[
                        {label:'Dias feedlot', val:`${dias} dias`, sub:`${meses.toFixed(1)} meses`},
                        {label:'Aumento total', val:`${aumento} kg`, sub:`${kgC} a ${kgV} kg`},
                        {label:'Kg comida total', val:`${Math.round(kgComida).toLocaleString('es-AR')} kg`, sub:`Conv. ${convMF}`},
                      ].map((c,i) => (
                        <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
                          <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: S.accent }}>{c.val}</div>
                          <div style={{ fontSize: 11, color: S.hint }}>{c.sub}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: S.red, textTransform: 'uppercase', marginBottom: '1rem' }}>Costos sin compra</div>
                      {costos.map((c,i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: `1px solid ${S.border}` }}>
                          <span style={{ color: S.muted }}>{c.label}</span>
                          <span style={{ fontFamily: 'monospace', color: S.red }}>-${c.val.toLocaleString('es-AR')}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', fontWeight: 700 }}>
                        <span>Total costos sin compra</span>
                        <span style={{ fontFamily: 'monospace', color: S.red }}>-${Math.round(costosSinCompra).toLocaleString('es-AR')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderTop: `1px solid ${S.border}` }}>
                        <span style={{ color: S.green }}>Ingreso neto venta</span>
                        <span style={{ fontFamily: 'monospace', color: S.green }}>+${Math.round(ingresoNeto).toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                    <div style={{ background: S.accent, borderRadius: 10, padding: '1.5rem', color: '#fff' }}>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>Precio maximo de compra - Punto de equilibrio</div>
                      <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'monospace' }}>${Math.max(0,Math.round(precioMaxEq)).toLocaleString('es-AR')}</div>
                      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>por kg vivo</div>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', margin: '12px 0' }} />
                      <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>Con rentabilidad del {calc.margen_deseado}% anual</div>
                      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace' }}>${Math.max(0,Math.round(precioMaxConM)).toLocaleString('es-AR')}</div>
                      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>por kg vivo</div>
                    </div>
                    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Sensibilidad - precio compra vs rentabilidad</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead><tr style={{ background: S.bg }}>
                          {['Precio compra $/kg','Costo total','Ingreso neto','Ganancia','Rent. anual'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {[0.85,0.90,0.95,1.0,1.05,1.10].map(factor => {
                            const pC = Math.round(precioMaxEq*factor)
                            const cTotal = pC*kgC+costosSinCompra
                            const gan = ingresoNeto-cTotal
                            const rentA = meses>0 ? ((gan/cTotal)*(12/meses)*100) : 0
                            const esRef = factor===1.0
                            return (
                              <tr key={factor} style={{ borderBottom: `1px solid ${S.border}`, background: esRef ? S.accentLight : 'transparent' }}>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:esRef?700:400 }}>${pC.toLocaleString('es-AR')}</td>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', color:S.red }}>-${cTotal.toLocaleString('es-AR')}</td>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', color:S.green }}>+${Math.round(ingresoNeto).toLocaleString('es-AR')}</td>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:600, color:gan>=0?S.green:S.red }}>{gan>=0?'+':''}{Math.round(gan).toLocaleString('es-AR')}</td>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:600, color:rentA>=0?S.green:S.red }}>{rentA.toFixed(1)}%</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
      </>)}

      {actividadVista === 'agricultura' && (
        <SeccionRentabilidadActividad
          S={S} titulo="Agricultura" anio={anioActualStr}
          anual={rentabilidadAnualAgro} indiceAnual={indiceAnualAgro} mensual={rentabilidadMensualAgro}
          columnas={[
            { key: 'ingreso', label: 'Ingreso (venta granos)', color: S.green },
            { key: 'costoInsumos', label: 'Agroquímicos', color: S.muted },
            { key: 'costoManoObra', label: 'Mano de obra', color: S.muted },
            { key: 'costoGastos', label: 'Gastos generales', color: S.muted },
          ]}
          subInversion="agroquímicos + mano de obra + gastos + amortización de maquinaria"
          nota="Compara ventas de granos contra compras de agroquímicos, mano de obra (Feedlot no incluido, General se reparte en tercios) y gastos generales de Agricultura. La amortización de maquinaria se suma solo al total anual de arriba, no a la tabla mes a mes. Con pocos datos cargados todavía, muchos meses van a aparecer vacíos — a medida que cargues cosechas, ventas de granos y compras, se va completando solo."
        />
      )}

      {actividadVista === 'servicios' && (
        <SeccionRentabilidadActividad
          S={S} titulo="Servicios" anio={anioActualStr}
          anual={rentabilidadAnualServ} indiceAnual={indiceAnualServ} mensual={rentabilidadMensualServ}
          columnas={[
            { key: 'ingreso', label: 'Ingreso (servicios a terceros)', color: S.green },
            { key: 'costoManoObraServ', label: 'Mano de obra (por servicio)', color: S.muted },
            { key: 'costoManoObra', label: 'Sueldos', color: S.muted },
            { key: 'costoGastos', label: 'Gastos generales', color: S.muted },
          ]}
          subInversion="mano de obra por servicio + sueldos + gastos + amortización de maquinaria"
          nota="Compara lo cobrado por servicios a terceros contra la mano de obra de esos trabajos, los sueldos del personal de Servicios (Feedlot no incluido, General se reparte en tercios) y los gastos generales de Servicios. La amortización de maquinaria se suma solo al total anual de arriba, no a la tabla mes a mes. Con pocos datos cargados todavía, muchos meses van a aparecer vacíos — a medida que cargues servicios, se va completando solo."
        />
      )}

      {actividadVista === 'comparativa' && (
        <SeccionComparativa S={S} anio={anioActualStr} actividades={actividadesComparativa}
          ingresoTotal={ingresoTotalEmpresa} inversionTotal={inversionTotalEmpresa}
          resultadoTotal={resultadoTotalEmpresa} indiceTotal={indiceTotalEmpresa} />
      )}

    </div>
  )
}

// Cuadro de rentabilidad mensual/anual reutilizable, para Agricultura y Servicios
// (Feedlot tiene el suyo propio más completo, arriba, con más pestañas).
function SeccionRentabilidadActividad({ S, titulo, anio, anual, indiceAnual, mensual, columnas, subInversion, nota }) {
  return (
    <div>
      <SectionHeader title={`Rentabilidad — ${titulo}`} sub={`Índice de rentabilidad ${anio}`} />
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
          <Stat label={`Ingreso ${anio}`} val={anual.ingreso > 0 ? `$${(anual.ingreso / 1000000).toFixed(1)}M` : '—'} color={S.green} />
          <Stat label={`Inversión total ${anio}`} val={anual.costoTotal > 0 ? `$${(anual.costoTotal / 1000000).toFixed(1)}M` : '—'} sub={subInversion} />
          <Stat label="Resultado" val={anual.costoTotal > 0 || anual.ingreso > 0 ? `$${(anual.resultado / 1000000).toFixed(1)}M` : '—'} color={anual.resultado >= 0 ? S.green : S.red} />
          <Stat label="Índice de rentabilidad anual" val={indiceAnual !== null ? `${indiceAnual.toFixed(1)}%` : '—'} sub="resultado / inversión total del año en curso" color={indiceAnual !== null ? (indiceAnual >= 0 ? S.green : S.red) : S.hint} />
        </div>
        <div style={{ fontSize: 11, color: S.hint, marginBottom: '1rem' }}>{nota}</div>
        {mensual.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>Todavía no hay datos suficientes de {titulo} para calcular nada acá — a medida que cargues información, esta pantalla se va a ir completando sola.</div>
        ) : (
          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: S.bg }}>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>Mes</th>
                  {columnas.map(c => (
                    <th key={c.key} style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{c.label}</th>
                  ))}
                  <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>Inversión total</th>
                  <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>Resultado</th>
                  <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>Índice</th>
                </tr>
              </thead>
              <tbody>
                {mensual.map(m => (
                  <tr key={m.mes} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 12px', fontWeight: 600, fontFamily: 'monospace' }}>
                      {new Date(m.mes + '-01T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                    </td>
                    {columnas.map(c => (
                      <td key={c.key} style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: c.color }}>{m[c.key] > 0 ? `$${(m[c.key] / 1000000).toFixed(2)}M` : '—'}</td>
                    ))}
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{m.costoTotal > 0 ? `$${(m.costoTotal / 1000000).toFixed(2)}M` : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: m.resultado >= 0 ? S.green : S.red }}>{m.costoTotal > 0 || m.ingreso > 0 ? `$${(m.resultado / 1000000).toFixed(2)}M` : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: m.indice !== null ? (m.indice >= 0 ? S.green : S.red) : S.hint }}>{m.indice !== null ? `${m.indice.toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Sección "Comparativa" — participación de cada actividad en el total de la
// empresa, índice de rentabilidad comparado, y evolución mensual del resultado.
function SeccionComparativa({ S, anio, actividades, ingresoTotal, inversionTotal, resultadoTotal, indiceTotal }) {
  const fmtM = (n) => n ? `$${(n / 1000000).toFixed(1)}M` : '—'
  const pct = (parte, total) => total > 0 ? (parte / total * 100) : 0

  // Gráfico de torta con CSS conic-gradient
  function Donut({ valores }) {
    let acumulado = 0
    const stops = valores.filter(v => v.valor > 0).map(v => {
      const desde = acumulado
      acumulado += pct(v.valor, valores.reduce((s, x) => s + x.valor, 0))
      return `${v.color} ${desde}% ${acumulado}%`
    })
    const total = valores.reduce((s, x) => s + x.valor, 0)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%', flexShrink: 0,
          background: total > 0 ? `conic-gradient(${stops.join(', ')})` : S.border,
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {valores.map(v => (
            <div key={v.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: v.color, flexShrink: 0 }} />
              <span style={{ color: S.text }}>{v.label}</span>
              <span style={{ color: S.muted, fontFamily: 'monospace' }}>{total > 0 ? pct(v.valor, total).toFixed(0) : 0}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Meses unificados de las tres actividades, para el gráfico de evolución
  const todosLosMeses = [...new Set(actividades.flatMap(a => a.mensual.map(m => m.mes)))].sort()
  const ultimos12 = todosLosMeses.slice(-12)
  const maxAbs = Math.max(1, ...ultimos12.flatMap(mes => actividades.map(a => Math.abs((a.mensual.find(m => m.mes === mes)?.resultado) || 0))))

  return (
    <div>
      <SectionHeader title="Comparativa entre actividades" sub={`Participación e índices comparados · ${anio}`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        <Stat label={`Ingreso total empresa ${anio}`} val={fmtM(ingresoTotal)} color={S.green} />
        <Stat label={`Inversión total empresa ${anio}`} val={fmtM(inversionTotal)} />
        <Stat label="Resultado total" val={fmtM(resultadoTotal)} color={resultadoTotal >= 0 ? S.green : S.red} />
        <Stat label="Índice general anual" val={indiceTotal !== null ? `${indiceTotal.toFixed(1)}%` : '—'} sub="resultado / inversión total del año en curso" color={indiceTotal !== null ? (indiceTotal >= 0 ? S.green : S.red) : S.hint} />
      </div>

      {/* Tabla comparativa */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Resumen por actividad</div>
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: S.bg }}>
                {['Actividad', 'Ingreso', '% del ingreso', 'Inversión', '% de la inversión', 'Resultado', 'Índice'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Actividad' ? 'left' : 'right', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actividades.map(a => (
                <tr key={a.key} style={{ borderBottom: `1px solid ${S.border}` }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{a.icon} {a.label}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.green }}>{fmtM(a.anual.ingreso)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{ingresoTotal > 0 ? `${pct(a.anual.ingreso, ingresoTotal).toFixed(0)}%` : '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtM(a.anual.costoTotal)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{inversionTotal > 0 ? `${pct(a.anual.costoTotal, inversionTotal).toFixed(0)}%` : '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: a.anual.resultado >= 0 ? S.green : S.red }}>{fmtM(a.anual.resultado)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: a.indice !== null ? (a.indice >= 0 ? S.green : S.red) : S.hint }}>{a.indice !== null ? `${a.indice.toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
              <tr style={{ background: S.bg, fontWeight: 700 }}>
                <td style={{ padding: '10px 12px' }}>Total empresa</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.green }}>{fmtM(ingresoTotal)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>100%</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtM(inversionTotal)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>100%</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: resultadoTotal >= 0 ? S.green : S.red }}>{fmtM(resultadoTotal)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: indiceTotal !== null ? (indiceTotal >= 0 ? S.green : S.red) : S.hint }}>{indiceTotal !== null ? `${indiceTotal.toFixed(1)}%` : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Participación en ingreso e inversión */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Participación en el ingreso</div>
          <Donut valores={actividades.map(a => ({ label: a.label, valor: a.anual.ingreso, color: a.color }))} />
        </div>
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Participación en la inversión</div>
          <Donut valores={actividades.map(a => ({ label: a.label, valor: a.anual.costoTotal, color: a.color }))} />
        </div>
      </div>

      {/* Índice de rentabilidad comparado */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Índice de rentabilidad anual comparado — dónde rinde más cada peso invertido en lo que va del año</div>
        {actividades.map(a => {
          const maxIndice = Math.max(1, ...actividades.map(x => Math.abs(x.indice || 0)))
          const ancho = a.indice !== null ? Math.min(100, Math.abs(a.indice) / maxIndice * 100) : 0
          return (
            <div key={a.key} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>{a.icon} {a.label}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: a.indice !== null ? (a.indice >= 0 ? S.green : S.red) : S.hint }}>{a.indice !== null ? `${a.indice.toFixed(1)}%` : 'sin datos'}</span>
              </div>
              <div style={{ background: S.bg, borderRadius: 6, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${ancho}%`, height: '100%', background: a.indice !== null ? (a.indice >= 0 ? a.color : S.red) : 'transparent', borderRadius: 6 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Evolución mensual del resultado */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Evolución mensual del resultado (últimos {ultimos12.length} meses con datos)</div>
        {ultimos12.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>Todavía no hay suficientes meses con datos para ver una evolución.</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180, borderBottom: `1px solid ${S.border}`, paddingBottom: 4 }}>
            {ultimos12.map(mes => (
              <div key={mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: '100%' }}>
                  {actividades.map(a => {
                    const val = a.mensual.find(m => m.mes === mes)?.resultado || 0
                    const alturaPx = Math.max(2, Math.abs(val) / maxAbs * 140)
                    return (
                      <div key={a.key} title={`${a.label}: ${fmtM(val)}`}
                        style={{ width: 8, height: alturaPx, background: val >= 0 ? a.color : S.red, borderRadius: '2px 2px 0 0', alignSelf: 'flex-end' }} />
                    )
                  })}
                </div>
                <div style={{ fontSize: 9, color: S.hint, writingMode: 'vertical-rl', textOrientation: 'mixed', whiteSpace: 'nowrap' }}>
                  {new Date(mes + '-01T12:00:00').toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
          {actividades.map(a => (
            <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: S.muted }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color }} /> {a.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function calcPesoProm(pa) {
  if (!pa || pa.length === 0) return null
  const conPeso = pa.filter(p => p.peso_promedio && p.rango !== 'menores')
  if (!conPeso.length) return null
  const tot = conPeso.reduce((s, p) => s + (p.cantidad || 0), 0)
  if (!tot) return null
  return conPeso.reduce((s, p) => s + p.peso_promedio * (p.cantidad || 0), 0) / tot
} 
