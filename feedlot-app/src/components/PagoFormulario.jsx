import { useState } from 'react'

// Forma inicial de un pago — la misma en todos los módulos que registran
// cobros/pagos (Insumos, Ventas, Ingresos, Agricultura, Servicios, Personal).
export const PAGO_INIT = {
  tipo: 'transferencia', // 'transferencia' | 'efectivo' | 'cheque' | 'e-cheq' | 'canje' | 'retencion' (solo donde se ofrece)
  monto: '',
  es_paralelo: false,
  subtipo_cheque: '', // 'propio' | 'tercero' — solo aplica si tipo es 'cheque' o 'e-cheq'
  canje_detalle: '',
  cheque_propio: { numero: '', banco: '', fecha_vencimiento: '', fecha_cobro: '' },
  cheque_tercero_ids: [],
}

// Impuestos que se pueden retener al pagar (forma de pago "Retención").
export const IMPUESTOS_RETENCION = ['Impuesto a las Ganancias', 'Ingresos Brutos', 'IVA', 'SUSS']

const inpDefault = { width: '100%', border: '1px solid #E2DDD6', borderRadius: 6, padding: '8px 10px', fontSize: 13, background: '#fff', boxSizing: 'border-box' }

// Una fila completa de "forma de pago": elegís transferencia / efectivo /
// cheque / e-cheq / canje, marcás si es paralelo, y si es cheque (físico o
// electrónico) se abre el desglose propio/tercero con sus datos — incluida
// la selección de cheques ya en cartera para depositar/endosar.
// Arma el detalle (número, banco, fechas, monto) de los cheques de tercero
// elegidos, tomándolo de la cartera. Los recibos lo necesitan para imprimir
// cada cheque — antes solo Ingresos, Gastos y Fletes lo armaban (cada uno con
// su propia copia) y en el resto de los módulos el recibo salía con el cheque
// en blanco. Ahora se arma acá, una sola vez, al tildar los cheques.
export function armarDetalleChequesTercero(ids, chequesCartera) {
  return (ids || []).map(id => {
    const ch = (chequesCartera || []).find(c => String(c.id) === String(id))
    return ch ? { id: ch.id, numero: ch.numero, banco: ch.banco, monto: ch.monto, fecha_vencimiento: ch.fecha_vencimiento, fecha_cobro: ch.fecha_cobro } : null
  }).filter(Boolean)
}

export function FilaPago({ pago, onChange, onRemove, chequesCartera = [], S, inputStyle, mostrarCanje = true, mostrarParalelo = true, soloTerceroSiParalelo = false, opcionesExtra = [], deudasPendientes = [], onCrearDeuda = null, opcionesInsumo = [], anticiposDisponibles = [], modoCobro = false, contraparte = '' }) {
  const inp = inputStyle || inpDefault
  const set = (campo, valor) => onChange({ ...pago, [campo]: valor })
  const setChequePropio = (campo, valor) => onChange({ ...pago, cheque_propio: { ...(pago.cheque_propio || {}), [campo]: valor } })
  const setChequeRecibido = (campo, valor) => onChange({ ...pago, cheque_recibido: { ...(pago.cheque_recibido || {}), [campo]: valor } })
  const esCheque = pago.tipo === 'cheque' || pago.tipo === 'e-cheq'
  const [mostrarNuevaDeuda, setMostrarNuevaDeuda] = useState(false)
  const [nuevaDeudaInsumo, setNuevaDeudaInsumo] = useState('')
  const [nuevaDeudaCantidad, setNuevaDeudaCantidad] = useState('')
  const [nuevaDeudaPrecio, setNuevaDeudaPrecio] = useState('')
  const [creandoDeuda, setCreandoDeuda] = useState(false)
  const insumoElegido = opcionesInsumo.find(o => `${o.tabla}-${o.id}` === nuevaDeudaInsumo)
  const montoNuevaDeuda = Math.round((parseFloat(nuevaDeudaCantidad) || 0) * (parseFloat(nuevaDeudaPrecio) || 0))

  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: mostrarParalelo ? '1fr 1fr auto auto' : '1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Forma de pago</div>
          <select value={pago.tipo} onChange={e => {
            if (e.target.value === 'anticipo' && anticiposDisponibles.length > 0) {
              // Se autoselecciona el anticipo apenas se elige este tipo de
              // pago (el primero si hay más de uno) — antes había que
              // además hacer clic en la fila del anticipo específico, y si
              // no se hacía ese clic extra, el pago quedaba marcado
              // "anticipo" pero sin descontar nada de verdad.
              const a = anticiposDisponibles[0]
              const montoActual = parseFloat(pago.monto) || 0
              onChange({ ...pago, tipo: 'anticipo', subtipo_cheque: '', anticipo_id: a.id, anticipo_detalle: a.descripcion, monto: String(Math.min(a.monto_disponible, montoActual || a.monto_disponible)) })
            } else if (e.target.value === 'retencion') {
              // La retención no sale de ninguna caja ese día (se deposita
              // después en ARCA/Rentas desde Comercial): nunca es Caja 2.
              onChange({ ...pago, tipo: 'retencion', subtipo_cheque: '', es_paralelo: false, retencion_impuesto: pago.retencion_impuesto || IMPUESTOS_RETENCION[0] })
            } else {
              onChange({ ...pago, tipo: e.target.value, subtipo_cheque: '' })
            }
          }} style={inp}>
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="cheque">📄 Cheque</option>
            <option value="e-cheq">💻 E-cheq</option>
            {opcionesExtra.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            {mostrarCanje && <option value="canje">🔄 Canje / Trueque</option>}
            {anticiposDisponibles.length > 0 && <option value="anticipo">🎟️ Anticipo ya pagado</option>}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Monto $</div>
          <input type="number" value={pago.monto} onChange={e => set('monto', e.target.value)} style={{ ...inp, fontFamily: 'monospace', fontWeight: 600 }} />
        </div>
        {mostrarParalelo && (
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: S.muted, cursor: 'pointer' }}>
              <input type="checkbox" checked={pago.es_paralelo || false} disabled={pago.tipo === 'retencion'} onChange={e => set('es_paralelo', e.target.checked)} />
              Caja 2
            </label>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
          {onRemove && <button onClick={onRemove}
            style={{ padding: '6px 10px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>✕</button>}
        </div>
      </div>

      {pago.tipo === 'canje' && (
        <div style={{ marginTop: 8 }}>
          {deudasPendientes.length > 0 && (            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>
                Compensar contra (lo que se le debe a este contacto) — podés marcar varias
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                {deudasPendientes.map(d => {
                  const idsSeleccionados = pago.canje_deuda_ids || (pago.canje_deuda_id ? [pago.canje_deuda_id] : [])
                  const marcado = idsSeleccionados.includes(String(d.id))
                  return (
                    <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: marcado ? '#F0EAFB' : S.surface, border: `1px solid ${marcado ? '#3D1A6B' : S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={marcado} onChange={e => {
                        const idsPrevios = pago.canje_deuda_ids || (pago.canje_deuda_id ? [pago.canje_deuda_id] : [])
                        const nuevosIds = e.target.checked ? [...idsPrevios, String(d.id)] : idsPrevios.filter(id => id !== String(d.id))
                        const deudasElegidas = deudasPendientes.filter(x => nuevosIds.includes(String(x.id)))
                        const montoTotal = deudasElegidas.reduce((s, x) => s + (x.monto || 0), 0)
                        const detalleTotal = deudasElegidas.map(x => x.label).join(' + ')
                        onChange({ ...pago, canje_deuda_id: null, canje_deuda_ids: nuevosIds, canje_detalle: detalleTotal || pago.canje_detalle, monto: nuevosIds.length ? String(montoTotal) : pago.monto })
                      }} />
                      <span>{d.label} · ${d.monto.toLocaleString('es-AR')}</span>
                    </label>
                  )
                })}
              </div>
            </>
          )}
          {onCrearDeuda && !mostrarNuevaDeuda && (
            <button onClick={() => setMostrarNuevaDeuda(true)} type="button"
              style={{ padding: '5px 10px', fontSize: 11, background: 'transparent', border: `1px dashed ${S.border}`, color: S.accent, borderRadius: 6, cursor: 'pointer', marginBottom: 8, width: '100%', textAlign: 'left' }}>
              + Cargar una compra nueva para compensar (sin salir de acá)
            </button>
          )}
          {onCrearDeuda && mostrarNuevaDeuda && (
            <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 6, padding: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 6 }}>Nueva compra para compensar</div>
              <select value={nuevaDeudaInsumo} onChange={e => setNuevaDeudaInsumo(e.target.value)} style={{ ...inp, marginBottom: 6 }}>
                <option value="">— Elegí el insumo —</option>
                {opcionesInsumo.filter(o => o.tabla === 'agro').length > 0 && (
                  <optgroup label="🌾 Agricultura">
                    {opcionesInsumo.filter(o => o.tabla === 'agro').map(o => <option key={`agro-${o.id}`} value={`agro-${o.id}`}>{o.nombre}</option>)}
                  </optgroup>
                )}
                {opcionesInsumo.filter(o => o.tabla === 'alimentacion').length > 0 && (
                  <optgroup label="🌽 Alimentación (Feedlot)">
                    {opcionesInsumo.filter(o => o.tabla === 'alimentacion').map(o => <option key={`alimentacion-${o.id}`} value={`alimentacion-${o.id}`}>{o.nombre}</option>)}
                  </optgroup>
                )}
              </select>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input type="number" placeholder={`Cantidad${insumoElegido?.unidad ? ' (' + insumoElegido.unidad + ')' : ''}`} value={nuevaDeudaCantidad} onChange={e => setNuevaDeudaCantidad(e.target.value)} style={{ ...inp, flex: 1 }} />
                <input type="number" placeholder={`$/${insumoElegido?.unidad || 'unidad'}`} value={nuevaDeudaPrecio} onChange={e => setNuevaDeudaPrecio(e.target.value)} style={{ ...inp, flex: 1 }} />
              </div>
              {montoNuevaDeuda > 0 && <div style={{ fontSize: 12, color: S.text, marginBottom: 6 }}>Total: <strong>${montoNuevaDeuda.toLocaleString('es-AR')}</strong></div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" disabled={creandoDeuda || !insumoElegido || !nuevaDeudaCantidad || !nuevaDeudaPrecio} onClick={async () => {
                  setCreandoDeuda(true)
                  const nueva = await onCrearDeuda({ tabla: insumoElegido.tabla, insumoId: insumoElegido.id, insumoNombre: insumoElegido.nombre, unidad: insumoElegido.unidad, cantidad: parseFloat(nuevaDeudaCantidad) || 0, precioUnitario: parseFloat(nuevaDeudaPrecio) || 0, monto: montoNuevaDeuda })
                  setCreandoDeuda(false)
                  if (!nueva) return
                  const idsPrevios = pago.canje_deuda_ids || (pago.canje_deuda_id ? [pago.canje_deuda_id] : [])
                  const nuevosIds = [...idsPrevios, String(nueva.id)]
                  const montoTotal = [...deudasPendientes, nueva].filter(x => nuevosIds.includes(String(x.id))).reduce((s, x) => s + (x.monto || 0), 0)
                  const detalleTotal = [...deudasPendientes, nueva].filter(x => nuevosIds.includes(String(x.id))).map(x => x.label).join(' + ')
                  onChange({ ...pago, canje_deuda_id: null, canje_deuda_ids: nuevosIds, canje_detalle: detalleTotal, monto: String(montoTotal) })
                  setNuevaDeudaInsumo(''); setNuevaDeudaCantidad(''); setNuevaDeudaPrecio(''); setMostrarNuevaDeuda(false)
                }} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', opacity: (creandoDeuda || !insumoElegido || !nuevaDeudaCantidad || !nuevaDeudaPrecio) ? 0.5 : 1 }}>
                  {creandoDeuda ? '...' : '✓ Crear'}
                </button>
                <button type="button" onClick={() => { setMostrarNuevaDeuda(false); setNuevaDeudaInsumo(''); setNuevaDeudaCantidad(''); setNuevaDeudaPrecio('') }}
                  style={{ padding: '8px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ fontSize: 10, color: S.hint, marginTop: 4 }}>Suma al stock (o queda pendiente de retirar, según el módulo) y se carga como pendiente de pago, a nombre de este contacto — queda seleccionada para compensar automáticamente.</div>
            </div>
          )}
          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>A cambio de</div>
          <input type="text" value={pago.canje_detalle || ''} placeholder="ej. factura de cosecha del 5/7"
            onChange={e => set('canje_detalle', e.target.value)} style={inp} />
        </div>
      )}

      {pago.tipo === 'retencion' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Impuesto</div>
              <select value={pago.retencion_impuesto || IMPUESTOS_RETENCION[0]} onChange={e => set('retencion_impuesto', e.target.value)} style={inp}>
                {IMPUESTOS_RETENCION.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>N° de certificado</div>
              <input type="text" value={pago.retencion_certificado || ''} placeholder="ej. 0000-2026-000016"
                onChange={e => set('retencion_certificado', e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: S.hint, marginTop: 6 }}>
            No sale plata de caja ahora: queda en "Retenciones a depositar" (Comercial) hasta que pagues el VEP.
          </div>
        </div>
      )}

      {pago.tipo === 'anticipo' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 6 }}>
            Descontar de un anticipo ya pagado — no genera ningún movimiento de caja nuevo
          </div>
          {anticiposDisponibles.map(a => {
            const seleccionado = pago.anticipo_id === a.id
            return (
              <div key={a.id} onClick={() => {
                const montoAplicar = Math.min(a.monto_disponible, parseFloat(pago.monto) || a.monto_disponible)
                onChange({ ...pago, anticipo_id: a.id, anticipo_detalle: a.descripcion, monto: String(montoAplicar) })
              }}
                style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${seleccionado ? S.accent : S.border}`, background: seleccionado ? S.accentLight : 'transparent', cursor: 'pointer', marginBottom: 6, fontSize: 12 }}>
                <b>${a.monto_disponible.toLocaleString('es-AR')}</b> disponibles — {a.descripcion} ({new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-AR')})
              </div>
            )
          })}
          {pago.anticipo_id && (
            <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>
              Se van a descontar ${(parseFloat(pago.monto) || 0).toLocaleString('es-AR')} del anticipo elegido arriba.
            </div>
          )}
        </div>
      )}

      {/* COBRO: el cheque lo estamos RECIBIENDO — se cargan sus datos para
          que entre a la cartera: quién lo firmó (librador) y de quién lo
          recibimos (puede ser otra persona, si nos lo endosaron). */}
      {esCheque && modoCobro && (
        <div style={{ marginTop: 8, background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.green, textTransform: 'uppercase', marginBottom: 6 }}>📥 Cheque recibido — entra a la cartera</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>N° cheque</div>
              <input type="text" value={pago.cheque_recibido?.numero || ''} onChange={e => setChequeRecibido('numero', e.target.value)} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Banco</div>
              <input type="text" value={pago.cheque_recibido?.banco || ''} onChange={e => setChequeRecibido('banco', e.target.value)} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.amber, textTransform: 'uppercase', marginBottom: 3 }}>Fecha de cobro *</div>
              <input type="date" value={pago.cheque_recibido?.fecha_cobro || ''} onChange={e => setChequeRecibido('fecha_cobro', e.target.value)} style={{ ...inp, border: `1px solid ${S.amber}` }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Librador (quién lo firma)</div>
              <input type="text" value={pago.cheque_recibido?.librador || ''} placeholder={contraparte || 'Nombre'} onChange={e => setChequeRecibido('librador', e.target.value)} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Recibido de</div>
              <input type="text" value={pago.cheque_recibido?.recibido_de || ''} placeholder={contraparte || 'Nombre'} onChange={e => setChequeRecibido('recibido_de', e.target.value)} style={inp} />
            </div>
          </div>
          {contraparte && <div style={{ fontSize: 10, color: S.hint, marginTop: 4 }}>Si lo dejás vacío, se usa "{contraparte}".</div>}
        </div>
      )}

      {esCheque && !modoCobro && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: pago.subtipo_cheque ? 10 : 0 }}>
            {(soloTerceroSiParalelo && pago.es_paralelo ? ['tercero'] : ['propio', 'tercero']).map(t => (
              <button key={t} onClick={() => set('subtipo_cheque', pago.subtipo_cheque === t ? '' : t)}
                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${pago.subtipo_cheque === t ? S.accent : S.border}`, background: pago.subtipo_cheque === t ? S.accentLight : 'transparent', color: pago.subtipo_cheque === t ? S.accent : S.muted }}>
                {t === 'propio' ? '📤 Propio' : '📥 Tercero'}
              </button>
            ))}
          </div>

          {pago.subtipo_cheque === 'propio' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>N° cheque</div>
                <input type="text" value={pago.cheque_propio?.numero || ''} onChange={e => setChequePropio('numero', e.target.value)} style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Banco</div>
                <input type="text" value={pago.cheque_propio?.banco || ''} onChange={e => setChequePropio('banco', e.target.value)} style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.amber, textTransform: 'uppercase', marginBottom: 4 }}>Fecha de pago (cuándo se cobra) *</div>
                <input type="date" value={pago.cheque_propio?.fecha_vencimiento || ''} onChange={e => setChequePropio('fecha_vencimiento', e.target.value)} style={{ ...inp, border: `1px solid ${S.amber}` }} />
                {pago.cheque_propio?.fecha_vencimiento && (
                  <div style={{ fontSize: 10, color: S.hint, marginTop: 3 }}>
                    Vence (30 días después): {(() => {
                      const d = new Date(pago.cheque_propio.fecha_vencimiento + 'T12:00:00')
                      d.setDate(d.getDate() + 30)
                      return d.toLocaleDateString('es-AR')
                    })()}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.green, textTransform: 'uppercase', marginBottom: 4 }}>Fecha de cobro real</div>
                <input type="date" value={pago.cheque_propio?.fecha_cobro || ''} onChange={e => setChequePropio('fecha_cobro', e.target.value)} style={{ ...inp, border: `1px solid ${S.green}` }} />
                <div style={{ fontSize: 10, color: S.hint, marginTop: 3 }}>Si no la sabés todavía, dejala vacía.</div>
              </div>
            </div>
          )}

          {pago.subtipo_cheque === 'tercero' && (
            <div style={{ marginTop: 8 }}>
              {(() => {
                const lista = chequesCartera.filter(ch =>
                  (pago.es_paralelo ? ch.es_paralelo : !ch.es_paralelo) &&
                  (ch.es_electronico === (pago.tipo === 'e-cheq') || ch.es_electronico == null)
                )
                return lista.length === 0
                  ? <div style={{ fontSize: 13, color: S.hint }}>No hay {pago.tipo === 'e-cheq' ? 'e-cheqs' : 'cheques físicos'} en cartera {pago.es_paralelo ? '(Caja 2)' : '(Caja 1)'}.</div>
                  : lista.map(ch => (
                    <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', border: `1px solid ${pago.cheque_tercero_ids?.includes(String(ch.id)) ? S.accent : S.border}`, borderRadius: 6, background: pago.cheque_tercero_ids?.includes(String(ch.id)) ? S.accentLight : S.surface, cursor: 'pointer', marginBottom: 5 }}>
                      <input type="checkbox" checked={pago.cheque_tercero_ids?.includes(String(ch.id)) || false} onChange={() => {
                        const actuales = pago.cheque_tercero_ids || []
                        const yaEsta = actuales.includes(String(ch.id))
                        const nuevos = yaEsta ? actuales.filter(id => id !== String(ch.id)) : [...actuales, String(ch.id)]
                        const nuevoMonto = nuevos.reduce((s, id) => s + (chequesCartera.find(x => String(x.id) === id)?.monto || 0), 0)
                        onChange({ ...pago, cheque_tercero_ids: nuevos, cheque_tercero_detalle: armarDetalleChequesTercero(nuevos, chequesCartera), monto: String(nuevoMonto || '') })
                      }} />
                      <div style={{ fontSize: 13 }}>
                        <strong>${ch.monto?.toLocaleString('es-AR')}</strong>
                        <span style={{ color: S.muted, marginLeft: 8 }}>#{ch.numero || 'sin nro'} · {ch.banco || '—'} · cobro {ch.fecha_cobro ? new Date(ch.fecha_cobro + 'T12:00:00').toLocaleDateString('es-AR') : (ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : '—')}{ch.librador ? ` · ${ch.librador}` : ''}</span>
                      </div>
                    </label>
                  ))
              })()}
              {pago.cheque_tercero_ids?.length > 0 && (
                <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, marginTop: 6, padding: '6px 10px', background: S.accentLight, borderRadius: 6 }}>
                  {pago.cheque_tercero_ids.length} cheque{pago.cheque_tercero_ids.length !== 1 ? 's' : ''} seleccionado{pago.cheque_tercero_ids.length !== 1 ? 's' : ''} · Total: ${parseFloat(pago.monto || 0).toLocaleString('es-AR')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Lista completa de pagos: varias FilaPago + botón de agregar + resumen del
// total cargado contra el monto objetivo (si se pasa).
export function ListaPagos({ pagos, onChangePagos, montoObjetivo, chequesCartera = [], S, mostrarCanje = true, mostrarParalelo = true, soloTerceroSiParalelo = false, opcionesExtra = [], deudasPendientes = [], onCrearDeuda = null, opcionesInsumo = [], anticiposDisponibles = [], modoCobro = false, contraparte = '' }) {
  const totalPagos = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
  return (
    <div>
      {pagos.map((pago, idx) => (
        <FilaPago key={idx} pago={pago} S={S} chequesCartera={chequesCartera} mostrarCanje={mostrarCanje} mostrarParalelo={mostrarParalelo} soloTerceroSiParalelo={soloTerceroSiParalelo} opcionesExtra={opcionesExtra} deudasPendientes={deudasPendientes} onCrearDeuda={onCrearDeuda} opcionesInsumo={opcionesInsumo} anticiposDisponibles={anticiposDisponibles} modoCobro={modoCobro} contraparte={contraparte}
          onChange={p => onChangePagos(pagos.map((pp, i) => i === idx ? p : pp))}
          onRemove={pagos.length > 1 ? () => onChangePagos(pagos.filter((_, i) => i !== idx)) : null}
        />
      ))}
      <button onClick={() => onChangePagos([...pagos, { ...PAGO_INIT }])}
        style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: 'transparent', border: `1px dashed ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', marginBottom: 8 }}>
        + Agregar otra forma de pago
      </button>
      {montoObjetivo != null && montoObjetivo > 0 && (
        <div style={{ background: Math.abs(montoObjetivo - totalPagos) < 0.5 ? S.greenLight : S.amberLight, border: `1px solid ${Math.abs(montoObjetivo - totalPagos) < 0.5 ? '#97C459' : '#EF9F27'}`, borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
          Total: <strong>${montoObjetivo.toLocaleString('es-AR')}</strong> · Pagos: <strong>${totalPagos.toLocaleString('es-AR')}</strong>
        </div>
      )}
    </div>
  )
}
