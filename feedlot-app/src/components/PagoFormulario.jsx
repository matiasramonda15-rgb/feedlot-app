import { useState } from 'react'

// Forma inicial de un pago — la misma en todos los módulos que registran
// cobros/pagos (Insumos, Ventas, Ingresos, Agricultura, Servicios, Personal).
export const PAGO_INIT = {
  tipo: 'transferencia', // 'transferencia' | 'efectivo' | 'cheque' | 'e-cheq' | 'canje'
  monto: '',
  es_paralelo: false,
  subtipo_cheque: '', // 'propio' | 'tercero' — solo aplica si tipo es 'cheque' o 'e-cheq'
  canje_detalle: '',
  cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' },
  cheque_tercero_ids: [],
}

const inpDefault = { width: '100%', border: '1px solid #E2DDD6', borderRadius: 6, padding: '8px 10px', fontSize: 13, background: '#fff', boxSizing: 'border-box' }

// Una fila completa de "forma de pago": elegís transferencia / efectivo /
// cheque / e-cheq / canje, marcás si es paralelo, y si es cheque (físico o
// electrónico) se abre el desglose propio/tercero con sus datos — incluida
// la selección de cheques ya en cartera para depositar/endosar.
export function FilaPago({ pago, onChange, onRemove, chequesCartera = [], S, inputStyle, mostrarCanje = true, mostrarParalelo = true, soloTerceroSiParalelo = false, opcionesExtra = [], deudasPendientes = [] }) {
  const inp = inputStyle || inpDefault
  const set = (campo, valor) => onChange({ ...pago, [campo]: valor })
  const setChequePropio = (campo, valor) => onChange({ ...pago, cheque_propio: { ...(pago.cheque_propio || {}), [campo]: valor } })
  const esCheque = pago.tipo === 'cheque' || pago.tipo === 'e-cheq'

  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: mostrarParalelo ? '1fr 1fr auto auto' : '1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Forma de pago</div>
          <select value={pago.tipo} onChange={e => onChange({ ...pago, tipo: e.target.value, subtipo_cheque: '' })} style={inp}>
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="cheque">📄 Cheque</option>
            <option value="e-cheq">💻 E-cheq</option>
            {opcionesExtra.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            {mostrarCanje && <option value="canje">🔄 Canje / Trueque</option>}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Monto $</div>
          <input type="number" value={pago.monto} onChange={e => set('monto', e.target.value)} style={{ ...inp, fontFamily: 'monospace', fontWeight: 600 }} />
        </div>
        {mostrarParalelo && (
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: S.muted, cursor: 'pointer' }}>
              <input type="checkbox" checked={pago.es_paralelo || false} onChange={e => set('es_paralelo', e.target.checked)} />
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
          {deudasPendientes.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>
                Compensar contra (lo que se le debe a este contacto)
              </div>
              <select value={pago.canje_deuda_id || ''} onChange={e => {
                const deuda = deudasPendientes.find(d => String(d.id) === e.target.value)
                onChange({ ...pago, canje_deuda_id: e.target.value || null, canje_detalle: deuda ? deuda.label : pago.canje_detalle, monto: deuda ? String(deuda.monto) : pago.monto })
              }} style={{ ...inp, marginBottom: 6 }}>
                <option value="">— Elegir de lo pendiente, o escribir abajo —</option>
                {deudasPendientes.map(d => (
                  <option key={d.id} value={d.id}>{d.label} · ${d.monto.toLocaleString('es-AR')}</option>
                ))}
              </select>
            </>
          )}
          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>A cambio de</div>
          <input type="text" value={pago.canje_detalle || ''} placeholder="ej. factura de cosecha del 5/7"
            onChange={e => set('canje_detalle', e.target.value)} style={inp} />
        </div>
      )}

      {esCheque && (
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>N° cheque</div>
                <input type="text" value={pago.cheque_propio?.numero || ''} onChange={e => setChequePropio('numero', e.target.value)} style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Banco</div>
                <input type="text" value={pago.cheque_propio?.banco || ''} onChange={e => setChequePropio('banco', e.target.value)} style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.amber, textTransform: 'uppercase', marginBottom: 4 }}>Vencimiento *</div>
                <input type="date" value={pago.cheque_propio?.fecha_vencimiento || ''} onChange={e => setChequePropio('fecha_vencimiento', e.target.value)} style={{ ...inp, border: `1px solid ${S.amber}` }} />
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
                        onChange({ ...pago, cheque_tercero_ids: nuevos, monto: String(nuevoMonto || '') })
                      }} />
                      <div style={{ fontSize: 13 }}>
                        <strong>${ch.monto?.toLocaleString('es-AR')}</strong>
                        <span style={{ color: S.muted, marginLeft: 8 }}>#{ch.numero || 'sin nro'} · {ch.banco || '—'} · vence {ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : '—'}{ch.librador ? ` · ${ch.librador}` : ''}</span>
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
export function ListaPagos({ pagos, onChangePagos, montoObjetivo, chequesCartera = [], S, mostrarCanje = true, mostrarParalelo = true, soloTerceroSiParalelo = false, opcionesExtra = [], deudasPendientes = [] }) {
  const totalPagos = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
  return (
    <div>
      {pagos.map((pago, idx) => (
        <FilaPago key={idx} pago={pago} S={S} chequesCartera={chequesCartera} mostrarCanje={mostrarCanje} mostrarParalelo={mostrarParalelo} soloTerceroSiParalelo={soloTerceroSiParalelo} opcionesExtra={opcionesExtra} deudasPendientes={deudasPendientes}
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
