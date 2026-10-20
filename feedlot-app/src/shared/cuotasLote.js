const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n }

// Saldo de una compra de hacienda repartido en sus cuotas: se toman los
// vencimientos de las facturas (cuotas_pago o, si no hay, los de
// facturas_feria), se les descuenta lo ya pagado empezando por la más vieja,
// y lo que queda de cada una cae en su fecha. Así una compra a 30-60-90 no
// aparece entera en el mes de la primera cuota. Sin cuotas: todo a la fecha
// de vencimiento (o de ingreso), como antes.
export function cuotasPendientesLote(l, saldo, pagado) {
  const fuente = (Array.isArray(l.cuotas_pago) && l.cuotas_pago.length) ? l.cuotas_pago : (l.facturas_feria || [])
  const venc = fuente.flatMap(f => (f?.vencimientos || []).map(v => ({ fecha: v.fecha, monto: num(v.monto) })))
    .filter(v => v.fecha && v.monto > 0).sort((a, b) => a.fecha.localeCompare(b.fecha))
  if (!venc.length) return [{ fecha: l.fecha_vencimiento_pago || l.fecha_ingreso, monto: saldo }]
  let resto = pagado
  const quedan = []
  venc.forEach(v => {
    const usa = Math.min(resto, v.monto)
    resto -= usa
    if (v.monto - usa > 0.5) quedan.push({ fecha: v.fecha, monto: v.monto - usa })
  })
  if (!quedan.length) return [{ fecha: venc[venc.length - 1].fecha, monto: saldo }]
  // Que la suma dé justo el saldo (redondeos, gastos de feria fuera de las cuotas…)
  const dif = saldo - quedan.reduce((t, q) => t + q.monto, 0)
  quedan[quedan.length - 1].monto += dif
  return quedan.filter(q => q.monto > 0.5)
}

