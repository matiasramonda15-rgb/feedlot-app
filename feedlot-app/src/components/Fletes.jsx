import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
}

const PAGO_INIT = { tipo: 'transferencia', monto: '', es_paralelo: false, subtipo_cheque: '', cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' } }

const inp = (extra = {}) => ({
  width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`,
  borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box',
  fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, ...extra
})

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</div>
)

export default function Fletes({ usuario }) {
  const [fletes, setFletes] = useState([])
  const [contactos, setContactos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('pendiente')
  const [filtroTransportista, setFiltroTransportista] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [formEdit, setFormEdit] = useState({})
  const [pagandoId, setPagandoId] = useState(null)
  const [formPago, setFormPago] = useState({ fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT }], contacto_id: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: f }, { data: ct }] = await Promise.all([
      supabase.from('fletes').select('*, lotes(codigo, procedencia, fecha_ingreso)').order('fecha', { ascending: false }),
      supabase.from('contactos').select('id, nombre, localidad').order('nombre'),
    ])
    setFletes(f || [])
    setContactos(ct || [])
    setLoading(false)
  }

  async function guardarEdit() {
    setGuardando(true)
    await supabase.from('fletes').update({
      transportista: formEdit.transportista,
      fecha: formEdit.fecha,
      cantidad: formEdit.cantidad ? parseInt(formEdit.cantidad) : null,
      kg_bruto: formEdit.kg_bruto ? parseFloat(formEdit.kg_bruto) : null,
      monto: formEdit.monto ? parseFloat(formEdit.monto) : null,
      numero_factura: formEdit.numero_factura || null,
      observaciones: formEdit.observaciones || null,
    }).eq('id', editandoId)
    setEditandoId(null)
    setGuardando(false)
    await cargar()
  }

  async function guardarPago(flete) {
    const pagos = formPago.pagos.filter(p => parseFloat(p.monto) > 0)
    if (!pagos.length) { alert('Ingresá el monto'); return }
    setGuardando(true)
    let caja_oficial_id = null, caja_paralela_id = null
    const ct = contactos.find(x => String(x.id) === formPago.contacto_id)
    const desc = `Flete ${flete.transportista} · ${flete.lotes?.codigo || ''}`
    for (const pago of pagos) {
      const monto = parseFloat(pago.monto)
      const fp = pago.subtipo_cheque ? `e-cheq ${pago.subtipo_cheque}` : pago.tipo
      if (pago.es_paralelo) {
        const { data: cp } = await supabase.from('caja_paralela').insert({ fecha: formPago.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
        if (!caja_paralela_id) caja_paralela_id = cp?.id
      } else {
        const { data: co } = await supabase.from('caja_oficial').insert({ fecha: formPago.fecha, tipo: 'egreso', categoria: 'Flete', descripcion: desc, monto, forma_pago: fp, contacto_id: formPago.contacto_id ? parseInt(formPago.contacto_id) : null }).select().single()
        if (!caja_oficial_id) caja_oficial_id = co?.id
      }
      if (!pago.es_paralelo && pago.subtipo_cheque === 'propio' && pago.cheque_propio?.fecha_vencimiento) {
        await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: formPago.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto, beneficiario: ct?.nombre || flete.transportista, estado: 'en_cartera', caja_oficial_id, registrado_por: usuario?.id })
      }
    }
    const totalPagado = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    await supabase.from('fletes').update({
      estado_pago: 'pagado',
      monto: flete.monto || totalPagado,
      caja_oficial_id, caja_paralela_id,
      contacto_id: formPago.contacto_id ? parseInt(formPago.contacto_id) : null,
    }).eq('id', flete.id)
    setPagandoId(null)
    setFormPago({ fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT }], contacto_id: '' })
    setGuardando(false)
    await cargar()
  }

  const transportistas = [...new Set(fletes.map(f => f.transportista).filter(Boolean))].sort()
  const fletesFiltrados = fletes.filter(f => {
    if (filtroEstado && f.estado_pago !== filtroEstado) return false
    if (filtroTransportista && f.transportista !== filtroTransportista) return false
    return true
  })
  const totalPend = fletes.filter(f => f.estado_pago === 'pendiente').reduce((s, f) => s + (f.monto || 0), 0)

  if (loading) return <div style={{ padding: '2rem', color: S.muted, fontSize: 13 }}>Cargando...</div>

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Fletes</div>
          <div style={{ fontSize: 13, color: S.muted, marginTop: 2 }}>Registro de transporte de animales</div>
        </div>
        {totalPend > 0 && (
          <div style={{ background: S.amberLight, border: `1px solid ${S.amber}`, borderRadius: 8, padding: '10px 16px', textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: S.amber, fontWeight: 600, textTransform: 'uppercase' }}>Pendientes de pago</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: S.amber }}>${totalPend.toLocaleString('es-AR')}</div>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem' }}>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          style={{ padding: '7px 12px', fontSize: 12, border: `1px solid ${S.border}`, borderRadius: 6, background: S.surface }}>
          <option value="">Todos</option>
          <option value="pendiente">Pendientes</option>
          <option value="pagado">Pagados</option>
        </select>
        <select value={filtroTransportista} onChange={e => setFiltroTransportista(e.target.value)}
          style={{ padding: '7px 12px', fontSize: 12, border: `1px solid ${S.border}`, borderRadius: 6, background: S.surface, color: filtroTransportista ? S.accent : S.muted }}>
          <option value="">Todos los transportistas</option>
          {transportistas.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(filtroEstado !== 'pendiente' || filtroTransportista) && (
          <button onClick={() => { setFiltroEstado('pendiente'); setFiltroTransportista('') }}
            style={{ padding: '6px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: S.bg }}>
              {['Fecha', 'Transportista', 'Lote', 'Procedencia', 'Animales', 'Kg bruto', 'N° Factura', 'Monto', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fletesFiltrados.length === 0 && (
              <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay fletes registrados.</td></tr>
            )}
            {fletesFiltrados.map(f => (
              <>
                <tr key={f.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                    {f.fecha ? new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                  </td>
                  <td style={{ padding: '9px 12px', fontWeight: 600 }}>{f.transportista}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: S.accent }}>{f.lotes?.codigo || '—'}</td>
                  <td style={{ padding: '9px 12px', color: S.muted, fontSize: 12 }}>{f.lotes?.procedencia || '—'}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', textAlign: 'right' }}>{f.cantidad?.toLocaleString('es-AR') || '—'}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', textAlign: 'right' }}>{f.kg_bruto ? `${f.kg_bruto.toLocaleString('es-AR')} kg` : '—'}</td>
                  <td style={{ padding: '9px 12px', color: S.muted, fontSize: 12 }}>{f.numero_factura || '—'}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, textAlign: 'right' }}>{f.monto ? `$${f.monto.toLocaleString('es-AR')}` : '—'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: f.estado_pago === 'pagado' ? S.greenLight : S.amberLight, color: f.estado_pago === 'pagado' ? S.green : S.amber }}>
                      {f.estado_pago === 'pagado' ? '✓ Pagado' : '⏳ Pendiente'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => { setEditandoId(editandoId === f.id ? null : f.id); setFormEdit({ transportista: f.transportista, fecha: f.fecha, cantidad: f.cantidad ? String(f.cantidad) : '', kg_bruto: f.kg_bruto ? String(f.kg_bruto) : '', monto: f.monto ? String(f.monto) : '', numero_factura: f.numero_factura || '', observaciones: f.observaciones || '' }) }}
                        style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>✏</button>
                      {f.estado_pago === 'pendiente' && (
                        <button onClick={() => { setPagandoId(pagandoId === f.id ? null : f.id); setFormPago({ fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT, monto: f.monto ? String(f.monto) : '' }], contacto_id: '' }) }}
                          style={{ padding: '3px 8px', fontSize: 11, background: S.green, border: 'none', color: '#fff', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>💳 Pagar</button>
                      )}
                      <button onClick={async () => {
                        if (!confirm('¿Eliminar este flete?')) return
                        await supabase.from('fletes').delete().eq('id', f.id)
                        await cargar()
                      }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </td>
                </tr>

                {/* Form edición */}
                {editandoId === f.id && (
                  <tr key={`edit-${f.id}`} style={{ background: S.accentLight }}>
                    <td colSpan={10} style={{ padding: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
                        <div><Label>Transportista</Label><input value={formEdit.transportista} onChange={e => setFormEdit({...formEdit, transportista: e.target.value})} style={inp()} /></div>
                        <div><Label>Fecha</Label><input type="date" value={formEdit.fecha} onChange={e => setFormEdit({...formEdit, fecha: e.target.value})} style={inp()} /></div>
                        <div><Label>Cantidad</Label><input type="number" value={formEdit.cantidad} onChange={e => setFormEdit({...formEdit, cantidad: e.target.value})} style={inp()} /></div>
                        <div><Label>Kg bruto</Label><input type="number" value={formEdit.kg_bruto} onChange={e => setFormEdit({...formEdit, kg_bruto: e.target.value})} style={inp()} /></div>
                        <div><Label>Monto $</Label><input type="number" value={formEdit.monto} onChange={e => setFormEdit({...formEdit, monto: e.target.value})} style={inp({ fontFamily: 'monospace' })} /></div>
                        <div><Label>N° Factura</Label><input value={formEdit.numero_factura} onChange={e => setFormEdit({...formEdit, numero_factura: e.target.value})} style={inp()} /></div>
                        <div style={{ gridColumn: 'span 2' }}><Label>Observaciones</Label><input value={formEdit.observaciones} onChange={e => setFormEdit({...formEdit, observaciones: e.target.value})} style={inp()} /></div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={guardarEdit} disabled={guardando} style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
                        <button onClick={() => setEditandoId(null)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Form pago */}
                {pagandoId === f.id && (
                  <tr key={`pago-${f.id}`} style={{ background: S.greenLight }}>
                    <td colSpan={10} style={{ padding: '1rem' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: S.green, marginBottom: '1rem' }}>💳 Registrar pago — {f.transportista}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, marginBottom: '1rem' }}>
                        <div>
                          <Label>Contacto / Transportista</Label>
                          <select value={formPago.contacto_id} onChange={e => setFormPago({...formPago, contacto_id: e.target.value})}
                            style={inp({ border: `1px solid ${S.accent}` })}>
                            <option value="">— Sin contacto —</option>
                            {contactos.map(ct => <option key={ct.id} value={ct.id}>{ct.nombre}{ct.localidad ? ` (${ct.localidad})` : ''}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label>Fecha</Label>
                          <input type="date" value={formPago.fecha} onChange={e => setFormPago({...formPago, fecha: e.target.value})} style={inp()} />
                        </div>
                      </div>
                      {formPago.pagos.map((pago, idx) => (
                        <div key={idx} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '12px', marginBottom: 8 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'flex-end' }}>
                            <div>
                              <Label>Forma de pago</Label>
                              <select value={pago.tipo} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, tipo: e.target.value, subtipo_cheque: ''} : p); setFormPago({...formPago, pagos: n}) }} style={inp()}>
                                <option value="transferencia">Transferencia</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="e-cheq">E-cheq</option>
                              </select>
                            </div>
                            <div>
                              <Label>Monto $</Label>
                              <input type="number" value={pago.monto} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, monto: e.target.value} : p); setFormPago({...formPago, pagos: n}) }} style={inp({ fontFamily: 'monospace', fontWeight: 600 })} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: S.muted, cursor: 'pointer' }}>
                                <input type="checkbox" checked={pago.es_paralelo || false} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, es_paralelo: e.target.checked} : p); setFormPago({...formPago, pagos: n}) }} />
                                Paralelo
                              </label>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                              {formPago.pagos.length > 1 && <button onClick={() => setFormPago({...formPago, pagos: formPago.pagos.filter((_,i)=>i!==idx)})}
                                style={{ padding: '6px 10px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>✕</button>}
                            </div>
                          </div>
                          {pago.tipo === 'e-cheq' && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                {['propio', 'tercero'].map(t => (
                                  <button key={t} onClick={() => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, subtipo_cheque: p.subtipo_cheque === t ? '' : t} : p); setFormPago({...formPago, pagos: n}) }}
                                    style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${pago.subtipo_cheque === t ? S.accent : S.border}`, background: pago.subtipo_cheque === t ? S.accentLight : 'transparent', color: pago.subtipo_cheque === t ? S.accent : S.muted }}>
                                    {t === 'propio' ? '📤 Propio' : '📥 Tercero'}
                                  </button>
                                ))}
                              </div>
                              {pago.subtipo_cheque === 'propio' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                  <div><Label>N° cheque</Label><input type="text" value={pago.cheque_propio?.numero || ''} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...(p.cheque_propio||{}), numero: e.target.value}} : p); setFormPago({...formPago, pagos: n}) }} style={inp()} /></div>
                                  <div><Label>Banco</Label><input type="text" value={pago.cheque_propio?.banco || ''} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...(p.cheque_propio||{}), banco: e.target.value}} : p); setFormPago({...formPago, pagos: n}) }} style={inp()} /></div>
                                  <div><Label>Vencimiento</Label><input type="date" value={pago.cheque_propio?.fecha_vencimiento || ''} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...(p.cheque_propio||{}), fecha_vencimiento: e.target.value}} : p); setFormPago({...formPago, pagos: n}) }} style={inp({ border: `1px solid ${S.amber}` })} /></div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      <button onClick={() => setFormPago({...formPago, pagos: [...formPago.pagos, { ...PAGO_INIT }]})}
                        style={{ padding: '5px 12px', fontSize: 11, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer', marginBottom: 12 }}>
                        + Agregar forma de pago
                      </button>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => guardarPago(f)} disabled={guardando} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                          {guardando ? 'Guardando...' : '✓ Confirmar pago'}
                        </button>
                        <button onClick={() => setPagandoId(null)} style={{ padding: '8px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
          {fletesFiltrados.length > 0 && (
            <tfoot>
              <tr style={{ background: S.accentLight }}>
                <td colSpan={5} style={{ padding: '9px 12px', fontWeight: 700 }}>Total filtrado</td>
                <td style={{ padding: '9px 12px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700 }}>
                  {fletesFiltrados.reduce((s,f) => s+(f.kg_bruto||0),0).toLocaleString('es-AR')} kg
                </td>
                <td></td>
                <td style={{ padding: '9px 12px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700 }}>
                  ${fletesFiltrados.reduce((s,f) => s+(f.monto||0),0).toLocaleString('es-AR')}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
