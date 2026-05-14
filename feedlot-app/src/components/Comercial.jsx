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
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</div>
}

function Card({ children, style = {} }) {
  return <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>{children}</div>
}

const CATEGORIAS_INGRESO = ['Cobro venta hacienda', 'Cobro venta grano', 'Cobro servicio', 'Crédito', 'Subsidio', 'Otro ingreso']
const CATEGORIAS_EGRESO = ['Compra hacienda', 'Insumos alimentación', 'Agroquímicos', 'Combustible', 'Sueldos y jornales', 'Alquileres', 'Reparaciones', 'Construcciones', 'Impuestos', 'Servicios', 'Honorarios', 'Veterinario', 'Flete', 'Otro egreso']
const FORMAS_PAGO = ['transferencia', 'cheque', 'e-cheq', 'efectivo', 'depósito']
const TIPOS_CONTACTO = ['comprador_hacienda', 'vendedor_hacienda', 'comprador_grano', 'servicio', 'otro']
const TIPO_LABEL = { comprador_hacienda: 'Comprador hacienda', vendedor_hacienda: 'Vendedor hacienda', comprador_grano: 'Comprador grano', servicio: 'Servicio', otro: 'Otro' }
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const ESTADOS_CHEQUE = { en_cartera: { bg: '#FDF0E0', color: '#7A4500' }, depositado: { bg: '#E8EFF8', color: '#1A3D6B' }, cobrado: { bg: '#E8F4EB', color: '#1E5C2E' }, rechazado: { bg: '#FDF0F0', color: '#7A1A1A' }, anulado: { bg: '#F7F5F0', color: '#6B6760' } }

export default function Comercial({ usuario }) {
  const [tab, setTab] = useState('caja_oficial')
  const [loading, setLoading] = useState(true)
  const [cajaOficial, setCajaOficial] = useState([])
  const [cajaParalela, setCajaParalela] = useState([])
  const [cheques, setCheques] = useState([])
  const [contactos, setContactos] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroCheque, setFiltroCheque] = useState('todos')
  const [showFormOf, setShowFormOf] = useState(false)
  const [showFormPar, setShowFormPar] = useState(false)
  const [showFormContacto, setShowFormContacto] = useState(false)

  const [formOf, setFormOf] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: 'ingreso', categoria: 'Cobro venta hacienda', descripcion: '', monto: '', forma_pago: 'transferencia', comprobante: '', contacto_id: '', numero_cheque: '', fecha_vencimiento_cheque: '', banco_cheque: '', librador: '', beneficiario: '' })
  const [formPar, setFormPar] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: 'ingreso', descripcion: '', monto: '', observaciones: '' })
  const [formContacto, setFormContacto] = useState({ nombre: '', tipo: 'comprador_hacienda', cuit: '', telefono: '', email: '', banco: '', cbu: '', observaciones: '' })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: co }, { data: cp }, { data: ch }, { data: ct }] = await Promise.all([
      supabase.from('caja_oficial').select('*, contactos(nombre)').order('fecha', { ascending: false }),
      supabase.from('caja_paralela').select('*').order('fecha', { ascending: false }),
      supabase.from('cheques').select('*').order('fecha_vencimiento', { ascending: true }),
      supabase.from('contactos').select('*').eq('activo', true).order('nombre'),
    ])
    setCajaOficial(co || [])
    setCajaParalela(cp || [])
    setCheques(ch || [])
    setContactos(ct || [])
    setLoading(false)
  }

  async function guardarCajaOf() {
    if (!formOf.monto) { alert('Ingresá el monto'); return }
    setGuardando(true)
    const { data: mov } = await supabase.from('caja_oficial').insert({
      fecha: formOf.fecha, tipo: formOf.tipo, categoria: formOf.categoria,
      descripcion: formOf.descripcion, monto: parseFloat(formOf.monto),
      forma_pago: formOf.forma_pago, comprobante: formOf.comprobante || null,
      contacto_id: formOf.contacto_id ? parseInt(formOf.contacto_id) : null,
      registrado_por: usuario?.id,
    }).select().single()

    if (['cheque', 'e-cheq'].includes(formOf.forma_pago) && formOf.fecha_vencimiento_cheque) {
      await supabase.from('cheques').insert({
        tipo: formOf.tipo === 'ingreso' ? 'recibido' : 'emitido',
        numero: formOf.numero_cheque || null, banco: formOf.banco_cheque || null,
        monto: parseFloat(formOf.monto), fecha_emision: formOf.fecha,
        fecha_vencimiento: formOf.fecha_vencimiento_cheque,
        librador: formOf.tipo === 'ingreso' ? (formOf.librador || null) : null,
        beneficiario: formOf.tipo === 'egreso' ? (formOf.beneficiario || null) : null,
        estado: 'en_cartera', caja_oficial_id: mov?.id || null, registrado_por: usuario?.id,
      })
    }
    await cargar()
    setShowFormOf(false)
    setFormOf({ fecha: new Date().toISOString().split('T')[0], tipo: 'ingreso', categoria: 'Cobro venta hacienda', descripcion: '', monto: '', forma_pago: 'transferencia', comprobante: '', contacto_id: '', numero_cheque: '', fecha_vencimiento_cheque: '', banco_cheque: '', librador: '', beneficiario: '' })
    setGuardando(false)
  }

  async function guardarCajaPar() {
    if (!formPar.monto || !formPar.descripcion) { alert('Completá descripción y monto'); return }
    setGuardando(true)
    await supabase.from('caja_paralela').insert({ ...formPar, monto: parseFloat(formPar.monto), registrado_por: usuario?.id })
    await cargar()
    setShowFormPar(false)
    setFormPar({ fecha: new Date().toISOString().split('T')[0], tipo: 'ingreso', descripcion: '', monto: '', observaciones: '' })
    setGuardando(false)
  }

  async function guardarContacto() {
    if (!formContacto.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    await supabase.from('contactos').insert({ ...formContacto, activo: true })
    await cargar()
    setShowFormContacto(false)
    setFormContacto({ nombre: '', tipo: 'comprador_hacienda', cuit: '', telefono: '', email: '', banco: '', cbu: '', observaciones: '' })
    setGuardando(false)
  }

  async function cambiarEstadoCheque(id, estado) {
    await supabase.from('cheques').update({ estado }).eq('id', id)
    await cargar()
  }

  async function eliminar(tabla, id) {
    if (!confirm('Eliminar este registro?')) return
    await supabase.from(tabla).delete().eq('id', id)
    await cargar()
  }

  if (loading) return <Loader />

  const filtrar = arr => arr.filter(x => {
    const fecha = x.fecha || x.creado_en?.split('T')[0]
    if (!fecha) return true
    const d = new Date(fecha + 'T12:00:00')
    return d.getFullYear() === parseInt(filtroAnio) && (!filtroMes || d.getMonth() + 1 === parseInt(filtroMes))
  })

  const coF = filtrar(cajaOficial)
  const cpF = filtrar(cajaParalela)
  const coIng = coF.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + (x.monto || 0), 0)
  const coEg = coF.filter(x => x.tipo === 'egreso').reduce((s, x) => s + (x.monto || 0), 0)
  const cpIng = cpF.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + (x.monto || 0), 0)
  const cpEg = cpF.filter(x => x.tipo === 'egreso').reduce((s, x) => s + (x.monto || 0), 0)

  const anios = [...new Set([...cajaOficial, ...cajaParalela].map(x => new Date(x.fecha + 'T12:00:00').getFullYear()))].sort((a, b) => b - a)
  if (!anios.includes(new Date().getFullYear())) anios.unshift(new Date().getFullYear())

  const chRec = cheques.filter(c => c.tipo === 'recibido')
  const chEm = cheques.filter(c => c.tipo === 'emitido')
  const chVence7 = cheques.filter(c => c.estado === 'en_cartera' && new Date(c.fecha_vencimiento + 'T12:00:00') <= new Date(Date.now() + 7 * 86400000))
  const chFiltrados = filtroCheque === 'todos' ? cheques : filtroCheque === 'recibidos' ? chRec : chEm

  const isChecque = ['cheque', 'e-cheq'].includes(formOf.forma_pago)

  const TABS = [
    { key: 'caja_oficial', label: 'Caja oficial' },
    { key: 'caja_paralela', label: 'Caja paralela' },
    { key: 'cheques', label: `Cheques${chVence7.length > 0 ? ` ⚠${chVence7.length}` : ''}` },
    { key: 'contactos', label: 'Contactos' },
  ]

  const FiltrosPeriodo = () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
        {anios.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
      <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
        <option value="">Todos los meses</option>
        {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
      </select>
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Comercial</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>Caja oficial · caja paralela · cheques · contactos</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
        {[
          { label: 'Saldo caja oficial', val: `$${((coIng - coEg) / 1000000).toFixed(1)}M`, sub: `+${(coIng/1000000).toFixed(1)}M / -${(coEg/1000000).toFixed(1)}M`, color: coIng - coEg >= 0 ? S.green : S.red },
          { label: 'Saldo caja paralela', val: `$${((cpIng - cpEg) / 1000000).toFixed(1)}M`, sub: `+${(cpIng/1000000).toFixed(1)}M / -${(cpEg/1000000).toFixed(1)}M`, color: cpIng - cpEg >= 0 ? S.green : S.red, purple: true },
          { label: 'Cheques en cartera', val: chRec.filter(c => c.estado === 'en_cartera').length, sub: `$${chRec.filter(c => c.estado === 'en_cartera').reduce((s,c) => s+(c.monto||0), 0).toLocaleString('es-AR')}`, color: S.amber },
          { label: 'Vencen en 7 días', val: chVence7.length, sub: chVence7.length > 0 ? '⚠ Revisar urgente' : '✓ Sin vencimientos', color: chVence7.length > 0 ? S.red : S.green },
        ].map((m, i) => (
          <div key={i} style={{ background: m.purple ? S.purpleLight : S.surface, border: `1px solid ${m.purple ? '#9F8ED4' : S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: m.purple ? S.purple : S.muted, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: m.color }}>{m.val}</div>
            <div style={{ fontSize: 11, color: m.purple ? S.purple : S.hint, marginTop: 3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'caja_oficial' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <FiltrosPeriodo />
            <button onClick={() => setShowFormOf(!showFormOf)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>+ Movimiento</button>
          </div>

          {showFormOf && (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo movimiento</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div><Label>Tipo</Label>
                  <select value={formOf.tipo} onChange={e => setFormOf({...formOf, tipo: e.target.value, categoria: e.target.value === 'ingreso' ? 'Cobro venta hacienda' : 'Compra hacienda'})} style={inputStyle}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>
                <div><Label>Categoría</Label>
                  <select value={formOf.categoria} onChange={e => setFormOf({...formOf, categoria: e.target.value})} style={inputStyle}>
                    {(formOf.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><Label>Fecha</Label><input type="date" value={formOf.fecha} onChange={e => setFormOf({...formOf, fecha: e.target.value})} style={inputStyle} /></div>
                <div><Label>Monto $</Label><input type="number" value={formOf.monto} onChange={e => setFormOf({...formOf, monto: e.target.value})} style={inputStyle} /></div>
                <div><Label>Forma de pago</Label>
                  <select value={formOf.forma_pago} onChange={e => setFormOf({...formOf, forma_pago: e.target.value})} style={inputStyle}>
                    {FORMAS_PAGO.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div><Label>Contacto</Label>
                  <select value={formOf.contacto_id} onChange={e => setFormOf({...formOf, contacto_id: e.target.value})} style={inputStyle}>
                    <option value="">— Sin contacto —</option>
                    {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/3' }}><Label>Descripción</Label><input type="text" value={formOf.descripcion} onChange={e => setFormOf({...formOf, descripcion: e.target.value})} style={inputStyle} /></div>
                <div><Label>Comprobante</Label><input type="text" value={formOf.comprobante} onChange={e => setFormOf({...formOf, comprobante: e.target.value})} style={inputStyle} placeholder="N° factura..." /></div>
                {isChecque && (
                  <div style={{ gridColumn: '1/-1', background: S.amberLight, border: `1px solid #EF9F27`, borderRadius: 8, padding: '1rem' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: S.amber, textTransform: 'uppercase', marginBottom: 10 }}>
                      {formOf.forma_pago === 'e-cheq' ? 'E-Cheque' : 'Cheque'} — se agenda automáticamente
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <div><Label>N° cheque</Label><input type="text" value={formOf.numero_cheque} onChange={e => setFormOf({...formOf, numero_cheque: e.target.value})} style={inputStyle} /></div>
                      <div><Label>Banco</Label><input type="text" value={formOf.banco_cheque} onChange={e => setFormOf({...formOf, banco_cheque: e.target.value})} style={inputStyle} /></div>
                      <div><Label>Fecha vencimiento *</Label><input type="date" value={formOf.fecha_vencimiento_cheque} onChange={e => setFormOf({...formOf, fecha_vencimiento_cheque: e.target.value})} style={{ ...inputStyle, borderColor: S.amber }} /></div>
                      {formOf.tipo === 'ingreso' && <div><Label>Librador</Label><input type="text" value={formOf.librador} onChange={e => setFormOf({...formOf, librador: e.target.value})} style={inputStyle} /></div>}
                      {formOf.tipo === 'egreso' && <div><Label>Beneficiario</Label><input type="text" value={formOf.beneficiario} onChange={e => setFormOf({...formOf, beneficiario: e.target.value})} style={inputStyle} /></div>}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormOf(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarCajaOf} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            {['ingreso', 'egreso'].map(tipo => {
              const items = coF.filter(x => x.tipo === tipo)
              const porCat = {}
              items.forEach(x => { porCat[x.categoria] = (porCat[x.categoria] || 0) + (x.monto || 0) })
              const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1])
              const total = cats.reduce((s, [, v]) => s + v, 0)
              return (
                <Card key={tipo} style={{ margin: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: tipo === 'ingreso' ? S.green : S.red, textTransform: 'uppercase', marginBottom: '1rem' }}>
                    {tipo === 'ingreso' ? 'Ingresos' : 'Egresos'} — ${(total / 1000000).toFixed(2)}M
                  </div>
                  {cats.map(([cat, monto]) => (
                    <div key={cat} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                      <div style={{ fontSize: 12, color: S.muted, flex: 1 }}>{cat}</div>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: tipo === 'ingreso' ? S.green : S.red }}>${monto.toLocaleString('es-AR')}</div>
                      <div style={{ fontSize: 11, color: S.hint, minWidth: 30, textAlign: 'right' }}>{Math.round(monto / total * 100)}%</div>
                    </div>
                  ))}
                  {cats.length === 0 && <div style={{ fontSize: 13, color: S.hint }}>Sin movimientos.</div>}
                </Card>
              )
            })}
          </div>

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Contacto', 'Forma', 'Comprobante', 'Monto', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {coF.length === 0 && <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay movimientos.</td></tr>}
                  {coF.map(m => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: m.tipo === 'ingreso' ? S.greenLight : S.redLight, color: m.tipo === 'ingreso' ? S.green : S.red }}>{m.tipo}</span></td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{m.categoria}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{m.descripcion || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{m.contactos?.nombre || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{m.forma_pago}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: S.hint }}>{m.comprobante || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: m.tipo === 'ingreso' ? S.green : S.red }}>{m.tipo === 'ingreso' ? '+' : '-'}${m.monto?.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('caja_oficial', m.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'caja_paralela' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <FiltrosPeriodo />
            <button onClick={() => setShowFormPar(!showFormPar)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.purple, border: `1px solid ${S.purple}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>+ Movimiento</button>
          </div>

          {showFormPar && (
            <Card style={{ border: '1px solid #9F8ED4' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.purple, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo movimiento paralelo</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div><Label>Tipo</Label>
                  <select value={formPar.tipo} onChange={e => setFormPar({...formPar, tipo: e.target.value})} style={inputStyle}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>
                <div><Label>Monto $</Label><input type="number" value={formPar.monto} onChange={e => setFormPar({...formPar, monto: e.target.value})} style={inputStyle} /></div>
                <div><Label>Fecha</Label><input type="date" value={formPar.fecha} onChange={e => setFormPar({...formPar, fecha: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: '1/3' }}><Label>Descripción *</Label><input type="text" value={formPar.descripcion} onChange={e => setFormPar({...formPar, descripcion: e.target.value})} style={inputStyle} /></div>
                <div><Label>Observaciones</Label><input type="text" value={formPar.observaciones} onChange={e => setFormPar({...formPar, observaciones: e.target.value})} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormPar(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarCajaPar} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.purple, border: `1px solid ${S.purple}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          {!filtroMes && (() => {
            const porMes = {}
            cajaParalela.filter(x => new Date(x.fecha + 'T12:00:00').getFullYear() === parseInt(filtroAnio)).forEach(m => {
              const mes = new Date(m.fecha + 'T12:00:00').getMonth() + 1
              if (!porMes[mes]) porMes[mes] = { ing: 0, eg: 0 }
              if (m.tipo === 'ingreso') porMes[mes].ing += m.monto || 0
              else porMes[mes].eg += m.monto || 0
            })
            const entradas = Object.entries(porMes).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).slice(0, 8)
            if (!entradas.length) return null
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
                {entradas.map(([mes, d]) => (
                  <div key={mes} style={{ background: S.purpleLight, border: '1px solid #9F8ED4', borderRadius: 8, padding: '.85rem', cursor: 'pointer' }} onClick={() => setFiltroMes(mes)}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: S.purple, marginBottom: 6 }}>{MESES[parseInt(mes)]}</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', color: S.green }}>+${d.ing.toLocaleString('es-AR')}</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', color: S.red }}>-${d.eg.toLocaleString('es-AR')}</div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: d.ing - d.eg >= 0 ? S.green : S.red, marginTop: 4 }}>${(d.ing - d.eg).toLocaleString('es-AR')}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha', 'Tipo', 'Descripción', 'Observaciones', 'Monto', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {cpF.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay movimientos.</td></tr>}
                  {cpF.map(m => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: m.tipo === 'ingreso' ? S.greenLight : S.redLight, color: m.tipo === 'ingreso' ? S.green : S.red }}>{m.tipo}</span></td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{m.descripcion}</td>
                      <td style={{ padding: '9px 12px', color: S.muted, fontSize: 12 }}>{m.observaciones || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: m.tipo === 'ingreso' ? S.green : S.red }}>{m.tipo === 'ingreso' ? '+' : '-'}${m.monto?.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('caja_paralela', m.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'cheques' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['todos', 'recibidos', 'emitidos'].map(f => (
                <button key={f} onClick={() => setFiltroCheque(f)}
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: filtroCheque === f ? 600 : 400, background: filtroCheque === f ? S.accent : 'transparent', border: `1px solid ${filtroCheque === f ? S.accent : S.border}`, color: filtroCheque === f ? '#fff' : S.muted, borderRadius: 6, cursor: 'pointer' }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: S.muted }}>{chFiltrados.length} cheques</div>
          </div>

          {chVence7.length > 0 && (
            <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.red, marginBottom: 6 }}>⚠ {chVence7.length} cheque{chVence7.length !== 1 ? 's' : ''} vence{chVence7.length === 1 ? '' : 'n'} en los próximos 7 días</div>
              {chVence7.map(c => (
                <div key={c.id} style={{ fontSize: 12, color: S.red, marginBottom: 2 }}>
                  {c.tipo === 'recibido' ? '📥' : '📤'} {c.tipo} #{c.numero || 'sin número'} · ${c.monto?.toLocaleString('es-AR')} · vence {new Date(c.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')} {c.banco ? `· ${c.banco}` : ''}
                </div>
              ))}
            </div>
          )}

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Tipo', 'N° Cheque', 'Banco', 'Monto', 'Emisión', 'Vencimiento', 'Librador/Beneficiario', 'Estado', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {chFiltrados.length === 0 && <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay cheques.</td></tr>}
                  {chFiltrados.map(c => {
                    const ec = ESTADOS_CHEQUE[c.estado] || ESTADOS_CHEQUE.en_cartera
                    const diasVence = Math.ceil((new Date(c.fecha_vencimiento + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24))
                    const urgente = diasVence <= 7 && c.estado === 'en_cartera'
                    return (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${S.border}`, background: urgente ? '#FFF5F5' : 'transparent' }}>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: c.tipo === 'recibido' ? S.greenLight : S.amberLight, color: c.tipo === 'recibido' ? S.green : S.amber }}>
                            {c.tipo === 'recibido' ? '📥 Recibido' : '📤 Emitido'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{c.numero || '—'}</td>
                        <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{c.banco || '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>${c.monto?.toLocaleString('es-AR')}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted }}>{c.fecha_emision ? new Date(c.fecha_emision + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, fontWeight: urgente ? 700 : 400, color: urgente ? S.red : S.text }}>
                          {new Date(c.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          {urgente && <span style={{ fontSize: 10, marginLeft: 4, color: S.red }}>({diasVence}d)</span>}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 12 }}>{c.librador || c.beneficiario || '—'}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <select value={c.estado} onChange={e => cambiarEstadoCheque(c.id, e.target.value)}
                            style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, border: `1px solid ${ec.color}`, borderRadius: 5, background: ec.bg, color: ec.color, cursor: 'pointer' }}>
                            {Object.keys(ESTADOS_CHEQUE).map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('cheques', c.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'contactos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{contactos.length} contactos</div>
            <button onClick={() => setShowFormContacto(!showFormContacto)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>+ Nuevo contacto</button>
          </div>

          {showFormContacto && (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo contacto</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div style={{ gridColumn: '1/3' }}><Label>Nombre / Razón social</Label><input type="text" value={formContacto.nombre} onChange={e => setFormContacto({...formContacto, nombre: e.target.value})} style={inputStyle} /></div>
                <div><Label>Tipo</Label>
                  <select value={formContacto.tipo} onChange={e => setFormContacto({...formContacto, tipo: e.target.value})} style={inputStyle}>
                    {TIPOS_CONTACTO.map(t => <option key={t} value={t}>{TIPO_LABEL[t] || t}</option>)}
                  </select>
                </div>
                <div><Label>CUIT</Label><input type="text" value={formContacto.cuit} onChange={e => setFormContacto({...formContacto, cuit: e.target.value})} style={inputStyle} placeholder="20-12345678-9" /></div>
                <div><Label>Teléfono</Label><input type="text" value={formContacto.telefono} onChange={e => setFormContacto({...formContacto, telefono: e.target.value})} style={inputStyle} /></div>
                <div><Label>Email</Label><input type="text" value={formContacto.email} onChange={e => setFormContacto({...formContacto, email: e.target.value})} style={inputStyle} /></div>
                <div><Label>Banco</Label><input type="text" value={formContacto.banco} onChange={e => setFormContacto({...formContacto, banco: e.target.value})} style={inputStyle} /></div>
                <div><Label>CBU</Label><input type="text" value={formContacto.cbu} onChange={e => setFormContacto({...formContacto, cbu: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: '1/-1' }}><Label>Observaciones</Label><input type="text" value={formContacto.observaciones} onChange={e => setFormContacto({...formContacto, observaciones: e.target.value})} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormContacto(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarContacto} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {contactos.length === 0 && <div style={{ gridColumn: '1/-1', padding: '2rem', textAlign: 'center', color: S.hint }}>No hay contactos.</div>}
            {contactos.map(c => {
              const movs = cajaOficial.filter(m => m.contacto_id === c.id)
              const total = movs.reduce((s, m) => s + (m.tipo === 'ingreso' ? (m.monto || 0) : -(m.monto || 0)), 0)
              return (
                <div key={c.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{c.nombre}</div>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: S.accentLight, color: S.accent }}>{TIPO_LABEL[c.tipo] || c.tipo}</span>
                  </div>
                  {c.cuit && <div style={{ fontSize: 12, color: S.muted }}>CUIT: {c.cuit}</div>}
                  {c.telefono && <div style={{ fontSize: 12, color: S.muted }}>Tel: {c.telefono}</div>}
                  {c.banco && <div style={{ fontSize: 12, color: S.muted }}>Banco: {c.banco}</div>}
                  {c.cbu && <div style={{ fontSize: 11, fontFamily: 'monospace', color: S.hint, marginTop: 2 }}>CBU: {c.cbu}</div>}
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: S.muted }}>{movs.length} movimientos</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: total >= 0 ? S.green : S.red }}>${(Math.abs(total) / 1000000).toFixed(1)}M</span>
                  </div>
                  <button onClick={() => eliminar('contactos', c.id)} style={{ marginTop: 8, width: '100%', padding: '5px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
