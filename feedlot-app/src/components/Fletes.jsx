import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { hoyLocal } from '../shared/dateUtils'
import { PAGO_INIT, ListaPagos } from './PagoFormulario'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
}


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
  const [chequesCartera, setChequesCartera] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTransportista, setFiltroTransportista] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [formEdit, setFormEdit] = useState({})
  const [pagandoId, setPagandoId] = useState(null)
  const [formPago, setFormPago] = useState({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT }], contacto_id: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: f }, { data: ct }, { data: ch }] = await Promise.all([
      supabase.from('fletes').select('*, lotes(codigo, procedencia, fecha_ingreso)').order('fecha', { ascending: false }),
      supabase.from('contactos').select('id, nombre, localidad').order('nombre'),
      supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento'),
    ])
    setFletes(f || [])
    setContactos(ct || [])
    setChequesCartera(ch || [])
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
      if (pago.tipo === 'canje') continue  // canje: no mueve caja, se compensa solo en Contactos
      if (pago.tipo === 'credito') {
        const cuotas = parseInt(formPago.credito_cuotas) || 1
        const { data: cred, error: errCred } = await supabase.from('creditos').insert({
          entidad: formPago.credito_entidad || null,
          descripcion: `Flete ${flete.transportista || ''} · ${flete.lotes?.codigo || ''}`,
          monto_total: monto, cant_cuotas: cuotas, monto_cuota: Math.round(monto / cuotas),
          fecha_inicio: formPago.fecha, fecha_vencimiento: formPago.credito_vencimiento || null,
          cuotas_pagadas: 0, saldo_pendiente: monto, estado: 'activo', registrado_por: usuario?.id,
        }).select().single()
        if (errCred) { alert('Error al crear el crédito: ' + errCred.message); setGuardando(false); return }
        const cuotasAInsertar = []
        for (let i = 0; i < cuotas; i++) {
          let fechaCuota = formPago.credito_vencimiento || formPago.fecha
          if (i > 0 && formPago.credito_vencimiento) {
            const d = new Date(formPago.credito_vencimiento + 'T12:00:00')
            d.setMonth(d.getMonth() + i)
            fechaCuota = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          }
          cuotasAInsertar.push({ credito_id: cred.id, fecha: fechaCuota, nro_cuota: i + 1, estado: 'pendiente', monto: Math.round(monto / cuotas) })
        }
        const { error: errCuotas } = await supabase.from('pagos_creditos').insert(cuotasAInsertar)
        if (errCuotas) alert('El crédito se creó, pero no se pudieron generar las cuotas: ' + errCuotas.message)
        continue
      }
      const fp = pago.subtipo_cheque || pago.tipo
      if (pago.es_paralelo) {
        const { data: cp, error: ep } = await supabase.from('caja_paralela').insert({ fecha: formPago.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
        if (ep) { alert('Error al registrar en Caja 2: ' + ep.message); setGuardando(false); return }
        if (!caja_paralela_id) caja_paralela_id = cp?.id
      } else {
        const { data: co, error: eo } = await supabase.from('caja_oficial').insert({ fecha: formPago.fecha, tipo: 'egreso', categoria: 'Flete', descripcion: desc, monto, forma_pago: fp, contacto_id: formPago.contacto_id ? parseInt(formPago.contacto_id) : null }).select().single()
        if (eo) { alert('Error al registrar en caja oficial: ' + eo.message); setGuardando(false); return }
        if (!caja_oficial_id) caja_oficial_id = co?.id
        if (pago.subtipo_cheque === 'propio' && pago.cheque_propio?.fecha_vencimiento) {
          const { error: ech } = await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: formPago.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto, beneficiario: ct?.nombre || flete.transportista, estado: 'en_cartera', caja_oficial_id, es_electronico: pago.tipo === 'e-cheq', registrado_por: usuario?.id })
          if (ech) { alert('Error al registrar el cheque: ' + ech.message); setGuardando(false); return }
        } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
          for (const chId of pago.cheque_tercero_ids) await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(chId))
        }
      }
    }
    const totalPagado = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    const { error: eFlete } = await supabase.from('fletes').update({
      estado_pago: 'pagado',
      monto: flete.monto || totalPagado,
      caja_oficial_id, caja_paralela_id,
      contacto_id: formPago.contacto_id ? parseInt(formPago.contacto_id) : null,
      pagos_detalle: pagos,
      forma_pago: pagos.map(p => p.subtipo_cheque || p.tipo).join('+'),
      es_paralelo: pagos.some(p => p.es_paralelo),
    }).eq('id', flete.id)
    if (eFlete) { alert('El pago se registró, pero no se pudo actualizar el flete: ' + eFlete.message); setGuardando(false); return }
    setPagandoId(null)
    setFormPago({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT }], contacto_id: '' })
    setGuardando(false)
    // Si el filtro estaba en "Pendientes", el flete que se acaba de pagar
    // desaparecería de la vista apenas se guarda — se pasa a "Todos" para
    // que se vea el cambio de estado en el momento, en vez de que parezca
    // que se borró.
    if (filtroEstado === 'pendiente') setFiltroEstado('')
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
        {(filtroEstado || filtroTransportista) && (
          <button onClick={() => { setFiltroEstado(''); setFiltroTransportista('') }}
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
                        <button onClick={() => { setPagandoId(pagandoId === f.id ? null : f.id); setFormPago({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT, monto: f.monto ? String(f.monto) : '' }], contacto_id: '' }) }}
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
                        <div>
                          <Label>Transportista</Label>
                          <select value={formEdit.transportista} onChange={e => setFormEdit({...formEdit, transportista: e.target.value})} style={inp()}>
                            <option value="">— Seleccioná —</option>
                            {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                          </select>
                        </div>
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
                      <Label>Formas de pago</Label>
                      <ListaPagos pagos={formPago.pagos} onChangePagos={n => setFormPago({...formPago, pagos: n})} chequesCartera={chequesCartera} S={S} soloTerceroSiParalelo opcionesExtra={[{ value: 'credito', label: '🏦 Crédito (tarjeta/financiera)' }]} />
                      {formPago.pagos.some(p => p.tipo === 'credito') && (
                        <div style={{ background: '#F0EAFB', border: '1px solid #9F8ED4', borderRadius: 8, padding: 12, marginTop: 8 }}>
                          <div style={{ fontSize: 12, color: '#3D1A6B', marginBottom: 8 }}>
                            El transportista ya cobró (se lo pagó la tarjeta/financiera) — la deuda queda registrada en Créditos.
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                            <div><Label>Entidad</Label><input type="text" value={formPago.credito_entidad || ''} onChange={e => setFormPago({...formPago, credito_entidad: e.target.value})} style={inp()} placeholder="ej. Tarjeta Agronación" /></div>
                            <div><Label>Cant. de cuotas</Label><input type="number" value={formPago.credito_cuotas || '1'} onChange={e => setFormPago({...formPago, credito_cuotas: e.target.value})} style={inp()} /></div>
                            <div><Label>Vencimiento (1ra cuota)</Label><input type="date" value={formPago.credito_vencimiento || ''} onChange={e => setFormPago({...formPago, credito_vencimiento: e.target.value})} style={inp()} /></div>
                          </div>
                        </div>
                      )}
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
