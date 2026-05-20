import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
}

function Loader() {
  return <div style={{ padding: '3rem', textAlign: 'center', color: S.muted }}>Cargando...</div>
}

export default function Contactos({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [contactos, setContactos] = useState([])
  const [ventas, setVentas] = useState([])
  const [lotes, setLotes] = useState([])
  const [pagosVenta, setPagosVenta] = useState({})
  const [pagosCompra, setPagosCompra] = useState({})
  const [vencimientosCompra, setVencimientosCompra] = useState({})
  const [filtro, setFiltro] = useState('')
  const [contactoSeleccionado, setContactoSeleccionado] = useState(null)
  const [mostrarNegro, setMostrarNegro] = useState(false)
  const [tabFicha, setTabFicha] = useState('oficial')
  const puedeVerParalelo = usuario?.rol === 'dueno' || usuario?.rol === 'secretaria'
  const [showForm, setShowForm] = useState(false)
  const [formContacto, setFormContacto] = useState({ nombre: '', tipo: 'otro', telefono: '', email: '', cuit: '', direccion: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)

  const TIPOS = ['comprador_hacienda', 'vendedor_hacienda', 'ambos', 'servicio', 'otro']

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [
      { data: c },
      { data: v },
      { data: l },
      { data: pv },
      { data: pc },
      { data: vc },
    ] = await Promise.all([
      supabase.from('contactos').select('*').order('nombre'),
      supabase.from('ventas').select('*, corrales(numero)').order('creado_en', { ascending: false }),
      supabase.from('lotes').select('*').order('created_at', { ascending: false }),
      supabase.from('pagos_ventas').select('*'),
      supabase.from('pagos_compras').select('*'),
      supabase.from('vencimientos_compra').select('*').order('fecha_vencimiento'),
    ])

    setContactos(c || [])
    setVentas(v || [])
    setLotes(l || [])

    const pvMap = {}
    ;(pv || []).forEach(p => {
      if (!pvMap[p.venta_id]) pvMap[p.venta_id] = []
      pvMap[p.venta_id].push(p)
    })
    setPagosVenta(pvMap)

    const pcMap = {}
    ;(pc || []).forEach(p => {
      if (!pcMap[p.lote_id]) pcMap[p.lote_id] = []
      pcMap[p.lote_id].push(p)
    })
    setPagosCompra(pcMap)

    const vcMap = {}
    ;(vc || []).forEach(v => {
      if (!vcMap[v.lote_id]) vcMap[v.lote_id] = []
      vcMap[v.lote_id].push(v)
    })
    setVencimientosCompra(vcMap)

    setLoading(false)
  }

  async function guardarContacto() {
    if (!formContacto.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    if (formContacto.id) {
      await supabase.from('contactos').update({ ...formContacto }).eq('id', formContacto.id)
    } else {
      await supabase.from('contactos').insert({ ...formContacto, activo: true })
    }
    await cargar()
    setShowForm(false)
    setFormContacto({ nombre: '', tipo: 'otro', telefono: '', email: '', cuit: '', direccion: '', observaciones: '' })
    setGuardando(false)
  }

  async function eliminarContacto(id) {
    if (!confirm('¿Eliminar este contacto?')) return
    await supabase.from('contactos').delete().eq('id', id)
    await cargar()
    if (contactoSeleccionado?.id === id) setContactoSeleccionado(null)
  }

  function calcularSaldo(nombre) {
    const data = transaccionesPorNombre[nombre] || { ventas: [], lotes: [] }
    const totalVentas = data.ventas.reduce((s, v) => s + (v.total || 0), 0)
    const cobradoVentas = data.ventas.reduce((s, v) => s + (pagosVenta[v.id] || []).reduce((ss, p) => ss + (p.monto || 0), 0), 0)
    const pendienteVentas = totalVentas - cobradoVentas
    const totalCompras = data.lotes.reduce((s, l) => s + (l.precio_compra && l.kg_bascula ? Math.round(l.kg_bascula * (1 - (l.desbaste_pct || 0) / 100) * l.precio_compra) : 0), 0)
    const pagadoCompras = data.lotes.reduce((s, l) => s + (pagosCompra[l.id] || []).reduce((ss, p) => ss + (p.monto || 0), 0), 0)
    const pendienteCompras = totalCompras - pagadoCompras
    return { pendienteVentas, pendienteCompras, saldoNeto: pendienteVentas - pendienteCompras, totalVentas, cobradoVentas, totalCompras, pagadoCompras, ...data }
  }

  if (loading) return <Loader />

  // Construir mapa de transacciones por nombre
  const transaccionesPorNombre = {}
  const ventasVistas = new Set()
  ventas.forEach(v => {
    const nombre = v.comprador
    if (!nombre) return
    if (v.grupo_venta_id) {
      if (ventasVistas.has(v.grupo_venta_id)) return
      ventasVistas.add(v.grupo_venta_id)
    }
    if (!transaccionesPorNombre[nombre]) transaccionesPorNombre[nombre] = { ventas: [], lotes: [] }
    transaccionesPorNombre[nombre].ventas.push(v)
  })
  lotes.forEach(l => {
    const nombre = l.procedencia
    if (!nombre) return
    if (!transaccionesPorNombre[nombre]) transaccionesPorNombre[nombre] = { ventas: [], lotes: [] }
    transaccionesPorNombre[nombre].lotes.push(l)
  })

  // Lista unificada de contactos (de tabla + de transacciones)
  const nombresContactos = new Set(contactos.map(c => c.nombre))
  const todosLosNombres = new Set([...Object.keys(transaccionesPorNombre), ...contactos.map(c => c.nombre)])
  const listaFiltrada = [...todosLosNombres]
    .filter(n => !filtro || n.toLowerCase().includes(filtro.toLowerCase()))
    .sort()

  // Calcular saldo para un nombre


  // Vista ficha de contacto
  if (contactoSeleccionado) {
    const nombre = contactoSeleccionado
    const { ventas: ventasCto, lotes: lotesCto, pendienteVentas, pendienteCompras, saldoNeto, totalVentas, cobradoVentas, totalCompras, pagadoCompras } = calcularSaldo(nombre)
    const contactoData = contactos.find(c => c.nombre === nombre)

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <button onClick={() => setContactoSeleccionado(null)}
            style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
            ← Volver
          </button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{nombre}</div>
            {contactoData?.tipo && <div style={{ fontSize: 12, color: S.muted, textTransform: 'capitalize' }}>{contactoData.tipo.replace('_', ' ')}</div>}
          </div>
          {contactoData && (
            <button onClick={() => { setFormContacto({...contactoData}); setShowForm(true) }}
              style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: 12, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer' }}>
              Editar contacto
            </button>
          )}
        </div>

        {/* Datos del contacto */}
        {contactoData && (
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', fontSize: 13 }}>
              {contactoData.telefono && <div><div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Teléfono</div><div>{contactoData.telefono}</div></div>}
              {contactoData.email && <div><div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Email</div><div>{contactoData.email}</div></div>}
              {contactoData.cuit && <div><div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>CUIT</div><div style={{ fontFamily: 'monospace' }}>{contactoData.cuit}</div></div>}
              {contactoData.direccion && <div><div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Dirección</div><div>{contactoData.direccion}</div></div>}
            </div>
          </div>
        )}

        {/* Saldo neto */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
          <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.green, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Ventas (te pagan)</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${(totalVentas/1000000).toFixed(2)}M</div>
            <div style={{ fontSize: 12, color: S.green, marginTop: 3 }}>Cobrado: ${(cobradoVentas/1000000).toFixed(2)}M</div>
            {pendienteVentas > 0 && <div style={{ fontSize: 12, color: S.amber, marginTop: 2 }}>Pendiente: ${(pendienteVentas/1000000).toFixed(2)}M</div>}
          </div>
          <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.red, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Compras (les pagás)</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: S.red }}>-${(totalCompras/1000000).toFixed(2)}M</div>
            <div style={{ fontSize: 12, color: S.green, marginTop: 3 }}>Pagado: ${(pagadoCompras/1000000).toFixed(2)}M</div>
            {pendienteCompras > 0 && <div style={{ fontSize: 12, color: S.red, marginTop: 2 }}>Pendiente: -${(pendienteCompras/1000000).toFixed(2)}M</div>}
          </div>
          <div style={{ background: saldoNeto >= 0 ? S.accentLight : S.redLight, border: `1px solid ${saldoNeto >= 0 ? S.accent : '#F09595'}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: saldoNeto >= 0 ? S.accent : S.red, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Saldo neto</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: saldoNeto >= 0 ? S.accent : S.red }}>
              {saldoNeto >= 0 ? '+' : ''}{(saldoNeto/1000000).toFixed(2)}M
            </div>
            <div style={{ fontSize: 12, color: S.muted, marginTop: 3 }}>{saldoNeto >= 0 ? 'te deben' : 'les debés'}</div>
          </div>
        </div>

        {/* Tabs ficha */}
        {puedeVerParalelo && (
          <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.25rem' }}>
            {[
              { key: 'oficial', label: 'Cuenta corriente' },
              { key: 'paralela', label: 'Cuenta paralela' },
            ].map(t => (
              <button key={t.key} onClick={() => setTabFicha(t.key)}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: tabFicha === t.key ? 600 : 500, cursor: 'pointer',
                  color: tabFicha === t.key ? (t.key === 'paralela' ? '#3D1A6B' : S.accent) : S.muted,
                  background: 'transparent', border: 'none',
                  borderBottom: tabFicha === t.key ? `2px solid ${t.key === 'paralela' ? '#9F8ED4' : S.accent}` : '2px solid transparent',
                  marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Cuenta corriente unificada */}
        {(() => {
          const esParalela = tabFicha === 'paralela' && puedeVerParalelo
          const movimientos = []

          // Ventas
          ventasCto.forEach(v => {
            const fechaOp = v.fecha || v.creado_en?.split('T')[0]
            const fechaVto = v.fecha_vencimiento_cobro
            const montoFact = v.monto_facturado || v.total || 0
            const montoParalelo = v.monto_negro || 0

            if (!esParalela && montoFact > 0) {
              movimientos.push({
                fecha: fechaOp, fechaVto, tipo: 'e-CVA', nro: v.id,
                descripcion: `Venta hacienda C-${v.corrales?.numero} · ${v.cantidad || ''} cab`,
                credito: montoFact, debito: 0,
              })
            }
            if (esParalela && montoParalelo > 0) {
              movimientos.push({
                fecha: fechaOp, fechaVto: null, tipo: 'PAR', nro: v.id,
                descripcion: `Venta hacienda C-${v.corrales?.numero} · ${v.cantidad || ''} cab`,
                credito: montoParalelo, debito: 0,
              })
            }
            // Cobros
            ;(pagosVenta[v.id] || []).forEach(p => {
              const esParaleloP = p.forma_pago === 'efectivo' && montoParalelo > 0
              if (esParalela && !esParaleloP) return
              if (!esParalela && esParaleloP) return
              movimientos.push({
                fecha: p.fecha, fechaVto: null, tipo: 'COBRO', nro: p.id,
                descripcion: `Cobro venta C-${v.corrales?.numero} · ${p.forma_pago}${p.numero_cheque ? ' #' + p.numero_cheque : ''}`,
                credito: 0, debito: p.monto, esPago: true,
              })
            })
          })

          // Compras
          lotesCto.forEach(l => {
            const total = l.precio_compra && l.kg_bascula ? Math.round(l.kg_bascula * (1 - (l.desbaste_pct || 0) / 100) * l.precio_compra) : 0
            const montoFact = l.monto_facturado || total
            const montoParalelo = l.monto_negro || 0
            const venc = vencimientosCompra[l.id] || []

            if (!esParalela && montoFact > 0) {
              movimientos.push({
                fecha: l.fecha_ingreso || l.created_at?.split('T')[0],
                fechaVto: venc.length > 0 ? venc[0].fecha_vencimiento : l.fecha_vencimiento_pago,
                tipo: 'e-LCA', nro: l.codigo,
                descripcion: `Compra ${l.codigo} · ${l.cantidad} cab · ${l.kg_bascula?.toLocaleString('es-AR')} kg`,
                credito: 0, debito: montoFact, factura: l.numero_factura,
              })
            }
            if (esParalela && montoParalelo > 0) {
              movimientos.push({
                fecha: l.fecha_ingreso || l.created_at?.split('T')[0],
                fechaVto: null, tipo: 'PAR', nro: l.codigo,
                descripcion: `Compra ${l.codigo} · ${l.cantidad} cab`,
                credito: 0, debito: montoParalelo,
              })
            }
            // Pagos
            ;(pagosCompra[l.id] || []).forEach(p => {
              const esParaleloP = p.es_negro || false
              if (esParalela && !esParaleloP) return
              if (!esParalela && esParaleloP) return
              movimientos.push({
                fecha: p.fecha, fechaVto: null, tipo: 'PAGO', nro: p.id,
                descripcion: `Pago compra ${l.codigo} · ${p.forma_pago}${p.numero_cheque ? ' #' + p.numero_cheque : ''}`,
                credito: p.monto, debito: 0, esPago: true,
              })
            })
          })

          // Ordenar por fecha
          movimientos.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

          // Calcular saldo acumulado
          let saldoAcum = 0
          const movConSaldo = movimientos.map(m => {
            saldoAcum += (m.credito || 0) - (m.debito || 0)
            return { ...m, saldoAcum }
          })

          const colNegro = '#3D1A6B'
          const bgNegro = '#F0EAFB'

          return (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto' }}>
              {/* Encabezado estilo estado de cuenta */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{esParalela ? 'Cuenta paralela' : 'Cuenta corriente oficial'}</div>
                  {contactoData?.cuit && <div style={{ fontSize: 11, color: S.muted, fontFamily: 'monospace' }}>CUIT: {contactoData.cuit}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: S.muted }}>Saldo final</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: saldoAcum >= 0 ? S.green : S.red }}>
                    {saldoAcum >= 0 ? '+' : ''}{saldoAcum.toLocaleString('es-AR')}
                  </div>
                  <div style={{ fontSize: 11, color: S.muted }}>{saldoAcum >= 0 ? 'te deben' : 'les debés'}</div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
                <thead>
                  <tr style={{ background: S.accent }}>
                    {['Fecha op.', 'Tipo', 'N° Doc.', 'Fecha vto.', 'Descripción', 'Débito', 'Crédito', 'Saldo'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Débito' || h === 'Crédito' || h === 'Saldo' ? 'right' : 'left', fontWeight: 600, color: '#fff', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movConSaldo.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay movimientos registrados.</td></tr>
                  )}
                  {movConSaldo.map((m, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, background: m.tipo === 'PAR' ? '#F0EAFB' : m.esPago ? '#F0FFF4' : i % 2 === 0 ? S.surface : S.bg }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>
                        {m.fecha ? new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: m.esPago ? S.greenLight : m.tipo === 'PAR' ? '#F0EAFB' : m.tipo === 'e-CVA' || m.tipo === 'COBRO' ? '#E8F8EF' : S.accentLight,
                          color: m.esPago ? S.green : m.tipo === 'PAR' ? '#3D1A6B' : m.tipo === 'e-CVA' || m.tipo === 'COBRO' ? '#0D6E3B' : S.accent,
                          border: `1px solid ${m.esPago ? '#97C459' : m.tipo === 'PAR' ? '#9F8ED4' : m.tipo === 'e-CVA' || m.tipo === 'COBRO' ? '#5DBF8C' : '#85B7EB'}` }}>
                          {m.tipo}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: S.muted }}>{m.factura || (typeof m.nro === 'string' ? m.nro : `#${m.nro}`)}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: m.fechaVto && new Date(m.fechaVto) < new Date() ? S.red : S.muted }}>
                        {m.fechaVto ? new Date(m.fechaVto + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: m.esNegro ? colNegro : S.text }}>{m.descripcion}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: m.debito > 0 ? S.red : S.hint }}>
                        {m.debito > 0 ? m.debito.toLocaleString('es-AR') : ''}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: m.credito > 0 ? S.green : S.hint }}>
                        {m.credito > 0 ? m.credito.toLocaleString('es-AR') : ''}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: m.saldoAcum >= 0 ? S.green : S.red }}>
                        {m.saldoAcum.toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: S.accent }}>
                    <td colSpan={5} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#fff' }}>SALDO FINAL</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>
                      {movConSaldo.reduce((s, m) => s + m.debito, 0).toLocaleString('es-AR')}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>
                      {movConSaldo.reduce((s, m) => s + m.credito, 0).toLocaleString('es-AR')}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: saldoAcum >= 0 ? '#7EE8A2' : '#F09595' }}>
                      {saldoAcum.toLocaleString('es-AR')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })()}
      </div>
    )
  }

  // Vista lista de contactos
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Contactos</div>
      <div style={{ fontSize: 12, color: S.muted, marginBottom: '1.5rem' }}>Compradores, vendedores y cuenta corriente</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <input type="text" placeholder="Buscar contacto..." value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ width: 280, padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, fontFamily: "'IBM Plex Sans', sans-serif" }} />
        <button onClick={() => { setFormContacto({ nombre: '', tipo: 'otro', telefono: '', email: '', cuit: '', direccion: '', observaciones: '' }); setShowForm(!showForm) }}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Nuevo contacto
        </button>
      </div>

      {showForm && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>{formContacto.id ? 'Editar contacto' : 'Nuevo contacto'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '.75rem' }}>
            {[
              { label: 'Nombre', key: 'nombre', type: 'text', required: true },
              { label: 'Teléfono', key: 'telefono', type: 'text' },
              { label: 'Email', key: 'email', type: 'email' },
              { label: 'CUIT', key: 'cuit', type: 'text' },
              { label: 'Dirección', key: 'direccion', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>{f.label}{f.required ? ' *' : ''}</div>
                <input type={f.type} value={formContacto[f.key] || ''} onChange={e => setFormContacto({...formContacto, [f.key]: e.target.value})}
                  style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif" }} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Tipo</div>
              <select value={formContacto.tipo || 'otro'} onChange={e => setFormContacto({...formContacto, tipo: e.target.value})}
                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, background: S.surface }}>
                {TIPOS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Observaciones</div>
              <input type="text" value={formContacto.observaciones || ''} onChange={e => setFormContacto({...formContacto, observaciones: e.target.value})}
                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif" }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardarContacto} disabled={guardando}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {listaFiltrada.map(nombre => {
          const { pendienteVentas, pendienteCompras, saldoNeto, ventas: v, lotes: l } = calcularSaldo(nombre)
          const contactoData = contactos.find(c => c.nombre === nombre)
          const tieneTransacciones = v.length > 0 || l.length > 0
          return (
            <div key={nombre} onClick={() => setContactoSeleccionado(nombre)}
              style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem', cursor: 'pointer', transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = S.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = S.border}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{nombre}</div>
                  {contactoData?.tipo && <div style={{ fontSize: 11, color: S.muted, textTransform: 'capitalize', marginTop: 2 }}>{contactoData.tipo.replace(/_/g, ' ')}</div>}
                </div>
                {tieneTransacciones && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: saldoNeto >= 0 ? S.green : S.red }}>
                      {saldoNeto >= 0 ? '+' : ''}{(saldoNeto/1000000).toFixed(1)}M
                    </div>
                    <div style={{ fontSize: 10, color: S.muted }}>{saldoNeto >= 0 ? 'te deben' : 'les debés'}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {v.length > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontWeight: 600 }}>{v.length} ventas</span>}
                {l.length > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: S.redLight, color: S.red, fontWeight: 600 }}>{l.length} compras</span>}
                {contactoData?.telefono && <span style={{ fontSize: 11, color: S.muted }}>📞 {contactoData.telefono}</span>}
              </div>
              {!contactoData && (
                <button onClick={e => { e.stopPropagation(); setFormContacto({ nombre, tipo: 'otro', telefono: '', email: '', cuit: '', direccion: '', observaciones: '' }); setShowForm(true) }}
                  style={{ marginTop: 8, width: '100%', padding: '4px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 4, cursor: 'pointer' }}>
                  + Agregar datos
                </button>
              )}
            </div>
          )
        })}
        {listaFiltrada.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: '3rem', textAlign: 'center', color: S.hint }}>No hay contactos.</div>
        )}
      </div>
    </div>
  )
}
