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
const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }
const inpMono = { ...inp, fontFamily: 'monospace' }
const Lbl = ({ children }) => <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{children}</div>

export default function Insumos({ usuario }) {
  const [tab, setTab] = useState('compras')
  const [compras, setCompras] = useState([])
  const [stockAlim, setStockAlim] = useState([])
  const [stockSan, setStockSan] = useState([])
  const [sinPrecio, setSinPrecio] = useState([])
  const [ingresosStock, setIngresosStock] = useState([])
  const [chequesCartera, setChequesCartera] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'alimentacion',
    insumo_id: '',
    insumo_nombre: '',
    cantidad: '',
    unidad: 'kg',
    precio_unitario: '',
    total: '',
    proveedor: '',
    numero_factura: '',
    forma_pago: 'transferencia',
    es_paralelo: false,
    observaciones: '',
  })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: c }, { data: sa }, { data: ss }, { data: ip }, { data: is_ }, { data: ch }] = await Promise.all([
      supabase.from('compras_insumos').select('*').order('fecha', { ascending: false }),
      supabase.from('stock_insumos').select('*').order('insumo'),
      supabase.from('stock_sanitario').select('*').order('producto'),
      supabase.from('ingresos_stock').select('*').is('precio_por_kg', null).order('creado_en', { ascending: false }),
      supabase.from('ingresos_stock').select('*').order('creado_en', { ascending: false }).limit(200),
      supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento', { ascending: true }),
    ])
    setCompras(c || [])
    setStockAlim(sa || [])
    setStockSan(ss || [])
    setIngresosStock(is_ || [])
    setChequesCartera(ch || [])
    // Ingresos de alimentación sin precio → van al banner
    setSinPrecio(ip || [])
    setLoading(false)
  }

  const stockActual = form.tipo === 'alimentacion' ? stockAlim : stockSan

  async function guardar() {
    if (!form.insumo_id || !form.cantidad || !form.precio_unitario) {
      alert('Completá insumo, cantidad y precio')
      return
    }
    setGuardando(true)

    const cantidad = parseFloat(form.cantidad)
    const precioUnit = parseFloat(form.precio_unitario)
    const total = form.total ? parseFloat(form.total) : Math.round(cantidad * precioUnit)

    // Registrar en caja primero para obtener el id
    let caja_oficial_id = null
    let caja_paralela_id = null
    if (form.es_paralelo) {
      const { data: cp } = await supabase.from('caja_paralela').insert({
        fecha: form.fecha, tipo: 'egreso',
        descripcion: `Compra ${form.insumo_nombre} — ${form.proveedor || ''}`,
        monto: total,
      }).select().single()
      caja_paralela_id = cp?.id || null
    } else {
      const { data: co } = await supabase.from('caja_oficial').insert({
        fecha: form.fecha, tipo: 'egreso',
        categoria: 'Compra insumos',
        descripcion: `Compra ${form.insumo_nombre} — ${form.proveedor || ''}`,
        monto: total,
        forma_pago: form.forma_pago,
      }).select().single()
      caja_oficial_id = co?.id || null
    }

    // Registrar compra con referencia a caja
    await supabase.from('compras_insumos').insert({
      fecha: form.fecha,
      insumo_id: parseInt(form.insumo_id),
      insumo_tipo: form.tipo,
      insumo_nombre: form.insumo_nombre,
      cantidad,
      unidad: form.unidad,
      precio_unitario: precioUnit,
      total,
      proveedor: form.proveedor || null,
      numero_factura: form.numero_factura || null,
      forma_pago: form.forma_pago,
      es_paralelo: form.es_paralelo,
      observaciones: form.observaciones || null,
      registrado_por: usuario?.id,
      caja_oficial_id,
      caja_paralela_id,
    })

    // Actualizar stock
    if (form.tipo === 'alimentacion') {
      const item = stockAlim.find(s => s.id === parseInt(form.insumo_id))
      if (item) {
        await supabase.from('stock_insumos').update({
          cantidad_kg: (item.cantidad_kg || 0) + cantidad,
          precio_referencia: precioUnit,
          actualizado_en: new Date().toISOString(),
        }).eq('id', item.id)
      }
    } else {
      const item = stockSan.find(s => s.id === parseInt(form.insumo_id))
      if (item) {
        await supabase.from('stock_sanitario').update({
          cantidad_ml: (item.cantidad_ml || 0) + cantidad,
          precio_referencia: precioUnit,
          actualizado_en: new Date().toISOString(),
        }).eq('id', item.id)
      }
    }

    setShowForm(false)
    setForm({
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'alimentacion', insumo_id: '', insumo_nombre: '',
      cantidad: '', unidad: 'kg', precio_unitario: '', total: '',
      proveedor: '', numero_factura: '', forma_pago: 'transferencia',
      es_paralelo: false, observaciones: '',
    })
    setGuardando(false)
    await cargar()
  }

  if (loading) return <Loader />

  const totalCompras = compras.reduce((s, c) => s + (c.total || 0), 0)

  const TABS = [
    { key: 'compras', label: 'Historial de compras' },
    { key: 'stock_alim', label: 'Stock alimentación' },
    { key: 'stock_san', label: 'Stock sanitario' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>Insumos</div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Registrar compra
        </button>
      </div>

      {/* Form nueva compra */}
      {showForm && (
        <div style={{ background: S.surface, border: `1px solid ${S.accent}`, borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: S.accent, marginBottom: '1rem' }}>Nueva compra de insumo</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <Lbl>Tipo de insumo</Lbl>
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value, insumo_id: '', insumo_nombre: '', unidad: e.target.value === 'alimentacion' ? 'kg' : 'ml'})} style={inp}>
                <option value="alimentacion">Alimentación</option>
                <option value="sanitario">Sanitario</option>
              </select>
            </div>
            <div>
              <Lbl>Insumo *</Lbl>
              <select value={form.insumo_id} onChange={e => {
                const item = stockActual.find(s => String(s.id) === e.target.value)
                setForm({...form, insumo_id: e.target.value, insumo_nombre: item ? (item.insumo || item.producto) : '', unidad: item?.unidad || (form.tipo === 'alimentacion' ? 'kg' : 'ml')})
              }} style={inp}>
                <option value="">— Seleccioná —</option>
                {stockActual.map(s => <option key={s.id} value={s.id}>{s.insumo || s.producto}</option>)}
              </select>
            </div>
            <div>
              <Lbl>Fecha</Lbl>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inp} />
            </div>
            <div>
              <Lbl>Cantidad ({form.unidad})</Lbl>
              <input type="number" value={form.cantidad} onChange={e => {
                const cant = e.target.value
                const total = cant && form.precio_unitario ? String(Math.round(parseFloat(cant) * parseFloat(form.precio_unitario))) : ''
                setForm({...form, cantidad: cant, total})
              }} style={inpMono} />
            </div>
            <div>
              <Lbl>Precio unitario $/{form.unidad}</Lbl>
              <input type="number" value={form.precio_unitario} onChange={e => {
                const precio = e.target.value
                const total = precio && form.cantidad ? String(Math.round(parseFloat(form.cantidad) * parseFloat(precio))) : ''
                setForm({...form, precio_unitario: precio, total})
              }} style={inpMono} />
            </div>
            <div>
              <Lbl>Total $ (calculado)</Lbl>
              <input type="number" value={form.total} onChange={e => setForm({...form, total: e.target.value})}
                style={{...inpMono, fontWeight: 600, border: `1px solid ${S.accent}`}} />
            </div>
            <div>
              <Lbl>Proveedor</Lbl>
              <input type="text" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inp} />
            </div>
            <div>
              <Lbl>N° Factura</Lbl>
              <input type="text" value={form.numero_factura} onChange={e => setForm({...form, numero_factura: e.target.value})} style={inp} />
            </div>
            <div>
              <Lbl>Forma de pago</Lbl>
              <select value={form.forma_pago} onChange={e => setForm({...form, forma_pago: e.target.value})} style={inp}>
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="cheque">Cheque</option>
                <option value="cuenta_corriente">Cuenta corriente</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: S.purple, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.es_paralelo} onChange={e => setForm({...form, es_paralelo: e.target.checked})} />
                Pago en cuenta paralela
              </label>
            </div>
            <div>
              <Lbl>Observaciones</Lbl>
              <input type="text" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} style={inp} />
            </div>
          </div>

          {/* Resumen */}
          {form.total && (
            <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 6, padding: '10px 14px', marginBottom: '1rem', fontSize: 13 }}>
              Total a pagar: <strong style={{ fontFamily: 'monospace', color: S.red }}>${parseFloat(form.total).toLocaleString('es-AR')}</strong>
              {' '} · {form.cantidad} {form.unidad} de {form.insumo_nombre || '—'}
              {' '} · ${parseFloat(form.precio_unitario || 0).toLocaleString('es-AR')}/{form.unidad}
              {' '} · {form.es_paralelo ? '💜 Paralelo' : '🏦 Oficial'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardar} disabled={guardando}
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              {guardando ? 'Guardando...' : 'Guardar compra'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Banner ingresos sin precio */}
      {sinPrecio.length > 0 && (
        <BannerSinPrecio ingresos={sinPrecio} stockAlim={stockAlim} usuario={usuario} onCargar={cargar} chequesCartera={chequesCartera} S={S} />
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB HISTORIAL */}
      {tab === 'compras' && (
        <div>
          <div style={{ fontSize: 12, color: S.red, marginBottom: '1rem' }}>
            Total gastado: <strong style={{ fontFamily: 'monospace' }}>${totalCompras.toLocaleString('es-AR')}</strong>
          </div>
          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ background: S.bg }}>
                  {['Fecha', 'Tipo', 'Insumo', 'Cantidad', '$/unidad', 'Total', 'Proveedor', 'Factura', 'Pago', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compras.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: S.hint }}>No hay compras registradas.</td></tr>
                )}
                {compras.map(c => (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${S.border}`, background: c.es_paralelo ? S.purpleLight : 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: c.insumo_tipo === 'alimentacion' ? S.greenLight : S.accentLight, color: c.insumo_tipo === 'alimentacion' ? S.green : S.accent }}>
                        {c.insumo_tipo === 'alimentacion' ? 'Alim.' : 'Sanit.'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{c.insumo_nombre}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{c.cantidad?.toLocaleString('es-AR')} {c.unidad}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>${c.precio_unitario?.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>-${c.total?.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '8px 12px', color: S.muted }}>{c.proveedor || '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: S.muted }}>{c.numero_factura || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 11 }}>
                      {c.es_paralelo ? <span style={{ color: S.purple, fontWeight: 600 }}>Paralelo</span> : c.forma_pago}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button onClick={async () => {
                        if (!confirm('¿Eliminar esta compra? Se eliminará también de la caja.')) return
                        // Eliminar de caja
                        if (c.caja_oficial_id) await supabase.from('caja_oficial').delete().eq('id', c.caja_oficial_id)
                        if (c.caja_paralela_id) await supabase.from('caja_paralela').delete().eq('id', c.caja_paralela_id)
                        // Revertir stock
                        const tabla = c.insumo_tipo === 'alimentacion' ? 'stock_insumos' : 'stock_sanitario'
                        const cantCol = c.insumo_tipo === 'alimentacion' ? 'cantidad_kg' : 'cantidad_ml'
                        const { data: item } = await supabase.from(tabla).select('*').eq('id', c.insumo_id).single()
                        if (item) await supabase.from(tabla).update({ [cantCol]: Math.max(0, (item[cantCol] || 0) - (c.cantidad || 0)) }).eq('id', c.insumo_id)
                        await supabase.from('compras_insumos').delete().eq('id', c.id)
                        await cargar()
                      }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB STOCK ALIMENTACION */}
      {tab === 'stock_alim' && (
        <StockTable items={stockAlim} tipo="alimentacion" onCargar={cargar} ingresosStock={ingresosStock} />
      )}

      {/* TAB STOCK SANITARIO */}
      {tab === 'stock_san' && (
        <StockTable items={stockSan} tipo="sanitario" onCargar={cargar} />
      )}
    </div>
  )
}

function StockTable({ items, tipo, onCargar, ingresosStock = [] }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', unidad: tipo === 'alimentacion' ? 'kg' : 'ml', minimo: '' })
  const [guardando, setGuardando] = useState(false)
  const [editandoIng, setEditandoIng] = useState(null) // id del ingreso en edición
  const [formIng, setFormIng] = useState({ cantidad_kg: '', precio_por_kg: '', proveedor: '' })

  async function guardarInsumo() {
    if (!form.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    if (tipo === 'alimentacion') {
      await supabase.from('stock_insumos').insert({ insumo: form.nombre, unidad: form.unidad, cantidad_kg: 0, minimo_kg: parseFloat(form.minimo) || 0 })
    } else {
      await supabase.from('stock_sanitario').insert({ producto: form.nombre, unidad: form.unidad, cantidad_ml: 0, minimo_stock: parseFloat(form.minimo) || 0 })
    }
    setShowForm(false)
    setForm({ nombre: '', unidad: tipo === 'alimentacion' ? 'kg' : 'ml', minimo: '' })
    setGuardando(false)
    await onCargar()
  }

  const cantCol = tipo === 'alimentacion' ? 'cantidad_kg' : 'cantidad_ml'
  const minCol = tipo === 'alimentacion' ? 'minimo_kg' : 'minimo_stock'
  const nombreCol = tipo === 'alimentacion' ? 'insumo' : 'producto'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Stock {tipo === 'alimentacion' ? 'alimentación' : 'sanitario'}</div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Agregar insumo
        </button>
      </div>

      {showForm && (
        <div style={{ background: S.accentLight, border: `1px solid ${S.accent}`, borderRadius: 8, padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Nombre</div>
            <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Unidad</div>
            <select value={form.unidad} onChange={e => setForm({...form, unidad: e.target.value})} style={inp}>
              {tipo === 'alimentacion' ? ['kg', 'tn', 'litros', 'unidades'].map(u => <option key={u}>{u}</option>) : ['ml', 'litros', 'cc', 'dosis'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Stock mínimo</div>
            <input type="number" value={form.minimo} onChange={e => setForm({...form, minimo: e.target.value})} style={inp} />
          </div>
          <button onClick={guardarInsumo} disabled={guardando}
            style={{ padding: '9px 16px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
            Guardar
          </button>
          <button onClick={() => setShowForm(false)}
            style={{ padding: '9px 16px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      )}

      <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: S.bg }}>
              {['Insumo', 'Stock actual', 'Unidad', 'Precio ref.', 'Mínimo', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>Sin insumos cargados.</td></tr>}
            {items.map(s => {
              const cant = s[cantCol] || 0
              const min = s[minCol] || 0
              const bajo = min > 0 && cant <= min
              const esEdit = editandoIng === s.id
              return (
                <>
                  <tr key={s.id} style={{ borderBottom: esEdit ? 'none' : `1px solid ${S.border}`, background: esEdit ? S.accentLight : bajo ? S.redLight : 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s[nombreCol]}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: bajo ? S.red : S.green }}>{cant.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '8px 12px', color: S.muted }}>{s.unidad || (tipo === 'alimentacion' ? 'kg' : 'ml')}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{s.precio_referencia ? `$${s.precio_referencia.toLocaleString('es-AR')}` : '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted }}>{min > 0 ? min.toLocaleString('es-AR') : '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {bajo ? <span style={{ padding: '2px 8px', borderRadius: 4, background: S.redLight, color: S.red, fontSize: 11, fontWeight: 600 }}>⚠ Stock bajo</span>
                        : <span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11 }}>OK</span>}
                    </td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => {
                          setEditandoIng(s.id)
                          setFormIng({ cantidad_kg: String(cant), precio_por_kg: String(s.precio_referencia || ''), proveedor: String(min) })
                        }} style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid #85B7EB`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                          Editar
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`¿Eliminar "${s[nombreCol]}"?`)) return
                          const tabla = tipo === 'alimentacion' ? 'stock_insumos' : 'stock_sanitario'
                          await supabase.from(tabla).delete().eq('id', s.id)
                          await onCargar()
                        }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                  {esEdit && (
                    <tr key={`edit-${s.id}`} style={{ borderBottom: `1px solid ${S.border}`, background: S.accentLight }}>
                      <td colSpan={7} style={{ padding: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 8, alignItems: 'flex-end' }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Stock actual ({tipo === 'alimentacion' ? 'kg' : 'ml'})</div>
                            <input type="number" value={formIng.cantidad_kg} onChange={e => setFormIng({ ...formIng, cantidad_kg: e.target.value })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Precio ref. $/{tipo === 'alimentacion' ? 'kg' : 'ml'}</div>
                            <input type="number" value={formIng.precio_por_kg} onChange={e => setFormIng({ ...formIng, precio_por_kg: e.target.value })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Stock mínimo</div>
                            <input type="number" value={formIng.proveedor} onChange={e => setFormIng({ ...formIng, proveedor: e.target.value })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                          </div>
                          <button onClick={async () => {
                            const tabla = tipo === 'alimentacion' ? 'stock_insumos' : 'stock_sanitario'
                            const cantCol2 = tipo === 'alimentacion' ? 'cantidad_kg' : 'cantidad_ml'
                            const minCol2 = tipo === 'alimentacion' ? 'minimo_kg' : 'minimo_stock'
                            await supabase.from(tabla).update({
                              [cantCol2]: parseFloat(formIng.cantidad_kg) || 0,
                              precio_referencia: formIng.precio_por_kg ? parseFloat(formIng.precio_por_kg) : null,
                              [minCol2]: parseFloat(formIng.proveedor) || 0,
                              actualizado_en: new Date().toISOString(),
                            }).eq('id', s.id)
                            setEditandoIng(null)
                            await onCargar()
                          }} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Guardar
                          </button>
                          <button onClick={() => setEditandoIng(null)}
                            style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Historial de ingresos (solo alimentación) */}
      {tipo === 'alimentacion' && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>
            Historial de ingresos de stock
          </div>
          {ingresosStock.length === 0
            ? <div style={{ fontSize: 13, color: S.hint }}>No hay ingresos registrados.</div>
            : (
              <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
                  <thead>
                    <tr style={{ background: S.bg }}>
                      {['Fecha', 'Insumo', 'Cantidad', 'Precio/kg', 'Total', 'Proveedor', 'Registrado por', ''].map((h, i) => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: i > 1 && i < 7 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ingresosStock.map(ing => {
                      const esEditando = editandoIng === ing.id
                      return (
                        <>
                          <tr key={ing.id} style={{ borderBottom: esEditando ? 'none' : `1px solid ${S.border}`, background: esEditando ? S.accentLight : 'transparent' }}>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted, whiteSpace: 'nowrap' }}>
                              {new Date(ing.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </td>
                            <td style={{ padding: '9px 12px', fontWeight: 600 }}>{ing.insumo_nombre}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{ing.cantidad_kg?.toLocaleString('es-AR')} kg</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                              {ing.precio_por_kg
                                ? `$${ing.precio_por_kg.toLocaleString('es-AR')}`
                                : <span style={{ color: S.amber, fontSize: 11, fontWeight: 600 }}>Pendiente</span>}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                              {ing.total ? `$${ing.total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'}
                            </td>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{ing.proveedor || '—'}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{ing.registrado_por || '—'}</td>
                            <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => {
                                  setEditandoIng(ing.id)
                                  setFormIng({ cantidad_kg: String(ing.cantidad_kg || ''), precio_por_kg: String(ing.precio_por_kg || ''), proveedor: ing.proveedor || '' })
                                }} style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid #85B7EB`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                                  Editar
                                </button>
                                <button onClick={async () => {
                                  if (!confirm('¿Eliminar este ingreso? Se restará del stock.')) return
                                  // Restar del stock
                                  const item = items.find(s => s.id === ing.insumo_id)
                                  if (item && ing.cantidad_kg) {
                                    await supabase.from('stock_insumos').update({
                                      cantidad_kg: Math.max(0, (item.cantidad_kg || 0) - ing.cantidad_kg),
                                      actualizado_en: new Date().toISOString(),
                                    }).eq('id', item.id)
                                  }
                                  await supabase.from('ingresos_stock').delete().eq('id', ing.id)
                                  await onCargar()
                                }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                          {esEditando && (
                            <tr key={`edit-${ing.id}`} style={{ borderBottom: `1px solid ${S.border}`, background: S.accentLight }}>
                              <td colSpan={8} style={{ padding: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 8, alignItems: 'flex-end' }}>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Cantidad (kg)</div>
                                    <input type="number" value={formIng.cantidad_kg} onChange={e => setFormIng({ ...formIng, cantidad_kg: e.target.value })}
                                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Precio/kg ($)</div>
                                    <input type="number" value={formIng.precio_por_kg} onChange={e => setFormIng({ ...formIng, precio_por_kg: e.target.value })}
                                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Proveedor</div>
                                    <input type="text" value={formIng.proveedor} onChange={e => setFormIng({ ...formIng, proveedor: e.target.value })}
                                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                                  </div>
                                  <button onClick={async () => {
                                    const nuevaCant = parseFloat(formIng.cantidad_kg) || ing.cantidad_kg
                                    const nuevoPrecio = formIng.precio_por_kg ? parseFloat(formIng.precio_por_kg) : ing.precio_por_kg
                                    const diffKg = nuevaCant - (ing.cantidad_kg || 0)
                                    // Actualizar ingresos_stock
                                    await supabase.from('ingresos_stock').update({
                                      cantidad_kg: nuevaCant,
                                      precio_por_kg: nuevoPrecio || null,
                                      total: nuevoPrecio ? Math.round(nuevaCant * nuevoPrecio) : null,
                                      proveedor: formIng.proveedor || null,
                                    }).eq('id', ing.id)
                                    // Ajustar stock si cambió la cantidad
                                    if (diffKg !== 0) {
                                      const item = items.find(s => s.id === ing.insumo_id)
                                      if (item) {
                                        await supabase.from('stock_insumos').update({
                                          cantidad_kg: Math.max(0, (item.cantidad_kg || 0) + diffKg),
                                          actualizado_en: new Date().toISOString(),
                                        }).eq('id', item.id)
                                      }
                                    }
                                    setEditandoIng(null)
                                    await onCargar()
                                  }} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    Guardar
                                  </button>
                                  <button onClick={() => setEditandoIng(null)}
                                    style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    Cancelar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}

function BannerSinPrecio({ ingresos, stockAlim, usuario, onCargar, chequesCartera = [], S }) {
  const [editando, setEditando] = useState({})

  function initEp() {
    return { precio: '', proveedor: '', forma_pago: 'transferencia', es_paralelo: false, subtipo_cheque: '', cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' }, cheque_tercero_id: '' }
  }

  async function guardarPrecio(ing) {
    const ep = editando[ing.id]
    if (!ep?.precio) { alert('Ingresá el precio'); return }
    const precioNum = parseFloat(ep.precio)
    const total = Math.round(ing.cantidad_kg * precioNum)
    const fecha = new Date().toISOString().split('T')[0]

    // 1. Actualizar ingresos_stock
    await supabase.from('ingresos_stock').update({
      precio_por_kg: precioNum,
      total,
      proveedor: ep.proveedor || null,
      precio_cargado_por: usuario?.nombre || usuario?.email,
      precio_cargado_en: new Date().toISOString(),
    }).eq('id', ing.id)

    // 2. Recalcular precio_referencia (promedio ponderado)
    const { data: todos } = await supabase.from('ingresos_stock')
      .select('cantidad_kg, precio_por_kg')
      .eq('insumo_id', ing.insumo_id)
      .not('precio_por_kg', 'is', null)
    const lista = todos || []
    const yaIncluido = lista.some(i => i.precio_por_kg === precioNum && i.cantidad_kg === ing.cantidad_kg)
    if (!yaIncluido) lista.push({ cantidad_kg: ing.cantidad_kg, precio_por_kg: precioNum })
    const totalKg = lista.reduce((s, i) => s + (i.cantidad_kg || 0), 0)
    if (totalKg > 0) {
      const prom = Math.round(lista.reduce((s, i) => s + (i.precio_por_kg || 0) * (i.cantidad_kg || 0), 0) / totalKg)
      const item = stockAlim.find(s => s.id === ing.insumo_id)
      if (item) {
        await supabase.from('stock_insumos').update({
          precio_referencia: prom,
          actualizado_en: new Date().toISOString(),
        }).eq('id', item.id)
      }
    }

    // 3. Registrar en caja
    const desc = `Compra ${ing.insumo_nombre}${ep.proveedor ? ` — ${ep.proveedor}` : ''} (${ing.cantidad_kg?.toLocaleString('es-AR')} kg)`
    const formaPago = ep.subtipo_cheque ? `e-cheq` : (ep.forma_pago || 'transferencia')

    if (ep.es_paralelo) {
      await supabase.from('caja_paralela').insert({ fecha, tipo: 'egreso', descripcion: desc, monto: total })
      // Si entregó cheque de tercero como pago paralelo, marcarlo como depositado
      if (ep.subtipo_cheque === 'tercero' && ep.cheque_tercero_id) {
        await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(ep.cheque_tercero_id))
      }
    } else {
      const { data: mov } = await supabase.from('caja_oficial').insert({
        fecha, tipo: 'egreso', categoria: 'Insumos alimentación',
        descripcion: desc, monto: total, forma_pago: formaPago,
      }).select().single()

      // 4. Manejo de cheques
      if (ep.subtipo_cheque === 'propio') {
        // Crear cheque emitido
        await supabase.from('cheques').insert({
          tipo: 'emitido',
          numero: ep.cheque_propio.numero || null,
          banco: ep.cheque_propio.banco || null,
          fecha_cobro: fecha,
          fecha_vencimiento: ep.cheque_propio.fecha_vencimiento,
          monto: total,
          beneficiario: ep.proveedor || null,
          estado: 'en_cartera',
          caja_oficial_id: mov?.id || null,
          registrado_por: usuario?.id,
        })
      } else if (ep.subtipo_cheque === 'tercero' && ep.cheque_tercero_id) {
        // Marcar cheque de tercero como entregado
        await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(ep.cheque_tercero_id))
      }
    }

    const nuevo = { ...editando }
    delete nuevo[ing.id]
    setEditando(nuevo)
    await onCargar()
  }

  return (
    <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: '.85rem' }}>
        ⚠ {ingresos.length} ingreso{ingresos.length !== 1 ? 's' : ''} de stock sin precio cargado
      </div>
      {ingresos.map(ing => {
        const ep = editando[ing.id]
        const totalCalc = ep?.precio ? Math.round(ing.cantidad_kg * parseFloat(ep.precio)) : null
        const esCheque = ep?.subtipo_cheque
        return (
          <div key={ing.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', marginBottom: '.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: ep ? 12 : 0 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{ing.insumo_nombre}</div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                  {ing.cantidad_kg?.toLocaleString('es-AR')} kg · registrado por {ing.registrado_por} · {new Date(ing.creado_en).toLocaleDateString('es-AR')}
                </div>
              </div>
              {!ep && (
                <button onClick={() => setEditando({ ...editando, [ing.id]: initEp() })}
                  style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", flexShrink: 0, marginLeft: 12 }}>
                  Cargar precio
                </button>
              )}
            </div>
            {ep && (
              <div>
                {/* Fila 1: precio, proveedor, forma pago, paralelo */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Precio por kg ($) *</div>
                    <input type="number" placeholder="ej. 130" value={ep.precio}
                      onChange={e => setEditando({ ...editando, [ing.id]: { ...ep, precio: e.target.value } })}
                      style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontWeight: 600, fontFamily: 'monospace' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Proveedor</div>
                    <input type="text" placeholder="ej. Agrosol" value={ep.proveedor}
                      onChange={e => setEditando({ ...editando, [ing.id]: { ...ep, proveedor: e.target.value } })}
                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Forma de pago</div>
                    <select value={ep.forma_pago} onChange={e => setEditando({ ...editando, [ing.id]: { ...ep, forma_pago: e.target.value, subtipo_cheque: '' } })}
                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="e-cheq">E-cheq</option>
                      <option value="cuenta_corriente">Cuenta corriente</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: S.purple, cursor: 'pointer' }}>
                      <input type="checkbox" checked={ep.es_paralelo} onChange={e => setEditando({ ...editando, [ing.id]: { ...ep, es_paralelo: e.target.checked } })} />
                      Pago paralelo
                    </label>
                  </div>
                </div>

                {/* E-cheq */}
                {ep.forma_pago === 'e-cheq' && (
                  <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Tipo de e-cheq</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: esCheque ? 10 : 0 }}>
                      {(ep.es_paralelo ? ['tercero'] : ['propio']).map(t => (
                        <button key={t} onClick={() => setEditando({ ...editando, [ing.id]: { ...ep, subtipo_cheque: ep.subtipo_cheque === t ? '' : t } })}
                          style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", border: `1px solid ${ep.subtipo_cheque === t ? S.accent : S.border}`, background: ep.subtipo_cheque === t ? S.accentLight : 'transparent', color: ep.subtipo_cheque === t ? S.accent : S.muted }}>
                          {t === 'propio' ? '📤 E-cheq propio' : '📥 E-cheq de tercero'}
                        </button>
                      ))}
                    </div>

                    {/* Cheq propio: campos */}
                    {ep.subtipo_cheque === 'propio' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>N° cheque</div>
                          <input type="text" value={ep.cheque_propio.numero}
                            onChange={e => setEditando({ ...editando, [ing.id]: { ...ep, cheque_propio: { ...ep.cheque_propio, numero: e.target.value } } })}
                            style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Banco</div>
                          <input type="text" value={ep.cheque_propio.banco}
                            onChange={e => setEditando({ ...editando, [ing.id]: { ...ep, cheque_propio: { ...ep.cheque_propio, banco: e.target.value } } })}
                            style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: S.amber, textTransform: 'uppercase', marginBottom: 3 }}>Fecha vencimiento *</div>
                          <input type="date" value={ep.cheque_propio.fecha_vencimiento}
                            onChange={e => setEditando({ ...editando, [ing.id]: { ...ep, cheque_propio: { ...ep.cheque_propio, fecha_vencimiento: e.target.value } } })}
                            style={{ width: '100%', border: `1px solid ${S.amber}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                        </div>
                      </div>
                    )}

                    {/* Cheq tercero: lista cheques en cartera */}
                    {ep.subtipo_cheque === 'tercero' && (
                      <div style={{ marginTop: 10 }}>
                        {(() => {
                          const lista = chequesCartera.filter(ch => ep.es_paralelo ? ch.es_paralelo : !ch.es_paralelo)
                          return lista.length === 0
                            ? <div style={{ fontSize: 13, color: S.hint }}>No hay cheques en cartera {ep.es_paralelo ? '(paralelo)' : '(oficial)'}.</div>
                            : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {lista.map(ch => (
                                  <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1px solid ${ep.cheque_tercero_id === String(ch.id) ? S.accent : S.border}`, borderRadius: 6, background: ep.cheque_tercero_id === String(ch.id) ? S.accentLight : S.surface, cursor: 'pointer' }}>
                                    <input type="radio" name={`cheque_${ing.id}`} value={ch.id}
                                      checked={ep.cheque_tercero_id === String(ch.id)}
                                      onChange={() => setEditando({ ...editando, [ing.id]: { ...ep, cheque_tercero_id: String(ch.id) } })} />
                                    <div style={{ fontSize: 13 }}>
                                      <strong>${ch.monto?.toLocaleString('es-AR')}</strong>
                                      <span style={{ color: S.muted, marginLeft: 8 }}>
                                        #{ch.numero || 'sin nro'} · {ch.banco || '—'} · vence {ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : '—'}
                                        {ch.librador ? ` · ${ch.librador}` : ''}
                                      </span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Resumen */}
                {totalCalc && (
                  <div style={{ background: ep.es_paralelo ? S.purpleLight : S.greenLight, border: `1px solid ${ep.es_paralelo ? '#C4A8F0' : '#97C459'}`, borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: ep.es_paralelo ? S.purple : S.green }}>
                    Total: <strong>${totalCalc.toLocaleString('es-AR')}</strong>
                    {' '}({ing.cantidad_kg?.toLocaleString('es-AR')} kg × ${parseFloat(ep.precio).toLocaleString('es-AR')}/kg)
                    {' · '}{ep.es_paralelo ? `💜 Paralelo${ep.subtipo_cheque === 'tercero' ? ' · 📥 cheq tercero' : ''}` : ep.subtipo_cheque === 'propio' ? '📤 E-cheq propio' : ep.subtipo_cheque === 'tercero' ? '📥 E-cheq tercero' : `🏦 ${ep.forma_pago}`}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => guardarPrecio(ing)}
                    style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    Guardar y registrar en caja
                  </button>
                  <button onClick={() => { const n = { ...editando }; delete n[ing.id]; setEditando(n) }}
                    style={{ padding: '8px 14px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
