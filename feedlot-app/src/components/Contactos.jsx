import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

// Paleta de estilos estática unificada
const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
}

function Loader() {
  return <div style={{ padding: '3rem', textAlign: 'center', color: S.muted, fontFamily: 'sans-serif' }}>Cargando agenda de contactos...</div>
}

export default function Contactos({ usuario }) {
  // 1. ESTADOS DE CONTROL Y UI
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)
  const [filtro, setFiltro] = useState('')
  const [contactoSeleccionado, setContactoSeleccionado] = useState(null)
  const [mostrarNegro, setMostrarNegro] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // 2. ESTADOS DE DATOS CENTRALIZADOS
  const [contactos, setContactos] = useState([])
  const [ventas, setVentas] = useState([])
  const [lotes, setLotes] = useState([])
  const [pagosVenta, setPagosVenta] = useState({})
  const [pagosCompra, setPagosCompra] = useState({})
  const [vencimientosCompra, setVencimientosCompra] = useState({})

  // Estado para el formulario de contacto (Crear / Editar)
  const [formContacto, setFormContacto] = useState({
    nombre: '', tipo: 'otro', telefono: '', email: '', cuit: '', direccion: '', observaciones: ''
  })

  // 3. CARGA DE DATOS OPTIMIZADA CON MANEJO DE ERRORES CORREGIDO
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)

      // Ejecutamos las consultas en paralelo apuntando a las tablas exactas de tu Base de Datos
      const [
        resContactos,
        resVentas,
        resLotes,
        resPagosVenta,
        resPagosCompra
      ] = await Promise.all([
        supabase.from('contactos').select('*').order('nombre'),
        supabase.from('ventas').select('*'),
        supabase.from('lotes').select('*'), // Corregido: tu tabla original se llama 'lotes'
        supabase.from('pagos_ventas').select('*'),
        supabase.from('pagos_compras').select('*')
      ])

      // Validamos si Supabase devolvió algún error en las peticiones
      if (resContactos.error) throw resContactos.error
      if (resVentas.error) throw resVentas.error
      if (resLotes.error) throw resLotes.error
      if (resPagosVenta.error) throw resPagosVenta.error
      if (resPagosCompra.error) throw resPagosCompra.error

      // Procesamos e indexamos Pagos de Ventas para búsquedas instantáneas
      const pVentasMap = {}
      if (resPagosVenta.data) {
        resPagosVenta.data.forEach(p => {
          if (!pVentasMap[p.venta_id]) pVentasMap[p.venta_id] = 0
          pVentasMap[p.venta_id] += (p.monto || 0)
        })
      }

      // Procesamos Pagos de Compras e indexamos
      const pComprasMap = {}
      const vComprasMap = {}
      if (resPagosCompra.data) {
        resPagosCompra.data.forEach(p => {
          const targetId = p.lote_id || p.compra_id
          if (targetId) {
            if (!pComprasMap[targetId]) pComprasMap[targetId] = 0
            pComprasMap[targetId] += (p.monto || 0)
            
            if (p.fecha_vencimiento_cheque) {
              vComprasMap[targetId] = p.fecha_vencimiento_cheque
            }
          }
        })
      }

      // Guardamos todo en los estados correspondientes
      setContactos(resContactos.data || [])
      setVentas(resVentas.data || [])
      setLotes(resLotes.data || [])
      setPagosVenta(pVentasMap)
      setPagosCompra(pComprasMap)
      setVencimientosCompra(vComprasMap)

    } catch (error) {
      console.error("Error crítico cargando contactos:", error)
      setErrorMessage(`Error de sincronización: ${error.message || 'Verifique la estructura de las tablas.'}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // 4. ACCIONES DEL FORMULARIO CON TRY/CATCH
  async function guardarContacto(e) {
    e.preventDefault()
    if (!formContacto.nombre.trim()) return

    try {
      setLoading(true)
      let error = null

      if (formContacto.id) {
        // Modo Edición
        const res = await supabase.from('contactos').update(formContacto).eq('id', formContacto.id)
        error = res.error
      } else {
        // Modo Creación Nuevo
        const res = await supabase.from('contactos').insert([formContacto])
        error = res.error
      }

      if (error) throw error

      setShowForm(false)
      setFormContacto({ nombre: '', tipo: 'otro', telefono: '', email: '', cuit: '', direccion: '', observaciones: '' })
      await cargarDatos()

    } catch (err) {
      console.error("Error al guardar contacto:", err)
      alert("Error al guardar el contacto. Intente nuevamente.")
      setLoading(false)
    }
  }

  // 5. PROCESAMIENTO Y FILTRADO EN MEMORIA aplicando filtro de blanco/negro si corresponde
  const nombresUnicos = Array.from(new Set([
    ...ventas.filter(v => mostrarNegro || v.tipo_operacion !== 'negro').map(v => v.cliente),
    ...lotes.filter(l => mostrarNegro || l.tipo_operacion !== 'negro').map(l => l.proveedor),
    ...contactos.map(c => c.nombre)
  ])).filter(Boolean).sort((a, b) => a.localeCompare(b))

  const listaFiltrada = nombresUnicos.filter(nombre => 
    nombre.toLowerCase().includes(filtro.toLowerCase())
  )

  // Vista de Carga
  if (loading && contactos.length === 0) return <Loader />

  return (
    <div style={{ padding: '1.5rem', background: S.bg, minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }}>
      
      {/* Encabezado Principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Agenda Comercial</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: S.muted }}>Clientes, proveedores y cuentas corrientes</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Checkbox para activar/desactivar la visualización informal si tu usuario lo requiere */}
          <label style={{ fontSize: 12, color: S.muted, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={mostrarNegro} onChange={e => setMostrarNegro(e.target.checked)} />
            Mostrar cuentas informales
          </label>

          <button onClick={() => { 
            setFormContacto({ nombre: '', tipo: 'otro', telefono: '', email: '', cuit: '', direccion: '', observaciones: '' })
            setShowForm(true) 
          }} style={{ background: S.accent, color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            + Nuevo Contacto
          </button>
        </div>
      </div>

      {/* Cartel de Alerta de Error si falla Supabase */}
      {errorMessage && (
        <div style={{ background: S.redLight, border: `1px solid ${S.red}`, color: S.red, padding: '10px 12px', borderRadius: 6, fontSize: 13, marginBottom: '1rem' }}>
          ⚠️ {errorMessage} <button onClick={cargarDatos} style={{ background: 'transparent', border: 'none', color: S.red, textDecoration: 'underline', cursor: 'pointer', marginLeft: 10 }}>Reintentar</button>
        </div>
      )}

      {/* Buscador */}
      <div style={{ marginBottom: '1rem' }}>
        <input 
          type="text" 
          placeholder="Buscar por nombre de cliente o proveedor..." 
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none', background: S.surface }}
        />
      </div>

      {/* GRID DE CONTACTOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {listaFiltrada.map(nombre => {
          // Filtramos operaciones respetando la visibilidad seleccionada
          const v = ventas.filter(item => item.cliente === nombre && (mostrarNegro || item.tipo_operacion !== 'negro'))
          const l = lotes.filter(item => item.proveedor === nombre && (mostrarNegro || item.tipo_operacion !== 'negro'))
          const contactoData = contactos.find(c => c.nombre === nombre)

          // Cálculos financieros
          const totalVendido = v.reduce((sum, item) => sum + (item.monto_total || item.monto || 0), 0)
          const totalCobrado = v.reduce((sum, item) => sum + (pagosVenta[item.id] || 0), 0)
          
          const totalComprado = l.reduce((sum, item) => sum + (item.precio_total || item.monto || 0), 0)
          const totalPagado = l.reduce((sum, item) => sum + (pagosCompra[item.id] || 0), 0)

          const saldoVentas = totalVendido - totalCobrado
          const saldoCompras = totalComprado - totalPagado
          const saldoNeto = saldoVentas - saldoCompras

          return (
            <div key={nombre} 
                 onClick={() => setContactoSeleccionado({ nombre, contactoData, v, l, totalVendido, totalCobrado, totalComprado, totalPagado, saldoNeto })}
                 style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem', cursor: 'pointer', transition: 'transform 0.1s', boxSizing: 'border-box' }}
                 onMouseEnter={e => e.currentTarget.style.borderColor = S.hint}
                 onMouseLeave={e => e.currentTarget.style.borderColor = S.border}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{nombre}</div>
                  <div style={{ fontSize: 11, color: S.hint, textTransform: 'uppercase', marginTop: 2 }}>
                    {contactoData?.tipo || (v.length && l.length ? 'Cliente/Proveedor' : v.length ? 'Cliente' : l.length ? 'Proveedor' : 'Contacto')}
                  </div>
                </div>

                {(saldoVentas > 0 || saldoCompras > 0 || saldoNeto !== 0) && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, color: saldoNeto >= 0 ? S.green : S.red }}>
                      {saldoNeto >= 0 ? '+' : ''}${Math.abs(saldoNeto).toLocaleString('es-AR')}
                    </div>
                    <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>
                      {saldoNeto >= 0 ? 'te deben' : 'les debés'}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                {v.length > 0 && <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontWeight: 600 }}>{v.length} ventas</span>}
                {l.length > 0 && <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: S.redLight, color: S.red, fontWeight: 600 }}>{l.length} compras</span>}
                {contactoData?.telefono && <span style={{ fontSize: 11, color: S.muted, alignSelf: 'center' }}>📞 {contactoData.telefono}</span>}
              </div>

              {!contactoData && (
                <button onClick={e => { 
                  e.stopPropagation()
                  setFormContacto({ nombre, tipo: 'otro', telefono: '', email: '', cuit: '', direccion: '', observaciones: '' })
                  setShowForm(true) 
                }} style={{ marginTop: 12, width: '100%', padding: '6px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
                  + Completar datos ficha
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* PANTALLA MODAL DE DETALLE */}
      {contactoSeleccionado && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
             onClick={() => setContactoSeleccionado(null)}>
          <div style={{ background: S.surface, borderRadius: 12, width: '100%', maxWidth: 650, maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}
               onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{contactoSeleccionado.nombre}</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: S.muted, textTransform: 'uppercase' }}>Ficha Comercial Completa</p>
              </div>
              <button onClick={() => setContactoSeleccionado(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: S.hint, cursor: 'pointer' }}>✕</button>
            </div>

            {contactoSeleccionado.contactoData ? (
              <div style={{ background: S.bg, padding: '12px', borderRadius: 8, fontSize: 13, marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {contactoSeleccionado.contactoData.cuit && <div><strong>CUIT:</strong> {contactoSeleccionado.contactoData.cuit}</div>}
                {contactoSeleccionado.contactoData.telefono && <div><strong>Teléfono:</strong> {contactoSeleccionado.contactoData.telefono}</div>}
                {contactoSeleccionado.contactoData.email && <div style={{ gridColumn: 'span 2' }}><strong>Email:</strong> {contactoSeleccionado.contactoData.email}</div>}
                {contactoSeleccionado.contactoData.direccion && <div style={{ gridColumn: 'span 2' }}><strong>Dirección:</strong> {contactoSeleccionado.contactoData.direccion}</div>}
                {contactoSeleccionado.contactoData.observaciones && <div style={{ gridColumn: 'span 2', marginTop: 4, color: S.muted }}><em>Obs: {contactoSeleccionado.contactoData.observaciones}</em></div>}
                <button onClick={() => {
                  setFormContacto(contactoSeleccionado.contactoData)
                  setShowForm(true)
                }} style={{ gridColumn: 'span 2', marginTop: 8, background: 'transparent', border: `1px solid ${S.border}`, padding: '4px', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: S.accent }}>
                  Editar datos de ficha
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: S.hint, fontStyle: 'italic' }}>No hay datos adicionales de contacto registrados para esta firma.</p>
            )}

            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, padding: '12px', display: 'flex', justifyContent: 'space-around', background: S.surface, marginBottom: '1.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: S.muted }}>Total Ventas (Vendido)</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 600, color: S.green, fontSize: 14 }}>${contactoSeleccionado.totalVendido.toLocaleString('es-AR')}</div>
              </div>
              <div style={{ borderLeft: `1px solid ${S.border}` }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: S.muted }}>Total Compras (Comprado)</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 600, color: S.red, fontSize: 14 }}>${contactoSeleccionado.totalComprado.toLocaleString('es-AR')}</div>
              </div>
              <div style={{ borderLeft: `1px solid ${S.border}` }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: S.muted }}>Saldo Neto</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: contactoSeleccionado.saldoNeto >= 0 ? S.green : S.red, fontSize: 14 }}>
                  {contactoSeleccionado.saldoNeto >= 0 ? '+' : ''}${contactoSeleccionado.saldoNeto.toLocaleString('es-AR')}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13 }}>
              {contactoSeleccionado.v.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 6px 0', color: S.green, fontSize: 13, textTransform: 'uppercase' }}>Historial de Ventas</h4>
                  {contactoSeleccionado.v.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px dashed ${S.border}` }}>
                      <span>Tropa / Venta #{item.id} ({item.fecha ? new Date(item.fecha).toLocaleDateString('es-AR') : 'S/D'})</span>
                      <strong style={{ fontFamily: 'monospace' }}>${(item.monto_total || item.monto || 0).toLocaleString('es-AR')}</strong>
                    </div>
                  ))}
                </div>
              )}

              {contactoSeleccionado.l.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 6px 0', color: S.red, fontSize: 13, textTransform: 'uppercase' }}>Historial de Compras / Haciendas</h4>
                  {contactoSeleccionado.l.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px dashed ${S.border}` }}>
                      <span>Compra #{item.id} ({item.fecha ? new Date(item.fecha).toLocaleDateString('es-AR') : 'S/D'})</span>
                      <strong style={{ fontFamily: 'monospace' }}>${(item.precio_total || item.monto || 0).toLocaleString('es-AR')}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL DEL FORMULARIO DE REGISTRO */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '1rem' }}>
          <form onSubmit={guardarContacto} style={{ background: S.surface, borderRadius: 12, width: '100%', maxWidth: 420, padding: '1.5rem', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: 16 }}>{formContacto.id ? 'Editar Ficha' : 'Completar Datos de Ficha'}</h3>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: S.muted, marginBottom: 4 }}>Nombre o Razón Social</label>
              <input type="text" required value={formContacto.nombre} onChange={e => setFormContacto({...formContacto, nombre: e.target.value})}
                     style={{ width: '100%', padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}/>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: S.muted, marginBottom: 4 }}>Tipo de Relación</label>
              <select value={formContacto.tipo} onChange={e => setFormContacto({...formContacto, tipo: e.target.value})}
                      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
                <option value="cliente">Cliente</option>
                <option value="proveedor">Proveedor</option>
                <option value="socio">Socio / Inversor</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: S.muted, marginBottom: 4 }}>Teléfono</label>
                <input type="text" value={formContacto.telefono || ''} onChange={e => setFormContacto({...formContacto, telefono: e.target.value})}
                       style={{ width: '100%', padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}/>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: S.muted, marginBottom: 4 }}>CUIT / CUIL</label>
                <input type="text" value={formContacto.cuit || ''} onChange={e => setFormContacto({...formContacto, cuit: e.target.value})}
                       style={{ width: '100%', padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}/>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: S.muted, marginBottom: 4 }}>Email</label>
              <input type="email" value={formContacto.email || ''} onChange={e => setFormContacto({...formContacto, email: e.target.value})}
                     style={{ width: '100%', padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}/>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: S.muted, marginBottom: 4 }}>Dirección Física</label>
              <input type="text" value={formContacto.direccion || ''} onChange={e => setFormContacto({...formContacto, direccion: e.target.value})}
                     style={{ width: '100%', padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}/>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: S.muted, marginBottom: 4 }}>Observaciones Internas</label>
              <textarea value={formContacto.observaciones || ''} onChange={e => setFormContacto({...formContacto, observaciones: e.target.value})}
                        style={{ width: '100%', padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', height: 60, resize: 'none' }}/>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: 'transparent', border: `1px solid ${S.border}`, padding: '8px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: S.muted }}>
                Cancelar
              </button>
              <button type="submit" style={{ background: S.green, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Guardar Datos
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}