// Lógica compartida de Ventas — registrar la venta de uno o varios corrales,
// con desbaste y (opcionalmente) precio/datos comerciales.
//
// Nota: igual que en Ingresos, esta función NUNCA crea un contacto nuevo en
// la tabla `contactos` — el comprador se guarda como texto libre en la venta.
// Crear contactos de verdad es exclusivo del módulo Contactos, para evitar
// duplicados por typos.

// corralesVenta: [{ corral_id, cantidad, kg_vivo, desbaste_pct?, precio_kg? }]
// desbaste_pct/precio_kg en cada fila son opcionales — si una fila no los trae,
// usa el desbaste/precio general de la venta. Así se puede vender la misma
// tropa al mismo comprador, pero unos pocos animales (una fila aparte) a otro
// precio o con otro desbaste.
// precioKg, montoFacturado, plazoDias son opcionales — si no se pasan, la
// venta queda "pendiente" de precio (para completarse después, ej. desde PC).
// Devuelve { error, cantidadVentas, totalKgNeto, montoTotal }
export async function registrarVenta(supabase, {
  corralesVenta, desbastePct = 8, precioKg, montoFacturado, ivaPct = 10.5,
  plazoDias, comprador, observaciones, usuario,
}) {
  const validos = (corralesVenta || []).filter(c => c.corral_id && c.cantidad && c.kg_vivo)
  if (validos.length === 0) return { error: { message: 'Completá al menos un corral con cantidad y kg' } }

  const precioGeneral = parseFloat(precioKg) || 0
  // Kg netos y monto total de cada fila, respetando su propio desbaste/precio si lo tiene
  const filas = validos.map(cv => {
    const desbCv = (cv.desbaste_pct !== undefined && cv.desbaste_pct !== '') ? parseFloat(cv.desbaste_pct) : desbastePct
    const precioCv = (cv.precio_kg !== undefined && cv.precio_kg !== '') ? parseFloat(cv.precio_kg) : precioGeneral
    const kgNetoCv = Math.round(parseFloat(cv.kg_vivo) * (1 - desbCv / 100) * 10) / 10
    const montoTotalCv = precioCv ? Math.round(kgNetoCv * precioCv * 100) / 100 : null
    return { cv, desbCv, precioCv, kgNetoCv, montoTotalCv }
  })

  const totalKgBruto = validos.reduce((s, c) => s + (parseFloat(c.kg_vivo) || 0), 0)
  const totalKgNeto = Math.round(filas.reduce((s, f) => s + f.kgNetoCv, 0) * 10) / 10
  const montoTotal = filas.some(f => f.montoTotalCv != null) ? Math.round(filas.reduce((s, f) => s + (f.montoTotalCv || 0), 0) * 100) / 100 : null
  const montoFact = montoTotal ? (montoFacturado != null && montoFacturado !== '' ? parseFloat(montoFacturado) : montoTotal) : null
  const fechaVto = plazoDias > 0 ? new Date(Date.now() + plazoDias * 86400000).toISOString().split('T')[0] : null
  const compradorFinal = (comprador || '').trim() || null
  const grupoId = validos.length > 1 ? crypto.randomUUID() : null

  let errorVenta = null
  for (const { cv, desbCv, precioCv, kgNetoCv, montoTotalCv } of filas) {
    const montoFactCv = (precioCv && montoFact && totalKgNeto) ? Math.round(montoFact * kgNetoCv / totalKgNeto * 100) / 100 : montoTotalCv
    const montoNegroCv = (montoTotalCv != null && montoFactCv != null) ? Math.max(0, montoTotalCv - montoFactCv) : 0

    const { error } = await supabase.from('ventas').insert({
      corral_id: parseInt(cv.corral_id),
      cantidad: parseInt(cv.cantidad),
      kg_vivo_total: parseFloat(cv.kg_vivo),
      desbaste_pct: desbCv,
      kg_neto: kgNetoCv,
      precio_kg: precioCv || null,
      total: montoTotalCv,
      monto_facturado: precioCv ? montoFactCv : null,
      monto_negro: precioCv ? montoNegroCv : null,
      iva_pct: precioCv ? ivaPct : null,
      iva_monto: (precioCv && montoFactCv) ? Math.round(montoFactCv * ivaPct / 100) : null,
      plazo_dias: plazoDias || null,
      fecha_vencimiento_cobro: fechaVto,
      estado_comercial: precioCv ? 'precio_cargado' : 'pendiente',
      comprador: compradorFinal,
      observaciones: observaciones || null,
      registrado_por: usuario?.id,
      grupo_venta_id: grupoId,
    })
    if (error) { errorVenta = error; continue }

    const { data: corral } = await supabase.from('corrales').select('animales').eq('id', cv.corral_id).single()
    const nuevosAnimales = Math.max(0, (corral?.animales || 0) - parseInt(cv.cantidad))
    const updateCorral = { animales: nuevosAnimales }
    if (nuevosAnimales === 0) { updateCorral.rol = 'libre'; updateCorral.sub = null }
    await supabase.from('corrales').update(updateCorral).eq('id', parseInt(cv.corral_id))
  }
  if (errorVenta) return { error: errorVenta }

  return { error: null, cantidadVentas: validos.length, totalKgNeto, totalKgBruto, montoTotal }
}
