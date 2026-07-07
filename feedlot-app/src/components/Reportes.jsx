import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './UI'

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
  const [lotes, setLotes] = useState([])
  const [ventas, setVentas] = useState([])
  const [formulasMixer, setFormulasMixer] = useState([])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: c }, { data: p }, { data: r }, { data: s }, { data: l }, { data: v }, { data: fm }] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('pesadas').select('*, corrales(numero), pesada_animales(rango, cantidad, peso_promedio)').order('creado_en', { ascending: false }).limit(100),
      supabase.from('raciones_app').select('*, corrales(numero, animales)').order('creado_en', { ascending: false }).limit(500),
      supabase.from('stock_insumos').select('*'),
      supabase.from('lotes').select('*').order('created_at', { ascending: false }),
      supabase.from('ventas').select('*, corrales(numero)').order('creado_en', { ascending: false }),
      supabase.from('formulas_mixer').select('*'),
    ])
    setCorrales((c || []).sort((a, b) => parseInt(a.numero) - parseInt(b.numero)))
    setPesadas(p || [])
    setRaciones(r || [])
    setStock(s || [])
    setLotes(l || [])
    setVentas(v || [])
    setFormulasMixer(fm || [])
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
  // Precio promedio ponderado de alimentación (kg × precio_referencia)
  const stockConPrecio = stock.filter(s => s.precio_referencia && s.cantidad_kg > 0)
  const totalKgStock = stockConPrecio.reduce((s, i) => s + i.cantidad_kg, 0)
  const precioPromAlim = totalKgStock > 0
    ? stockConPrecio.reduce((s, i) => s + i.precio_referencia * i.cantidad_kg, 0) / totalKgStock
    : null

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
    const costo = precioPromAlim ? (r.kg_total || 0) * precioPromAlim : 0
    costoAlimPorCorral[num].totalCosto += costo
    costoAlimPorCorral[num].totalKg += r.kg_total || 0
    costoAlimPorCorral[num].dias.add(new Date(r.creado_en).toDateString())
  })

  // ── GDP GLOBAL FEEDLOT — Metodología por movimientos mensuales ──
  const hoy = new Date()
  // Calcula por mes calendario usando lotes y ventas

  // ── Materia seca real: % MS por insumo (de stock_insumos) + composición de cada
  // fórmula (de formulas_mixer) — para calcular cuántos kg de MATERIA SECA real
  // se le dieron a los animales cada día, en vez de un % fijo aproximado.
  const pctMSPorInsumo = {}
  stock.forEach(s => { pctMSPorInsumo[s.insumo] = s.pct_ms || 0 })
  const formulasPorDietaEtapa = {}
  formulasMixer.forEach(f => {
    const key = `${f.dieta}_${f.etapa}`
    if (!formulasPorDietaEtapa[key]) formulasPorDietaEtapa[key] = []
    formulasPorDietaEtapa[key].push({ n: f.ingrediente, kg: f.kg })
  })
  // Kg de materia seca real de una ración (separa rollo extra del mixer, y aplica
  // el % MS de cada insumo de la fórmula correspondiente)
  function kgMSDeRacion(r) {
    const kgRollo = r.kg_rollo_extra || (r.solo_rollo ? (r.kg_total || 0) : 0)
    const kgMixer = (r.kg_total || 0) - kgRollo
    let msTotal = 0
    if (kgRollo > 0) {
      const msRollo = pctMSPorInsumo['Rollo (heno)'] || 0
      msTotal += kgRollo * msRollo / 100
    }
    if (kgMixer > 0) {
      const etapa = r.mezclador === 'Acostumbramiento' ? 'acostumbramiento' : r.mezclador === 'Recria' ? 'recria' : 'terminacion'
      const dietaR = r.tipo_dieta || 'seco'
      const formula = formulasPorDietaEtapa[`${dietaR}_${etapa}`] || []
      formula.forEach(ing => {
        const kgIng = ing.kg * kgMixer / 100
        const msIng = pctMSPorInsumo[ing.n] ?? 0
        msTotal += kgIng * msIng / 100
      })
    }
    return msTotal
  }

  function calcMesGDP(lotesData, ventasData, racionesData, fechaInicio, fechaFin) {
    const dias = Math.round((fechaFin - fechaInicio) / 86400000)
    if (dias <= 0) return null

    // Lotes activos al inicio del período
    const lotesAntesInicio = lotesData.filter(l => new Date(l.fecha_ingreso + 'T12:00:00') < fechaInicio)
    const ventasAntesInicio = ventasData.filter(v => new Date(v.creado_en) < fechaInicio)
    const animalesVendidosAntes = ventasAntesInicio.reduce((s, v) => s + (v.cantidad || 0), 0)
    const animalesIngresadosAntes = lotesAntesInicio.reduce((s, l) => s + (l.cantidad || 0), 0)
    const stockInicial = Math.max(0, animalesIngresadosAntes - animalesVendidosAntes)

    // Ingresos del período
    const lotesPeriodo = lotesData.filter(l => {
      const f = new Date(l.fecha_ingreso + 'T12:00:00')
      return f >= fechaInicio && f < fechaFin
    })
    const cabIngresadas = lotesPeriodo.reduce((s, l) => s + (l.cantidad || 0), 0)
    const kgIngresados = lotesPeriodo.reduce((s, l) => s + (l.kg_bascula || 0), 0)

    // Ventas del período
    const ventasPeriodo = ventasData.filter(v => {
      const f = new Date(v.creado_en)
      return f >= fechaInicio && f < fechaFin
    })
    const cabVendidas = ventasPeriodo.reduce((s, v) => s + (v.cantidad || 0), 0)
    const kgVendidos = ventasPeriodo.reduce((s, v) => s + (v.kg_vivo_total || 0), 0)

    const stockFinal = Math.max(0, stockInicial + cabIngresadas - cabVendidas)

    if (cabIngresadas === 0 || cabVendidas === 0 || kgIngresados === 0 || kgVendidos === 0) return null

    // Paso 1: Pesos promedio
    const pesoProm_ingreso = kgIngresados / cabIngresadas
    const pesoProm_venta = kgVendidos / cabVendidas

    // Paso 2: Existencia promedio
    const existenciaPromedio = (stockInicial + stockFinal) / 2
    if (existenciaPromedio <= 0) return null

    // Paso 3 y 4: Permanencia
    const permanencia = (existenciaPromedio * dias) / cabVendidas

    // Corrección por variación de stock
    const variacionStock = stockInicial > 0 ? ((stockFinal - stockInicial) / stockInicial) * 100 : 0
    const existenciaCorregida = existenciaPromedio - ((stockFinal - stockInicial) / 2)
    const permanenciaCorregida = existenciaCorregida > 0 ? (existenciaCorregida * dias) / cabVendidas : permanencia

    // Paso 5: GDP
    const gdp = permanencia > 0 ? (pesoProm_venta - pesoProm_ingreso) / permanencia : null
    const gdpCorregido = permanenciaCorregida > 0 ? (pesoProm_venta - pesoProm_ingreso) / permanenciaCorregida : null

    // Paso 6: Consumo diario
    // Consumo diario: promedio de (kg_dia / animales_ese_dia) para cada día con raciones
    const racionesPeriodo = racionesData.filter(r => {
      const f = new Date(r.creado_en)
      return f >= fechaInicio && f < fechaFin
    })
    // Agrupar por día
    const porDia = {}
    racionesPeriodo.forEach(r => {
      const dia = r.creado_en.split('T')[0]
      if (!porDia[dia]) porDia[dia] = { kgTotal: 0, animales: 0, corralesVistos: new Set() }
      porDia[dia].kgTotal += r.kg_total || 0
      // Se usa la "foto" de animales guardada en el momento de cargar la ración
      // (cantidad_animales) — así el cálculo es correcto incluso si después se
      // movieron animales de ese corral. Los registros viejos (de antes de este
      // arreglo) no tienen esa foto, así que para esos se usa el dato actual del
      // corral como respaldo, aunque no sea exacto históricamente.
      if (r.corral_id && !porDia[dia].corralesVistos.has(r.corral_id)) {
        porDia[dia].animales += (r.cantidad_animales ?? r.corrales?.animales) || 0
        porDia[dia].corralesVistos.add(r.corral_id)
      }
    })
    const diasConDatos = Object.values(porDia).filter(d => d.animales > 0 && d.kgTotal > 0)
    const consumoDiario = diasConDatos.length > 0
      ? diasConDatos.reduce((s, d) => s + d.kgTotal / d.animales, 0) / diasConDatos.length
      : null
    const consumoDiarioCalc = consumoDiario && consumoDiario <= 30 ? consumoDiario : null
    const kgAlimento = racionesPeriodo.reduce((s, r) => s + (r.kg_total || 0), 0)
    const kgAlimentoMS = racionesPeriodo.reduce((s, r) => s + kgMSDeRacion(r), 0)

    // Paso 7: Conversión
    const conversion = gdp && consumoDiarioCalc ? (kgAlimentoMS / (gdp * existenciaPromedio * dias)) : null
    const conversionCorregida = gdpCorregido && consumoDiarioCalc ? (kgAlimentoMS / (gdpCorregido * existenciaPromedio * dias)) : null
    const kgProducidos = gdp && existenciaPromedio ? gdp * existenciaPromedio * dias : null

    return {
      dias, stockInicial, stockFinal, cabIngresadas, kgIngresados, cabVendidas, kgVendidos,
      pesoProm_ingreso, pesoProm_venta, existenciaPromedio, existenciaCorregida,
      permanencia, permanenciaCorregida, gdp, gdpCorregido,
      consumoDiario: consumoDiarioCalc, conversion, conversionCorregida, kgProducidos, kgAlimento,
      variacionStock,
    }
  }

  // Calcular por mes (últimos 12 meses)
  const mesesGDP = []
  for (let i = 0; i < 12; i++) {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 1)
    const resultado = calcMesGDP(lotes, ventas, raciones, inicio, fin)
    if (resultado) {
      mesesGDP.unshift({ mes: inicio.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }), fechaInicio: inicio, ...resultado })
    }
  }

  // Mes actual
  const mesActual = mesesGDP[mesesGDP.length - 1] || null

  // Promedios móviles
  function promMovil(meses, n) {
    const ultimos = meses.slice(-n).filter(m => m.gdp)
    if (ultimos.length === 0) return null
    const totalAnim = ultimos.reduce((s, m) => s + m.existenciaPromedio * m.dias, 0)
    return {
      gdp: ultimos.reduce((s, m) => s + m.gdp * m.existenciaPromedio * m.dias, 0) / totalAnim,
      conversion: ultimos.filter(m => m.conversion).length > 0
        ? ultimos.reduce((s, m) => s + (m.conversion || 0) * m.existenciaPromedio * m.dias, 0) / totalAnim
        : null,
      permanencia: Math.round(ultimos.reduce((s, m) => s + m.permanencia * m.existenciaPromedio * m.dias, 0) / totalAnim),
    }
  }
  const prom3 = promMovil(mesesGDP, 3)
  const prom6 = promMovil(mesesGDP, 6)
  const prom12 = promMovil(mesesGDP, 12)

  // GDP para display (usa mes actual o prom3 como fallback)
  const gdpFeedlotGlobal = prom6?.gdp || prom3?.gdp || mesActual?.gdp || null
  const permanenciaPromedio = prom6?.permanencia || prom3?.permanencia || mesActual?.permanencia || null
  const kgGanadosPorAnimal = mesActual ? mesActual.pesoProm_venta - mesActual.pesoProm_ingreso : null
  const conversionGlobal = prom6?.conversion || prom3?.conversion || mesActual?.conversion || null
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
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Análisis de performance · feedlot {new Date().getFullYear()}
      </div>

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
                <Stat label="Ganancia diaria (por animal)" val={prom6.gdp ? `${prom6.gdp.toFixed(3)} kg/cab/d` : '—'} sub="cuánto engorda cada animal por día" color={prom6.gdp >= 1.1 ? S.green : prom6.gdp >= 0.9 ? S.amber : S.red} />
                <Stat label="Kg ganados x animal" val={prom6.gdp && prom6.permanencia ? `${Math.round(prom6.gdp * prom6.permanencia)} kg` : '—'} sub="total durante toda la estadía" color={S.green} />
                <Stat label="Permanencia" val={prom6.permanencia ? `${prom6.permanencia} días` : '—'} sub="tiempo promedio en el feedlot" />
                <Stat label="Conversión" val={prom6.conversion ? prom6.conversion.toFixed(2) : '—'} sub="kg alimento / kg ganado" color={prom6.conversion <= 7 ? S.green : prom6.conversion <= 9 ? S.amber : S.red} />
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
                  <Stat label="Conversión" val={mesActual.conversion ? mesActual.conversion.toFixed(2) : '—'} sub="kg alimento / kg ganado" color={mesActual.conversion <= 7 ? S.green : mesActual.conversion <= 9 ? S.amber : S.red} />
                  <Stat label="Consumo diario (30 días)" val={consumoDiarioProm30 ? `${consumoDiarioProm30.toFixed(1)} kg/cab/d` : '—'} sub={`promedio móvil · ${diasConDatos30.length} días con datos`} color={S.accent} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <Stat label="Peso prom. ingreso" val={`${Math.round(mesActual.pesoProm_ingreso)} kg`} sub={`${mesActual.cabIngresadas} animales`} />
                  <Stat label="Peso prom. venta" val={`${Math.round(mesActual.pesoProm_venta)} kg`} sub={`${mesActual.cabVendidas} animales`} />
                  <Stat label="Existencia promedio" val={Math.round(mesActual.existenciaPromedio)} sub={`inicio: ${mesActual.stockInicial} → fin: ${mesActual.stockFinal}`} />
                  <Stat label="Kg producidos estim." val={mesActual.kgProducidos ? `${Math.round(mesActual.kgProducidos).toLocaleString('es-AR')} kg` : '—'} sub="GDP × exist. × días" color={S.green} />
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
        </div>
      )}

      {/* ── COSTOS ── */}
      {tab === 'costos' && (
        <div>
          <SectionHeader title="Costos de producción" sub="Alimentación · últimos 30 días con precios de referencia cargados" />

          {/* Resumen global */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
            {(() => {
              const totalCostoAlim = Object.values(costoAlimPorCorral).reduce((s, c) => s + c.totalCosto, 0)
              const totalKgAlim = Object.values(costoAlimPorCorral).reduce((s, c) => s + c.totalKg, 0)
              const diasMedidos = Object.values(costoAlimPorCorral).reduce((s, c) => s + c.dias.size, 0)
              const costoPorAnimal = totalAnimales > 0 && totalCostoAlim > 0 ? totalCostoAlim / totalAnimales : null
              const costoPorKgProd = gdpGlobal && costoPorAnimal ? costoPorAnimal / gdpGlobal : null
              return [
                { label: 'Costo alim. total (30d)', val: totalCostoAlim > 0 ? `$${Math.round(totalCostoAlim).toLocaleString('es-AR')}` : '—', sub: precioPromAlim ? `$${Math.round(precioPromAlim).toLocaleString('es-AR')}/kg prom. ponderado` : 'sin precio de referencia en stock' },
                { label: 'Costo por animal/día', val: costoPorAnimal ? `$${Math.round(costoPorAnimal / 30).toLocaleString('es-AR')}` : '—', sub: 'promedio últimos 30 días' },
                { label: 'Kg alimento total', val: totalKgAlim > 0 ? totalKgAlim.toLocaleString('es-AR') + ' kg' : '—', sub: 'últimos 30 días' },
                { label: 'Costo por kg producido', val: costoPorKgProd ? `$${Math.round(costoPorKgProd).toLocaleString('es-AR')}` : '—', sub: 'costo alim. / GDP promedio' },
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
                      const gdp = gdpPorCorral[num]?.gdp
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
