import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './Tablero'

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
  const [showFormEmp, setShowFormEmp] = useState(false)
  const [showFormPago, setShowFormPago] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const [formEmp, setFormEmp] = useState({ nombre: '', rol: '', sueldo_base: '' })
  const [formPago, setFormPago] = useState({
    empleado_id: '', fecha: new Date().toISOString().split('T')[0],
    monto: '', concepto: '', tipo: 'sueldo'
  })

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

  async function guardarEmpleado() {
    if (!formEmp.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    await supabase.from('empleados').insert({ ...formEmp, sueldo_base: formEmp.sueldo_base ? parseFloat(formEmp.sueldo_base) : null, activo: true })
    await cargar()
    setShowFormEmp(false)
    setFormEmp({ nombre: '', rol: '', sueldo_base: '' })
    setGuardando(false)
  }

  async function guardarPago() {
    if (!formPago.empleado_id || !formPago.monto) { alert('Completá empleado y monto'); return }
    setGuardando(true)
    await supabase.from('pagos_empleados').insert({ ...formPago, monto: parseFloat(formPago.monto), empleado_id: parseInt(formPago.empleado_id), registrado_por: usuario?.id })
    await cargar()
    setShowFormPago(false)
    setFormPago({ empleado_id: '', fecha: new Date().toISOString().split('T')[0], monto: '', concepto: '', tipo: 'sueldo' })
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
              <div key={e.id} onClick={() => setEmpleadoSelId(String(e.id))}
                style={{ border: `1px solid ${isSel ? S.accent : S.border}`, borderRadius: 8, padding: '.75rem', marginBottom: 6, cursor: 'pointer', background: isSel ? S.accentLight : e.activo ? S.surface : S.bg, opacity: e.activo ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.nombre}</div>
                  <span style={{ fontSize: 10, color: e.activo ? S.green : S.hint }}>{e.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
                <div style={{ fontSize: 11, color: S.muted }}>{e.rol || '—'}</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: S.muted }}>Base: ${e.sueldo_base?.toLocaleString('es-AR') || '—'}</span>
                  <span style={{ color: S.green }}>${totalEmp.toLocaleString('es-AR')} {anio}</span>
                </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
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
                <div><Label>Monto $</Label><input type="number" value={formPago.monto} onChange={e => setFormPago({...formPago, monto: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: '2/-1' }}><Label>Concepto</Label><input type="text" value={formPago.concepto} onChange={e => setFormPago({...formPago, concepto: e.target.value})} placeholder="ej. Sueldo abril, % cosecha..." style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormPago(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarPago} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
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
                      <td style={{ padding: '9px 12px' }}><button onClick={() => eliminarPago(p.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
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
