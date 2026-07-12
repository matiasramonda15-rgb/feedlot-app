import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './UI'

const PAGO_INIT_P = { tipo: 'transferencia', monto: '', es_paralelo: false, cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' } }

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
}

const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</div>
}

function Card({ children, style = {} }) {
  return <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>{children}</div>
}

const TIPOS_PAGO = ['sueldo', 'jornal', 'bonificacion', 'adelanto', 'vacaciones', 'aguinaldo', 'otro']

export default function Personal({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState([])
  const [pagos, setPagos] = useState([])
  const [empleadoSelId, setEmpleadoSelId] = useState('')
  const [editandoEmp, setEditandoEmp] = useState(null) // { id, nombre, rol, sueldo_base, tipo, aparece_en_servicios }
  const [showFormEmp, setShowFormEmp] = useState(false)
  const [showFormPago, setShowFormPago] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const [formEmp, setFormEmp] = useState({ nombre: '', rol: '', sueldo_base: '', tipo: 'fijo', aparece_en_servicios: true })
  const [formPago, setFormPago] = useState({
    empleado_id: '', fecha: new Date().toISOString().split('T')[0],
    monto: '', concepto: '', tipo: 'sueldo'
  })
  const [pagosForm, setPagosForm] = useState([{ ...PAGO_INIT_P }])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: e }, { data: p }] = await Promise.all([
      supabase.from('empleados').select('*').order('nombre'),
      supabase.from('pagos_empleados').select('*, empleados(nombre)').order('fecha', { ascending: false }),
    ])
    setEmpleados(e || [])
    setPagos(p || [])
    setLoading(false)
  }

  async function guardarEditEmpleado() {
    if (!editandoEmp?.nombre?.trim()) { alert('Ingresá el nombre'); return }
    await supabase.from('empleados').update({
      nombre: editandoEmp.nombre.trim(),
      rol: editandoEmp.rol || null,
      sueldo_base: editandoEmp.sueldo_base ? parseFloat(editandoEmp.sueldo_base) : null,
      tipo: editandoEmp.tipo || 'fijo',
      aparece_en_servicios: editandoEmp.aparece_en_servicios !== false,
    }).eq('id', editandoEmp.id)
    setEditandoEmp(null)
    await cargarDatos()
  }

  async function guardarEmpleado() {
    if (!formEmp.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    await supabase.from('empleados').insert({ nombre: formEmp.nombre, rol: formEmp.rol || null, sueldo_base: formEmp.sueldo_base ? parseFloat(formEmp.sueldo_base) : null, tipo: formEmp.tipo || 'fijo', aparece_en_servicios: formEmp.aparece_en_servicios !== false, activo: true })
    await cargar()
    setShowFormEmp(false)
    setFormEmp({ nombre: '', rol: '', sueldo_base: '' })
    setGuardando(false)
  }

  async function guardarPago() {
    if (!formPago.empleado_id) { alert('Seleccioná un empleado'); return }
    const totalPagos = pagosForm.reduce((a, p) => a + (parseFloat(p.monto) || 0), 0)
    if (!totalPagos) { alert('Ingresá al menos una forma de pago con monto'); return }
    setGuardando(true)
    const emp = empleados.find(e => String(e.id) === String(formPago.empleado_id))
    const desc = `Personal — ${emp?.nombre || ''} · ${formPago.tipo}${formPago.concepto ? ' · ' + formPago.concepto : ''}`
    let caja_oficial_id = null, caja_paralela_id = null
    for (const p of pagosForm.filter(p => p.monto)) {
      const monto = parseFloat(p.monto) || 0
      if (!monto) continue
      if (p.es_paralelo) {
        const { data: cp } = await supabase.from('caja_paralela').insert({ fecha: formPago.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
        caja_paralela_id = cp?.id
      } else {
        const { data: co } = await supabase.from('caja_oficial').insert({ fecha: formPago.fecha, tipo: 'egreso', categoria: 'Personal', descripcion: desc, monto, forma_pago: p.tipo }).select().single()
        caja_oficial_id = co?.id
        if (p.tipo === 'cheque_propio' && p.cheque_propio?.fecha_vencimiento) {
          await supabase.from('cheques').insert({ tipo: 'emitido', numero: p.cheque_propio.numero || null, banco: p.cheque_propio.banco || null, fecha_cobro: formPago.fecha, fecha_vencimiento: p.cheque_propio.fecha_vencimiento, monto, librador: emp?.nombre || null, estado: 'emitido', caja_oficial_id })
        }
      }
    }
    await supabase.from('pagos_empleados').insert({
      ...formPago,
      monto: totalPagos,
      empleado_id: parseInt(formPago.empleado_id),
      registrado_por: usuario?.id,
      caja_oficial_id,
      caja_paralela_id,
    })
    await cargar()
    setShowFormPago(false)
    setFormPago({ empleado_id: '', fecha: new Date().toISOString().split('T')[0], monto: '', concepto: '', tipo: 'sueldo' })
    setPagosForm([{ ...PAGO_INIT_P }])
    setGuardando(false)
  }

  async function eliminarPago(id) {
    if (!confirm('¿Eliminar este pago?')) return
    await supabase.from('pagos_empleados').delete().eq('id', id)
    await cargar()
  }

  async function toggleActivo(id, activo) {
    await supabase.from('empleados').update({ activo: !activo }).eq('id', id)
    await cargar()
  }

  if (loading) return <Loader />

  const empleadoSel = empleados.find(e => String(e.id) === String(empleadoSelId))
  const pagosSel = empleadoSelId ? pagos.filter(p => String(p.empleado_id) === String(empleadoSelId)) : pagos
  const anio = new Date().getFullYear()
  const pagosAnio = pagos.filter(p => new Date(p.fecha).getFullYear() === anio)
  const totalAnio = pagosAnio.reduce((s, p) => s + (p.monto || 0), 0)
  const sueldosBase = empleados.filter(e => e.activo).reduce((s, e) => s + (e.sueldo_base || 0), 0)

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Personal</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Empleados · sueldos · pagos registrados
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: 'Empleados activos', val: empleados.filter(e => e.activo).length },
          { label: 'Sueldos base mensuales', val: `$${sueldosBase.toLocaleString('es-AR')}` },
          { label: `Pagado en ${anio}`, val: `$${totalAnio.toLocaleString('es-AR')}`, color: S.green },
          { label: 'Pagos registrados', val: pagos.length },
        ].map((m, i) => (
          <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: m.color || S.text }}>{m.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1rem' }}>
        {/* Lista empleados */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Empleados</div>
            <button onClick={() => setShowFormEmp(!showFormEmp)}
              style={{ padding: '5px 10px', fontSize: 11, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 5, cursor: 'pointer' }}>
              + Agregar
            </button>
          </div>

          {showFormEmp && (
            <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gap: '.75rem', marginBottom: '.75rem' }}>
                <div><Label>Nombre</Label><input type="text" value={formEmp.nombre} onChange={e => setFormEmp({...formEmp, nombre: e.target.value})} style={inputStyle} /></div>
                <div><Label>Rol / cargo</Label><input type="text" value={formEmp.rol} onChange={e => setFormEmp({...formEmp, rol: e.target.value})} style={inputStyle} placeholder="ej. Encargado" /></div>
                <div><Label>Sueldo base $</Label><input type="number" value={formEmp.sueldo_base} onChange={e => setFormEmp({...formEmp, sueldo_base: e.target.value})} style={inputStyle} /></div>
                <div>
                  <Label>Tipo</Label>
                  <select value={formEmp.tipo} onChange={e => setFormEmp({...formEmp, tipo: e.target.value})} style={inputStyle}>
                    <option value="fijo">Fijo</option>
                    <option value="temporal">Temporal</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={formEmp.aparece_en_servicios} onChange={e => setFormEmp({...formEmp, aparece_en_servicios: e.target.checked})} id="aparece_svc" />
                  <label htmlFor="aparece_svc" style={{ fontSize: 13, cursor: 'pointer' }}>Aparece en Servicios</label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowFormEmp(false)} style={{ flex: 1, padding: '7px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarEmpleado} disabled={guardando} style={{ flex: 1, padding: '7px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? '...' : 'Guardar'}</button>
              </div>
            </div>
          )}

          <div onClick={() => setEmpleadoSelId('')}
            style={{ border: `1px solid ${!empleadoSelId ? S.accent : S.border}`, borderRadius: 8, padding: '.75rem', marginBottom: 6, cursor: 'pointer', background: !empleadoSelId ? S.accentLight : S.surface }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Todos los empleados</div>
            <div style={{ fontSize: 11, color: S.muted }}>{pagos.length} pagos registrados</div>
          </div>

          {empleados.map(e => {
            const pagosEmp = pagos.filter(p => p.empleado_id === e.id)
            const totalEmp = pagosEmp.filter(p => new Date(p.fecha).getFullYear() === anio).reduce((s, p) => s + (p.monto || 0), 0)
            const isSel = String(e.id) === String(empleadoSelId)
            return (
              <div key={e.id} style={{ border: `1px solid ${editandoEmp?.id === e.id ? S.accent : isSel ? S.accent : S.border}`, borderRadius: 8, marginBottom: 6, overflow: 'hidden', opacity: e.activo ? 1 : 0.6 }}>
                {editandoEmp?.id !== e.id ? (
                  <div onClick={() => setEmpleadoSelId(String(e.id))}
                    style={{ padding: '.75rem', cursor: 'pointer', background: isSel ? S.accentLight : e.activo ? S.surface : S.bg }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{e.nombre}</span>
                          {e.tipo === 'temporal' && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: S.amberLight, color: S.amber }}>Temporal</span>}
                          {e.aparece_en_servicios && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: S.accentLight, color: S.accent }}>Servicios</span>}
                        </div>
                        <div style={{ fontSize: 11, color: S.muted }}>{e.rol || '—'}</div>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: S.muted }}>Base: ${e.sueldo_base?.toLocaleString('es-AR') || '—'}</span>
                          <span style={{ color: S.green }}>${totalEmp.toLocaleString('es-AR')} {anio}</span>
                        </div>
                      </div>
                      <button onClick={ev => { ev.stopPropagation(); setEditandoEmp({ id: e.id, nombre: e.nombre, rol: e.rol || '', sueldo_base: e.sueldo_base ? String(e.sueldo_base) : '', tipo: e.tipo || 'fijo', aparece_en_servicios: e.aparece_en_servicios !== false }) }}
                        style={{ padding: '4px 8px', fontSize: 11, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 5, cursor: 'pointer', marginLeft: 8, flexShrink: 0 }}>
                        ✏ Editar
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: e.activo ? S.green : S.hint, marginTop: 4 }}>{e.activo ? '● Activo' : '○ Inactivo'}</div>
                  </div>
                ) : (
                  <div style={{ padding: '1rem', background: S.accentLight }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: S.accent, marginBottom: 10 }}>Editar empleado</div>
                    <div style={{ display: 'grid', gap: '.75rem', marginBottom: '.75rem' }}>
                      <div><Label>Nombre</Label><input type="text" value={editandoEmp.nombre} onChange={ev => setEditandoEmp({...editandoEmp, nombre: ev.target.value})} style={inputStyle} /></div>
                      <div><Label>Rol / cargo</Label><input type="text" value={editandoEmp.rol} onChange={ev => setEditandoEmp({...editandoEmp, rol: ev.target.value})} style={inputStyle} /></div>
                      <div><Label>Sueldo base $</Label><input type="number" value={editandoEmp.sueldo_base} onChange={ev => setEditandoEmp({...editandoEmp, sueldo_base: ev.target.value})} style={inputStyle} /></div>
                      <div>
                        <Label>Tipo</Label>
                        <select value={editandoEmp.tipo} onChange={ev => setEditandoEmp({...editandoEmp, tipo: ev.target.value})} style={inputStyle}>
                          <option value="fijo">Fijo</option>
                          <option value="temporal">Temporal</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={editandoEmp.aparece_en_servicios} onChange={ev => setEditandoEmp({...editandoEmp, aparece_en_servicios: ev.target.checked})} id={`svc_${e.id}`} />
                        <label htmlFor={`svc_${e.id}`} style={{ fontSize: 13, cursor: 'pointer' }}>Aparece en Servicios</label>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setEditandoEmp(null)} style={{ flex: 1, padding: '7px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={guardarEditEmpleado} style={{ flex: 1, padding: '7px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Pagos */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {empleadoSel ? `Pagos — ${empleadoSel.nombre}` : 'Historial de pagos'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {empleadoSel && (
                <button onClick={() => toggleActivo(empleadoSel.id, empleadoSel.activo)}
                  style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                  {empleadoSel.activo ? 'Dar de baja' : 'Reactivar'}
                </button>
              )}
              <button onClick={() => { setFormPago({...formPago, empleado_id: empleadoSelId}); setShowFormPago(true) }}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                + Registrar pago
              </button>
            </div>
          </div>

          {/* Detalle empleado seleccionado */}
          {empleadoSel && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1rem' }}>
              {[
                { label: 'Sueldo base', val: empleadoSel.sueldo_base ? `$${empleadoSel.sueldo_base.toLocaleString('es-AR')}` : '—' },
                { label: `Pagado en ${anio}`, val: `$${pagosSel.filter(p => new Date(p.fecha).getFullYear() === anio).reduce((s, p) => s + (p.monto || 0), 0).toLocaleString('es-AR')}`, color: S.green },
                { label: 'Total histórico', val: `$${pagosSel.reduce((s, p) => s + (p.monto || 0), 0).toLocaleString('es-AR')}` },
              ].map((m, i) => (
                <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.85rem' }}>
                  <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: m.color || S.text }}>{m.val}</div>
                </div>
              ))}
            </div>
          )}

          {showFormPago && (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo pago</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div><Label>Empleado</Label>
                  <select value={formPago.empleado_id} onChange={e => setFormPago({...formPago, empleado_id: e.target.value})} style={inputStyle}>
                    <option value="">— Seleccioná —</option>
                    {empleados.filter(e => e.activo).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div><Label>Tipo</Label>
                  <select value={formPago.tipo} onChange={e => setFormPago({...formPago, tipo: e.target.value})} style={inputStyle}>
                    {TIPOS_PAGO.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><Label>Fecha</Label><input type="date" value={formPago.fecha} onChange={e => setFormPago({...formPago, fecha: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: '1/-1' }}><Label>Concepto</Label><input type="text" value={formPago.concepto} onChange={e => setFormPago({...formPago, concepto: e.target.value})} placeholder="ej. Sueldo abril, % cosecha..." style={inputStyle} /></div>
              </div>

              {/* Formas de pago */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Label>Formas de pago</Label>
                <button onClick={() => setPagosForm([...pagosForm, { ...PAGO_INIT_P }])}
                  style={{ padding: '4px 10px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>+ Agregar</button>
              </div>
              {pagosForm.map((p, pi) => (
                <div key={pi} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.75rem', marginBottom: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                    <div><Label>Forma de pago</Label>
                      <select value={p.tipo} onChange={e => { const pf = pagosForm.map((x,i) => i===pi ? {...x, tipo: e.target.value} : x); setPagosForm(pf) }} style={inputStyle}>
                        {['transferencia','efectivo','cheque_propio','cheque_tercero'].map(t => (
                          <option key={t} value={t}>{t === 'cheque_propio' ? 'E-cheq propio' : t === 'cheque_tercero' ? 'Cheque tercero' : t.charAt(0).toUpperCase()+t.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div><Label>Monto $</Label>
                      <input type="number" value={p.monto} onChange={e => { const pf = pagosForm.map((x,i) => i===pi ? {...x, monto: e.target.value} : x); setPagosForm(pf) }} style={inputStyle} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', marginBottom: 2 }}>
                      <input type="checkbox" checked={p.es_paralelo} onChange={e => { const pf = pagosForm.map((x,i) => i===pi ? {...x, es_paralelo: e.target.checked} : x); setPagosForm(pf) }} />
                      Paralelo
                    </label>
                  </div>
                  {p.tipo === 'cheque_propio' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                      <div><Label>N° Cheque</Label><input type="text" value={p.cheque_propio?.numero || ''} onChange={e => { const pf = pagosForm.map((x,i) => i===pi ? {...x, cheque_propio: {...x.cheque_propio, numero: e.target.value}} : x); setPagosForm(pf) }} style={inputStyle} /></div>
                      <div><Label>Banco</Label><input type="text" value={p.cheque_propio?.banco || ''} onChange={e => { const pf = pagosForm.map((x,i) => i===pi ? {...x, cheque_propio: {...x.cheque_propio, banco: e.target.value}} : x); setPagosForm(pf) }} style={inputStyle} /></div>
                      <div><Label>Vencimiento</Label><input type="date" value={p.cheque_propio?.fecha_vencimiento || ''} onChange={e => { const pf = pagosForm.map((x,i) => i===pi ? {...x, cheque_propio: {...x.cheque_propio, fecha_vencimiento: e.target.value}} : x); setPagosForm(pf) }} style={inputStyle} /></div>
                    </div>
                  )}
                </div>
              ))}
              <div style={{ padding: '8px 12px', background: S.greenLight, borderRadius: 6, fontSize: 13, color: S.green, fontWeight: 600, marginTop: 8, marginBottom: 12 }}>
                Total: ${pagosForm.reduce((a, p) => a + (parseFloat(p.monto) || 0), 0).toLocaleString('es-AR')}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowFormPago(false); setPagosForm([{ ...PAGO_INIT_P }]) }} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarPago} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar pago'}</button>
              </div>
            </Card>
          )}

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha','Empleado','Tipo','Concepto','Monto',''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {pagosSel.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay pagos registrados.</td></tr>}
                  {pagosSel.map(p => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(p.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{p.empleados?.nombre}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.accentLight, color: S.accent }}>{p.tipo}</span></td>
                      <td style={{ padding: '9px 12px', color: S.muted }}>{p.concepto || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.green }}>${p.monto?.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => {
                            const win = window.open('', '_blank')
                            const nroRecibo = String(p.id).padStart(6, '0')
                            const copiaHtml = (etiqueta) => `
                              <div class="copia">
                                <div class="etiqueta">${etiqueta}</div>
                                <h2>Recibo de Pago — Ramonda Hnos S.A.</h2>
                                <p>Recibo N° ${nroRecibo} · Emitido el ${new Date().toLocaleDateString('es-AR')}</p>
                                <div class="box">
                                  <div class="row"><span class="label">Empleado</span><span class="val">${p.empleados?.nombre || '—'}</span></div>
                                  <div class="row"><span class="label">Fecha de pago</span><span class="val">${new Date(p.fecha).toLocaleDateString('es-AR')}</span></div>
                                  <div class="row"><span class="label">Tipo</span><span class="val">${p.tipo}</span></div>
                                  <div class="row"><span class="label">Concepto</span><span class="val">${p.concepto || '—'}</span></div>
                                </div>
                                <div class="montobox">
                                  <div style="color:#6B6760;font-size:11px;margin-bottom:3px">TOTAL ABONADO</div>
                                  <div class="monto">$${p.monto?.toLocaleString('es-AR')}</div>
                                </div>
                                <div class="firma">
                                  <div class="firma-line">Firma empleado</div>
                                  <div class="firma-line">Firma empleador</div>
                                </div>
                              </div>`
                            win.document.write(`<!DOCTYPE html><html><head><title>Recibo de Pago</title><style>
                              @page{size:A4;margin:10mm} body{font-family:'IBM Plex Sans',sans-serif;margin:0;font-size:12px}
                              .hoja{display:flex;flex-direction:column;height:277mm}
                              .copia{flex:1;padding:14px 28px;box-sizing:border-box;position:relative}
                              .copia:first-child{border-bottom:2px dashed #999}
                              .etiqueta{position:absolute;top:8px;right:20px;font-size:10px;color:#6B6760;text-transform:uppercase;letter-spacing:.05em;border:1px solid #999;border-radius:4px;padding:2px 8px}
                              h2{margin:0 0 2px;font-size:15px} p{color:#6B6760;font-size:11px;margin-bottom:10px}
                              .box{border:1px solid #E2DDD6;border-radius:8px;padding:10px;margin-bottom:10px}
                              .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:12px}
                              .row:last-child{border-bottom:none} .label{color:#6B6760} .val{font-weight:600}
                              .montobox{text-align:center;padding:10px;border:2px solid #1E5C2E;border-radius:8px;margin-bottom:14px}
                              .monto{font-size:18px;font-weight:700;color:#1E5C2E;font-family:monospace}
                              .firma{display:flex;gap:40px;margin-top:14px}
                              .firma-line{flex:1;border-top:1px solid #ccc;padding-top:6px;font-size:10px;color:#9E9A94}
                              .no-print{text-align:center;margin-top:12px} @media print{.no-print{display:none}}
                            </style></head><body>
                              <div class="hoja">
                                ${copiaHtml('Copia — ' + (p.empleados?.nombre || 'empleado'))}
                                ${copiaHtml('Copia — Ramonda Hnos S.A.')}
                              </div>
                              <div class="no-print"><button onclick="window.print()" style="padding:8px 16px;background:#1A3D6B;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir recibo</button></div>
                            </body></html>`)
                            win.document.close()
                          }} style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>🖨 Recibo</button>
                          <button onClick={() => eliminarPago(p.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
