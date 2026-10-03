import { ListaPagos } from './PagoFormulario'
import { registrarPagos, unirIds } from '../shared/pagosLogic'

// Checklist de compras pendientes de pago — selección, precio (si falta) y
// N° factura (si falta) por cada una. Usado tanto en Insumos (Alimentación
// y Sanidad) como en Agricultura (agroquímicos), que comparten la misma
// tabla de compras por atrás.
// cotizacionDolar (opcional): si se pasa, aparece un botón para cargar el
// precio en USD en vez de pesos (útil en Agricultura, donde casi todo se
// cotiza en dólares) — monedas/setMonedas guarda qué moneda eligió cada fila.
// modos/setModos (opcional): permite elegir si lo que se carga es el precio
// por unidad (y el sistema calcula el total) o el total de la factura (y el
// sistema calcula el precio por unidad) — útil porque a veces el total real
// de la factura no coincide exacto con cantidad × precio unitario (redondeos,
// gastos incluidos, etc.), y así se puede cargar el número real tal cual está.
// IVA de una compra al ponerle precio: el precio por unidad se carga SIN IVA
// (es el costo: va al stock); el total (lo que se paga) es CON IVA. En modo
// "total factura" lo que se carga es el total con IVA. ivaPct vacío o 0 =
// sin IVA (compra sin factura, monotributo o venta interna).
export function calcularPrecioCompra(c, valorIngresado, { esUsd, cotizacionDolar, modo, ivaPct }) {
  const f = 1 + (parseFloat(ivaPct) || 0) / 100
  const valorEnPesos = esUsd ? valorIngresado * cotizacionDolar : valorIngresado
  let precioNeto, total
  if (modo === 'total') {
    total = Math.round(valorEnPesos)
    precioNeto = c.cantidad ? Math.round(total / f / c.cantidad * 100) / 100 : Math.round(total / f)
  } else {
    precioNeto = Math.round(valorEnPesos * 100) / 100
    total = Math.round((c.cantidad || 0) * precioNeto * f)
  }
  const neto = Math.round(total / f * 100) / 100
  return { precioNeto, total, neto, ivaMonto: Math.round((total - neto) * 100) / 100, ivaPct: parseFloat(ivaPct) || 0 }
}

export function ChecklistComprasPendientes({ pendientes, seleccionadas, setSeleccionadas, precios, setPrecios, facturas, setFacturas, S, cotizacionDolar, monedas, setMonedas, modos, setModos, ivas, setIvas, ivaSugerido }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {pendientes.map(c => {
        const sel = seleccionadas.includes(c.id)
        const esUsd = cotizacionDolar && monedas?.[c.id] === 'USD'
        const modo = modos?.[c.id] || 'unitario'
        const valorIngresado = parseFloat(precios[c.id]) || 0
        const valorEnPesos = esUsd ? valorIngresado * cotizacionDolar : valorIngresado
        // Si el modo es "total", lo que se cargó ya es el total de la
        // factura — el precio por unidad sale de dividir por la cantidad.
        const ivaC = ivas?.[c.id] ?? (ivaSugerido ? String(ivaSugerido(c)) : '0')
        const calc = precios[c.id] && c.cantidad ? calcularPrecioCompra(c, valorIngresado, { esUsd, cotizacionDolar, modo, ivaPct: ivaC }) : null
        const montoCalc = calc ? calc.total : null
        const precioUnitCalc = calc ? calc.precioNeto : null
        void valorEnPesos
        return (
          <div key={c.id} style={{ border: `1px solid ${sel ? '#EF9F27' : S.border}`, borderRadius: 6, background: sel ? '#FFF8EC' : S.surface }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={sel} onChange={e => {
                setSeleccionadas(e.target.checked ? [...seleccionadas, c.id] : seleccionadas.filter(id => id !== c.id))
                if (!e.target.checked && setPrecios) { const np = {...precios}; delete np[c.id]; setPrecios(np) }
              }} />
              <div style={{ flex: 1, fontSize: 13 }}>
                <strong>{c.insumo_nombre || '—'}</strong>
                <span style={{ color: S.muted, marginLeft: 8 }}>{c.cantidad?.toLocaleString('es-AR')} {c.unidad}</span>
                <span style={{ color: S.muted, marginLeft: 8 }}>· {c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'}</span>
                {c.proveedor && <span style={{ color: S.muted, marginLeft: 8 }}>· {c.proveedor}</span>}
              </div>
              {c.total || c.precio_unitario
                ? (() => {
                    const totalReal = c.total || Math.round((c.cantidad || 0) * c.precio_unitario)
                    const yaPagado = (c.pagos_detalle || []).reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
                    const saldo = Math.max(0, totalReal - yaPagado)
                    return yaPagado > 0
                      ? <span style={{ fontFamily: 'monospace', fontWeight: 600, color: S.red }}>${saldo.toLocaleString('es-AR')} <span style={{ fontSize: 10, color: S.muted, fontWeight: 400 }}>(saldo de ${totalReal.toLocaleString('es-AR')})</span></span>
                      : <span style={{ fontFamily: 'monospace', fontWeight: 600, color: S.red }}>${totalReal.toLocaleString('es-AR')}</span>
                  })()
                : null}
            </label>
            {sel && !(c.total || c.precio_unitario) && (
              <div onClick={e => e.preventDefault()} style={{ padding: '0 12px 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {setModos && (
                  <div style={{ display: 'flex', border: `1px solid ${S.border}`, borderRadius: 5, overflow: 'hidden' }}>
                    {[['unitario', `$/${c.unidad || 'u'}`], ['total', 'Total factura']].map(([m, l]) => (
                      <button key={m} onClick={() => setModos({...modos, [c.id]: m})}
                        style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: modo === m ? S.accent : 'transparent', color: modo === m ? '#fff' : S.muted, whiteSpace: 'nowrap' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: S.amber, whiteSpace: 'nowrap' }}>
                  {modo === 'total' ? (esUsd ? 'US$ total con IVA:' : '$ total con IVA:') : `${esUsd ? 'US$' : '$'}/${c.unidad || 'u'} sin IVA:`}
                </div>
                <input type="number" value={precios[c.id] || ''} onChange={e => setPrecios({...precios, [c.id]: e.target.value})}
                  placeholder={modo === 'total' ? 'ej. 815000' : 'ej. 850'} style={{ padding: '5px 8px', border: `1px solid ${S.amber}`, borderRadius: 5, fontSize: 12, fontFamily: 'monospace', width: 120 }} />
                {cotizacionDolar > 0 && setMonedas && (
                  <div style={{ display: 'flex', border: `1px solid ${S.border}`, borderRadius: 5, overflow: 'hidden' }}>
                    {['ARS', 'USD'].map(m => (
                      <button key={m} onClick={() => setMonedas({...monedas, [c.id]: m})}
                        style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: (monedas?.[c.id] || 'ARS') === m ? S.accent : 'transparent', color: (monedas?.[c.id] || 'ARS') === m ? '#fff' : S.muted }}>
                        {m === 'ARS' ? '$' : 'US$'}
                      </button>
                    ))}
                  </div>
                )}
                {setIvas && (
                  <select value={ivaC} onChange={e => setIvas({ ...(ivas || {}), [c.id]: e.target.value })}
                    title="IVA de la factura" style={{ padding: '4px 6px', border: `1px solid ${S.border}`, borderRadius: 5, fontSize: 11 }}>
                    <option value="0">Sin IVA / sin factura</option><option value="10.5">IVA 10,5%</option><option value="21">IVA 21%</option><option value="27">IVA 27%</option>
                  </select>
                )}
                {montoCalc != null && (
                  <span style={{ fontSize: 12, color: S.green, fontWeight: 600 }}>
                    = ${montoCalc.toLocaleString('es-AR')}{esUsd ? ` (a $${cotizacionDolar.toLocaleString('es-AR')})` : ''}
                    {calc && calc.ivaPct > 0 && <span style={{ fontWeight: 400, color: S.muted }}> (neto ${Math.round(calc.neto).toLocaleString('es-AR')} + IVA ${Math.round(calc.ivaMonto).toLocaleString('es-AR')})</span>}
                    {modo === 'total' && precioUnitCalc != null && ` · $${precioUnitCalc.toLocaleString('es-AR', { maximumFractionDigits: 2 })}/${c.unidad || 'u'} sin IVA`}
                  </span>
                )}
                {setFacturas && !c.numero_factura && (
                  <>
                    <div style={{ fontSize: 11, color: S.muted, whiteSpace: 'nowrap', marginLeft: 8 }}>N° Factura:</div>
                    <input type="text" value={facturas?.[c.id] || ''} onChange={e => setFacturas({...facturas, [c.id]: e.target.value})}
                      placeholder="opcional" style={{ padding: '5px 8px', border: `1px solid ${S.border}`, borderRadius: 5, fontSize: 12, width: 130 }} />
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Registra el pago de UNA o VARIAS compras pendientes — es el ÚNICO lugar
// donde se pagan compras de insumos (Insumos y Agricultura). Crea los
// movimientos de caja / cheques de cada forma de pago (con la función
// compartida registrarMovimientoDePago, la misma que Personal y Fletes),
// actualiza cada compra seleccionada (precio si faltaba, factura si se
// cargó, estado) y actualiza el precio de referencia del insumo en el stock
// correspondiente vía el callback que le pases.
//
// Qué cambió respecto de la versión anterior (de acá para adelante):
//  - Se guardan TODOS los movimientos de caja del pago (caja_oficial_ids /
//    caja_paralela_ids / cheque_emitido_ids), no solo el primero. Antes, un
//    pago con dos formas de pago dejaba la segunda caja "huérfana".
//  - Cada forma de pago guardada en pagos_detalle lleva su fecha, el id de
//    su movimiento de caja (_caja_id), su cheque emitido (_cheque_emitido_id)
//    y un id del pago (_pago_grupo) que es el mismo para todas las compras
//    pagadas juntas — así se puede saber después qué se pagó con qué.
//  - Los cheques de tercero quedan "entregado" a nombre del proveedor, en
//    Caja 1 y en Caja 2 (antes: "depositado" en Caja 1 y sin tocar en Caja 2).
//  - Un pago de $0 (solo fijar precio) ya no borra los ids de caja que la
//    compra tenía de pagos anteriores.
//
// categoriaCaja — categoría del movimiento en Caja 1 ('Compra insumos' por
// defecto; Agricultura usa 'Compra insumos Agricultura').
// actualizarPrecioReferencia(compra, precioUnit) — se llama solo cuando la
// compra no tenía precio y se cargó ahora; cada módulo sabe a qué tabla de
// stock (stock_insumos / stock_sanitario / stock_agro) le corresponde.
export async function pagarComprasPendientes(supabase, {
  seleccionadas, pendientes, precios, facturas, pagos, fecha,
  descripcion, contactoId, contactoNombre, registradoPor, actualizarPrecioReferencia,
  creditoEntidad, creditoCuotas, creditoVencimiento, creditoEsDolares, cotizacionDolarCredito, creditoMontoUsd, monedas, cotizacionDolar, modos,
  categoriaCaja = 'Compra insumos', ivas = {}, ivaSugerido = null,
}) {
  const ivaDe = c => ivas?.[c.id] ?? (ivaSugerido ? String(ivaSugerido(c)) : '0')
  // Caja + cheques de cada forma de pago: la función compartida (la misma de
  // Personal y Fletes). Devuelve las líneas ya marcadas y TODOS los ids.
  const reg = await registrarPagos(supabase, pagos, {
    fecha, descripcion, categoria: categoriaCaja,
    contactoId: contactoId ? parseInt(contactoId) : null,
    beneficiarioCheque: contactoNombre || null,
    registradoPorCheque: registradoPor || null,
    estadoChequeTercero: 'entregado',
    beneficiarioTercero: contactoNombre || undefined,
    marcarTerceroEnCaja2: true,
  })
  if (reg.error) return { error: reg.error }
  const { lineas, cajaOficialIds, cajaParalelaIds, chequeEmitidoIds } = reg

  // Si parte del pago fue con crédito de una financiera/banco, el proveedor
  // ya cobró — se registra la deuda en Créditos, vinculada a la primera
  // compra pagada (si se pagaron varias juntas, queda igual la referencia).
  const pagoCredito = pagos.find(p => p.tipo === 'credito' && parseFloat(p.monto) > 0)
  if (pagoCredito) {
    const montoCredito = parseFloat(pagoCredito.monto)
    const cuotas = parseInt(creditoCuotas) || 1
    const primeraCompra = pendientes.find(x => x.id === seleccionadas[0])
    // Si el crédito es en dólares, se guarda el equivalente en USD (usando
    // la cotización de referencia del momento) — el monto en pesos de cada
    // cuota recién se define el día que se pague, no ahora.
    const montoUsd = creditoEsDolares ? (creditoMontoUsd ? parseFloat(creditoMontoUsd) : (cotizacionDolarCredito ? Math.round((montoCredito / cotizacionDolarCredito) * 100) / 100 : null)) : null
    const { data: cred, error: errCredito } = await supabase.from('creditos').insert({
      compra_insumos_id: seleccionadas[0] || null,
      entidad: creditoEntidad || null,
      descripcion: `${primeraCompra?.insumo_nombre || descripcion}${seleccionadas.length > 1 ? ` (+${seleccionadas.length - 1} más)` : ''}`,
      es_dolares: !!creditoEsDolares,
      monto_total: creditoEsDolares ? 0 : montoCredito,
      monto_total_usd: montoUsd,
      cant_cuotas: cuotas, monto_cuota: creditoEsDolares ? null : Math.round(montoCredito / cuotas),
      fecha_inicio: fecha, fecha_vencimiento: creditoVencimiento || null,
      cuotas_pagadas: 0, saldo_pendiente: creditoEsDolares ? 0 : montoCredito, estado: 'activo',
      registrado_por: registradoPor || null,
    }).select().single()
    if (errCredito) return { error: errCredito }
    // Se anota el crédito en su línea de pago, para poder deshacerlo después.
    lineas.forEach(l => { if (l.tipo === 'credito') l._credito_id = cred.id })
    // Generar las cuotas reales (antes esto quedaba sin crear, así que el
    // crédito aparecía en Activos pero no había nada para "pagar" después).
    // Si son varias cuotas, se reparten mensualmente a partir del vencimiento
    // cargado (es un valor por defecto — se puede ajustar después a mano).
    const cuotasAInsertar = []
    for (let i = 0; i < cuotas; i++) {
      let fechaCuota = creditoVencimiento || fecha
      if (i > 0 && creditoVencimiento) {
        const d = new Date(creditoVencimiento + 'T12:00:00')
        d.setMonth(d.getMonth() + i)
        fechaCuota = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      cuotasAInsertar.push({
        credito_id: cred.id, fecha: fechaCuota, nro_cuota: i + 1, estado: 'pendiente',
        monto: creditoEsDolares ? null : Math.round(montoCredito / cuotas),
        monto_usd: creditoEsDolares && montoUsd ? Math.round((montoUsd / cuotas) * 100) / 100 : null,
      })
    }
    const { error: errCuotas } = await supabase.from('pagos_creditos').insert(cuotasAInsertar)
    if (errCuotas) return { error: errCuotas }
  }

  // Primero se resuelven los totales finales de cada compra seleccionada
  // (algunas pueden estar sin precio todavía, recién se define acá) — hace
  // falta tener todos los totales ANTES de repartir el pago proporcional.
  const totalesFinales = {}
  for (const id of seleccionadas) {
    const c = pendientes.find(x => x.id === id)
    if (!c) continue
    if (c.total || c.precio_unitario) {
      const totalReal = c.total || Math.round((c.cantidad || 0) * c.precio_unitario)
      // Si ya tenía algo pagado antes (compra "parcial"), el reparto del
      // pago combinado se hace sobre lo que REALMENTE falta, no sobre el
      // total completo — si no, una compra ya cubierta en un 70% se lleva
      // una porción del pago como si no se hubiera tocado todavía.
      const yaPagado = (c.pagos_detalle || []).reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
      totalesFinales[id] = Math.max(0, totalReal - yaPagado)
      continue
    }
    if (!precios[id]) { totalesFinales[id] = 0; continue }
    const esUsd = monedas?.[id] === 'USD' && cotizacionDolar
    totalesFinales[id] = calcularPrecioCompra(c, parseFloat(precios[id]), { esUsd, cotizacionDolar, modo: modos?.[id], ivaPct: ivaDe(c) }).total
  }
  const totalCombinado = Object.values(totalesFinales).reduce((s, t) => s + t, 0)

  for (const id of seleccionadas) {
    const c = pendientes.find(x => x.id === id)
    if (!c) continue
    // El pago se reparte proporcional al peso de esta compra dentro del
    // total combinado — antes cada compra se quedaba con el monto COMPLETO
    // del pago conjunto, como si cada una se hubiera pagado entera por
    // separado (inflaba el "pagado" varias veces sobre lo mismo).
    const proporcion = totalCombinado > 0 ? (totalesFinales[id] || 0) / totalCombinado : (1 / seleccionadas.length)
    const pagosProporcionales = lineas.map(p => ({ ...p, monto: Math.round((parseFloat(p.monto) || 0) * proporcion) }))
    const montoPagadoAhora = pagosProporcionales.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    // Ids de caja: los que la compra ya tenía (de pagos anteriores) + los de
    // este pago. Se leen frescos de la base para no pisar nada.
    const { data: actual } = await supabase.from('compras_insumos')
      .select('caja_oficial_id, caja_paralela_id, caja_oficial_ids, caja_paralela_ids, cheque_emitido_ids').eq('id', id).single()
    const prev = actual || c
    const upd = {
      caja_oficial_id: prev.caja_oficial_id || cajaOficialIds[0] || null,
      caja_paralela_id: prev.caja_paralela_id || cajaParalelaIds[0] || null,
      caja_oficial_ids: unirIds(prev.caja_oficial_ids || (prev.caja_oficial_id ? [prev.caja_oficial_id] : []), cajaOficialIds),
      caja_paralela_ids: unirIds(prev.caja_paralela_ids || (prev.caja_paralela_id ? [prev.caja_paralela_id] : []), cajaParalelaIds),
      cheque_emitido_ids: unirIds(prev.cheque_emitido_ids || [], chequeEmitidoIds),
      pagos_detalle: [...(c.pagos_detalle || []), ...pagosProporcionales],
    }
    // Forma de pago y caja: solo si de verdad se pagó algo ahora. Un "guardar
    // precio sin pagar" ya no pisa la caja elegida al cargar la compra.
    if (lineas.length > 0) {
      upd.forma_pago = lineas.map(p => p.subtipo_cheque || p.tipo).join('+')
      upd.es_paralelo = lineas.some(p => p.es_paralelo)
    }
    if (contactoId) upd.contacto_id = parseInt(contactoId)
    // Si la compra se cargó sin precio, se define recién ahora al pagar —
    // si se cargó en dólares, se convierte a pesos con la cotización del día
    // antes de guardar (el stock y la caja siempre quedan en pesos).
    let totalDeEstaCompra = c.total || (c.precio_unitario ? Math.round((c.cantidad || 0) * c.precio_unitario) : null)
    if (!(c.total || c.precio_unitario) && precios[id]) {
      const valorIngresado = parseFloat(precios[id])
      const esUsd = monedas?.[id] === 'USD' && cotizacionDolar
      const esModoTotal = modos?.[id] === 'total'
      // Precio por unidad SIN IVA (va al stock) y total CON IVA (se paga).
      const calc = calcularPrecioCompra(c, valorIngresado, { esUsd, cotizacionDolar, modo: modos?.[id], ivaPct: ivaDe(c) })
      const precioFinal = calc.precioNeto, totalFinal = calc.total
      upd.precio_unitario = precioFinal
      upd.total = totalFinal
      upd.iva_pct = calc.ivaPct; upd.neto = calc.neto; upd.iva_monto = calc.ivaMonto
      totalDeEstaCompra = totalFinal
      if (esUsd) { upd.precio_unitario_usd = esModoTotal ? null : valorIngresado; upd.cotizacion_dolar = cotizacionDolar }
      if (facturas?.[id]) upd.numero_factura = facturas[id]
      if (actualizarPrecioReferencia) await actualizarPrecioReferencia(c, precioFinal)
    }
    // Si lo que se pagó ahora (más lo ya pagado antes, si venía de una
    // compra ya con algo abonado) alcanza el total, queda pagado. Si quedó
    // algo pero no todo, queda "parcial" (no "pendiente" — si no, el pago
    // ya guardado en pagos_detalle no se ve reflejado en el estado y parece
    // que no se pagó nada). Si literalmente no se pagó nada, sigue pendiente.
    const pagadoPrevio = (c.pagos_detalle || []).reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    const pagadoTotalAcumulado = pagadoPrevio + montoPagadoAhora
    upd.estado_pago = totalDeEstaCompra && pagadoTotalAcumulado >= totalDeEstaCompra - 1000
      ? 'pagado'
      : (pagadoTotalAcumulado > 0 ? 'parcial' : 'pendiente')
    const { error } = await supabase.from('compras_insumos').update(upd).eq('id', id)
    if (error) return { error }
  }

  return { error: null }
}
