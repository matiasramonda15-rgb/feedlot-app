import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Btn, Loader } from './UI'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

const PRODUCTOS_DEFAULT = [
  { n: 'Alliance', tipo: 'Vacuna', lab: 'MSD Animal Health', car: 0 },
  { n: 'Feedlot', tipo: 'Vacuna', lab: 'MSD Animal Health', car: 0 },
  { n: 'Ivermectina 1%', tipo: 'Antiparasitario', lab: 'Holliday-Scott', car: 28 },
  { n: 'Oxitetraciclina', tipo: 'Antibiotico', lab: 'Generico', car: 28 },
  { n: 'Oxitetraciclina oftálmica', tipo: 'Antibiotico', lab: 'Generico', car: 14 },
  { n: 'Enrofloxacina', tipo: 'Antibiotico', lab: 'Bayer', car: 14 },
  { n: 'Meloxicam', tipo: 'Antiinflamatorio', lab: 'Boehringer', car: 5 },
  { n: 'Vitamina AD3E', tipo: 'Vitamina', lab: 'Holliday-Scott', car: 0 },
]

const TIPO_BADGE = {
  Vacuna: { bg: S.accentLight, color: S.accent },
  Antibiotico: { bg: S.amberLight, color: S.amber },
  Antiparasitario: { bg: S.purpleLight, color: S.purple },
  Vitamina: { bg: S.greenLight, color: S.green },
  Antiinflamatorio: { bg: S.redLight, color: S.red },
  Otro: { bg: S.bg, color: S.muted },
}

const DIAGNOSTICOS = ['Conjuntivitis', 'Pietin', 'Neumonia', 'Timpanismo', 'Diarrea', 'Artritis', 'Otro']

function Badge({ children, color, bg, border }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: bg || S.accentLight, color: color || S.accent, border: border ? `1px solid ${border}` : 'none' }}>
      {children}
    </span>
  )
}

export default function Sanidad({ usuario }) {
  const [tab, setTab] = useState('alertas')
  const [historialSan, setHistorialSan] = useState([])
  const [loading, setLoading] = useState(true)
  const [alertas, setAlertas] = useState([])
  const [corrales, setCorrales] = useState([])
  const [lotes, setLotes] = useState([])
  const [enfermeria, setEnfermeria] = useState([])
  const [corralesEnfermeria, setCorralesEnfermeria] = useState([])
  const [mortalidad, setMortalidad] = useState([])
  const [eventos, setEventos] = useState([])
  const [revisiones, setRevisiones] = useState([])
  const [productos, setProductos] = useState([])
  const [revState, setRevState] = useState([])
  const [showFormMort, setShowFormMort] = useState(false)
  const [formMort, setFormMort] = useState({ fecha: new Date().toISOString().split('T')[0], corral_id: '', cantidad: '1', causa: '' })
  const [guardandoMort, setGuardandoMort] = useState(false)
  const [vacunacionLote, setVacunacionLote] = useState({}) // { [lote_id]: { vacunas: [{prod_id, dosis}], guardando, confirmada, resumen } }
  const [showFormStockSan, setShowFormStockSan] = useState(false)
  const [formStockSan, setFormStockSan] = useState({ producto_id: '', cantidad: '', unidad: 'ml', proveedor: '', remito: '' })
  const [guardandoStockSan, setGuardandoStockSan] = useState(false)
  const [historialIngresosSan, setHistorialIngresosSan] = useState([])
  const [showNuevoProd, setShowNuevoProd] = useState(false)
  const [formNuevoProd, setFormNuevoProd] = useState({ nombre: '', tipo: 'Vacuna', lab: '', car: '', unidad: 'ml', minimo: '' })
  const [editProd, setEditProd] = useState(null) // { id, nombre, tipo, lab, car, unidad, minimo }
  const [guardandoProd, setGuardandoProd] = useState(false)

  async function guardarMortalidad() {
    if (!formMort.corral_id) { alert('Seleccioná un corral'); return }
    setGuardandoMort(true)
    const cant = parseInt(formMort.cantidad) || 1
    await supabase.from('mortalidad').insert({
      fecha: formMort.fecha, corral_id: parseInt(formMort.corral_id),
      cantidad: cant, causa: formMort.causa || null, registrado_por: usuario?.id,
    })
    // Descontar del corral
    const { data: corral } = await supabase.from('corrales').select('animales').eq('id', formMort.corral_id).single()
    const nuevos = Math.max(0, (corral?.animales || 0) - cant)
    const update = { animales: nuevos }
    if (nuevos === 0) { update.rol = 'libre'; update.sub = null }
    await supabase.from('corrales').update(update).eq('id', parseInt(formMort.corral_id))
    await cargarDatos()
    setShowFormMort(false)
    setFormMort({ fecha: new Date().toISOString().split('T')[0], corral_id: '', cantidad: '1', causa: '' })
    setGuardandoMort(false)
  }




  async function guardarNuevoProd() {
    if (!formNuevoProd.nombre.trim()) { alert('Ingresá el nombre'); return }
    setGuardandoProd(true)
    await supabase.from('stock_sanitario').insert({
      producto: formNuevoProd.nombre.trim(),
      tipo: formNuevoProd.tipo,
      laboratorio: formNuevoProd.lab || null,
      carencia_dias: parseInt(formNuevoProd.car) || 0,
      unidad: formNuevoProd.unidad,
      cantidad_ml: 0,
      minimo_stock: parseFloat(formNuevoProd.minimo) || 0,
      activo: true,
    })
    setFormNuevoProd({ nombre: '', tipo: 'Vacuna', lab: '', car: '', unidad: 'ml', minimo: '' })
    setShowNuevoProd(false)
    setGuardandoProd(false)
    await cargarProductos()
  }

  async function guardarEditProd() {
    if (!editProd?.nombre?.trim()) { alert('Ingresá el nombre'); return }
    setGuardandoProd(true)
    await supabase.from('stock_sanitario').update({
      producto: editProd.nombre.trim(),
      tipo: editProd.tipo,
      laboratorio: editProd.lab || null,
      carencia_dias: parseInt(editProd.car) || 0,
      unidad: editProd.unidad,
      minimo_stock: parseFloat(editProd.minimo) || 0,
      cantidad_ml: parseFloat(editProd.cantidad_actual) || 0,
      actualizado_en: new Date().toISOString(),
    }).eq('id', editProd.id)
    setEditProd(null)
    setGuardandoProd(false)
    await cargarProductos()
  }

  async function eliminarProd(p) {
    if (!confirm(`¿Eliminar "${p.n}"?`)) return
    await supabase.from('stock_sanitario').update({ activo: false }).eq('id', p.id)
    await cargarProductos()
  }

  async function guardarIngresoSan() {
    if (!formStockSan.producto_id || !formStockSan.cantidad) { alert('Completá producto y cantidad'); return }
    setGuardandoStockSan(true)
    const prod = productos.find(p => String(p.id) === String(formStockSan.producto_id))
    if (prod) {
      const cant = parseFloat(formStockSan.cantidad)
      const campoCant = formStockSan.unidad === 'kg' ? 'cantidad_kg' : 'cantidad_ml'
      const valorActual = formStockSan.unidad === 'kg' ? (prod.cantidad_kg || 0) : (prod.cantidad_ml || 0)
      // Actualizar stock
      await supabase.from('stock_sanitario').update({
        [campoCant]: valorActual + cant,
        actualizado_en: new Date().toISOString(),
      }).eq('id', prod.id)
      // Registrar en ingresos_stock (legacy)
      await supabase.from('ingresos_stock').insert({
        insumo_id: prod.id,
        insumo_nombre: prod.n,
        tipo: 'sanitario',
        cantidad_kg: cant,
        unidad: formStockSan.unidad,
        precio_por_kg: null,
        total: null,
        proveedor: formStockSan.proveedor || null,
        remito: formStockSan.remito || null,
        registrado_por: usuario?.nombre || usuario?.email,
      })
      // Crear compra pendiente en compras_insumos para que Paula complete precio y pague
      const hoy = new Date()
      const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`
      await supabase.from('compras_insumos').insert({
        fecha: fechaHoy,
        insumo_id: prod.id,
        insumo_tipo: 'sanitario',
        insumo_nombre: prod.n,
        cantidad: cant,
        unidad: formStockSan.unidad,
        proveedor: formStockSan.proveedor || null,
        numero_factura: formStockSan.remito || null,
        precio_unitario: null,
        total: null,
        estado_pago: 'pendiente',
        registrado_por: usuario?.id,
      })
    }
    await cargarProductos()
    setShowFormStockSan(false)
    setFormStockSan({ producto_id: '', cantidad: '', unidad: 'ml', proveedor: '', remito: '' })
    setGuardandoStockSan(false)
  }

  async function eliminarMortalidad(m) {
    if (!confirm('¿Eliminar este registro? Se devuelve el animal al corral.')) return
    await supabase.from('mortalidad').delete().eq('id', m.id)
    // Devolver al corral
    const { data: corral } = await supabase.from('corrales').select('animales, rol').eq('id', m.corral_id).single()
    const update = { animales: (corral?.animales || 0) + m.cantidad }
    if (corral?.rol === 'libre') update.rol = 'clasificado'
    await supabase.from('corrales').update(update).eq('id', m.corral_id)
    await cargarDatos()
  }
  const esDueno = ['dueno', 'secretaria'].includes(usuario?.rol)

  useEffect(() => {
    cargarProductos()
  }, [])

  async function cargarProductos() {
    const [{ data }, { data: compras }] = await Promise.all([
      supabase.from('stock_sanitario').select('*').eq('activo', true).order('producto'),
      supabase.from('compras_insumos').select('*').eq('insumo_tipo', 'sanitario').order('fecha', { ascending: false }).limit(50),
    ])
    if (data) setProductos(data.map(p => ({ n: p.producto, tipo: p.tipo, id: p.id, cantidad_ml: p.cantidad_ml, unidad: p.unidad || 'ml', lab: p.laboratorio || '', car: p.carencia_dias || 0, minimo: p.minimo_stock || 0 })))
    setHistorialSan(compras || [])
  }

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const [{ data: al }, { data: c }, { data: l }, { data: enf }, { data: mort }, { data: ev }, { data: rev }] = await Promise.all([
      supabase.from('alertas').select('*').eq('resuelta', false).order('fecha_vence'),
      supabase.from('corrales').select('*').not('rol', 'eq', 'libre').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('lotes').select('id, codigo, cantidad, fecha_ingreso, peso_prom_ingreso, corral_cuarentena_id').order('created_at', { ascending: false }).limit(10),
      supabase.from('animales_enfermeria').select('*, corrales:corral_origen_id(numero), lotes(codigo)').order('creado_en', { ascending: false }),
      supabase.from('mortalidad').select('*, corrales(numero), lotes(codigo)').order('creado_en', { ascending: false }),
      supabase.from('eventos_sanitarios').select('*, corrales(numero), usuarios:registrado_por(nombre)').order('creado_en', { ascending: false }).limit(30),
      supabase.from('revisiones').select('*, usuarios:registrado_por(nombre)').order('creado_en', { ascending: false }).limit(10),
    ])
    setAlertas(al || [])
    setCorrales(c || [])
    setLotes(l || [])
    setEnfermeria(enf || [])
    setMortalidad(mort || [])
    setEventos(ev || [])
    setRevisiones(rev || [])
    setRevState((c || []).map(() => ({ ok: null, enfermos: [] })))
    setLoading(false)
  }

  async function resolverAlerta(id) {
    await supabase.from('alertas').update({ resuelta: true, resuelta_en: new Date().toISOString() }).eq('id', id)
    await cargarDatos()
  }

  async function confirmarRevision() {
    const sin = revState.filter(s => s.ok === null).length
    if (sin > 0) { alert(`Falta revisar ${sin} corral${sin !== 1 ? 'es' : ''}.`); return }

    await supabase.from('revisiones').insert({ tipo: 'bisemanal', registrado_por: usuario?.id })

    for (let i = 0; i < corrales.length; i++) {
      const st = revState[i]
      await supabase.from('eventos_sanitarios').insert({
        tipo: 'revision', corral_id: corrales[i].id,
        producto: st.ok ? 'Sin novedad' : 'Varios',
        cantidad_animales: st.ok ? corrales[i].animales : st.enfermos.length,
        observaciones: st.ok ? 'Sin novedades' : st.enfermos.map(e => `${e.desc} - ${e.diag}`).join('; '),
        registrado_por: usuario?.id,
      })
      for (const enf of (st.enfermos || [])) {
        if (enf.desc) {
          // Descontar del stock sanitario
          if (enf.prod_id && enf.ml) {
            const prod = productos.find(p => p.id === enf.prod_id)
            if (prod) {
              const nuevaCant = Math.max(0, (prod.cantidad_ml || 0) - parseFloat(enf.ml))
              await supabase.from('stock_sanitario').update({ cantidad_ml: nuevaCant, actualizado_en: new Date().toISOString() }).eq('id', enf.prod_id)
            }
          }
          // Registrar en animales_enfermeria
          const corrEnf = enf.mover_enfermeria ? corrales.find(c => c.rol === 'enfermeria') : null
          await supabase.from('animales_enfermeria').insert({
            corral_origen_id: corrales[i].id,
            corral_id: corrEnf?.id || null,
            descripcion: enf.desc,
            diagnostico: enf.diag,
            tratamiento: enf.prod,
            cantidad_ml: enf.ml ? parseFloat(enf.ml) : null,
            estado: enf.mover_enfermeria ? 'en_enfermeria' : 'en tratamiento',
            registrado_por: usuario?.id,
          })
        }
      }
    }
    await cargarDatos()
    alert('Revision confirmada correctamente.')
  }

  function setRevOk(i) {
    const n = [...revState]; n[i] = { ok: true, enfermos: [] }; setRevState(n)
  }
  function setRevNov(i) {
    const n = [...revState]; n[i] = { ok: false, enfermos: [{ desc: '', diag: 'Conjuntivitis', prod: '', prod_id: null, ml: '', mover_enfermeria: false }] }; setRevState(n)
  }
  function resetRev(i) {
    const n = [...revState]; n[i] = { ok: null, enfermos: [] }; setRevState(n)
  }
  function addEnfermo(i) {
    const n = [...revState]; n[i].enfermos.push({ desc: '', diag: 'Conjuntivitis', prod: '' }); setRevState(n)
  }
  function delEnfermo(i, ei) {
    const n = [...revState]
    n[i].enfermos.splice(ei, 1)
    if (!n[i].enfermos.length) n[i].ok = null
    setRevState(n)
  }
  function updEnfermo(i, ei, k, v) {
    const n = [...revState]; n[i].enfermos[ei][k] = v; setRevState(n)
  }



  if (loading) return <Loader />

  const mortMes = mortalidad.filter(m => {
    const f = new Date(m.creado_en); const h = new Date()
    return f.getMonth() === h.getMonth() && f.getFullYear() === h.getFullYear()
  }).reduce((s, m) => s + (m.cantidad || 0), 0)

  const enfermeriaActivos = enfermeria.filter(e => e.estado !== 'alta' && e.estado !== 'muerto')
  const ultimaRevision = revisiones[0]
  const hoy = new Date()
  const diasSemana = ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado']
  const proximaRevision = (() => {
    if (!ultimaRevision) return 'No registrada'
    const ultima = new Date(ultimaRevision.creado_en)
    const proxima = new Date(ultima)
    proxima.setDate(proxima.getDate() + (ultima.getDay() === 1 ? 3 : 4))
    const dias = Math.ceil((proxima - hoy) / (1000 * 60 * 60 * 24))
    return dias <= 0 ? 'Hoy' : dias === 1 ? 'Manana' : `en ${dias} dias`
  })()

  const TABS = ['alertas', 'ingreso', 'revision', 'historial', 'mortalidad', 'stock']
  const TAB_LABELS = ['Alertas', 'Protocolo ingreso', 'Revision bisemanal', 'Historial', '💀 Mortalidad', '📦 Stock']

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Sanidad</h1>
          <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace' }}>
            {diasSemana[hoy.getDay()]} {hoy.toLocaleDateString('es-AR')} · proxima revision: {proximaRevision}
          </div>
        </div>
        <Btn onClick={() => setTab('revision')}>Iniciar revision →</Btn>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t ? 600 : 500, cursor: 'pointer', color: tab === t ? (t === 'mortalidad' ? S.red : S.accent) : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t ? `2px solid ${t === 'mortalidad' ? S.red : S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif", position: 'relative' }}>
            {TAB_LABELS[i]}
            {t === 'alertas' && alertas.length > 0 && (
              <span style={{ marginLeft: 6, background: '#E24B4A', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 600, padding: '1px 6px' }}>{alertas.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* TAB ALERTAS */}
      {tab === 'alertas' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: '1.5rem' }}>
            <div style={{ background: S.surface, border: `1px solid #F09595`, borderRadius: 8, padding: '1rem' }}>
              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Alertas activas</div>
              <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'monospace', color: S.red }}>{alertas.length}</div>
              <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>requieren accion</div>
            </div>
            <div style={{ background: S.surface, border: `1px solid #EF9F27`, borderRadius: 8, padding: '1rem' }}>
              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>En tratamiento</div>
              <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'monospace', color: S.amber }}>{enfermeriaActivos.length}</div>
              <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>animales en enfermeria</div>
            </div>
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Proxima revision</div>
              <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'monospace', color: S.text }}>{proximaRevision}</div>
              <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>lunes y jueves</div>
            </div>
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Mortandad este mes</div>
              <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'monospace', color: S.text }}>{mortMes}</div>
              <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>{mortMes === 0 ? 'sin bajas' : 'animales'}</div>
            </div>
          </div>

          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Alertas pendientes</div>
            {alertas.length === 0 && <p style={{ fontSize: 13, color: S.hint, padding: '.5rem 0' }}>No hay alertas pendientes.</p>}
            {alertas.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '.85rem', padding: '.85rem 0', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: S.redLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🔔</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: S.red, marginBottom: 2 }}>{a.titulo}</div>
                  <div style={{ fontSize: 12, color: S.muted, lineHeight: 1.6 }}>{a.descripcion}</div>
                  {a.fecha_vence && <div style={{ fontSize: 11, fontFamily: 'monospace', color: S.red, marginTop: 3 }}>Vence: {new Date(a.fecha_vence).toLocaleDateString('es-AR')}</div>}
                </div>
                <button onClick={() => resolverAlerta(a.id)}
                  style={{ padding: '5px 10px', fontSize: 12, background: S.greenLight, border: `1px solid #97C459`, color: S.green, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", whiteSpace: 'nowrap' }}>
                  Confirmar ✓
                </button>
              </div>
            ))}
          </div>

          {enfermeriaActivos.length > 0 && (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Animales en enfermeria</div>
              <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Ingreso','Descripcion','Diagnostico','Tratamiento','Estado','Dias'].map(h => (
                        <th key={h} style={{ background: S.bg, padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {enfermeriaActivos.map(e => {
                      const dias = Math.ceil((new Date() - new Date(e.fecha_ingreso)) / (1000 * 60 * 60 * 24))
                      return (
                        <tr key={e.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{new Date(e.fecha_ingreso).toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit'})}</td>
                          <td style={{ padding: '9px 12px' }}>{e.descripcion}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <Badge bg={S.amberLight} color={S.amber}>{e.diagnostico || '-'}</Badge>
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 12 }}>{e.tratamiento || '-'}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <Badge bg={e.estado === 'mejorando' ? S.greenLight : S.amberLight} color={e.estado === 'mejorando' ? S.green : S.amber}>
                              {e.estado}
                            </Badge>
                          </td>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{dias} dias</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB PROTOCOLO INGRESO */}
      {tab === 'ingreso' && (
        <div>
          <div style={{ background: S.accentLight, border: '1px solid #85B7EB', borderRadius: 8, padding: '.9rem 1rem', fontSize: 13, color: S.accent, marginBottom: '1.25rem', lineHeight: 1.6 }}>
            El protocolo corre solo — cuando registras un ingreso, el sistema crea las alertas necesarias segun el peso promedio del lote.
          </div>
          {lotes.length === 0 && <p style={{ fontSize: 13, color: S.hint }}>No hay lotes registrados.</p>}
          {lotes.map(l => {
            const dias = Math.ceil((new Date() - new Date(l.fecha_ingreso)) / (1000 * 60 * 60 * 24))
            const enCuarentena = dias <= 10
            const peso = l.peso_prom_ingreso || 0
            const segunda = peso < 180
            return (
              <div key={l.id} style={{ background: S.surface, border: `1px solid ${enCuarentena ? '#EF9F27' : S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{l.codigo}</div>
                    <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                      {l.cantidad} animales · {new Date(l.fecha_ingreso).toLocaleDateString('es-AR')} · prom. {Math.round(peso)} kg · dia {dias} de 10
                    </div>
                  </div>
                  <Badge bg={enCuarentena ? S.amberLight : S.greenLight} color={enCuarentena ? S.amber : S.green}>
                    {enCuarentena ? 'Cuarentena activa' : 'Cerrado ✓'}
                  </Badge>
                </div>
                {/* Día 0 — Vacunación múltiple */}
                {(() => {
                  const vac = vacunacionLote[l.id] || {}
                  const todosProductos = productos.filter(p => p.tipo === 'Vacuna')
                  const confirmada = vac.confirmada
                  const vacSeleccionadas = vac.vacunas || [{ prod_id: '', dosis: '5' }]
                  return (
                    <div style={{ padding: '.85rem 0', borderBottom: `1px solid ${S.border}`, display: 'flex', gap: '1rem' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: confirmada ? S.green : S.amberLight, border: confirmada ? 'none' : `2px solid #EF9F27`, color: confirmada ? '#fff' : S.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {confirmada ? '✓' : '1'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, color: confirmada ? S.text : S.amber }}>
                          Dia 0 — Vacunación (lote completo)
                        </div>
                        {confirmada ? (
                          <div style={{ fontSize: 12, color: S.muted }}>
                            {(vac.resumen || []).map(r => `${r.nombre} ${r.dosis}ml/animal (${r.mlTotal.toLocaleString('es-AR')} ml)`).join(' · ')}
                            {' · '}{new Date(l.fecha_ingreso).toLocaleDateString('es-AR')}
                          </div>
                        ) : (
                          <div>
                            {todosProductos.length === 0 ? (
                              <div style={{ fontSize: 12, color: S.amber, padding: '6px 0' }}>⚠ No hay vacunas en stock. Agregá productos en Insumos → Stock sanitario.</div>
                            ) : (
                              <>
                                <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>
                                  Seleccioná una o más vacunas y la dosis de cada una. Se descontará del stock automáticamente.
                                </div>
                                {vacSeleccionadas.map((vs, vi) => {
                                  const prodSel = todosProductos.find(p => String(p.id) === String(vs.prod_id))
                                  const mlTotal = vs.prod_id && vs.dosis ? Math.round(l.cantidad * parseFloat(vs.dosis || 5)) : null
                                  return (
                                    <div key={vi} style={{ marginBottom: 8 }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                                        <div>
                                          {vi === 0 && <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Vacuna</div>}
                                          <select value={vs.prod_id || ''}
                                            onChange={e => {
                                              const nuevas = vacSeleccionadas.map((x, i) => i === vi ? {...x, prod_id: e.target.value} : x)
                                              setVacunacionLote(prev => ({...prev, [l.id]: {...(prev[l.id]||{}), vacunas: nuevas}}))
                                            }}
                                            style={{ width: '100%', padding: '8px 10px', border: `1px solid ${S.accent}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }}>
                                            <option value="">— Seleccioná —</option>
                                            {todosProductos.map(p => (
                                              <option key={p.id} value={p.id}>
                                                {p.n} ({(p.cantidad_ml || 0).toLocaleString('es-AR')} ml en stock)
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          {vi === 0 && <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>ml/animal</div>}
                                          <input type="number" value={vs.dosis || '5'} step="0.5" min="0"
                                            onChange={e => {
                                              const nuevas = vacSeleccionadas.map((x, i) => i === vi ? {...x, dosis: e.target.value} : x)
                                              setVacunacionLote(prev => ({...prev, [l.id]: {...(prev[l.id]||{}), vacunas: nuevas}}))
                                            }}
                                            style={{ width: '100%', padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                                          {vacSeleccionadas.length > 1 && (
                                            <button onClick={() => {
                                              const nuevas = vacSeleccionadas.filter((_, i) => i !== vi)
                                              setVacunacionLote(prev => ({...prev, [l.id]: {...(prev[l.id]||{}), vacunas: nuevas}}))
                                            }} style={{ padding: '7px 10px', fontSize: 12, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer', marginTop: vi === 0 ? 18 : 0 }}>✕</button>
                                          )}
                                        </div>
                                      </div>
                                      {vs.prod_id && vs.dosis && mlTotal && (
                                        <div style={{ marginTop: 4, fontSize: 11, color: S.accent }}>
                                          → {mlTotal.toLocaleString('es-AR')} ml de {prodSel?.n} ({l.cantidad} animales × {vs.dosis} ml)
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                                <button onClick={() => {
                                  const nuevas = [...vacSeleccionadas, { prod_id: '', dosis: '5' }]
                                  setVacunacionLote(prev => ({...prev, [l.id]: {...(prev[l.id]||{}), vacunas: nuevas}}))
                                }} style={{ padding: '5px 12px', fontSize: 11, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer', marginBottom: 10 }}>
                                  + Agregar otra vacuna
                                </button>
                                <button disabled={!vacSeleccionadas.some(vs => vs.prod_id) || vac.guardando}
                                  onClick={async () => {
                                    const validas = vacSeleccionadas.filter(vs => vs.prod_id)
                                    if (validas.length === 0) { alert('Seleccioná al menos una vacuna'); return }
                                    setVacunacionLote(prev => ({...prev, [l.id]: {...prev[l.id], guardando: true}}))
                                    const resumen = []
                                    for (const vs of validas) {
                                      const dosis = parseFloat(vs.dosis || 5)
                                      const mlDesc = Math.round(l.cantidad * dosis)
                                      const prod = todosProductos.find(p => String(p.id) === String(vs.prod_id))
                                      if (!prod) continue
                                      if ((prod.cantidad_ml || 0) < mlDesc) {
                                        if (!confirm(`Stock insuficiente de ${prod.n}. Hay ${prod.cantidad_ml?.toLocaleString('es-AR')} ml y se necesitan ${mlDesc.toLocaleString('es-AR')} ml. ¿Continuar igual?`)) {
                                          setVacunacionLote(prev => ({...prev, [l.id]: {...prev[l.id], guardando: false}}))
                                          return
                                        }
                                      }
                                      const nuevaCant = Math.max(0, (prod.cantidad_ml || 0) - mlDesc)
                                      await supabase.from('stock_sanitario').update({ cantidad_ml: nuevaCant, actualizado_en: new Date().toISOString() }).eq('id', prod.id)
                                      await supabase.from('eventos_sanitarios').insert({
                                        tipo: 'vacunacion', corral_id: l.corral_cuarentena_id,
                                        producto: prod.n, cantidad_ml: mlDesc,
                                        cantidad_animales: l.cantidad,
                                        observaciones: `Ingreso lote ${l.codigo} — ${dosis} ml/animal`,
                                        registrado_por: usuario?.id,
                                      })
                                      resumen.push({ nombre: prod.n, dosis, mlTotal: mlDesc })
                                    }
                                    await cargarProductos()
                                    setVacunacionLote(prev => ({...prev, [l.id]: {...prev[l.id], guardando: false, confirmada: true, resumen}}))
                                  }}
                                  style={{ display: 'block', width: '100%', padding: '8px 14px', fontSize: 12, fontWeight: 600, background: vacSeleccionadas.some(vs => vs.prod_id) ? S.accent : S.bg, border: `1px solid ${vacSeleccionadas.some(vs => vs.prod_id) ? S.accent : S.border}`, color: vacSeleccionadas.some(vs => vs.prod_id) ? '#fff' : S.muted, borderRadius: 6, cursor: vacSeleccionadas.some(vs => vs.prod_id) ? 'pointer' : 'default' }}>
                                  {vac.guardando ? 'Guardando...' : '✓ Confirmar vacunación'}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
                <div style={{ padding: '.85rem 0', borderBottom: `1px solid ${S.border}`, display: 'flex', gap: '1rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: dias > 1 ? S.green : S.border, color: dias > 1 ? '#fff' : S.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{dias > 1 ? '✓' : '2'}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, color: dias > 1 ? S.text : S.muted }}>Dias 1-10 — Via alimentacion</div>
                    <div style={{ fontSize: 12, color: S.muted, lineHeight: 1.6 }}>Incluido en formula del mixer. Sin accion adicional.</div>
                  </div>
                </div>
                {segunda && (
                  <div style={{ padding: '.85rem 0', borderBottom: `1px solid ${S.border}`, display: 'flex', gap: '1rem' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.amberLight, border: `2px solid #EF9F27`, color: S.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>!</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, color: S.amber }}>Dia 20 — Segunda dosis Alliance + Feedlot (peso &lt;180 kg)</div>
                      <div style={{ fontSize: 12, color: S.muted, lineHeight: 1.6 }}>El lote ingreso con {Math.round(peso)} kg promedio. Repetir dosis a los 20 dias del ingreso.</div>
                    </div>
                  </div>
                )}
                <div style={{ padding: '.85rem 0', display: 'flex', gap: '1rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: dias >= 10 ? S.green : S.border, color: dias >= 10 ? '#fff' : S.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{dias >= 10 ? '✓' : segunda ? '4' : '3'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, color: dias >= 10 ? S.text : S.muted }}>Dia 10 — Cierre del protocolo</div>
                    <div style={{ fontSize: 12, color: S.muted, lineHeight: 1.6 }}>El lote pasa a acumulacion y queda bajo revision bisemanal.</div>
                    {dias >= 10 && enCuarentena && (
                      <button onClick={async () => {
                        if (!confirm(`¿Confirmar pasaje de ${l.cantidad} animales a acumulación?`)) return
                        const corral = corrales.find(c => c.id === l.corral_cuarentena_id)
                        if (corral) {
                          await supabase.from('corrales').update({ rol: 'acumulacion' }).eq('id', corral.id)
                          await supabase.from('movimientos').insert({ fecha: new Date().toISOString(), tipo: 'cambio_rol', corral_destino_id: corral.id, cantidad: l.cantidad, motivo: 'Fin cuarentena — pase a acumulación', registrado_por: usuario?.id })
                        }
                        await cargar()
                      }} style={{ marginTop: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                        ✓ Confirmar pasaje a acumulación
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TAB REVISION BISEMANAL */}
      {tab === 'revision' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Revision bisemanal</h2>
              <div style={{ fontSize: 12, color: S.muted }}>Lunes y jueves · recorrida de todos los corrales</div>
            </div>
            <button onClick={confirmarRevision}
              style={{ padding: '8px 16px', background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              Confirmar revision
            </button>
          </div>

          <div style={{ background: S.accentLight, border: '1px solid #85B7EB', borderRadius: 8, padding: '.9rem 1rem', fontSize: 13, color: S.accent, marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Recorres cada corral. Si no hay novedades, marcas "Sin novedades". Si encontras un animal con problema, lo describes y elegis el producto aplicado.
          </div>

          {corrales.map((c, i) => {
            const st = revState[i] || { ok: null, enfermos: [] }
            const bc = st.ok === true ? '#97C459' : st.ok === false ? '#EF9F27' : S.border
            return (
              <div key={c.id} style={{ border: `1px solid ${bc}`, borderRadius: 10, marginBottom: '.65rem', overflow: 'hidden' }}>
                <div style={{ padding: '.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: S.surface }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Corral {c.numero} — {c.rol}</div>
                    <div style={{ fontSize: 12, color: S.muted, marginTop: 1 }}>{c.animales || 0} animales</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {st.ok === true && <Badge bg={S.greenLight} color={S.green}>Sin novedades ✓</Badge>}
                    {st.ok === false && <Badge bg={S.amberLight} color={S.amber}>{st.enfermos.length} con novedad</Badge>}
                    {st.ok === null && <Badge bg={S.bg} color={S.muted}>Pendiente</Badge>}
                    {st.ok === null && (
                      <>
                        <button onClick={() => setRevOk(i)} style={{ padding: '5px 10px', fontSize: 12, background: S.greenLight, border: `1px solid #97C459`, color: S.green, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Sin novedades ✓</button>
                        <button onClick={() => setRevNov(i)} style={{ padding: '5px 10px', fontSize: 12, background: S.amberLight, border: `1px solid #EF9F27`, color: S.amber, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Hay novedad</button>
                      </>
                    )}
                    {st.ok !== null && (
                      <button onClick={() => resetRev(i)} style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Cambiar</button>
                    )}
                  </div>
                </div>

                {st.ok === false && (
                  <div style={{ padding: '1rem', borderTop: `1px solid ${S.border}`, background: '#fffef8' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px 70px 60px 32px', gap: 8, padding: '4px 0 8px', borderBottom: `1px solid ${S.border}`, marginBottom: 4 }}>
                      {['Descripcion del animal','Diagnostico','Producto aplicado','ml','Enf.',''].map(h => (
                        <div key={h} style={{ fontSize: 10, fontWeight: 600, color: S.hint, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</div>
                      ))}
                    </div>
                    {st.enfermos.map((e, ei) => (
                      <div key={ei} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px 70px 60px 32px', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${S.border}` }}>
                        <input type="text" value={e.desc} placeholder="ej. novillo negro, oreja cortada"
                          onChange={ev => updEnfermo(i, ei, 'desc', ev.target.value)}
                          style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface }} />
                        <select value={e.diag} onChange={ev => updEnfermo(i, ei, 'diag', ev.target.value)}
                          style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface }}>
                          {DIAGNOSTICOS.map(d => <option key={d}>{d}</option>)}
                        </select>
                        <select value={e.prod} onChange={ev => {
                          const prod = productos.find(p => p.n === ev.target.value)
                          updEnfermo(i, ei, 'prod', ev.target.value)
                          updEnfermo(i, ei, 'prod_id', prod?.id || null)
                        }}
                          style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface }}>
                          <option value="">— Producto —</option>
                          {productos.map(p => <option key={p.n} value={p.n}>{p.n} ({p.cantidad_ml?.toLocaleString('es-AR')} {p.unidad})</option>)}
                        </select>
                        <input type="number" value={e.ml || ''} placeholder="ml" onChange={ev => updEnfermo(i, ei, 'ml', ev.target.value)}
                          style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, width: 70, background: S.surface }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: S.red, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                          <input type="checkbox" checked={e.mover_enfermeria || false} onChange={ev => updEnfermo(i, ei, 'mover_enfermeria', ev.target.checked)} />
                          Enf.
                        </label>
                        <button onClick={() => delEnfermo(i, ei)}
                          style={{ border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, borderRadius: 5, width: 28, height: 28, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: '.65rem' }}>
                      <button onClick={() => addEnfermo(i)} style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>+ Animal</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* TAB HISTORIAL */}
      {tab === 'historial' && (
        <div>
          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Fecha','Tipo','Corral','Producto','Animales','Observaciones','Por'].map(h => (
                    <th key={h} style={{ background: S.bg, padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventos.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay eventos registrados.</td></tr>
                )}
                {eventos.map(e => {
                  const TIPO_COLORS = {
                    ingreso: { bg: S.accentLight, color: S.accent, label: 'Ingreso' },
                    revision: { bg: S.purpleLight, color: S.purple, label: 'Revision' },
                    tratamiento: { bg: S.amberLight, color: S.amber, label: 'Tratamiento' },
                    segunda_dosis: { bg: S.amberLight, color: S.amber, label: '2da dosis' },
                    mortalidad: { bg: S.redLight, color: S.red, label: 'Mortandad' },
                  }
                  const tc = TIPO_COLORS[e.tipo] || { bg: S.bg, color: S.muted, label: e.tipo }
                  return (
                    <tr key={e.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{new Date(e.creado_en).toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit'})}</td>
                      <td style={{ padding: '9px 12px' }}><Badge bg={tc.bg} color={tc.color}>{tc.label}</Badge></td>
                      <td style={{ padding: '9px 12px' }}>{e.corrales?.numero ? `C-${e.corrales.numero}` : 'Todos'}</td>
                      <td style={{ padding: '9px 12px' }}>{e.producto}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{e.cantidad_animales}</td>
                      <td style={{ padding: '9px 12px', color: S.muted, fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.observaciones || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{e.usuarios?.nombre || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB PRODUCTOS */}
      {tab === 'mortalidad' && (
        <div>
          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
            {(() => {
              const anio = new Date().getFullYear()
              const mes = new Date().getMonth()
              const mortAnio = mortalidad.filter(m => new Date(m.creado_en).getFullYear() === anio)
              const mortMes = mortalidad.filter(m => { const d = new Date(m.creado_en); return d.getFullYear() === anio && d.getMonth() === mes })
              const totalAnio = mortAnio.reduce((s, m) => s + (m.cantidad || 0), 0)
              const totalMes = mortMes.reduce((s, m) => s + (m.cantidad || 0), 0)
              const totalAnimales = corrales.reduce((s, c) => s + (c.animales || 0), 0)
              const pctMort = totalAnimales > 0 ? ((totalAnio / (totalAnimales + totalAnio)) * 100).toFixed(2) : '0.00'
              const porCausa = {}
              mortAnio.forEach(m => { if (m.causa) porCausa[m.causa] = (porCausa[m.causa] || 0) + (m.cantidad || 0) })
              const causaPrincipal = Object.entries(porCausa).sort((a, b) => b[1] - a[1])[0]
              return [
                { label: `Muertes ${anio}`, val: totalAnio, color: S.red },
                { label: 'Muertes este mes', val: totalMes, color: S.red },
                { label: 'Tasa de mortalidad', val: `${pctMort}%`, color: parseFloat(pctMort) > 2 ? S.red : S.green },
                { label: 'Causa principal', val: causaPrincipal?.[0] || '—', color: S.muted },
              ].map((m, i) => (
                <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
                  <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: m.color }}>{m.val}</div>
                </div>
              ))
            })()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Historial de mortalidad</div>
            <button onClick={() => setShowFormMort(!showFormMort)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.red, border: `1px solid ${S.red}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Registrar muerte
            </button>
          </div>

          {showFormMort && (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Fecha</div>
                  <input type="date" value={formMort.fecha} onChange={e => setFormMort({...formMort, fecha: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Corral</div>
                  <select value={formMort.corral_id} onChange={e => setFormMort({...formMort, corral_id: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, background: S.surface }}>
                    <option value="">— Seleccioná —</option>
                    {corrales.filter(c => c.animales > 0).map(c => <option key={c.id} value={c.id}>C-{c.numero} · {c.animales} anim.</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Cantidad</div>
                  <input type="number" value={formMort.cantidad} onChange={e => setFormMort({...formMort, cantidad: e.target.value})} min="1"
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Causa</div>
                  <select value={formMort.causa} onChange={e => setFormMort({...formMort, causa: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, background: S.surface }}>
                    <option value="">— Sin especificar —</option>
                    {['Neumonía', 'Enterotoxemia', 'Accidente', 'Timpanismo', 'Diarrea', 'Causa desconocida', 'Otro'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormMort(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarMortalidad} disabled={guardandoMort} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.red, border: `1px solid ${S.red}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardandoMort ? 'Guardando...' : 'Registrar'}</button>
              </div>
            </div>
          )}

          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: S.bg }}>
                {['Fecha', 'Corral', 'Cantidad', 'Causa', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {mortalidad.length === 0 && <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay registros de mortalidad.</td></tr>}
                {mortalidad.map(m => (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>C-{m.corrales?.numero || '—'}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.red, fontWeight: 600 }}>{m.cantidad}</td>
                    <td style={{ padding: '9px 12px', color: S.muted }}>{m.causa || '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <button onClick={() => eliminarMortalidad(m)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── STOCK SANITARIO ── */}
      {tab === 'stock' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Stock sanitario</div>
              <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>Registrá el remito cuando ingresa mercadería. La factura y el pago se completan desde Insumos.</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowNuevoProd(!showNuevoProd); setShowFormStockSan(false) }}
                style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                + Nuevo producto
              </button>
              <button onClick={() => { setShowFormStockSan(!showFormStockSan); setShowNuevoProd(false) }}
                style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                + Registrar remito
              </button>
            </div>
          </div>

          {/* Formulario nuevo producto */}
          {showNuevoProd && (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>Nuevo producto sanitario</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Nombre *</div>
                  <input type="text" value={formNuevoProd.nombre} onChange={e => setFormNuevoProd({...formNuevoProd, nombre: e.target.value})}
                    placeholder="ej. Ivermectina 1%"
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.accent}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Tipo *</div>
                  <select value={formNuevoProd.tipo} onChange={e => setFormNuevoProd({...formNuevoProd, tipo: e.target.value})}
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
                    {['Vacuna', 'Antibiotico', 'Antiparasitario', 'Vitamina', 'Antiinflamatorio', 'Otro'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Unidad</div>
                  <select value={formNuevoProd.unidad} onChange={e => setFormNuevoProd({...formNuevoProd, unidad: e.target.value})}
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
                    {['ml', 'dosis', 'kg', 'comprimido', 'unidad'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Laboratorio</div>
                  <input type="text" value={formNuevoProd.lab} onChange={e => setFormNuevoProd({...formNuevoProd, lab: e.target.value})}
                    placeholder="ej. MSD Animal Health"
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Carencia (días)</div>
                  <input type="number" value={formNuevoProd.car} onChange={e => setFormNuevoProd({...formNuevoProd, car: e.target.value})}
                    placeholder="0 = sin carencia" min="0"
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Mínimo de alerta</div>
                  <input type="number" value={formNuevoProd.minimo} onChange={e => setFormNuevoProd({...formNuevoProd, minimo: e.target.value})}
                    placeholder="ej. 500"
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowNuevoProd(false)}
                  style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarNuevoProd} disabled={guardandoProd}
                  style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                  {guardandoProd ? 'Guardando...' : 'Agregar producto'}
                </button>
              </div>
            </div>
          )}

          {/* Formulario remito */}
          {showFormStockSan && (
            <div style={{ background: S.surface, border: `1px solid ${S.accent}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.accent, marginBottom: '1rem' }}>Registrar ingreso de producto sanitario</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Producto *</div>
                  <select value={formStockSan.producto_id} onChange={e => {
                    const p = productos.find(x => String(x.id) === e.target.value)
                    setFormStockSan({...formStockSan, producto_id: e.target.value, unidad: p?.unidad || 'ml'})
                  }} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }}>
                    <option value="">— Seleccioná —</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.n} ({p.tipo})</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Cantidad *</div>
                  <input type="number" value={formStockSan.cantidad} onChange={e => setFormStockSan({...formStockSan, cantidad: e.target.value})}
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.accent}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Unidad</div>
                  <select value={formStockSan.unidad} onChange={e => setFormStockSan({...formStockSan, unidad: e.target.value})}
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
                    {['ml', 'dosis', 'kg', 'comprimido', 'unidad'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Proveedor</div>
                  <input type="text" value={formStockSan.proveedor} onChange={e => setFormStockSan({...formStockSan, proveedor: e.target.value})}
                    placeholder="ej. Veterinaria Córdoba"
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>N° Remito</div>
                  <input type="text" value={formStockSan.remito} onChange={e => setFormStockSan({...formStockSan, remito: e.target.value})}
                    placeholder="ej. R-00012345"
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormStockSan(false)}
                  style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarIngresoSan} disabled={guardandoStockSan}
                  style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                  {guardandoStockSan ? 'Guardando...' : '💾 Registrar ingreso'}
                </button>
              </div>
            </div>
          )}

          {/* Tabla de stock */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: S.bg }}>
                  {['Producto', 'Tipo', 'Laboratorio', 'Carencia', 'Mínimo', 'Stock actual', 'Unidad', ''].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productos.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay productos. Usá "+ Nuevo producto" para agregar.</td></tr>
                )}
                {productos.map((p, i) => {
                  const tc = TIPO_BADGE[p.tipo] || TIPO_BADGE.Otro
                  const cant = p.cantidad_ml || p.cantidad_kg || 0
                  const bajo = cant < 50
                  return (
                    <React.Fragment key={p.id || i}>
                    <tr style={{ borderBottom: editProd?.id === p.id ? 'none' : `1px solid ${S.border}` }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{p.n}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: tc.bg, color: tc.color }}>{p.tipo}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>{p.lab || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: p.car > 0 ? S.amber : S.hint }}>
                        {p.car > 0 ? `${p.car} días` : 'Sin carencia'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: S.muted, fontFamily: 'monospace' }}>{p.minimo > 0 ? p.minimo.toLocaleString('es-AR') : '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: bajo ? S.red : S.green }}>
                        {cant.toLocaleString('es-AR')}
                        {bajo && <span style={{ fontSize: 11, marginLeft: 6, background: S.redLight, color: S.red, padding: '2px 6px', borderRadius: 4 }}>⚠ Stock bajo</span>}
                      </td>
                      <td style={{ padding: '10px 14px', color: S.muted }}>{p.unidad || 'ml'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setEditProd(editProd?.id === p.id ? null : { id: p.id, nombre: p.n, tipo: p.tipo, lab: p.lab || '', car: String(p.car || 0), unidad: p.unidad || 'ml', minimo: String(p.minimo || 0), cantidad_actual: String(p.cantidad_ml || 0) })}
                            style={{ padding: '4px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                            {editProd?.id === p.id ? 'Cancelar' : 'Editar'}
                          </button>
                          <button onClick={() => eliminarProd(p)}
                            style={{ padding: '4px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editProd?.id === p.id && (
                      <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td colSpan={8} style={{ padding: '1rem', background: S.accentLight }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: '.75rem' }}>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Nombre</div>
                              <input type="text" value={editProd.nombre} onChange={e => setEditProd({...editProd, nombre: e.target.value})}
                                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${S.accent}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Tipo</div>
                              <select value={editProd.tipo} onChange={e => setEditProd({...editProd, tipo: e.target.value})}
                                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
                                {['Vacuna', 'Antibiotico', 'Antiparasitario', 'Vitamina', 'Antiinflamatorio', 'Otro'].map(t => <option key={t}>{t}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Laboratorio</div>
                              <input type="text" value={editProd.lab} onChange={e => setEditProd({...editProd, lab: e.target.value})}
                                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Carencia (días)</div>
                              <input type="number" value={editProd.car} onChange={e => setEditProd({...editProd, car: e.target.value})}
                                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Mínimo</div>
                              <input type="number" value={editProd.minimo} onChange={e => setEditProd({...editProd, minimo: e.target.value})}
                                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Unidad</div>
                              <select value={editProd.unidad} onChange={e => setEditProd({...editProd, unidad: e.target.value})}
                                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
                                {['ml', 'dosis', 'kg', 'comprimido', 'unidad'].map(u => <option key={u}>{u}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: S.green, textTransform: 'uppercase', marginBottom: 3 }}>Stock actual</div>
                              <input type="number" value={editProd.cantidad_actual} onChange={e => setEditProd({...editProd, cantidad_actual: e.target.value})}
                                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${S.green}`, borderRadius: 6, fontSize: 13, fontWeight: 600, color: S.green, background: S.surface, boxSizing: 'border-box' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditProd(null)}
                              style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={guardarEditProd} disabled={guardandoProd}
                              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                              {guardandoProd ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Historial de ingresos */}
          {historialIngresosSan.length > 0 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '.75rem' }}>Últimos ingresos registrados</div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: S.bg }}>
                      {['Fecha', 'Producto', 'Cantidad', 'Proveedor', 'Remito', 'Estado'].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historialIngresosSan.map(ing => (
                      <tr key={ing.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted, whiteSpace: 'nowrap' }}>
                          {ing.fecha ? new Date(ing.fecha+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{ing.insumo_nombre}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{ing.cantidad?.toLocaleString('es-AR')} {ing.unidad || 'ml'}</td>
                        <td style={{ padding: '8px 12px', color: S.muted }}>{ing.proveedor || '—'}</td>
                        <td style={{ padding: '8px 12px', color: S.muted, fontFamily: 'monospace' }}>{ing.numero_factura || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: ing.estado_pago === 'pagado' ? S.greenLight : S.amberLight, color: ing.estado_pago === 'pagado' ? S.green : S.amber }}>
                            {ing.estado_pago === 'pagado' ? '✓ Pagado' : '⏳ Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
} 
