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
    const [{ data: c }, { data: sa }, { data: ss }] = await Promise.all([
      supabase.from('compras_insumos').select('*').order('fecha', { ascending: false }),
      supabase.from('stock_insumos').select('*').order('insumo'),
      supabase.from('stock_sanitario').select('*').order('producto'),
    ])
    setCompras(c || [])
    setStockAlim(sa || [])
    setStockSan(ss || [])
    // Insumos con stock > 0 pero sin precio de referencia
    const todosStock = [...(sa || []).map(s => ({ ...s, tipo: 'alimentacion', nombre: s.insumo, cant: s.cantidad_kg || 0 })),
                       ...(ss || []).map(s => ({ ...s, tipo: 'sanitario', nombre: s.producto, cant: s.cantidad_ml || 0 }))]
    setSinPrecio(todosStock.filter(s => !s.precio_referencia && s.cant > 0))
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

    // Registrar compra
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

    // Registrar en caja
    if (form.es_paralelo) {
      await supabase.from('caja_paralela').insert({
        fecha: form.fecha, tipo: 'egreso',
        descripcion: `Compra ${form.insumo_nombre} — ${form.proveedor || ''}`,
        monto: total,
      })
    } else {
      await supabase.from('caja_oficial').insert({
        fecha: form.fecha, tipo: 'egreso',
        categoria: 'Compra insumos',
        descripcion: `Compra ${form.insumo_nombre} — ${form.proveedor || ''}`,
        monto: total,
        forma_pago: form.forma_pago,
      })
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

      {/* Banner insumos sin precio de referencia */}
      {sinPrecio.length > 0 && (
        <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: '.75rem' }}>
            ⚠ {sinPrecio.length} insumo{sinPrecio.length !== 1 ? 's' : ''} sin precio de referencia — registrá una compra para asignarlo
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sinPrecio.map(s => (
              <div key={s.id + s.tipo} style={{ background: S.surface, border: `1px solid #EF9F27`, borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{s.nombre}</span>
                <span style={{ color: S.muted, fontSize: 12, marginLeft: 8 }}>
                  {s.cant.toLocaleString('es-AR')} {s.tipo === 'alimentacion' ? 'kg' : 'ml'} · {s.tipo === 'alimentacion' ? 'Alim.' : 'Sanit.'}
                </span>
              </div>
            ))}
          </div>
        </div>
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
                      <button onClick={async () => { if (!confirm('¿Eliminar?')) return; await supabase.from('compras_insumos').delete().eq('id', c.id); await cargar() }}
                        style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
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
        <StockTable items={stockAlim} tipo="alimentacion" onCargar={cargar} />
      )}

      {/* TAB STOCK SANITARIO */}
      {tab === 'stock_san' && (
        <StockTable items={stockSan} tipo="sanitario" onCargar={cargar} />
      )}
    </div>
  )
}

function StockTable({ items, tipo, onCargar }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', unidad: tipo === 'alimentacion' ? 'kg' : 'ml', minimo: '' })
  const [guardando, setGuardando] = useState(false)

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
              {['Insumo', 'Stock actual', 'Unidad', 'Precio ref.', 'Mínimo', 'Estado'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>Sin insumos cargados.</td></tr>}
            {items.map(s => {
              const cant = s[cantCol] || 0
              const min = s[minCol] || 0
              const bajo = min > 0 && cant <= min
              return (
                <tr key={s.id} style={{ borderBottom: `1px solid ${S.border}`, background: bajo ? S.redLight : 'transparent' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s[nombreCol]}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: bajo ? S.red : S.green }}>{cant.toLocaleString('es-AR')}</td>
                  <td style={{ padding: '8px 12px', color: S.muted }}>{s.unidad || (tipo === 'alimentacion' ? 'kg' : 'ml')}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{s.precio_referencia ? `$${s.precio_referencia.toLocaleString('es-AR')}` : '—'}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted }}>{min > 0 ? min.toLocaleString('es-AR') : '—'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {bajo ? <span style={{ padding: '2px 8px', borderRadius: 4, background: S.redLight, color: S.red, fontSize: 11, fontWeight: 600 }}>⚠ Stock bajo</span>
                      : <span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11 }}>OK</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
