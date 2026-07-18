import { ListaPagos } from './PagoFormulario'

// Checklist de compras pendientes de pago — selección, precio (si falta) y
// N° factura (si falta) por cada una. Usado tanto en Insumos (Alimentación
// y Sanidad) como en Agricultura (agroquímicos), que comparten la misma
// tabla de compras por atrás.
// cotizacionDolar (opcional): si se pasa, aparece un botón para cargar el
// precio en USD en vez de pesos (útil en Agricultura, donde casi todo se
// cotiza en dólares) — monedas/setMonedas guarda qué moneda eligió cada fila.
export function ChecklistComprasPendientes({ pendientes, seleccionadas, setSeleccionadas, precios, setPrecios, facturas, setFacturas, S, cotizacionDolar, monedas, setMonedas }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {pendientes.map(c => {
        const sel = seleccionadas.includes(c.id)
        const esUsd = cotizacionDolar && monedas?.[c.id] === 'USD'
        const precioIngresado = parseFloat(precios[c.id]) || 0
        const precioEnPesos = esUsd ? precioIngresado * cotizacionDolar : precioIngresado
        const montoCalc = precios[c.id] && c.cantidad ? Math.round(precioEnPesos * c.cantidad) : null
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
                ? <span style={{ fontFamily: 'monospace', fontWeight: 600, color: S.red }}>${(c.total || 0).toLocaleString('es-AR')}</span>
                : null}
            </label>
            {sel && !(c.total || c.precio_unitario) && (
              <div onClick={e => e.preventDefault()} style={{ padding: '0 12px 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, color: S.amber, whiteSpace: 'nowrap' }}>{esUsd ? 'US$' : '$'}/{c.unidad || 'u'}:</div>
                <input type="number" value={precios[c.id] || ''} onChange={e => setPrecios({...precios, [c.id]: e.target.value})}
                  placeholder="ej. 850" style={{ padding: '5px 8px', border: `1px solid ${S.amber}`, borderRadius: 5, fontSize: 12, fontFamily: 'monospace', width: 110 }} />
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
                {montoCalc != null && <span style={{ fontSize: 12, color: S.green, fontWeight: 600 }}>= ${montoCalc.toLocaleString('es-AR')}{esUsd ? ` (a $${cotizacionDolar.toLocaleString('es-AR')})` : ''}</span>}
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

// Registra el pago agrupado de varias compras pendientes: crea los
// movimientos de caja / cheques según la lista de pagos (usando ListaPagos),
// actualiza cada compra seleccionada (precio si faltaba, factura si se
// cargó, estado a pagado), y actualiza el precio de referencia del insumo
// en el stock correspondiente vía el callback que le pases.
//
// actualizarPrecioReferencia(compra, precioUnit) — se llama solo cuando la
// compra no tenía precio y se cargó ahora; cada módulo sabe a qué tabla de
// stock (stock_insumos / stock_sanitario / stock_agro) le corresponde.
export async function pagarComprasPendientes(supabase, {
  seleccionadas, pendientes, precios, facturas, pagos, fecha,
  descripcion, contactoId, contactoNombre, registradoPor, actualizarPrecioReferencia,
  creditoEntidad, creditoCuotas, creditoVencimiento, monedas, cotizacionDolar,
}) {
  let caja_oficial_id = null, caja_paralela_id = null
  for (const pago of pagos) {
    const monto = parseFloat(pago.monto) || 0
    if (!monto) continue
    if (pago.tipo === 'canje') continue  // canje: no toca caja, pero ya cuenta como pagado
    if (pago.tipo === 'credito') continue  // crédito: tampoco mueve caja — el proveedor ya cobró vía la financiera
    const formaPago = pago.subtipo_cheque || pago.tipo
    if (pago.es_paralelo) {
      const { data: cp, error: errCp } = await supabase.from('caja_paralela').insert({ fecha, tipo: 'egreso', descripcion, monto }).select().single()
      if (errCp) return { error: errCp }
      if (!caja_paralela_id) caja_paralela_id = cp?.id || null
    } else {
      const { data: co, error: errCo } = await supabase.from('caja_oficial').insert({ fecha, tipo: 'egreso', categoria: 'Compra insumos', descripcion, monto, forma_pago: formaPago, contacto_id: contactoId ? parseInt(contactoId) : null }).select().single()
      if (errCo) return { error: errCo }
      if (!caja_oficial_id) caja_oficial_id = co?.id || null
      if (pago.subtipo_cheque === 'propio' && pago.cheque_propio?.fecha_vencimiento) {
        const { error: errCheq } = await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto, beneficiario: contactoNombre || null, estado: 'en_cartera', caja_oficial_id, es_electronico: pago.tipo === 'e-cheq', registrado_por: registradoPor || null })
        if (errCheq) return { error: errCheq }
      } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
        for (const chId of pago.cheque_tercero_ids) await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(chId))
      }
    }
  }

  // Si parte del pago fue con crédito de una financiera/banco, el proveedor
  // ya cobró — se registra la deuda en Créditos, vinculada a la primera
  // compra pagada (si se pagaron varias juntas, queda igual la referencia).
  const pagoCredito = pagos.find(p => p.tipo === 'credito' && parseFloat(p.monto) > 0)
  if (pagoCredito) {
    const montoCredito = parseFloat(pagoCredito.monto)
    const cuotas = parseInt(creditoCuotas) || 1
    const primeraCompra = pendientes.find(x => x.id === seleccionadas[0])
    const { error: errCredito } = await supabase.from('creditos').insert({
      compra_insumos_id: seleccionadas[0] || null,
      entidad: creditoEntidad || null,
      descripcion: `${primeraCompra?.insumo_nombre || descripcion}${seleccionadas.length > 1 ? ` (+${seleccionadas.length - 1} más)` : ''}`,
      monto_total: montoCredito, cant_cuotas: cuotas, monto_cuota: Math.round(montoCredito / cuotas),
      fecha_inicio: fecha, fecha_vencimiento: creditoVencimiento || null,
      cuotas_pagadas: 0, saldo_pendiente: montoCredito, estado: 'activo',
      registrado_por: registradoPor || null,
    })
    if (errCredito) return { error: errCredito }
  }

  for (const id of seleccionadas) {
    const c = pendientes.find(x => x.id === id)
    if (!c) continue
    const upd = {
      estado_pago: 'pagado', caja_oficial_id, caja_paralela_id,
      pagos_detalle: pagos,
      forma_pago: pagos.map(p => p.subtipo_cheque || p.tipo).join('+'),
      es_paralelo: pagos.some(p => p.es_paralelo),
    }
    if (contactoId) upd.contacto_id = parseInt(contactoId)
    // Si la compra se cargó sin precio, se define recién ahora al pagar —
    // si se cargó en dólares, se convierte a pesos con la cotización del día
    // antes de guardar (el stock y la caja siempre quedan en pesos).
    if (!(c.total || c.precio_unitario) && precios[id]) {
      const precioIngresado = parseFloat(precios[id])
      const esUsd = monedas?.[id] === 'USD' && cotizacionDolar
      const precioFinal = esUsd ? Math.round(precioIngresado * cotizacionDolar * 100) / 100 : precioIngresado
      upd.precio_unitario = precioFinal
      upd.total = Math.round((c.cantidad || 0) * precioFinal)
      if (esUsd) { upd.precio_unitario_usd = precioIngresado; upd.cotizacion_dolar = cotizacionDolar }
      if (facturas?.[id]) upd.numero_factura = facturas[id]
      if (actualizarPrecioReferencia) await actualizarPrecioReferencia(c, precioFinal)
    }
    const { error } = await supabase.from('compras_insumos').update(upd).eq('id', id)
    if (error) return { error }
  }

  return { error: null }
}
