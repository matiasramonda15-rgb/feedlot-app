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

const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</div>
}

function Card({ children, style = {} }) {
  return <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>{children}</div>
}

function SecTitle({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>{children}</div>
}

const TIPOS_CONTACTO = ['comprador_hacienda', 'vendedor_hacienda', 'comprador_grano', 'servicio', 'otro']
const TIPOS_LIQ = ['venta_hacienda', 'compra_hacienda', 'venta_grano', 'servicio']
const FORMAS_COBRO = ['transferencia', 'cheque', 'efectivo', 'mixto']
const CATEGORIAS_CAJA = ['Cobro venta', 'Pago compra', 'Gastos operativos', 'Sueldos', 'Impuestos', 'Retenciones', 'Comisiones', 'Fletes', 'Otro']

const TIPO_LABEL = {
  comprador_hacienda: 'Comprador hacienda',
  vendedor_hacienda: 'Vendedor hacienda',
  comprador_grano: 'Comprador grano',
  servicio: 'Servicio',
  otro: 'Otro',
  venta_hacienda: 'Venta hacienda',
  compra_hacienda: 'Compra hacienda',
  venta_grano: 'Venta grano',
}

export default function Comercial({ usuario }) {
  const [tab, setTab] = useState('liquidaciones')
  const [loading, setLoading] = useState(true)
  const [contactos, setContactos] = useState([])
  const [liquidaciones, setLiquidaciones] = useState([])
  const [cajaOficial, setCajaOficial] = useState([])
  const [cajaParalela, setCajaParalela] = useState([])
  const [guardando, setGuardando] = useState(false)

  // Filtros
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))
  const [filtroMes, setFiltroMes] = useState('')

  // Forms
  const [showFormContacto, setShowFormContacto] = useState(false)
  const [showFormLiq, setShowFormLiq] = useState(false)
  const [showFormCajaOf, setShowFormCajaOf] = useState(false)
  const [showFormCajaPar, setShowFormCajaPar] = useState(false)

  const [formContacto, setFormContacto] = useState({ nombre: '', tipo: 'comprador_hacienda', cuit: '', telefono: '', email: '', banco: '', cbu: '', observaciones: '' })
  const [formLiq, setFormLiq] = useState({
    contacto_id: '', tipo: 'venta_hacienda', fecha: new Date().toISOString().split('T')[0],
    numero_liquidacion: '', monto_bruto: '', iva: '', retenciones: '', comisiones: '',
    fletes: '', otros_descuentos: '', forma_cobro: 'transferencia',
    numero_cheque: '', fecha_cheque: '', factura_recibida: false, observaciones: ''
  })
  const [formCajaOf, setFormCajaOf] = useState({
    fecha: new Date().toISOString().split('T')[0], tipo: 'ingreso',
    categoria: 'Cobro venta', descripcion: '', monto: '', forma_pago: 'transferencia',
    comprobante: '', contacto_id: ''
  })
  const [formCajaPar, setFormCajaPar] = useState({
    fecha: new Date().toISOString().split('T')[0], tipo: 'ingreso',
    descripcion: '', monto: '', observaciones: ''
  })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: ct }, { data: lq }, { data: co }, { data: cp }] = await Promise.all([
      supabase.from('contactos').select('*').eq('activo', true).order('nombre'),
      supabase.from('liquidaciones').select('*, contactos(nombre)').order('fecha', { ascending: false }),
      supabase.from('caja_oficial').select('*, contactos(nombre)').order('fecha', { ascending: false }),
      supabase.from('caja_paralela').select('*').order('fecha', { ascending: false }),
    ])
    setContactos(ct || [])
    setLiquidaciones(lq || [])
    setCajaOficial(co || [])
    setCajaParalela(cp || [])
    setLoading(false)
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

  async function guardarLiquidacion() {
    if (!formLiq.fecha || !formLiq.monto_bruto) { alert('Completá fecha y monto bruto'); return }
    setGuardando(true)
    const bruto = parseFloat(formLiq.monto_bruto) || 0
    const iva = parseFloat(formLiq.iva) || 0
    const retenciones = parseFloat(formLiq.retenciones) || 0
    const comisiones = parseFloat(formLiq.comisiones) || 0
    const fletes = parseFloat(formLiq.fletes) || 0
    const otros = parseFloat(formLiq.otros_descuentos) || 0
    const neto = bruto + iva - retenciones - comisiones - fletes - otros
    await supabase.from('liquidaciones').insert({
      ...formLiq,
      contacto_id: formLiq.contacto_id ? parseInt(formLiq.contacto_id) : null,
      monto_bruto: bruto, iva, retenciones, comisiones, fletes,
      otros_descuentos: otros, monto_neto: Math.round(neto * 100) / 100,
      registrado_por: usuario?.id,
    })
    await cargar()
    setShowFormLiq(false)
    setFormLiq({ contacto_id: '', tipo: 'venta_hacienda', fecha: new Date().toISOString().split('T')[0], numero_liquidacion: '', monto_bruto: '', iva: '', retenciones: '', comisiones: '', fletes: '', otros_descuentos: '', forma_cobro: 'transferencia', numero_cheque: '', fecha_cheque: '', factura_recibida: false, observaciones: '' })
    setGuardando(false)
  }

  async function guardarCajaOf() {
    if (!formCajaOf.monto) { alert('Ingresá el monto'); return }
    setGuardando(true)
    await supabase.from('caja_oficial').insert({
      ...formCajaOf,
      monto: parseFloat(formCajaOf.monto),
      contacto_id: formCajaOf.contacto_id ? parseInt(formCajaOf.contacto_id) : null,
      registrado_por: usuario?.id,
    })
    await cargar()
    setShowFormCajaOf(false)
    setFormCajaOf({ fecha: new Date().toISOString().split('T')[0], tipo: 'ingreso', categoria: 'Cobro venta', descripcion: '', monto: '', forma_pago: 'transferencia', comprobante: '', contacto_id: '' })
    setGuardando(false)
  }

  async function guardarCajaPar() {
    if (!formCajaPar.monto || !formCajaPar.descripcion) { alert('Completá descripción y monto'); return }
    setGuardando(true)
    await supabase.from('caja_paralela').insert({ ...formCajaPar, monto: parseFloat(formCajaPar.monto), registrado_por: usuario?.id })
    await cargar()
    setShowFormCajaPar(false)
    setFormCajaPar({ fecha: new Date().toISOString().split('T')[0], tipo: 'ingreso', descripcion: '', monto: '', observaciones: '' })
    setGuardando(false)
  }

  async function eliminar(tabla, id) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from(tabla).delete().eq('id', id)
    await cargar()
  }

  if (loading) return <Loader />

  // Filtrar por año y mes
  const filtrar = arr => arr.filter(x => {
    const fecha = x.fecha || x.creado_en?.split('T')[0]
    if (!fecha) return true
    const anioMatch = new Date(fecha).getFullYear() === parseInt(filtroAnio)
    const mesMatch = !filtroMes || (new Date(fecha).getMonth() + 1) === parseInt(filtroMes)
    return anioMatch && mesMatch
  })

  const liqFiltradas = filtrar(liquidaciones)
  const cajaOfFiltrada = filtrar(cajaOficial)
  const cajaParFiltrada = filtrar(cajaParalela)

  // Métricas
  const totalLiqIngresos = liqFiltradas.filter(l => ['venta_hacienda', 'venta_grano', 'servicio'].includes(l.tipo)).reduce((s, l) => s + (l.monto_neto || 0), 0)
  const totalLiqEgresos = liqFiltradas.filter(l => l.tipo === 'compra_hacienda').reduce((s, l) => s + (l.monto_neto || 0), 0)
  const totalCajaOfIngresos = cajaOfFiltrada.filter(c => c.tipo === 'ingreso').reduce((s, c) => s + (c.monto || 0), 0)
  const totalCajaOfEgresos = cajaOfFiltrada.filter(c => c.tipo === 'egreso').reduce((s, c) => s + (c.monto || 0), 0)
  const totalParIngresos = cajaParFiltrada.filter(c => c.tipo === 'ingreso').reduce((s, c) => s + (c.monto || 0), 0)
  const totalParEgresos = cajaParFiltrada.filter(c => c.tipo === 'egreso').reduce((s, c) => s + (c.monto || 0), 0)

  const anios = [...new Set([...liquidaciones, ...cajaOficial, ...cajaParalela].map(x => new Date(x.fecha || x.creado_en).getFullYear()))].sort((a, b) => b - a)
  if (!anios.includes(new Date().getFullYear())) anios.unshift(new Date().getFullYear())

  const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  // Calcular monto neto preview en formulario
  const previewNeto = (() => {
    const b = parseFloat(formLiq.monto_bruto) || 0
    const i = parseFloat(formLiq.iva) || 0
    const r = parseFloat(formLiq.retenciones) || 0
    const c = parseFloat(formLiq.comisiones) || 0
    const f = parseFloat(formLiq.fletes) || 0
    const o = parseFloat(formLiq.otros_descuentos) || 0
    return b > 0 ? b + i - r - c - f - o : null
  })()

  const TABS = [
    { key: 'liquidaciones', label: 'Liquidaciones' },
    { key: 'caja_oficial', label: 'Caja oficial' },
    { key: 'caja_paralela', label: 'Caja paralela' },
    { key: 'contactos', label: 'Contactos' },
  ]

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Comercial</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Liquidaciones · caja oficial · caja paralela · contactos
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem' }}>
        <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}
          style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
          style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
          <option value="">Todos los meses</option>
          {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {/* Resumen global */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem' }}>
          <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Liquidaciones</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div><div style={{ fontSize: 11, color: S.muted }}>Ingresos</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${(totalLiqIngresos / 1000000).toFixed(1)}M</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: S.muted }}>Egresos</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: S.red }}>${(totalLiqEgresos / 1000000).toFixed(1)}M</div></div>
          </div>
        </div>
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem' }}>
          <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Caja oficial</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div><div style={{ fontSize: 11, color: S.muted }}>Ingresos</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${(totalCajaOfIngresos / 1000000).toFixed(1)}M</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: S.muted }}>Egresos</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: S.red }}>${(totalCajaOfEgresos / 1000000).toFixed(1)}M</div></div>
          </div>
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${S.border}`, fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: totalCajaOfIngresos - totalCajaOfEgresos >= 0 ? S.green : S.red }}>
            Saldo: ${((totalCajaOfIngresos - totalCajaOfEgresos) / 1000000).toFixed(1)}M
          </div>
        </div>
        <div style={{ background: S.purpleLight, border: `1px solid #9F8ED4`, borderRadius: 10, padding: '1rem' }}>
          <div style={{ fontSize: 11, color: S.purple, textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Caja paralela</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div><div style={{ fontSize: 11, color: S.purple }}>Ingresos</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${(totalParIngresos / 1000000).toFixed(1)}M</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: S.purple }}>Egresos</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: S.red }}>${(totalParEgresos / 1000000).toFixed(1)}M</div></div>
          </div>
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid #9F8ED4`, fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: totalParIngresos - totalParEgresos >= 0 ? S.green : S.red }}>
            Saldo: ${((totalParIngresos - totalParEgresos) / 1000000).toFixed(1)}M
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LIQUIDACIONES ── */}
      {tab === 'liquidaciones' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Liquidaciones · {liqFiltradas.length} registros</div>
            <button onClick={() => setShowFormLiq(!showFormLiq)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Nueva liquidación
            </button>
          </div>

          {showFormLiq && (
            <Card>
              <SecTitle>Nueva liquidación</SecTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div><Label>Tipo</Label>
                  <select value={formLiq.tipo} onChange={e => setFormLiq({...formLiq, tipo: e.target.value})} style={inputStyle}>
                    {TIPOS_LIQ.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                  </select>
                </div>
                <div><Label>Contacto</Label>
                  <select value={formLiq.contacto_id} onChange={e => setFormLiq({...formLiq, contacto_id: e.target.value})} style={inputStyle}>
                    <option value="">— Sin contacto —</option>
                    {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div><Label>Fecha</Label><input type="date" value={formLiq.fecha} onChange={e => setFormLiq({...formLiq, fecha: e.target.value})} style={inputStyle} /></div>
                <div><Label>N° liquidación</Label><input type="text" value={formLiq.numero_liquidacion} onChange={e => setFormLiq({...formLiq, numero_liquidacion: e.target.value})} style={inputStyle} placeholder="ej. 0001-00001234" /></div>
                <div><Label>Monto bruto $</Label><input type="number" value={formLiq.monto_bruto} onChange={e => setFormLiq({...formLiq, monto_bruto: e.target.value})} style={inputStyle} /></div>
                <div><Label>IVA $</Label><input type="number" value={formLiq.iva} onChange={e => setFormLiq({...formLiq, iva: e.target.value})} style={inputStyle} placeholder="0" /></div>
                <div><Label>Retenciones $</Label><input type="number" value={formLiq.retenciones} onChange={e => setFormLiq({...formLiq, retenciones: e.target.value})} style={inputStyle} placeholder="0" /></div>
                <div><Label>Comisiones $</Label><input type="number" value={formLiq.comisiones} onChange={e => setFormLiq({...formLiq, comisiones: e.target.value})} style={inputStyle} placeholder="0" /></div>
                <div><Label>Fletes $</Label><input type="number" value={formLiq.fletes} onChange={e => setFormLiq({...formLiq, fletes: e.target.value})} style={inputStyle} placeholder="0" /></div>
                <div><Label>Otros descuentos $</Label><input type="number" value={formLiq.otros_descuentos} onChange={e => setFormLiq({...formLiq, otros_descuentos: e.target.value})} style={inputStyle} placeholder="0" /></div>
                <div><Label>Forma de cobro</Label>
                  <select value={formLiq.forma_cobro} onChange={e => setFormLiq({...formLiq, forma_cobro: e.target.value})} style={inputStyle}>
                    {FORMAS_COBRO.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                {formLiq.forma_cobro === 'cheque' && (
                  <>
                    <div><Label>N° cheque</Label><input type="text" value={formLiq.numero_cheque} onChange={e => setFormLiq({...formLiq, numero_cheque: e.target.value})} style={inputStyle} /></div>
                    <div><Label>Fecha cheque</Label><input type="date" value={formLiq.fecha_cheque} onChange={e => setFormLiq({...formLiq, fecha_cheque: e.target.value})} style={inputStyle} /></div>
                  </>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                  <input type="checkbox" id="factura" checked={formLiq.factura_recibida} onChange={e => setFormLiq({...formLiq, factura_recibida: e.target.checked})} />
                  <label htmlFor="factura" style={{ fontSize: 13, cursor: 'pointer' }}>Factura recibida</label>
                </div>
                <div style={{ gridColumn: '1/-1' }}><Label>Observaciones</Label><input type="text" value={formLiq.observaciones} onChange={e => setFormLiq({...formLiq, observaciones: e.target.value})} style={inputStyle} /></div>
              </div>
              {previewNeto !== null && (
                <div style={{ background: previewNeto >= 0 ? S.greenLight : S.redLight, border: `1px solid ${previewNeto >= 0 ? '#97C459' : '#F09595'}`, borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: previewNeto >= 0 ? S.green : S.red }}>
                  Monto neto a cobrar: ${previewNeto.toLocaleString('es-AR')}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormLiq(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarLiquidacion} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha', 'Tipo', 'Contacto', 'N° Liq.', 'Bruto', 'Desc.', 'Neto', 'Cobro', 'Factura', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {liqFiltradas.length === 0 && <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay liquidaciones.</td></tr>}
                  {liqFiltradas.map(l => {
                    const descuentos = (l.retenciones || 0) + (l.comisiones || 0) + (l.fletes || 0) + (l.otros_descuentos || 0)
                    const esIngreso = ['venta_hacienda', 'venta_grano', 'servicio'].includes(l.tipo)
                    return (
                      <tr key={l.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(l.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                        <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: esIngreso ? S.greenLight : S.redLight, color: esIngreso ? S.green : S.red }}>{TIPO_LABEL[l.tipo] || l.tipo}</span></td>
                        <td style={{ padding: '9px 12px', fontSize: 12 }}>{l.contactos?.nombre || '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted }}>{l.numero_liquidacion || '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>${l.monto_bruto?.toLocaleString('es-AR')}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.red }}>{descuentos > 0 ? `-$${descuentos.toLocaleString('es-AR')}` : '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: esIngreso ? S.green : S.red }}>${l.monto_neto?.toLocaleString('es-AR')}</td>
                        <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{l.forma_cobro}{l.numero_cheque ? ` #${l.numero_cheque}` : ''}</td>
                        <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 11, fontWeight: 600, color: l.factura_recibida ? S.green : S.amber }}>{l.factura_recibida ? '✓ Sí' : '⚠ No'}</span></td>
                        <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('liquidaciones', l.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── CAJA OFICIAL ── */}
      {tab === 'caja_oficial' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Caja oficial</div>
              <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                Saldo: <strong style={{ color: totalCajaOfIngresos - totalCajaOfEgresos >= 0 ? S.green : S.red, fontFamily: 'monospace' }}>
                  ${(totalCajaOfIngresos - totalCajaOfEgresos).toLocaleString('es-AR')}
                </strong>
              </div>
            </div>
            <button onClick={() => setShowFormCajaOf(!showFormCajaOf)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Movimiento
            </button>
          </div>

          {showFormCajaOf && (
            <Card>
              <SecTitle>Nuevo movimiento</SecTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div><Label>Tipo</Label>
                  <select value={formCajaOf.tipo} onChange={e => setFormCajaOf({...formCajaOf, tipo: e.target.value})} style={inputStyle}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>
                <div><Label>Categoría</Label>
                  <select value={formCajaOf.categoria} onChange={e => setFormCajaOf({...formCajaOf, categoria: e.target.value})} style={inputStyle}>
                    {CATEGORIAS_CAJA.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><Label>Fecha</Label><input type="date" value={formCajaOf.fecha} onChange={e => setFormCajaOf({...formCajaOf, fecha: e.target.value})} style={inputStyle} /></div>
                <div><Label>Monto $</Label><input type="number" value={formCajaOf.monto} onChange={e => setFormCajaOf({...formCajaOf, monto: e.target.value})} style={inputStyle} /></div>
                <div><Label>Forma de pago</Label>
                  <select value={formCajaOf.forma_pago} onChange={e => setFormCajaOf({...formCajaOf, forma_pago: e.target.value})} style={inputStyle}>
                    {FORMAS_COBRO.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div><Label>Comprobante</Label><input type="text" value={formCajaOf.comprobante} onChange={e => setFormCajaOf({...formCajaOf, comprobante: e.target.value})} style={inputStyle} placeholder="N° factura, recibo..." /></div>
                <div><Label>Contacto</Label>
                  <select value={formCajaOf.contacto_id} onChange={e => setFormCajaOf({...formCajaOf, contacto_id: e.target.value})} style={inputStyle}>
                    <option value="">— Sin contacto —</option>
                    {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '2/-1' }}><Label>Descripción</Label><input type="text" value={formCajaOf.descripcion} onChange={e => setFormCajaOf({...formCajaOf, descripcion: e.target.value})} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormCajaOf(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarCajaOf} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Contacto', 'Forma pago', 'Comprobante', 'Monto', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {cajaOfFiltrada.length === 0 && <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay movimientos.</td></tr>}
                  {cajaOfFiltrada.map(m => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: m.tipo === 'ingreso' ? S.greenLight : S.redLight, color: m.tipo === 'ingreso' ? S.green : S.red }}>{m.tipo}</span></td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{m.categoria}</td>
                      <td style={{ padding: '9px 12px', color: S.muted, fontSize: 12 }}>{m.descripcion || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{m.contactos?.nombre || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{m.forma_pago}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: S.hint }}>{m.comprobante || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: m.tipo === 'ingreso' ? S.green : S.red }}>
                        {m.tipo === 'ingreso' ? '+' : '-'}${m.monto?.toLocaleString('es-AR')}
                      </td>
                      <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('caja_oficial', m.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── CAJA PARALELA ── */}
      {tab === 'caja_paralela' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Caja paralela</div>
              <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                Saldo: <strong style={{ color: totalParIngresos - totalParEgresos >= 0 ? S.green : S.red, fontFamily: 'monospace' }}>
                  ${(totalParIngresos - totalParEgresos).toLocaleString('es-AR')}
                </strong>
              </div>
            </div>
            <button onClick={() => setShowFormCajaPar(!showFormCajaPar)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.purple, border: `1px solid ${S.purple}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Movimiento
            </button>
          </div>

          {showFormCajaPar && (
            <Card style={{ border: `1px solid #9F8ED4` }}>
              <SecTitle>Nuevo movimiento paralelo</SecTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div><Label>Tipo</Label>
                  <select value={formCajaPar.tipo} onChange={e => setFormCajaPar({...formCajaPar, tipo: e.target.value})} style={inputStyle}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>
                <div><Label>Monto $</Label><input type="number" value={formCajaPar.monto} onChange={e => setFormCajaPar({...formCajaPar, monto: e.target.value})} style={inputStyle} /></div>
                <div><Label>Fecha</Label><input type="date" value={formCajaPar.fecha} onChange={e => setFormCajaPar({...formCajaPar, fecha: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: '1/3' }}><Label>Descripción *</Label><input type="text" value={formCajaPar.descripcion} onChange={e => setFormCajaPar({...formCajaPar, descripcion: e.target.value})} style={inputStyle} placeholder="¿De qué es este movimiento?" /></div>
                <div><Label>Observaciones</Label><input type="text" value={formCajaPar.observaciones} onChange={e => setFormCajaPar({...formCajaPar, observaciones: e.target.value})} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormCajaPar(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarCajaPar} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.purple, border: `1px solid ${S.purple}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          {/* Resumen por mes */}
          {!filtroMes && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
              {(() => {
                const porMes = {}
                cajaParalela.filter(x => new Date(x.fecha).getFullYear() === parseInt(filtroAnio)).forEach(m => {
                  const mes = new Date(m.fecha).getMonth() + 1
                  if (!porMes[mes]) porMes[mes] = { ing: 0, eg: 0 }
                  if (m.tipo === 'ingreso') porMes[mes].ing += m.monto || 0
                  else porMes[mes].eg += m.monto || 0
                })
                return Object.entries(porMes).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).slice(0, 8).map(([mes, datos]) => (
                  <div key={mes} style={{ background: S.purpleLight, border: '1px solid #9F8ED4', borderRadius: 8, padding: '.85rem', cursor: 'pointer' }}
                    onClick={() => setFiltroMes(mes)}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: S.purple, marginBottom: 6 }}>{MESES[parseInt(mes)]}</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', color: S.green }}>+${datos.ing.toLocaleString('es-AR')}</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', color: S.red }}>-${datos.eg.toLocaleString('es-AR')}</div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: datos.ing - datos.eg >= 0 ? S.green : S.red, marginTop: 4 }}>
                      ${(datos.ing - datos.eg).toLocaleString('es-AR')}
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha', 'Tipo', 'Descripción', 'Observaciones', 'Monto', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {cajaParFiltrada.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay movimientos.</td></tr>}
                  {cajaParFiltrada.map(m => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: m.tipo === 'ingreso' ? S.greenLight : S.redLight, color: m.tipo === 'ingreso' ? S.green : S.red }}>{m.tipo}</span></td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{m.descripcion}</td>
                      <td style={{ padding: '9px 12px', color: S.muted, fontSize: 12 }}>{m.observaciones || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: m.tipo === 'ingreso' ? S.green : S.red }}>
                        {m.tipo === 'ingreso' ? '+' : '-'}${m.monto?.toLocaleString('es-AR')}
                      </td>
                      <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('caja_paralela', m.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── CONTACTOS ── */}
      {tab === 'contactos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{contactos.length} contactos</div>
            <button onClick={() => setShowFormContacto(!showFormContacto)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Nuevo contacto
            </button>
          </div>

          {showFormContacto && (
            <Card>
              <SecTitle>Nuevo contacto</SecTitle>
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
              const liqContact = liquidaciones.filter(l => l.contacto_id === c.id)
              const totalOp = liqContact.reduce((s, l) => s + (l.monto_neto || 0), 0)
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
                    <span style={{ color: S.muted }}>{liqContact.length} operaciones</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: totalOp >= 0 ? S.green : S.red }}>${(totalOp / 1000000).toFixed(1)}M</span>
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
