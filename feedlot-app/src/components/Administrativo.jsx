import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './Tablero'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', borderStrong: '#C8C2B8',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

const inputStyle = {
  width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`,
  borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box',
  fontFamily: "'IBM Plex Sans', sans-serif", color: S.text,
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</div>
}

function Card({ children, style = {} }) {
  return <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>{children}</div>
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>{children}</div>
}

const CATEGORIAS_GASTO_CAMPANA = ['Semilla', 'Fertilizante', 'Herbicida', 'Fungicida', 'Insecticida', 'Laboreo', 'Siembra', 'Cosecha', 'Flete', 'Seguro', 'Otro']
const CATEGORIAS_GASTO_GENERAL = ['Combustible', 'Electricidad', 'Impuestos', 'Reparaciones', 'Seguros', 'Honorarios', 'Veterinario', 'Comunicaciones', 'Rodados', 'Otro']
const CULTIVOS = ['Soja', 'Maiz', 'Trigo', 'Alfalfa', 'Girasol', 'Sorgo', 'Otro']
const LABORES = ['Siembra', 'Cosecha', 'Pulverización', 'Fertilización', 'Roturación', 'Rastreo', 'Transporte', 'Otro']

export default function Administrativo({ usuario }) {
  const [tab, setTab] = useState('personal')
  const [loading, setLoading] = useState(true)

  // Personal
  const [empleados, setEmpleados] = useState([])
  const [pagos, setPagos] = useState([])
  const [showFormPago, setShowFormPago] = useState(false)
  const [formPago, setFormPago] = useState({ empleado_id: '', fecha: new Date().toISOString().split('T')[0], monto: '', concepto: '', tipo: 'sueldo' })

  // Agricultura
  const [potreros, setPotreros] = useState([])
  const [campanas, setCampanas] = useState([])
  const [gastosCampana, setGastosCampana] = useState([])
  const [ventasGrano, setVentasGrano] = useState([])
  const [campanaSelId, setCampanaSelId] = useState('')
  const [showFormCampana, setShowFormCampana] = useState(false)
  const [showFormGastoCampana, setShowFormGastoCampana] = useState(false)
  const [showFormVentaGrano, setShowFormVentaGrano] = useState(false)
  const [formCampana, setFormCampana] = useState({ potrero_id: '', cultivo: 'Soja', anio: new Date().getFullYear(), fecha_siembra: '', observaciones: '' })
  const [formGastoCampana, setFormGastoCampana] = useState({ campana_id: '', categoria: 'Semilla', descripcion: '', monto: '', fecha: new Date().toISOString().split('T')[0], proveedor: '' })
  const [formVentaGrano, setFormVentaGrano] = useState({ campana_id: '', cultivo: '', kg: '', precio_kg: '', comprador: '', fecha: new Date().toISOString().split('T')[0], destino: 'venta', observaciones: '' })

  // Maquinaria
  const [maquinaria, setMaquinaria] = useState([])
  const [trabajos, setTrabajos] = useState([])
  const [showFormTrabajo, setShowFormTrabajo] = useState(false)
  const [formTrabajo, setFormTrabajo] = useState({ maquina_id: '', potrero_id: '', labor: 'Siembra', fecha: new Date().toISOString().split('T')[0], horas: '', litros_combustible: '', costo_combustible: '', contratista: false, costo_contratista: '', observaciones: '' })

  // Gastos generales
  const [gastosGenerales, setGastosGenerales] = useState([])
  const [showFormGasto, setShowFormGasto] = useState(false)
  const [formGasto, setFormGasto] = useState({ categoria: 'Combustible', descripcion: '', monto: '', fecha: new Date().toISOString().split('T')[0], proveedor: '', comprobante: '' })

  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [
      { data: emp }, { data: pag }, { data: pot }, { data: cam },
      { data: gc }, { data: vg }, { data: maq }, { data: trab }, { data: gg }
    ] = await Promise.all([
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
      supabase.from('pagos_empleados').select('*, empleados(nombre)').order('fecha', { ascending: false }).limit(50),
      supabase.from('potreros').select('*').eq('activo', true).order('nombre'),
      supabase.from('campanas').select('*, potreros(nombre)').order('anio', { ascending: false }),
      supabase.from('gastos_campana').select('*, campanas(cultivo, anio, potreros(nombre))').order('fecha', { ascending: false }).limit(100),
      supabase.from('ventas_grano').select('*, campanas(cultivo, anio, potreros(nombre))').order('fecha', { ascending: false }),
      supabase.from('maquinaria').select('*').eq('activo', true).order('nombre'),
      supabase.from('trabajos_maquinaria').select('*, maquinaria(nombre), potreros(nombre)').order('fecha', { ascending: false }).limit(50),
      supabase.from('gastos_generales').select('*').order('fecha', { ascending: false }).limit(100),
    ])
    setEmpleados(emp || [])
    setPagos(pag || [])
    setPotreros(pot || [])
    setCampanas(cam || [])
    setGastosCampana(gc || [])
    setVentasGrano(vg || [])
    setMaquinaria(maq || [])
    setTrabajos(trab || [])
    setGastosGenerales(gg || [])
    setLoading(false)
  }

  // ── PERSONAL ──
  async function guardarPago() {
    if (!formPago.empleado_id || !formPago.monto) { alert('Completá empleado y monto'); return }
    setGuardando(true)
    await supabase.from('pagos_empleados').insert({ ...formPago, monto: parseFloat(formPago.monto), registrado_por: usuario?.id })
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

  // ── AGRICULTURA ──
  async function guardarCampana() {
    if (!formCampana.potrero_id || !formCampana.cultivo) { alert('Completá potrero y cultivo'); return }
    setGuardando(true)
    await supabase.from('campanas').insert({ ...formCampana, potrero_id: parseInt(formCampana.potrero_id) })
    await cargar()
    setShowFormCampana(false)
    setFormCampana({ potrero_id: '', cultivo: 'Soja', anio: new Date().getFullYear(), fecha_siembra: '', observaciones: '' })
    setGuardando(false)
  }

  async function guardarGastoCampana() {
    if (!formGastoCampana.campana_id || !formGastoCampana.monto) { alert('Completá campaña y monto'); return }
    setGuardando(true)
    await supabase.from('gastos_campana').insert({ ...formGastoCampana, campana_id: parseInt(formGastoCampana.campana_id), monto: parseFloat(formGastoCampana.monto), registrado_por: usuario?.id })
    await cargar()
    setShowFormGastoCampana(false)
    setFormGastoCampana({ campana_id: '', categoria: 'Semilla', descripcion: '', monto: '', fecha: new Date().toISOString().split('T')[0], proveedor: '' })
    setGuardando(false)
  }

  async function guardarVentaGrano() {
    if (!formVentaGrano.campana_id || !formVentaGrano.kg) { alert('Completá campaña y kg'); return }
    setGuardando(true)
    const total = formVentaGrano.kg && formVentaGrano.precio_kg ? parseFloat(formVentaGrano.kg) * parseFloat(formVentaGrano.precio_kg) : null
    await supabase.from('ventas_grano').insert({ ...formVentaGrano, campana_id: parseInt(formVentaGrano.campana_id), kg: parseFloat(formVentaGrano.kg), precio_kg: formVentaGrano.precio_kg ? parseFloat(formVentaGrano.precio_kg) : null, total, registrado_por: usuario?.id })
    await cargar()
    setShowFormVentaGrano(false)
    setFormVentaGrano({ campana_id: '', cultivo: '', kg: '', precio_kg: '', comprador: '', fecha: new Date().toISOString().split('T')[0], destino: 'venta', observaciones: '' })
    setGuardando(false)
  }

  async function cerrarCampana(id, kgCosechados) {
    const kg = prompt('¿Cuántos kg se cosecharon?', kgCosechados || '')
    if (kg === null) return
    await supabase.from('campanas').update({ estado: 'cerrada', fecha_cosecha: new Date().toISOString().split('T')[0], kg_cosechados: parseFloat(kg) || null }).eq('id', id)
    await cargar()
  }

  // ── MAQUINARIA ──
  async function guardarTrabajo() {
    if (!formTrabajo.maquina_id || !formTrabajo.labor) { alert('Completá máquina y labor'); return }
    setGuardando(true)
    await supabase.from('trabajos_maquinaria').insert({
      ...formTrabajo,
      maquina_id: parseInt(formTrabajo.maquina_id),
      potrero_id: formTrabajo.potrero_id ? parseInt(formTrabajo.potrero_id) : null,
      horas: formTrabajo.horas ? parseFloat(formTrabajo.horas) : null,
      litros_combustible: formTrabajo.litros_combustible ? parseFloat(formTrabajo.litros_combustible) : null,
      costo_combustible: formTrabajo.costo_combustible ? parseFloat(formTrabajo.costo_combustible) : null,
      costo_contratista: formTrabajo.costo_contratista ? parseFloat(formTrabajo.costo_contratista) : null,
      registrado_por: usuario?.id,
    })
    await cargar()
    setShowFormTrabajo(false)
    setFormTrabajo({ maquina_id: '', potrero_id: '', labor: 'Siembra', fecha: new Date().toISOString().split('T')[0], horas: '', litros_combustible: '', costo_combustible: '', contratista: false, costo_contratista: '', observaciones: '' })
    setGuardando(false)
  }

  // ── GASTOS GENERALES ──
  async function guardarGasto() {
    if (!formGasto.categoria || !formGasto.monto) { alert('Completá categoría y monto'); return }
    setGuardando(true)
    await supabase.from('gastos_generales').insert({ ...formGasto, monto: parseFloat(formGasto.monto), registrado_por: usuario?.id })
    await cargar()
    setShowFormGasto(false)
    setFormGasto({ categoria: 'Combustible', descripcion: '', monto: '', fecha: new Date().toISOString().split('T')[0], proveedor: '', comprobante: '' })
    setGuardando(false)
  }

  async function eliminarGasto(tabla, id) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from(tabla).delete().eq('id', id)
    await cargar()
  }

  if (loading) return <Loader />

  const campanaSeleccionada = campanas.find(c => String(c.id) === String(campanaSelId))
  const gastosCampanaSel = gastosCampana.filter(g => String(g.campana_id) === String(campanaSelId))
  const ventasGranoSel = ventasGrano.filter(v => String(v.campana_id) === String(campanaSelId))
  const totalGastosCampana = gastosCampanaSel.reduce((s, g) => s + (g.monto || 0), 0)
  const totalVentasGranoSel = ventasGranoSel.reduce((s, v) => s + (v.total || 0), 0)
  const margenCampana = totalVentasGranoSel - totalGastosCampana

  const totalPagosAnio = pagos.filter(p => new Date(p.fecha).getFullYear() === new Date().getFullYear()).reduce((s, p) => s + (p.monto || 0), 0)
  const totalGastosGeneralesAnio = gastosGenerales.filter(g => new Date(g.fecha).getFullYear() === new Date().getFullYear()).reduce((s, g) => s + (g.monto || 0), 0)

  const TABS = [
    { key: 'personal', label: 'Personal' },
    { key: 'agricultura', label: 'Agricultura' },
    { key: 'maquinaria', label: 'Maquinaria' },
    { key: 'gastos', label: 'Gastos generales' },
  ]

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Administración</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Personal · Agricultura · Maquinaria · Gastos · {new Date().getFullYear()}
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PERSONAL ── */}
      {tab === 'personal' && (
        <div>
          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
            <Card style={{ margin: 0 }}>
              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 5 }}>Empleados activos</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}>{empleados.length}</div>
            </Card>
            <Card style={{ margin: 0 }}>
              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 5 }}>Pagado este año</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${totalPagosAnio.toLocaleString('es-AR')}</div>
            </Card>
            <Card style={{ margin: 0 }}>
              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 5 }}>Sueldos base mensuales</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}>${empleados.reduce((s, e) => s + (e.sueldo_base || 0), 0).toLocaleString('es-AR')}</div>
            </Card>
          </div>

          {/* Empleados */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <SectionTitle>Empleados</SectionTitle>
              <button onClick={() => setShowFormPago(!showFormPago)}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                + Registrar pago
              </button>
            </div>

            {showFormPago && (
              <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                  <div>
                    <Label>Empleado</Label>
                    <select value={formPago.empleado_id} onChange={e => setFormPago({...formPago, empleado_id: e.target.value})} style={inputStyle}>
                      <option value="">— Seleccioná —</option>
                      {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <select value={formPago.tipo} onChange={e => setFormPago({...formPago, tipo: e.target.value})} style={inputStyle}>
                      {['sueldo', 'jornal', 'bonificacion', 'adelanto', 'otro'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Fecha</Label>
                    <input type="date" value={formPago.fecha} onChange={e => setFormPago({...formPago, fecha: e.target.value})} style={inputStyle} />
                  </div>
                  <div>
                    <Label>Monto $</Label>
                    <input type="number" placeholder="ej. 500000" value={formPago.monto} onChange={e => setFormPago({...formPago, monto: e.target.value})} style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '2/-1' }}>
                    <Label>Concepto (opcional)</Label>
                    <input type="text" placeholder="ej. Sueldo abril, % cosecha..." value={formPago.concepto} onChange={e => setFormPago({...formPago, concepto: e.target.value})} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowFormPago(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={guardarPago} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                    {guardando ? 'Guardando...' : 'Guardar pago'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
              {empleados.map(e => {
                const pagosEmp = pagos.filter(p => p.empleado_id === e.id)
                const totalPagado = pagosEmp.reduce((s, p) => s + (p.monto || 0), 0)
                return (
                  <div key={e.id} style={{ border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{e.nombre}</div>
                        <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>{e.rol}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: S.muted }}>Sueldo base</div>
                        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace' }}>${e.sueldo_base?.toLocaleString('es-AR')}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: S.muted }}>{pagosEmp.length} pagos registrados</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: S.green }}>${totalPagado.toLocaleString('es-AR')} total</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Historial de pagos */}
          <Card>
            <SectionTitle>Historial de pagos</SectionTitle>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Fecha', 'Empleado', 'Tipo', 'Concepto', 'Monto', ''].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagos.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay pagos registrados.</td></tr>}
                  {pagos.map(p => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(p.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{p.empleados?.nombre}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.accentLight, color: S.accent }}>{p.tipo}</span></td>
                      <td style={{ padding: '9px 12px', color: S.muted }}>{p.concepto || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.green }}>${p.monto?.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <button onClick={() => eliminarPago(p.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── AGRICULTURA ── */}
      {tab === 'agricultura' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Agricultura</div>
              <div style={{ fontSize: 12, color: S.muted }}>Campañas · gastos · ventas de grano</div>
            </div>
            <button onClick={() => setShowFormCampana(!showFormCampana)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Nueva campaña
            </button>
          </div>

          {showFormCampana && (
            <Card>
              <SectionTitle>Nueva campaña</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div>
                  <Label>Potrero</Label>
                  <select value={formCampana.potrero_id} onChange={e => setFormCampana({...formCampana, potrero_id: e.target.value})} style={inputStyle}>
                    <option value="">— Seleccioná —</option>
                    {potreros.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.hectareas} ha)</option>)}
                  </select>
                </div>
                <div>
                  <Label>Cultivo</Label>
                  <select value={formCampana.cultivo} onChange={e => setFormCampana({...formCampana, cultivo: e.target.value})} style={inputStyle}>
                    {CULTIVOS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Año</Label>
                  <input type="number" value={formCampana.anio} onChange={e => setFormCampana({...formCampana, anio: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <Label>Fecha siembra</Label>
                  <input type="date" value={formCampana.fecha_siembra} onChange={e => setFormCampana({...formCampana, fecha_siembra: e.target.value})} style={inputStyle} />
                </div>
                <div style={{ gridColumn: '2/-1' }}>
                  <Label>Observaciones</Label>
                  <input type="text" value={formCampana.observaciones} onChange={e => setFormCampana({...formCampana, observaciones: e.target.value})} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormCampana(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarCampana} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                  {guardando ? 'Guardando...' : 'Crear campaña'}
                </button>
              </div>
            </Card>
          )}

          {/* Lista de campañas */}
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1rem' }}>
            <div>
              <SectionTitle style={{ padding: '0 0 .5rem' }}>Campañas</SectionTitle>
              {campanas.length === 0 && <div style={{ fontSize: 13, color: S.hint, padding: '1rem 0' }}>No hay campañas registradas.</div>}
              {campanas.map(c => {
                const gastosTot = gastosCampana.filter(g => g.campana_id === c.id).reduce((s, g) => s + (g.monto || 0), 0)
                const ventasTot = ventasGrano.filter(v => v.campana_id === c.id).reduce((s, v) => s + (v.total || 0), 0)
                const isSel = String(c.id) === String(campanaSelId)
                return (
                  <div key={c.id} onClick={() => setCampanaSelId(String(c.id))}
                    style={{ border: `1px solid ${isSel ? S.accent : S.border}`, borderRadius: 8, padding: '.85rem', marginBottom: 8, cursor: 'pointer', background: isSel ? S.accentLight : S.surface }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.cultivo} {c.anio}</div>
                      <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: c.estado === 'cerrada' ? S.greenLight : S.amberLight, color: c.estado === 'cerrada' ? S.green : S.amber }}>{c.estado}</span>
                    </div>
                    <div style={{ fontSize: 12, color: S.muted }}>{c.potreros?.nombre}</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: S.red }}>Gastos: ${gastosTot.toLocaleString('es-AR')}</span>
                      <span style={{ color: S.green }}>Ventas: ${ventasTot.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Detalle de campaña seleccionada */}
            <div>
              {!campanaSeleccionada ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>Seleccioná una campaña para ver el detalle.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{campanaSeleccionada.cultivo} {campanaSeleccionada.anio} · {campanaSeleccionada.potreros?.nombre}</div>
                      <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                        {campanaSeleccionada.kg_cosechados ? `${campanaSeleccionada.kg_cosechados.toLocaleString('es-AR')} kg cosechados` : 'Sin cosecha registrada'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {campanaSeleccionada.estado !== 'cerrada' && (
                        <button onClick={() => cerrarCampana(campanaSeleccionada.id, campanaSeleccionada.kg_cosechados)}
                          style={{ padding: '6px 12px', fontSize: 12, background: S.greenLight, border: `1px solid #97C459`, color: S.green, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600 }}>
                          Cerrar campaña
                        </button>
                      )}
                      <button onClick={() => { setFormGastoCampana({...formGastoCampana, campana_id: campanaSelId}); setShowFormGastoCampana(true) }}
                        style={{ padding: '6px 12px', fontSize: 12, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600 }}>
                        + Gasto
                      </button>
                      <button onClick={() => { setFormVentaGrano({...formVentaGrano, campana_id: campanaSelId, cultivo: campanaSeleccionada.cultivo}); setShowFormVentaGrano(true) }}
                        style={{ padding: '6px 12px', fontSize: 12, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600 }}>
                        + Venta grano
                      </button>
                    </div>
                  </div>

                  {/* Resumen económico */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1rem' }}>
                    {[
                      { label: 'Total gastos', val: `$${totalGastosCampana.toLocaleString('es-AR')}`, color: S.red },
                      { label: 'Total ventas', val: `$${totalVentasGranoSel.toLocaleString('es-AR')}`, color: S.green },
                      { label: 'Margen bruto', val: `$${margenCampana.toLocaleString('es-AR')}`, color: margenCampana >= 0 ? S.green : S.red },
                    ].map((m, i) => (
                      <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.85rem' }}>
                        <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: m.color }}>{m.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Form gasto campaña */}
                  {showFormGastoCampana && (
                    <Card>
                      <SectionTitle>Nuevo gasto</SectionTitle>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                        <div>
                          <Label>Categoría</Label>
                          <select value={formGastoCampana.categoria} onChange={e => setFormGastoCampana({...formGastoCampana, categoria: e.target.value})} style={inputStyle}>
                            {CATEGORIAS_GASTO_CAMPANA.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label>Monto $</Label>
                          <input type="number" value={formGastoCampana.monto} onChange={e => setFormGastoCampana({...formGastoCampana, monto: e.target.value})} style={inputStyle} />
                        </div>
                        <div>
                          <Label>Fecha</Label>
                          <input type="date" value={formGastoCampana.fecha} onChange={e => setFormGastoCampana({...formGastoCampana, fecha: e.target.value})} style={inputStyle} />
                        </div>
                        <div>
                          <Label>Descripción</Label>
                          <input type="text" value={formGastoCampana.descripcion} onChange={e => setFormGastoCampana({...formGastoCampana, descripcion: e.target.value})} style={inputStyle} />
                        </div>
                        <div>
                          <Label>Proveedor</Label>
                          <input type="text" value={formGastoCampana.proveedor} onChange={e => setFormGastoCampana({...formGastoCampana, proveedor: e.target.value})} style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowFormGastoCampana(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={guardarGastoCampana} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                          {guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </Card>
                  )}

                  {/* Form venta grano */}
                  {showFormVentaGrano && (
                    <Card>
                      <SectionTitle>Nueva venta de grano</SectionTitle>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                        <div>
                          <Label>Kg</Label>
                          <input type="number" value={formVentaGrano.kg} onChange={e => setFormVentaGrano({...formVentaGrano, kg: e.target.value})} style={inputStyle} />
                        </div>
                        <div>
                          <Label>Precio $/kg</Label>
                          <input type="number" value={formVentaGrano.precio_kg} onChange={e => setFormVentaGrano({...formVentaGrano, precio_kg: e.target.value})} style={inputStyle} />
                        </div>
                        <div>
                          <Label>Fecha</Label>
                          <input type="date" value={formVentaGrano.fecha} onChange={e => setFormVentaGrano({...formVentaGrano, fecha: e.target.value})} style={inputStyle} />
                        </div>
                        <div>
                          <Label>Destino</Label>
                          <select value={formVentaGrano.destino} onChange={e => setFormVentaGrano({...formVentaGrano, destino: e.target.value})} style={inputStyle}>
                            <option value="venta">Venta</option>
                            <option value="feedlot">Uso feedlot</option>
                            <option value="acopio">Acopio</option>
                          </select>
                        </div>
                        <div>
                          <Label>Comprador</Label>
                          <input type="text" value={formVentaGrano.comprador} onChange={e => setFormVentaGrano({...formVentaGrano, comprador: e.target.value})} style={inputStyle} />
                        </div>
                        <div>
                          <Label>Observaciones</Label>
                          <input type="text" value={formVentaGrano.observaciones} onChange={e => setFormVentaGrano({...formVentaGrano, observaciones: e.target.value})} style={inputStyle} />
                        </div>
                      </div>
                      {formVentaGrano.kg && formVentaGrano.precio_kg && (
                        <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: S.green }}>
                          Total: <strong>${(parseFloat(formVentaGrano.kg) * parseFloat(formVentaGrano.precio_kg)).toLocaleString('es-AR')}</strong>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowFormVentaGrano(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={guardarVentaGrano} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                          {guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </Card>
                  )}

                  {/* Gastos de la campaña */}
                  <Card>
                    <SectionTitle>Gastos</SectionTitle>
                    <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: S.bg }}>
                            {['Fecha', 'Categoría', 'Descripción', 'Proveedor', 'Monto', ''].map(h => (
                              <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {gastosCampanaSel.length === 0 && <tr><td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: S.hint }}>Sin gastos registrados.</td></tr>}
                          {gastosCampanaSel.map(g => (
                            <tr key={g.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                              <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(g.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</td>
                              <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.amberLight, color: S.amber }}>{g.categoria}</span></td>
                              <td style={{ padding: '9px 12px', color: S.muted }}>{g.descripcion || '—'}</td>
                              <td style={{ padding: '9px 12px', color: S.muted }}>{g.proveedor || '—'}</td>
                              <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>${g.monto?.toLocaleString('es-AR')}</td>
                              <td style={{ padding: '9px 12px' }}><button onClick={() => eliminarGasto('gastos_campana', g.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Ventas de grano */}
                  <Card>
                    <SectionTitle>Ventas / destino de grano</SectionTitle>
                    <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: S.bg }}>
                            {['Fecha', 'Destino', 'Kg', 'Precio/kg', 'Total', 'Comprador', ''].map(h => (
                              <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ventasGranoSel.length === 0 && <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: S.hint }}>Sin ventas registradas.</td></tr>}
                          {ventasGranoSel.map(v => (
                            <tr key={v.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                              <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(v.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</td>
                              <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: v.destino === 'feedlot' ? S.accentLight : S.greenLight, color: v.destino === 'feedlot' ? S.accent : S.green }}>{v.destino}</span></td>
                              <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.kg?.toLocaleString('es-AR')} kg</td>
                              <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.precio_kg ? `$${v.precio_kg.toLocaleString('es-AR')}` : '—'}</td>
                              <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.green }}>{v.total ? `$${v.total.toLocaleString('es-AR')}` : '—'}</td>
                              <td style={{ padding: '9px 12px', color: S.muted }}>{v.comprador || '—'}</td>
                              <td style={{ padding: '9px 12px' }}><button onClick={() => eliminarGasto('ventas_grano', v.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MAQUINARIA ── */}
      {tab === 'maquinaria' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Maquinaria</div>
              <div style={{ fontSize: 12, color: S.muted }}>{maquinaria.length} máquinas registradas</div>
            </div>
            <button onClick={() => setShowFormTrabajo(!showFormTrabajo)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Registrar trabajo
            </button>
          </div>

          {/* Máquinas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
            {maquinaria.map(m => {
              const trabsMaq = trabajos.filter(t => t.maquina_id === m.id)
              const horasTotal = trabsMaq.reduce((s, t) => s + (t.horas || 0), 0)
              return (
                <div key={m.id} style={{ border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', background: S.surface }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{m.nombre}</div>
                  <div style={{ fontSize: 12, color: S.muted }}>{m.tipo} · {m.anio}</div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${S.border}`, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: S.muted }}>{trabsMaq.length} trabajos</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{horasTotal.toFixed(1)} hs</span>
                  </div>
                </div>
              )
            })}
          </div>

          {showFormTrabajo && (
            <Card>
              <SectionTitle>Nuevo trabajo</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div>
                  <Label>Máquina</Label>
                  <select value={formTrabajo.maquina_id} onChange={e => setFormTrabajo({...formTrabajo, maquina_id: e.target.value})} style={inputStyle}>
                    <option value="">— Seleccioná —</option>
                    {maquinaria.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Labor</Label>
                  <select value={formTrabajo.labor} onChange={e => setFormTrabajo({...formTrabajo, labor: e.target.value})} style={inputStyle}>
                    {LABORES.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Fecha</Label>
                  <input type="date" value={formTrabajo.fecha} onChange={e => setFormTrabajo({...formTrabajo, fecha: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <Label>Potrero</Label>
                  <select value={formTrabajo.potrero_id} onChange={e => setFormTrabajo({...formTrabajo, potrero_id: e.target.value})} style={inputStyle}>
                    <option value="">— Opcional —</option>
                    {potreros.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Horas trabajadas</Label>
                  <input type="number" value={formTrabajo.horas} onChange={e => setFormTrabajo({...formTrabajo, horas: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <Label>Litros combustible</Label>
                  <input type="number" value={formTrabajo.litros_combustible} onChange={e => setFormTrabajo({...formTrabajo, litros_combustible: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <Label>Costo combustible $</Label>
                  <input type="number" value={formTrabajo.costo_combustible} onChange={e => setFormTrabajo({...formTrabajo, costo_combustible: e.target.value})} style={inputStyle} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                  <input type="checkbox" checked={formTrabajo.contratista} onChange={e => setFormTrabajo({...formTrabajo, contratista: e.target.checked})} id="contratista" />
                  <label htmlFor="contratista" style={{ fontSize: 13, cursor: 'pointer' }}>Es contratista externo</label>
                </div>
                {formTrabajo.contratista && (
                  <div>
                    <Label>Costo contratista $</Label>
                    <input type="number" value={formTrabajo.costo_contratista} onChange={e => setFormTrabajo({...formTrabajo, costo_contratista: e.target.value})} style={inputStyle} />
                  </div>
                )}
                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Observaciones</Label>
                  <input type="text" value={formTrabajo.observaciones} onChange={e => setFormTrabajo({...formTrabajo, observaciones: e.target.value})} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormTrabajo(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarTrabajo} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle>Historial de trabajos</SectionTitle>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Fecha', 'Máquina', 'Labor', 'Potrero', 'Horas', 'Litros', 'Costo', ''].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trabajos.length === 0 && <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay trabajos registrados.</td></tr>}
                  {trabajos.map(t => (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(t.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{t.maquinaria?.nombre}</td>
                      <td style={{ padding: '9px 12px' }}>{t.labor}</td>
                      <td style={{ padding: '9px 12px', color: S.muted }}>{t.potreros?.nombre || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{t.horas ? `${t.horas}h` : '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{t.litros_combustible ? `${t.litros_combustible}L` : '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.red }}>
                        {(t.costo_combustible || t.costo_contratista) ? `$${((t.costo_combustible || 0) + (t.costo_contratista || 0)).toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td style={{ padding: '9px 12px' }}><button onClick={() => eliminarGasto('trabajos_maquinaria', t.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── GASTOS GENERALES ── */}
      {tab === 'gastos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Gastos generales</div>
              <div style={{ fontSize: 12, color: S.muted }}>Total este año: <strong style={{ color: S.red }}>${totalGastosGeneralesAnio.toLocaleString('es-AR')}</strong></div>
            </div>
            <button onClick={() => setShowFormGasto(!showFormGasto)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Registrar gasto
            </button>
          </div>

          {/* Resumen por categoría */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
            {CATEGORIAS_GASTO_GENERAL.slice(0, 8).map(cat => {
              const total = gastosGenerales.filter(g => g.categoria === cat && new Date(g.fecha).getFullYear() === new Date().getFullYear()).reduce((s, g) => s + (g.monto || 0), 0)
              if (total === 0) return null
              return (
                <div key={cat} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.85rem' }}>
                  <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{cat}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: S.red }}>${total.toLocaleString('es-AR')}</div>
                </div>
              )
            }).filter(Boolean)}
          </div>

          {showFormGasto && (
            <Card>
              <SectionTitle>Nuevo gasto general</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div>
                  <Label>Categoría</Label>
                  <select value={formGasto.categoria} onChange={e => setFormGasto({...formGasto, categoria: e.target.value})} style={inputStyle}>
                    {CATEGORIAS_GASTO_GENERAL.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Monto $</Label>
                  <input type="number" value={formGasto.monto} onChange={e => setFormGasto({...formGasto, monto: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <Label>Fecha</Label>
                  <input type="date" value={formGasto.fecha} onChange={e => setFormGasto({...formGasto, fecha: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <Label>Descripción</Label>
                  <input type="text" value={formGasto.descripcion} onChange={e => setFormGasto({...formGasto, descripcion: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <Label>Proveedor</Label>
                  <input type="text" value={formGasto.proveedor} onChange={e => setFormGasto({...formGasto, proveedor: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <Label>N° comprobante</Label>
                  <input type="text" value={formGasto.comprobante} onChange={e => setFormGasto({...formGasto, comprobante: e.target.value})} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormGasto(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarGasto} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle>Historial</SectionTitle>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Fecha', 'Categoría', 'Descripción', 'Proveedor', 'Comprobante', 'Monto', ''].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gastosGenerales.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay gastos registrados.</td></tr>}
                  {gastosGenerales.map(g => (
                    <tr key={g.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(g.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.amberLight, color: S.amber }}>{g.categoria}</span></td>
                      <td style={{ padding: '9px 12px', color: S.muted }}>{g.descripcion || '—'}</td>
                      <td style={{ padding: '9px 12px', color: S.muted }}>{g.proveedor || '—'}</td>
                      <td style={{ padding: '9px 12px', color: S.muted, fontFamily: 'monospace', fontSize: 12 }}>{g.comprobante || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>${g.monto?.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px' }}><button onClick={() => eliminarGasto('gastos_generales', g.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
