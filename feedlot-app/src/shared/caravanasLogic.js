// Lógica compartida para lecturas de caravana electrónica (peso por caravana,
// al ingreso y a la venta), usada por Ingresos.jsx y Ventas.jsx.

// Parsea el texto pegado de un reporte de pesaje tipo:
//   032010031451655 161 17:44
//   032010031451658 190 17:45
// (caravana, peso, hora — separados por espacios o tabs, una línea por animal).
// Es tolerante a encabezados y a la línea de estadísticas del final: cualquier
// línea que no matchee el patrón se ignora en silencio.
export function parsearReporteCaravanas(texto) {
  if (!texto) return []
  const lineas = texto.split('\n')
  const resultado = []
  const vistos = new Set()
  for (const linea of lineas) {
    // El número puede ser una caravana electrónica larga (15 dígitos) o un
    // número corto puesto a mano (ej. "5179") para identificar un animal
    // que llegó sin caravana electrónica — se acepta cualquier largo.
    const m = linea.trim().match(/^(\d{1,20})[\s\t,;]+(\d+(?:[.,]\d+)?)\s*(?:kg)?[\s\t,;]*(\d{1,2}:\d{2})?/i)
    if (!m) continue
    const numero_caravana = m[1]
    const peso = parseFloat(m[2].replace(',', '.'))
    const hora = m[3] || null
    if (!peso || peso <= 0 || peso > 1500) continue // filtra la línea de "Peso Total del Lote" u otras que no son un animal
    if (vistos.has(numero_caravana)) continue // por si el reporte tiene alguna línea duplicada
    vistos.add(numero_caravana)
    resultado.push({ numero_caravana, peso, hora })
  }
  return resultado
}

// Guarda un lote de lecturas ya parseadas, todas con el mismo tipo/fecha/vínculo.
export async function guardarLecturasCaravana(supabase, { lecturas, tipo, fecha, loteId, ventaId, corralId, usuario }) {
  if (!lecturas || lecturas.length === 0) return { error: null, cantidad: 0 }
  const filas = lecturas.map(l => ({
    numero_caravana: l.numero_caravana,
    tipo,
    fecha,
    hora: l.hora || null,
    peso: l.peso,
    lote_id: loteId || null,
    venta_id: ventaId || null,
    corral_id: corralId || null,
    registrado_por: usuario?.id || null,
  }))
  const { error } = await supabase.from('caravanas_lecturas').insert(filas)
  return { error, cantidad: filas.length }
}

// Empareja lecturas de ingreso con su lectura de venta correspondiente (mismo
// número de caravana) para calcular permanencia y GDP real por animal.
// lecturas: todas las filas de caravanas_lecturas (ingreso + venta mezcladas).
export function emparejarCaravanas(lecturas) {
  const porNumero = {}
  ;(lecturas || []).forEach(l => {
    if (!porNumero[l.numero_caravana]) porNumero[l.numero_caravana] = { ingreso: null, venta: null }
    // Si hay más de una lectura del mismo tipo para la misma caravana (no
    // debería pasar, pero por las dudas), se queda con la más vieja de
    // ingreso y la más nueva de venta — el par más largo y más realista.
    if (l.tipo === 'ingreso') {
      if (!porNumero[l.numero_caravana].ingreso || l.fecha < porNumero[l.numero_caravana].ingreso.fecha) porNumero[l.numero_caravana].ingreso = l
    } else if (l.tipo === 'venta') {
      if (!porNumero[l.numero_caravana].venta || l.fecha > porNumero[l.numero_caravana].venta.fecha) porNumero[l.numero_caravana].venta = l
    }
  })
  const pares = []
  Object.entries(porNumero).forEach(([numero_caravana, { ingreso, venta }]) => {
    if (!ingreso || !venta) return
    const dias = Math.round((new Date(venta.fecha) - new Date(ingreso.fecha)) / 86400000)
    if (dias <= 0) return // datos inconsistentes (venta antes que el ingreso) — se descarta
    const aumentoPeso = venta.peso - ingreso.peso
    const gdpIndividual = aumentoPeso / dias
    pares.push({
      numero_caravana, pesoIngreso: ingreso.peso, pesoVenta: venta.peso,
      fechaIngreso: ingreso.fecha, fechaVenta: venta.fecha,
      loteId: ingreso.lote_id, ventaId: venta.venta_id, corralIngresoId: ingreso.corral_id,
      dias, aumentoPeso, gdpIndividual,
    })
  })
  return pares
}

// Parsea el listado de SENASA (un número de caravana por línea, sin peso ni
// hora — es la lista LEGAL de lo que quedó asentado en el DTE/guía, que no
// siempre coincide con lo que se leyó realmente en el campo). Tolerante a
// líneas vacías o con texto que no sea puramente un número.
export function parsearListaSenasa(texto) {
  if (!texto) return []
  const vistos = new Set()
  const resultado = []
  texto.split('\n').forEach(linea => {
    const limpio = linea.trim()
    if (!/^\d{4,20}$/.test(limpio)) return
    if (vistos.has(limpio)) return
    vistos.add(limpio)
    resultado.push(limpio)
  })
  return resultado
}

// Guarda una lista de números de caravana SENASA para un lote.
export async function guardarCaravanasSenasa(supabase, { numeros, loteId, usuario }) {
  if (!numeros || numeros.length === 0) return { error: null, cantidad: 0 }
  const filas = numeros.map(numero_caravana => ({ numero_caravana, lote_id: loteId, registrado_por: usuario?.id || null }))
  const { error } = await supabase.from('caravanas_senasa').insert(filas)
  return { error, cantidad: filas.length }
}

// Compara la lista de SENASA contra lo realmente leído en el campo (de
// caravanas_lecturas, tipo ingreso) para un lote — para ver de un vistazo
// qué caravanas están en un lado y no en el otro.
export function compararCaravanasSenasaCampo(senasa, lecturasCampo) {
  const numsCampo = new Set((lecturasCampo || []).map(l => l.numero_caravana))
  const numsSenasa = new Set((senasa || []).map(s => s.numero_caravana))
  const soloSenasa = [...numsSenasa].filter(n => !numsCampo.has(n))
  const soloCampo = [...numsCampo].filter(n => !numsSenasa.has(n))
  const enAmbos = [...numsSenasa].filter(n => numsCampo.has(n))
  return { soloSenasa, soloCampo, enAmbos }
}
