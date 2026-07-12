// Lógica compartida de indicadores del feedlot (GDP, permanencia, conversión,
// consumo diario) — la misma que se usa en Reportes y en el Tablero, para que
// nunca queden desincronizados ni haya dos cálculos distintos del mismo número.
//
// Arreglos de julio 2026 ya incluidos acá:
// - La existencia (cuántos animales había en una fecha pasada) se reconstruye
//   PARA ATRÁS desde el conteo real de HOY (siempre correcto), en vez de sumar
//   todo el historial de ingresos/ventas desde el principio de los tiempos
//   (que no está completo porque el sistema es nuevo).
// - El mes en curso usa "hoy" como fin del período, no el fin de mes teórico
//   (si no, se cuentan días que todavía no pasaron y que por lo tanto no
//   tienen ventas, inflando la permanencia).
// - La conversión usa el % de materia seca real de cada insumo (cargado en
//   Alimentación → Fórmulas de mixer), no un % fijo aproximado.
// - Los promedios (3/6/12 meses) excluyen del todo (numerador Y peso) los
//   meses sin conversión calculable, en vez de contarlos como cero.

// Arma los diccionarios de % materia seca por insumo y composición de cada
// fórmula, a partir de los datos ya cargados de stock_insumos y formulas_mixer.
export function construirLookupsMS(stock, formulasMixer) {
  const pctMSPorInsumo = {}
  ;(stock || []).forEach(s => { pctMSPorInsumo[s.insumo] = s.pct_ms || 0 })
  const formulasPorDietaEtapa = {}
  ;(formulasMixer || []).forEach(f => {
    const key = `${f.dieta}_${f.etapa}`
    if (!formulasPorDietaEtapa[key]) formulasPorDietaEtapa[key] = []
    formulasPorDietaEtapa[key].push({ n: f.ingrediente, kg: f.kg })
  })
  return { pctMSPorInsumo, formulasPorDietaEtapa }
}

// Kg de materia seca real de una ración (separa rollo extra del mixer, y aplica
// el % MS de cada insumo de la fórmula correspondiente)
export function kgMSDeRacion(r, lookups) {
  const { pctMSPorInsumo, formulasPorDietaEtapa } = lookups
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

// Calcula GDP, permanencia, conversión y consumo diario para un período dado.
// corralesData: array de corrales (para la existencia real de hoy)
export function calcMesGDP(lotesData, ventasData, racionesData, fechaInicio, fechaFin, existenciaActualGlobal, lookups) {
  const dias = Math.round((fechaFin - fechaInicio) / 86400000)
  if (dias <= 0) return null
  const hoy = new Date()

  function existenciaEn(fecha) {
    const ingresosDespues = lotesData.filter(l => {
      const f = new Date(l.fecha_ingreso + 'T12:00:00')
      return f > fecha && f <= hoy
    }).reduce((s, l) => s + (l.cantidad || 0), 0)
    const ventasDespues = ventasData.filter(v => {
      const f = new Date(v.creado_en)
      return f > fecha && f <= hoy
    }).reduce((s, v) => s + (v.cantidad || 0), 0)
    return Math.max(0, existenciaActualGlobal - ingresosDespues + ventasDespues)
  }

  const stockInicial = existenciaEn(fechaInicio)

  const lotesPeriodo = lotesData.filter(l => {
    const f = new Date(l.fecha_ingreso + 'T12:00:00')
    return f >= fechaInicio && f < fechaFin
  })
  const cabIngresadas = lotesPeriodo.reduce((s, l) => s + (l.cantidad || 0), 0)
  const kgIngresados = lotesPeriodo.reduce((s, l) => s + (l.kg_bascula || 0), 0)

  const ventasPeriodo = ventasData.filter(v => {
    const f = new Date(v.creado_en)
    return f >= fechaInicio && f < fechaFin
  })
  const cabVendidas = ventasPeriodo.reduce((s, v) => s + (v.cantidad || 0), 0)
  const kgVendidos = ventasPeriodo.reduce((s, v) => s + (v.kg_vivo_total || 0), 0)

  const stockFinal = Math.max(0, stockInicial + cabIngresadas - cabVendidas)

  if (cabIngresadas === 0 || cabVendidas === 0 || kgIngresados === 0 || kgVendidos === 0) return null

  const pesoProm_ingreso = kgIngresados / cabIngresadas
  const pesoProm_venta = kgVendidos / cabVendidas

  const existenciaPromedio = (stockInicial + stockFinal) / 2
  if (existenciaPromedio <= 0) return null

  const permanencia = (existenciaPromedio * dias) / cabVendidas
  const variacionStock = stockInicial > 0 ? ((stockFinal - stockInicial) / stockInicial) * 100 : 0
  const existenciaCorregida = Math.max(stockInicial, stockFinal)
  const permanenciaCorregida = existenciaCorregida > 0 ? (existenciaCorregida * dias) / cabVendidas : permanencia

  const gdp = permanencia > 0 ? (pesoProm_venta - pesoProm_ingreso) / permanencia : null
  const gdpCorregido = permanenciaCorregida > 0 ? (pesoProm_venta - pesoProm_ingreso) / permanenciaCorregida : null

  // Consumo diario por animal (promedio de kg_dia/animales_ese_dia, por cada día con raciones)
  const racionesPeriodo = (racionesData || []).filter(r => {
    const f = new Date(r.creado_en)
    return f >= fechaInicio && f < fechaFin
  })
  const porDia = {}
  racionesPeriodo.forEach(r => {
    const dia = r.creado_en.split('T')[0]
    if (!porDia[dia]) porDia[dia] = { kgTotal: 0, animales: 0, corralesVistos: new Set() }
    porDia[dia].kgTotal += r.kg_total || 0
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
  const kgAlimentoMS = lookups ? racionesPeriodo.reduce((s, r) => s + kgMSDeRacion(r, lookups), 0) : null

  const conversion = gdp && consumoDiarioCalc && kgAlimentoMS != null ? (kgAlimentoMS / (gdp * existenciaPromedio * dias)) : null
  const conversionCorregida = gdpCorregido && consumoDiarioCalc && kgAlimentoMS != null ? (kgAlimentoMS / (gdpCorregido * existenciaPromedio * dias)) : null
  // Kg producidos estimados = cuánto engordó, en total, todo lo que había en el
  // feedlot en el período (GDP diario × cuántos animales en promedio × cuántos días)
  const kgProducidos = gdp ? gdp * existenciaPromedio * dias : null
  const kgProducidosCorregido = gdpCorregido ? gdpCorregido * existenciaPromedio * dias : null

  return {
    dias, stockInicial, stockFinal, existenciaPromedio, cabIngresadas, kgIngresados,
    cabVendidas, kgVendidos, pesoProm_ingreso, pesoProm_venta, permanencia, permanenciaCorregida,
    variacionStock, gdp, gdpCorregido, consumoDiario, consumoDiarioCalc, kgAlimento, kgAlimentoMS,
    conversion, conversionCorregida, kgProducidos, kgProducidosCorregido,
  }
}

// Promedio ponderado de N meses — pondera por "cabeza-días" (existenciaPromedio × dias)
// de cada mes. La conversión se promedia solo entre los meses que tienen un valor
// válido: si un mes no aporta numerador, tampoco debe aportar peso al denominador.
export function promMovil(meses, n) {
  const ultimos = meses.slice(-n).filter(m => m.gdp)
  if (ultimos.length === 0) return null
  const totalAnim = ultimos.reduce((s, m) => s + m.existenciaPromedio * m.dias, 0)
  const mesesConConversion = ultimos.filter(m => m.conversion)
  const pesoConversion = mesesConConversion.reduce((s, m) => s + m.existenciaPromedio * m.dias, 0)
  return {
    gdp: ultimos.reduce((s, m) => s + m.gdp * m.existenciaPromedio * m.dias, 0) / totalAnim,
    conversion: mesesConConversion.length > 0
      ? mesesConConversion.reduce((s, m) => s + m.conversion * m.existenciaPromedio * m.dias, 0) / pesoConversion
      : null,
    permanencia: Math.round(ultimos.reduce((s, m) => s + m.permanencia * m.existenciaPromedio * m.dias, 0) / totalAnim),
  }
}

// Función de conveniencia todo-en-uno: dado los datos ya cargados, arma los
// últimos 12 meses y devuelve mesActual + promedios móviles de 3/6/12 meses.
export function calcularIndicadoresFeedlot({ corrales, lotes, ventas, raciones, stock, formulasMixer }) {
  const existenciaActualGlobal = (corrales || []).reduce((s, c) => s + (c.animales || 0), 0)
  const lookups = construirLookupsMS(stock, formulasMixer)
  const hoy = new Date()

  const mesesGDP = []
  for (let i = 0; i < 12; i++) {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const fin = i === 0 ? hoy : new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 1)
    const resultado = calcMesGDP(lotes || [], ventas || [], raciones || [], inicio, fin, existenciaActualGlobal, lookups)
    if (resultado) mesesGDP.unshift({ mes: inicio.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }), fechaInicio: inicio, ...resultado })
  }

  const mesActual = mesesGDP[mesesGDP.length - 1] || null
  const prom3 = promMovil(mesesGDP, 3)
  const prom6 = promMovil(mesesGDP, 6)
  const prom12 = promMovil(mesesGDP, 12)

  return { mesesGDP, mesActual, prom3, prom6, prom12, existenciaActualGlobal }
}
