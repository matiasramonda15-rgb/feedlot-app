import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Btn, Loader } from './UI'
import { confirmarVacunacionIngreso, registrarTratamientoSanitario, cargarStockSanitario, yaVacunadoIngreso } from '../shared/sanidadLogic'

const CM = { bg: '#1A2E1A', surface: '#243324', surface2: '#2E3F2E', border: '#3A4F3A', text: '#E8F0E8', muted: '#8FA88F', green: '#7EC87E', amber: '#F5C97A', red: '#F09595', blue: '#7EB8F7', mono: "'IBM Plex Mono', monospace", sans: "'IBM Plex Sans', sans-serif" }
function MobileTopbar({ titulo, sub, onBack }) {
  return (
    <div style={{ background: CM.surface, padding: '1rem', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: `1px solid ${CM.border}` }}>
      {onBack && <button onClick={onBack} style={{ background: 'none', border: 'none', color: CM.green, fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: CM.text }}>{titulo}</div>
        {sub && <div style={{ fontSize: 11, color: CM.muted, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}
function MobileScroll({ children }) {
  return <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: CM.bg, color: CM.text }}>{children}</div>
}

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

export default function Sanidad({ usuario, mobile, nav }) {
  const [tab, setTab] = useState('alertas')
  const [historialSan, setHistorialSan] = useState([])
  const [historialSanLegacy, setHistorialSanLegacy] = useState([])
  const [loading, setLoading] = useState(true)
  const [alertas, setAlertas] = useState([])
  const [corrales, setCorrales] = useState([])
  const [lotes, setLotes] = useState([])
  const [enfermeria, setEnfermeria] = useState([])
  const [corralesEnfermeria, setCorralesEnfermeria] = useState([])
  const [mortalidad, setMortalidad] = useState([])
  const [eventos, setEventos] = useState([])
  const [eventosVacunacionIngreso, setEventosVacunacionIngreso] = useState([])
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
  // historialSan already declared above
  const [showNuevoProd, setShowNuevoProd] = useState(false)
  const [formNuevoProd, setFormNuevoProd] = useState({ nombre: '', tipo: 'Vacuna', lab: '', car: '', unidad: 'ml', minimo: '' })
  // Estado propio del modo celular
  const [pantSan, setPantSan] = useState(() => {
    const destino = typeof window !== 'undefined' ? window.__sanidadTab : null
    if (destino) window.__sanidadTab = null
    return destino || 'alertas'
  })
  const [verArchivoSan, setVerArchivoSan] = useState(false)
  const [confirmadosM, setConfirmadosM] = useState({})
  const [revStateM, setRevStateM] = useState([])
  const [formEventoM, setFormEventoM] = useState({ corral_id: '', prod_id: '', producto: '', dosis_ml: '5', cantidad: '', observaciones: '' })
  const [guardandoM, setGuardandoM] = useState(false)
  const [stockSanitarioM, setStockSanitarioM] = useState([])
  const [proximaPesadaM, setProximaPesadaM] = useState(null)
  const [movimientosM, setMovimientosM] = useState([])
  const [editProd, setEditProd] = useState(null)
  const [tipoCustomNuevo, setTipoCustomNuevo] = useState('')
  const [filtroTipoStock, setFiltroTipoStock] = useState('')
  const [tipoCustomEdit, setTipoCustomEdit] = useState('') // { id, nombre, tipo, lab, car, unidad, minimo }
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
    const tipoFinal = formNuevoProd.tipo === '__nuevo__' ? tipoCustomNuevo.trim() : formNuevoProd.tipo
    if (!tipoFinal) { alert('Ingresá el tipo'); return }
    setGuardandoProd(true)
    await supabase.from('stock_sanitario').insert({
      producto: formNuevoProd.nombre.trim(),
      tipo: tipoFinal,
      laboratorio: formNuevoProd.lab || null,
      carencia_dias: parseInt(formNuevoProd.car) || 0,
      unidad: formNuevoProd.unidad,
      cantidad_ml: 0,
      minimo_stock: parseFloat(formNuevoProd.minimo) || 0,
      activo: true,
    })
    setFormNuevoProd({ nombre: '', tipo: 'Vacuna', lab: '', car: '', unidad: 'ml', minimo: '' })
    setTipoCustomNuevo('')
    setShowNuevoProd(false)
    setGuardandoProd(false)
    await cargarProductos()
  }

  async function guardarEditProd() {
    if (!editProd?.nombre?.trim()) { alert('Ingresá el nombre'); return }
    const tipoFinal = editProd.tipo === '__nuevo__' ? tipoCustomEdit.trim() : editProd.tipo
    if (!tipoFinal) { alert('Ingresá el tipo'); return }
    setGuardandoProd(true)
    await supabase.from('stock_sanitario').update({
      producto: editProd.nombre.trim(),
      tipo: tipoFinal,
      laboratorio: editProd.lab || null,
      carencia_dias: parseInt(editProd.car) || 0,
      unidad: editProd.unidad,
      minimo_stock: parseFloat(editProd.minimo) || 0,
      cantidad_ml: parseFloat(editProd.cantidad_actual) || 0,
      actualizado_en: new Date().toISOString(),
    }).eq('id', editProd.id)
    setEditProd(null)
    setTipoCustomEdit('')
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
      // Actualizar stock de forma atómica (suma en la base, no en la app) para
      // no pisar otra operación que toque el mismo producto casi al mismo tiempo
      await supabase.rpc('incrementar_stock_sanitario', { p_id: prod.id, p_delta: cant })
      await supabase.from('stock_sanitario').update({ pedido_realizado: false }).eq('id', prod.id)
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
    const [{ data }, { data: compras }, { data: legacy }] = await Promise.all([
      cargarStockSanitario(supabase),
      supabase.from('compras_insumos').select('*').eq('insumo_tipo', 'sanitario').order('fecha', { ascending: false }).limit(50),
      supabase.from('ingresos_stock').select('*').eq('tipo', 'sanitario').order('creado_en', { ascending: false }).limit(10),
    ])
    if (data) setProductos(data.map(p => ({ n: p.producto, tipo: p.tipo, id: p.id, cantidad_ml: p.cantidad_ml, unidad: p.unidad || 'ml', lab: p.laboratorio || '', car: p.carencia_dias || 0, minimo: p.minimo_stock || 0 })))
    setHistorialSan(compras || [])
    setHistorialSanLegacy(legacy || [])
  }

  useEffect(() => { cargarDatos() }, [])

  useEffect(() => {
    if (!mobile) return
    setRevStateM(corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado').map(c => ({ id: c.id, numero: c.numero, rol: c.rol, animales: c.animales || 0, ok: null, enfermos: [] })))
  }, [corrales, mobile])

  useEffect(() => {
    if (!mobile) return
    cargarStockSanitario(supabase).then(({ data }) => setStockSanitarioM(data || []))
    supabase.from('configuracion').select('valor').eq('clave', 'proxima_pesada').single().then(({ data }) => setProximaPesadaM(data?.valor || null))
    supabase.from('movimientos').select('*').order('fecha', { ascending: false }).limit(50).then(({ data }) => setMovimientosM(data || []))
  }, [mobile])

  async function cargarDatos() {
    const [{ data: al }, { data: c }, { data: l }, { data: enf }, { data: mort }, { data: ev }, { data: rev }, { data: vacIng }] = await Promise.all([
      supabase.from('alertas').select('*').eq('resuelta', false).order('fecha_vence'),
      supabase.from('corrales').select('*').not('rol', 'eq', 'libre').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('lotes').select('id, codigo, cantidad, fecha_ingreso, peso_prom_ingreso, corral_cuarentena_id, vacunado_ingreso').order('created_at', { ascending: false }).limit(10),
      supabase.from('animales_enfermeria').select('*, corrales:corral_origen_id(numero), lotes(codigo)').order('creado_en', { ascending: false }),
      supabase.from('mortalidad').select('*, corrales(numero), lotes(codigo)').order('creado_en', { ascending: false }),
      supabase.from('eventos_sanitarios').select('*, corrales(numero), usuarios:registrado_por(nombre)').order('creado_en', { ascending: false }).limit(200),
      supabase.from('revisiones').select('*, usuarios:registrado_por(nombre)').order('creado_en', { ascending: false }).limit(10),
      supabase.from('eventos_sanitarios').select('id, corral_id, lote_id, producto, cantidad_ml, cantidad_animales').eq('tipo', 'vacunacion').order('creado_en', { ascending: false }).limit(300),
    ])
    setAlertas(al || [])
    setCorrales((c || []).sort((a, b) => parseInt(a.numero) - parseInt(b.numero)))
    setLotes(l || [])
    setEnfermeria(enf || [])
    setMortalidad(mort || [])
    setEventos(ev || [])
    setRevisiones(rev || [])
    setEventosVacunacionIngreso(vacIng || [])
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

    const { error: errRev } = await supabase.from('revisiones').insert({ tipo: 'bisemanal', registrado_por: usuario?.id })
    if (errRev) { alert('Error al registrar la revisión: ' + errRev.message); return }

    for (let i = 0; i < corrales.length; i++) {
      const st = revState[i]
      if (st.ok) {
        const { error } = await supabase.from('eventos_sanitarios').insert({
          tipo: 'revision', corral_id: corrales[i].id,
          producto: 'Sin novedad', cantidad_animales: corrales[i].animales,
          observaciones: 'Sin novedades', registrado_por: usuario?.id,
        })
        if (error) { alert(`Error al guardar la revisión del corral ${corrales[i].numero}: ` + error.message); return }
        continue
      }
      for (const enf of (st.enfermos || [])) {
        if (!enf.desc) continue
        const productosValidos = (enf.productos || []).filter(p => p.prod)
        if (productosValidos.length === 0) {
          // Novedad sin ningún producto aplicado — igual queda registrada
          const { error } = await supabase.from('eventos_sanitarios').insert({
            tipo: 'revision', corral_id: corrales[i].id,
            producto: null, cantidad_animales: 1,
            observaciones: `${enf.diag}${enf.desc ? ' — ' + enf.desc : ''}`,
            registrado_por: usuario?.id,
          })
          if (error) { alert('Error al guardar la novedad: ' + error.message); return }
        } else {
          // Un evento POR CADA producto realmente aplicado — así el historial
          // muestra el nombre real de cada vacuna/producto, no un genérico "Varios".
          for (const p of productosValidos) {
            const mlNum = parseFloat(p.ml) || 0
            if (p.prod_id && mlNum > 0) {
              const { error: errStock } = await supabase.rpc('incrementar_stock_sanitario', { p_id: p.prod_id, p_delta: -mlNum })
              if (errStock) { alert('Error al descontar stock de ' + p.prod + ': ' + errStock.message); return }
            }
            const { error } = await supabase.from('eventos_sanitarios').insert({
              tipo: 'revision', corral_id: corrales[i].id,
              producto: p.prod, cantidad_ml: mlNum || null, cantidad_animales: 1,
              observaciones: `${enf.diag}${enf.desc ? ' — ' + enf.desc : ''}`,
              registrado_por: usuario?.id,
            })
            if (error) { alert('Error al guardar el evento de ' + p.prod + ': ' + error.message); return }
          }
        }
        // Registrar en animales_enfermeria (seguimiento del animal en sí, con todos los productos juntos)
        const corrEnf = enf.mover_enfermeria ? corrales.find(c => c.rol === 'enfermeria') : null
        const { error: errEnf } = await supabase.from('animales_enfermeria').insert({
          corral_origen_id: corrales[i].id,
          corral_id: corrEnf?.id || null,
          descripcion: enf.desc,
          diagnostico: enf.diag,
          tratamiento: productosValidos.map(p => p.prod).join(', ') || null,
          cantidad_ml: productosValidos.reduce((s, p) => s + (parseFloat(p.ml) || 0), 0) || null,
          estado: enf.mover_enfermeria ? 'en_enfermeria' : 'en tratamiento',
          registrado_por: usuario?.id,
        })
        if (errEnf) { alert('Error al registrar en enfermería: ' + errEnf.message); return }
      }
    }
    await cargarDatos()
    alert('Revision confirmada correctamente.')
  }

  function setRevOk(i) {
    const n = [...revState]; n[i] = { ok: true, enfermos: [] }; setRevState(n)
  }
  function setRevNov(i) {
    const n = [...revState]; n[i] = { ok: false, enfermos: [{ desc: '', diag: 'Conjuntivitis', productos: [{ prod: '', prod_id: null, ml: '' }], mover_enfermeria: false }] }; setRevState(n)
  }
  function resetRev(i) {
    const n = [...revState]; n[i] = { ok: null, enfermos: [] }; setRevState(n)
  }
  function addEnfermo(i) {
    const n = [...revState]; n[i].enfermos.push({ desc: '', diag: 'Conjuntivitis', productos: [{ prod: '', prod_id: null, ml: '' }], mover_enfermeria: false }); setRevState(n)
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
  function addProductoEnfermo(i, ei) {
    const n = [...revState]; n[i].enfermos[ei].productos.push({ prod: '', prod_id: null, ml: '' }); setRevState(n)
  }
  function delProductoEnfermo(i, ei, pi) {
    const n = [...revState]
    n[i].enfermos[ei].productos.splice(pi, 1)
    if (!n[i].enfermos[ei].productos.length) n[i].enfermos[ei].productos.push({ prod: '', prod_id: null, ml: '' })
    setRevState(n)
  }
  function updProductoEnfermo(i, ei, pi, k, v) {
    const n = [...revState]; n[i].enfermos[ei].productos[pi][k] = v; setRevState(n)
  }



  if (loading) return <Loader />

  // ── MODO CELULAR ──
  if (mobile) {
    const corralesActivosM = corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado')
    const proximaDateM = proximaPesadaM ? new Date(proximaPesadaM + 'T12:00:00') : null
    const diasPesadaM = proximaDateM ? Math.ceil((proximaDateM - new Date()) / (1000 * 60 * 60 * 24)) : null

    async function confirmarAlertaM(id) {
      await supabase.from('alertas').update({ resuelta: true, resuelta_en: new Date().toISOString() }).eq('id', id)
      setConfirmadosM(prev => ({...prev, [id]: true}))
      await cargarDatos()
    }

    async function confirmarRevisionM() {
      const sin = revStateM.filter(s => s.ok === null).length
      if (sin > 0) { alert(`Falta revisar ${sin} corral${sin !== 1 ? 'es' : ''}.`); return }
      setGuardandoM(true)
      const { error: errRev } = await supabase.from('revisiones').insert({ tipo: 'bisemanal', registrado_por: usuario?.id })
      if (errRev) { alert('Error al registrar la revisión: ' + errRev.message); setGuardandoM(false); return }
      for (const st of revStateM) {
        if (st.ok) {
          const { error } = await supabase.from('eventos_sanitarios').insert({
            tipo: 'revision', corral_id: st.id, producto: 'Sin novedad',
            cantidad_animales: st.animales, observaciones: 'Sin novedades', registrado_por: usuario?.id,
          })
          if (error) { alert('Error al guardar: ' + error.message); setGuardandoM(false); return }
          continue
        }
        for (const enf of (st.enfermos || [])) {
          if (!enf.desc) continue
          const productosValidos = (enf.productos || []).filter(p => p.prod)
          if (productosValidos.length === 0) {
            const { error } = await supabase.from('eventos_sanitarios').insert({
              tipo: 'revision', corral_id: st.id, producto: null,
              observaciones: `${enf.diag}${enf.desc ? ' — ' + enf.desc : ''}`,
              cantidad_animales: 1, registrado_por: usuario?.id,
            })
            if (error) { alert('Error al guardar la novedad: ' + error.message); setGuardandoM(false); return }
          } else {
            for (const p of productosValidos) {
              const mlNum = parseFloat(p.ml) || 0
              if (p.prod_id && mlNum > 0) await supabase.rpc('incrementar_stock_sanitario', { p_id: p.prod_id, p_delta: -mlNum })
              const { error } = await supabase.from('eventos_sanitarios').insert({
                tipo: 'revision', corral_id: st.id, producto: p.prod,
                observaciones: `${enf.diag}${enf.desc ? ' — ' + enf.desc : ''}`,
                cantidad_animales: 1, cantidad_ml: mlNum || null, registrado_por: usuario?.id,
              })
              if (error) { alert('Error al guardar el evento de ' + p.prod + ': ' + error.message); setGuardandoM(false); return }
            }
          }
          const { error: errEnf } = await supabase.from('animales_enfermeria').insert({
            corral_origen_id: st.id, descripcion: enf.desc, diagnostico: enf.diag,
            tratamiento: productosValidos.map(p => p.prod).join(', ') || null,
            cantidad_ml: productosValidos.reduce((s, p) => s + (parseFloat(p.ml) || 0), 0) || null,
            estado: enf.mover_enfermeria ? 'en_enfermeria' : 'en tratamiento', registrado_por: usuario?.id,
          })
          if (errEnf) { alert('Error al registrar en enfermería: ' + errEnf.message); setGuardandoM(false); return }
        }
      }
      await cargarDatos()
      alert('Revision confirmada.')
      setPantSan('alertas')
      setGuardandoM(false)
    }

    async function registrarEventoM() {
      if (!formEventoM.corral_id) { alert('Selecciona un corral'); return }
      if (!formEventoM.prod_id) { alert('Selecciona un producto'); return }
      if (!formEventoM.cantidad) { alert('Ingresa la cantidad de animales'); return }
      setGuardandoM(true)
      const cantAnimales = parseInt(formEventoM.cantidad)
      const dosisMl = parseFloat(formEventoM.dosis_ml) || 0
      const mlTotal = dosisMl > 0 ? Math.round(cantAnimales * dosisMl) : null
      const prod = stockSanitarioM.find(p => String(p.id) === String(formEventoM.prod_id))
      const { error } = await registrarTratamientoSanitario(supabase, {
        tipo: 'tratamiento', corralId: parseInt(formEventoM.corral_id),
        productoId: prod?.id || null, productoNombre: formEventoM.producto,
        cantidadMl: mlTotal, cantidadAnimales: cantAnimales,
        observaciones: formEventoM.observaciones, usuario,
      })
      if (error) { alert('Error al registrar el evento: ' + error.message); setGuardandoM(false); return }
      await cargarDatos()
      alert(`Evento registrado.${mlTotal ? ` Se descontaron ${mlTotal.toLocaleString('es-AR')} ml de ${formEventoM.producto}.` : ''}`)
      setPantSan('alertas')
      setFormEventoM({ corral_id: '', prod_id: '', producto: '', dosis_ml: '5', cantidad: '', observaciones: '' })
      setGuardandoM(false)
    }

    async function guardarMortalidadM() {
      await guardarMortalidad()
      nav && nav('home')
    }

    const TABS_M = [
      { key: 'alertas', label: 'Alertas' },
      { key: 'revision', label: 'Revision' },
      { key: 'evento', label: 'Evento' },
      { key: 'historial', label: '📋 Historial' },
      { key: 'mortalidad', label: '💀 Muerte' },
      { key: 'stock', label: '📦 Stock' },
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <MobileTopbar titulo="Sanidad" onBack={() => nav && nav('home')} />
        <div style={{ display: 'flex', background: CM.surface, borderBottom: `1px solid ${CM.border}`, flexShrink: 0 }}>
          {TABS_M.map(t => (
            <button key={t.key} onClick={() => setPantSan(t.key)}
              style={{ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: CM.sans, background: pantSan === t.key ? CM.green : 'transparent', color: pantSan === t.key ? '#0A1A0A' : CM.muted, borderBottom: pantSan === t.key ? `2px solid ${CM.green}` : '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
        <MobileScroll>
          {pantSan === 'alertas' && (
            <>
              {proximaDateM && (
                <div style={{ background: diasPesadaM <= 7 ? '#3D2A00' : '#1A3D26', border: `1px solid ${diasPesadaM <= 7 ? CM.amber : CM.green}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: diasPesadaM <= 7 ? CM.amber : CM.green, marginBottom: 3 }}>Proxima pesada fija</div>
                  <div style={{ fontSize: 12, color: CM.muted }}>
                    {proximaDateM.toLocaleDateString('es-AR')}
                    <span style={{ marginLeft: 8, fontWeight: 600, color: diasPesadaM <= 7 ? CM.amber : CM.green }}>
                      {diasPesadaM <= 0 ? '- Realizar hoy' : `- en ${diasPesadaM} dias`}
                    </span>
                  </div>
                </div>
              )}
              {alertas.length === 0 && corrales.filter(c => c.rol === 'cuarentena' && (c.animales || 0) > 0).length === 0 && <div style={{ textAlign: 'center', padding: '1rem', color: CM.muted, fontSize: 13 }}>Sin alertas pendientes.</div>}
              {corrales.filter(c => c.rol === 'cuarentena' && (c.animales || 0) > 0).map(c => {
                const ultimoLote = (lotes || []).find(l => l.corral_cuarentena_id === c.id)
                const ultimaFecha = ultimoLote?.fecha_ingreso || (movimientosM || []).find(m => m.corral_destino_id === c.id)?.fecha?.split('T')[0] || null
                const dias = ultimaFecha ? (() => {
                  const hoy = new Date()
                  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`
                  return Math.floor((new Date(hoyStr) - new Date(ultimaFecha)) / (1000 * 60 * 60 * 24))
                })() : null
                if (dias === null) return null
                return (
                  <div key={c.id} style={{ background: '#3D2A00', border: `1px solid ${CM.amber}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: CM.amber, marginBottom: 3 }}>🐄 Cuarentena C-{c.numero} — {dias} días</div>
                    <div style={{ fontSize: 12, color: CM.muted, marginBottom: '.65rem' }}>
                      {c.animales} animales · último ingreso {ultimaFecha ? new Date(ultimaFecha + 'T12:00:00').toLocaleDateString('es-AR') : '?'}
                    </div>
                    {(() => {
                      const loteC = (lotes || []).find(l => l.corral_cuarentena_id === c.id)
                      const vacunas = stockSanitarioM.filter(p => p.tipo === 'Vacuna')
                      const vacKey = loteC?.id || c.id
                      const vac = vacunacionLote[vacKey] || {}
                      const vacSeleccionadas = vac.vacunas || [{ prod_id: '', dosis: '5' }]
                      const expandido = vacunacionLote[`exp_vac_${c.id}`]
                      const yaVacunado = loteC ? yaVacunadoIngreso(loteC) : false
                      if (vac.confirmada || yaVacunado) {
                        return (
                          <div style={{ background: '#1A3D26', border: `1px solid ${CM.green}`, borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: CM.green }}>
                            ✓ Vacunado{(vac.resumen?.length > 0) ? ` — ${vac.resumen.map(r => `${r.nombre} ${r.dosis}ml/animal`).join(' · ')}` : ''}
                          </div>
                        )
                      }
                      return (
                        <div style={{ marginBottom: 8 }}>
                          {!expandido ? (
                            <button onClick={() => setVacunacionLote(prev => ({...prev, [`exp_vac_${c.id}`]: true}))}
                              style={{ width: '100%', padding: 10, background: '#2A1A00', border: `1px solid ${CM.amber}`, borderRadius: 8, color: CM.amber, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: CM.sans }}>
                              💉 Vacunar al ingreso
                            </button>
                          ) : (
                            <div style={{ background: '#1A1A1A', border: `1px solid ${CM.amber}`, borderRadius: 8, padding: '1rem' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: CM.amber, marginBottom: 10 }}>💉 Vacunación — C-{c.numero}</div>
                              {vacunas.length === 0 ? (
                                <div style={{ fontSize: 12, color: CM.amber }}>⚠ No hay vacunas en stock.</div>
                              ) : (
                                <>
                                  {vacSeleccionadas.map((vs, vi) => {
                                    const mlTotal = vs.prod_id && vs.dosis && loteC ? Math.round(loteC.cantidad * parseFloat(vs.dosis || 5)) : null
                                    return (
                                      <div key={vi} style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>
                                          {vi === 0 ? 'Vacuna' : `Vacuna ${vi + 1}`}
                                        </div>
                                        <select value={vs.prod_id || ''}
                                          onChange={e => {
                                            const nuevas = vacSeleccionadas.map((x, i) => i === vi ? {...x, prod_id: e.target.value} : x)
                                            setVacunacionLote(prev => ({...prev, [vacKey]: {...(prev[vacKey]||{}), vacunas: nuevas}}))
                                          }}
                                          style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.amber}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans, marginBottom: 6 }}>
                                          <option value="">— Seleccioná —</option>
                                          {vacunas.map(p => (
                                            <option key={p.id} value={p.id}>{p.producto} · {(p.cantidad_ml || 0).toLocaleString('es-AR')} {p.unidad || 'ml'}</option>
                                          ))}
                                        </select>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                          <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, color: CM.muted, marginBottom: 4 }}>ml/animal</div>
                                            <input type="number" inputMode="decimal" value={vs.dosis || '5'} step="0.5" min="0"
                                              onChange={e => {
                                                const nuevas = vacSeleccionadas.map((x, i) => i === vi ? {...x, dosis: e.target.value} : x)
                                                setVacunacionLote(prev => ({...prev, [vacKey]: {...(prev[vacKey]||{}), vacunas: nuevas}}))
                                              }}
                                              style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: CM.mono, fontWeight: 600, color: CM.amber, boxSizing: 'border-box' }} />
                                          </div>
                                          {vacSeleccionadas.length > 1 && (
                                            <button onClick={() => {
                                              const nuevas = vacSeleccionadas.filter((_, i) => i !== vi)
                                              setVacunacionLote(prev => ({...prev, [vacKey]: {...(prev[vacKey]||{}), vacunas: nuevas}}))
                                            }} style={{ padding: '10px 12px', fontSize: 13, background: '#2E1A1A', border: `1px solid ${CM.red}`, color: CM.red, borderRadius: 8, cursor: 'pointer', marginTop: 20 }}>✕</button>
                                          )}
                                        </div>
                                        {mlTotal && <div style={{ fontSize: 12, color: CM.green, marginTop: 4 }}>→ {mlTotal.toLocaleString('es-AR')} ml ({loteC?.cantidad} × {vs.dosis} ml)</div>}
                                      </div>
                                    )
                                  })}
                                  <button onClick={() => {
                                    const nuevas = [...vacSeleccionadas, { prod_id: '', dosis: '5' }]
                                    setVacunacionLote(prev => ({...prev, [vacKey]: {...(prev[vacKey]||{}), vacunas: nuevas}}))
                                  }} style={{ width: '100%', background: 'transparent', border: `1px solid ${CM.green}`, borderRadius: 8, padding: '10px', fontSize: 13, color: CM.green, fontWeight: 600, marginBottom: 10, cursor: 'pointer' }}>
                                    + Agregar otra vacuna
                                  </button>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => setVacunacionLote(prev => ({...prev, [`exp_vac_${c.id}`]: false}))}
                                      style={{ flex: 1, background: '#1A1A1A', border: `1px solid ${CM.border}`, borderRadius: 8, padding: 10, fontSize: 13, color: CM.muted, cursor: 'pointer' }}>
                                      Cancelar
                                    </button>
                                    <button disabled={!vacSeleccionadas.some(vs => vs.prod_id) || vac.guardando}
                                      onClick={async () => {
                                        const validas = vacSeleccionadas.filter(vs => vs.prod_id)
                                        if (!loteC) { alert('No se encontró el lote de ingreso para este corral. Revisá que el corral tenga un lote cargado con corral_cuarentena_id = ' + c.id); return }
                                        if (validas.length === 0) { alert('Seleccioná al menos una vacuna'); return }
                                        setVacunacionLote(prev => ({...prev, [vacKey]: {...prev[vacKey], guardando: true}}))
                                        const vacunasParaGuardar = validas.map(vs => {
                                          const prod = vacunas.find(p => String(p.id) === String(vs.prod_id))
                                          return prod ? { productoId: prod.id, nombre: prod.producto, dosisMlPorAnimal: parseFloat(vs.dosis || 5) } : null
                                        }).filter(Boolean)
                                        const { error, resumen } = await confirmarVacunacionIngreso(supabase, { lote: loteC, vacunas: vacunasParaGuardar, usuario })
                                        if (error) {
                                          alert('Error al confirmar vacunación: ' + error.message)
                                          setVacunacionLote(prev => ({...prev, [vacKey]: {...prev[vacKey], guardando: false}}))
                                          return
                                        }
                                        await cargarDatos()
                                        setVacunacionLote(prev => ({...prev, [vacKey]: {...prev[vacKey], guardando: false, confirmada: true, resumen}, [`exp_vac_${c.id}`]: false}))
                                      }}
                                      style={{ flex: 2, background: vacSeleccionadas.some(vs => vs.prod_id) ? CM.green : '#1A1A1A', border: 'none', borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 600, color: vacSeleccionadas.some(vs => vs.prod_id) ? '#0A1A0A' : CM.muted, cursor: 'pointer', fontFamily: CM.sans }}>
                                      {vac.guardando ? 'Guardando...' : '✓ Confirmar vacunación'}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    {dias >= 10 && (
                      <button onClick={async () => {
                        await supabase.from('corrales').update({ rol: 'acumulacion' }).eq('id', c.id)
                        await supabase.from('movimientos').insert({ fecha: new Date().toISOString(), tipo: 'cambio_rol', corral_destino_id: c.id, cantidad: c.animales, motivo: 'Fin cuarentena — pase a acumulacion', registrado_por: usuario?.id })
                        await cargarDatos()
                      }} style={{ width: '100%', padding: 10, background: '#1A3D26', border: `1px solid ${CM.green}`, borderRadius: 8, color: CM.green, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: CM.sans }}>
                        ✓ Confirmar pasaje a acumulacion
                      </button>
                    )}
                  </div>
                )
              })}
              {alertas.map(a => {
                const isProtocolo = a.tipo === 'protocolo_ingreso'
                const loteAlerta = isProtocolo ? (lotes || []).find(l => l.corral_cuarentena_id === a.corral_id) : null
                const vac = loteAlerta ? (vacunacionLote[loteAlerta.id] || {}) : {}
                const vacunas = stockSanitarioM.filter(p => p.tipo === 'Vacuna')
                const vacSeleccionadas = vac.vacunas || [{ prod_id: '', dosis: '5' }]
                const expandido = vacunacionLote[`exp_${a.id}`]
                return (
                  <div key={a.id} style={{ background: confirmadosM[a.id] ? '#1A3D26' : '#3D2A00', border: `1px solid ${confirmadosM[a.id] ? CM.green : CM.amber}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
                    {confirmadosM[a.id] ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 20 }}>✅</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: CM.green }}>Confirmado</div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.65rem' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: CM.amber, marginBottom: 3 }}>{a.titulo}</div>
                            <div style={{ fontSize: 12, color: CM.muted }}>{a.descripcion}</div>
                            {a.fecha_vence && <div style={{ fontSize: 11, color: CM.amber, marginTop: 3 }}>Vence: {new Date(a.fecha_vence).toLocaleDateString('es-AR')}</div>}
                          </div>
                          {isProtocolo && (
                            <button onClick={() => setVacunacionLote(prev => ({...prev, [`exp_${a.id}`]: !prev[`exp_${a.id}`]}))}
                              style={{ marginLeft: 10, padding: '6px 12px', fontSize: 12, background: expandido ? '#2A1A00' : CM.amber, border: `1px solid ${CM.amber}`, borderRadius: 7, color: expandido ? CM.amber : '#0A1A0A', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                              {expandido ? '▲ Cerrar' : '💉 Vacunar'}
                            </button>
                          )}
                        </div>
                        {isProtocolo && expandido && loteAlerta && (
                          <div style={{ borderTop: `1px solid ${CM.amber}`, paddingTop: '1rem' }}>
                            {vacunas.length === 0 ? (
                              <div style={{ fontSize: 12, color: CM.amber }}>⚠ No hay vacunas en stock.</div>
                            ) : (
                              <>
                                {vacSeleccionadas.map((vs, vi) => {
                                  const mlTotal = vs.prod_id && vs.dosis ? Math.round(loteAlerta.cantidad * parseFloat(vs.dosis || 5)) : null
                                  const prodSel = vacunas.find(p => String(p.id) === String(vs.prod_id))
                                  return (
                                    <div key={vi} style={{ marginBottom: 10 }}>
                                      <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>
                                        {vi === 0 ? 'Vacuna' : `Vacuna ${vi + 1}`}
                                      </div>
                                      <select value={vs.prod_id || ''}
                                        onChange={e => {
                                          const nuevas = vacSeleccionadas.map((x, i) => i === vi ? {...x, prod_id: e.target.value} : x)
                                          setVacunacionLote(prev => ({...prev, [loteAlerta.id]: {...(prev[loteAlerta.id]||{}), vacunas: nuevas}}))
                                        }}
                                        style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.amber}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans, marginBottom: 6 }}>
                                        <option value="">— Seleccioná —</option>
                                        {vacunas.map(p => (
                                          <option key={p.id} value={p.id}>{p.producto} · {(p.cantidad_ml || 0).toLocaleString('es-AR')} {p.unidad || 'ml'}</option>
                                        ))}
                                      </select>
                                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ fontSize: 11, color: CM.muted, marginBottom: 4 }}>ml/animal</div>
                                          <input type="number" inputMode="decimal" value={vs.dosis || '5'} step="0.5" min="0"
                                            onChange={e => {
                                              const nuevas = vacSeleccionadas.map((x, i) => i === vi ? {...x, dosis: e.target.value} : x)
                                              setVacunacionLote(prev => ({...prev, [loteAlerta.id]: {...(prev[loteAlerta.id]||{}), vacunas: nuevas}}))
                                            }}
                                            style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: CM.mono, fontWeight: 600, color: CM.amber, boxSizing: 'border-box' }} />
                                        </div>
                                        {vacSeleccionadas.length > 1 && (
                                          <button onClick={() => {
                                            const nuevas = vacSeleccionadas.filter((_, i) => i !== vi)
                                            setVacunacionLote(prev => ({...prev, [loteAlerta.id]: {...(prev[loteAlerta.id]||{}), vacunas: nuevas}}))
                                          }} style={{ padding: '10px 12px', fontSize: 13, background: '#2E1A1A', border: `1px solid ${CM.red}`, color: CM.red, borderRadius: 8, cursor: 'pointer', marginTop: 20 }}>✕</button>
                                        )}
                                      </div>
                                      {mlTotal && <div style={{ fontSize: 12, color: CM.green, marginTop: 4 }}>→ {mlTotal.toLocaleString('es-AR')} ml de {prodSel?.producto}</div>}
                                    </div>
                                  )
                                })}
                                <button onClick={() => {
                                  const nuevas = [...vacSeleccionadas, { prod_id: '', dosis: '5' }]
                                  setVacunacionLote(prev => ({...prev, [loteAlerta.id]: {...(prev[loteAlerta.id]||{}), vacunas: nuevas}}))
                                }} style={{ width: '100%', background: 'transparent', border: `1px solid ${CM.green}`, borderRadius: 8, padding: '10px', fontSize: 13, color: CM.green, fontWeight: 600, marginBottom: 10, cursor: 'pointer' }}>
                                  + Agregar otra vacuna
                                </button>
                                <button disabled={!vacSeleccionadas.some(vs => vs.prod_id) || vac.guardando}
                                  onClick={async () => {
                                    const validas = vacSeleccionadas.filter(vs => vs.prod_id)
                                    if (validas.length === 0) return
                                    setVacunacionLote(prev => ({...prev, [loteAlerta.id]: {...prev[loteAlerta.id], guardando: true}}))
                                    const vacunasParaGuardar = validas.map(vs => {
                                      const prod = vacunas.find(p => String(p.id) === String(vs.prod_id))
                                      return prod ? { productoId: prod.id, nombre: prod.producto, dosisMlPorAnimal: parseFloat(vs.dosis || 5) } : null
                                    }).filter(Boolean)
                                    const { error, resumen } = await confirmarVacunacionIngreso(supabase, { lote: loteAlerta, vacunas: vacunasParaGuardar, usuario })
                                    if (error) {
                                      alert('Error al confirmar vacunación: ' + error.message)
                                      setVacunacionLote(prev => ({...prev, [loteAlerta.id]: {...prev[loteAlerta.id], guardando: false}}))
                                      return
                                    }
                                    const { error: e3 } = await supabase.from('alertas').update({ resuelta: true, resuelta_en: new Date().toISOString() }).eq('id', a.id)
                                    if (e3) alert('La vacunación se guardó, pero no se pudo cerrar la alerta: ' + e3.message)
                                    setVacunacionLote(prev => ({...prev, [loteAlerta.id]: {...prev[loteAlerta.id], guardando: false, confirmada: true, resumen}}))
                                    await cargarDatos()
                                  }}
                                  style={{ width: '100%', background: vacSeleccionadas.some(vs => vs.prod_id) ? CM.green : '#1A1A1A', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: vacSeleccionadas.some(vs => vs.prod_id) ? '#0A1A0A' : CM.muted, cursor: 'pointer', fontFamily: CM.sans }}>
                                  {vac.guardando ? 'Guardando...' : '✓ Confirmar vacunación'}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                        {!isProtocolo && (
                          <button onClick={() => confirmarAlertaM(a.id)}
                            style={{ width: '100%', padding: 10, background: '#2A1A00', border: `1px solid ${CM.amber}`, borderRadius: 8, color: CM.amber, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: CM.sans }}>
                            Confirmar resolucion
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </>
          )}

          {pantSan === 'revision' && (
            <>
              <div style={{ fontSize: 12, color: CM.muted, marginBottom: '1rem', lineHeight: 1.6 }}>
                Recorre cada corral. Sin novedades si esta todo bien. Hay novedad si encontras algun animal con problema.
              </div>
              {revStateM.map((c, i) => (
                <div key={c.id} style={{ border: `1px solid ${c.ok === true ? CM.green : c.ok === false ? CM.amber : CM.border}`, borderRadius: 12, marginBottom: '.65rem', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem', background: c.ok === true ? '#1A3D26' : c.ok === false ? '#3D2A00' : CM.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Corral {c.numero}</div>
                      <div style={{ fontSize: 12, color: CM.muted }}>{c.rol} - {c.animales} animales</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {c.ok === true && <span style={{ fontSize: 12, fontWeight: 600, color: CM.green }}>Sin novedades ✓</span>}
                      {c.ok === false && <span style={{ fontSize: 12, fontWeight: 600, color: CM.amber }}>{c.enfermos.length} con novedad</span>}
                      {c.ok === null && (
                        <>
                          <button onClick={() => { const n = [...revStateM]; n[i] = {...n[i], ok: true, enfermos: []}; setRevStateM(n) }}
                            style={{ padding: '7px 10px', background: '#1A3D26', border: `1px solid ${CM.green}`, borderRadius: 7, color: CM.green, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: CM.sans }}>Sin novedades ✓</button>
                          <button onClick={() => { const n = [...revStateM]; n[i] = {...n[i], ok: false, enfermos: [{desc:'',diag:'Conjuntivitis',productos:[{prod:'',prod_id:null,ml:''}],mover_enfermeria:false}]}; setRevStateM(n) }}
                            style={{ padding: '7px 10px', background: '#3D2A00', border: `1px solid ${CM.amber}`, borderRadius: 7, color: CM.amber, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: CM.sans }}>Hay novedad</button>
                        </>
                      )}
                      {c.ok !== null && (
                        <button onClick={() => { const n = [...revStateM]; n[i] = {...n[i], ok: null, enfermos: []}; setRevStateM(n) }}
                          style={{ padding: '5px 8px', background: 'transparent', border: `1px solid ${CM.border}`, borderRadius: 6, color: CM.muted, fontSize: 11, cursor: 'pointer', fontFamily: CM.sans }}>Cambiar</button>
                      )}
                    </div>
                  </div>
                  {c.ok === false && (
                    <div style={{ padding: '1rem', borderTop: `1px solid ${CM.border}`, background: CM.surface2 }}>
                      {c.enfermos.map((enf, ei) => (
                        <div key={ei} style={{ background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '.75rem', marginBottom: '.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: CM.amber }}>Animal {ei + 1}</span>
                            <button onClick={() => {
                              const n = [...revStateM]; n[i].enfermos.splice(ei, 1)
                              if (!n[i].enfermos.length) n[i].ok = null
                              setRevStateM(n)
                            }} style={{ background: 'transparent', border: 'none', color: CM.muted, cursor: 'pointer', fontSize: 16 }}>✕</button>
                          </div>
                          <input type="text" placeholder="Descripcion del animal" value={enf.desc}
                            onChange={e => { const n = [...revStateM]; n[i].enfermos[ei].desc = e.target.value; setRevStateM(n) }}
                            style={{ width: '100%', background: CM.surface2, border: `1px solid ${CM.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, color: CM.text, fontFamily: CM.sans, boxSizing: 'border-box', marginBottom: 6 }} />
                          <select value={enf.diag} onChange={e => { const n = [...revStateM]; n[i].enfermos[ei].diag = e.target.value; setRevStateM(n) }}
                            style={{ width: '100%', background: CM.surface2, border: `1px solid ${CM.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, color: CM.text, fontFamily: CM.sans, marginBottom: 6 }}>
                            {['Conjuntivitis','Pietin','Neumonia','Timpanismo','Diarrea','Artritis','Otro'].map(d => <option key={d}>{d}</option>)}
                          </select>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(enf.productos || []).map((p, pi) => (
                              <div key={pi} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <select value={p.prod} onChange={e => {
                                  const prod = stockSanitarioM.find(x => x.producto === e.target.value)
                                  const n = [...revStateM]
                                  n[i].enfermos[ei].productos[pi].prod = e.target.value
                                  n[i].enfermos[ei].productos[pi].prod_id = prod?.id || null
                                  setRevStateM(n)
                                }}
                                  style={{ flex: 1, background: CM.surface2, border: `1px solid ${CM.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, color: CM.text, fontFamily: CM.sans }}>
                                  <option value="">— Producto aplicado —</option>
                                  {stockSanitarioM.map(x => <option key={x.id} value={x.producto}>{x.producto} ({(x.cantidad_ml||0).toLocaleString('es-AR')} {x.unidad||'ml'})</option>)}
                                </select>
                                <input type="number" value={p.ml || ''} placeholder="ml" onChange={e => { const n=[...revStateM]; n[i].enfermos[ei].productos[pi].ml=e.target.value; setRevStateM(n) }}
                                  style={{ width: 60, border: `1px solid ${CM.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 12, background: CM.surface, color: CM.text }} />
                                <button onClick={() => {
                                  const n = [...revStateM]
                                  n[i].enfermos[ei].productos.splice(pi, 1)
                                  if (!n[i].enfermos[ei].productos.length) n[i].enfermos[ei].productos.push({ prod: '', prod_id: null, ml: '' })
                                  setRevStateM(n)
                                }} style={{ background: 'transparent', border: 'none', color: CM.muted, cursor: 'pointer', fontSize: 14 }}>✕</button>
                              </div>
                            ))}
                            <button onClick={() => { const n = [...revStateM]; n[i].enfermos[ei].productos.push({ prod: '', prod_id: null, ml: '' }); setRevStateM(n) }}
                              style={{ padding: '5px 8px', fontSize: 11, background: 'transparent', border: `1px solid ${CM.amber}`, color: CM.amber, borderRadius: 5, cursor: 'pointer', alignSelf: 'flex-start' }}>
                              + Otro producto para este animal
                            </button>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#EF4444', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                              <input type="checkbox" checked={enf.mover_enfermeria || false} onChange={e => { const n=[...revStateM]; n[i].enfermos[ei].mover_enfermeria=e.target.checked; setRevStateM(n) }} />
                              → Mover a enfermería
                            </label>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => { const n = [...revStateM]; n[i].enfermos.push({desc:'',diag:'Conjuntivitis',productos:[{prod:'',prod_id:null,ml:''}],mover_enfermeria:false}); setRevStateM(n) }}
                        style={{ width: '100%', padding: '8px', background: 'transparent', border: `1px solid ${CM.border}`, borderRadius: 8, color: CM.muted, fontSize: 12, cursor: 'pointer', fontFamily: CM.sans, marginTop: 4 }}>
                        + Agregar otro animal
                      </button>
                      <button onClick={async () => {
                        if (guardandoM) return
                        const enfs = c.enfermos.filter(e => (e.productos||[]).some(p=>p.prod) || e.desc || e.diag)
                        if (!enfs.length) { alert('Completá al menos un animal con diagnóstico o producto'); return }
                        setGuardandoM(true)
                        try {
                          for (const enf of enfs) {
                            const productosValidos = (enf.productos || []).filter(p => p.prod)
                            if (productosValidos.length === 0) {
                              const { error } = await supabase.from('eventos_sanitarios').insert({
                                tipo: 'revision', corral_id: revStateM[i]?.id, producto: null,
                                observaciones: `${enf.diag}${enf.desc ? ' — ' + enf.desc : ''}`,
                                cantidad_animales: 1,
                                registrado_por: usuario?.id,
                              })
                              if (error) throw error
                            } else {
                              for (const p of productosValidos) {
                                const mlNum = parseFloat(p.ml) || 0
                                if (p.prod_id && mlNum > 0) {
                                  await supabase.rpc('incrementar_stock_sanitario', { p_id: p.prod_id, p_delta: -mlNum })
                                }
                                const { error } = await supabase.from('eventos_sanitarios').insert({
                                  tipo: 'revision', corral_id: revStateM[i]?.id, producto: p.prod,
                                  observaciones: `${enf.diag}${enf.desc ? ' — ' + enf.desc : ''}`,
                                  cantidad_animales: 1, cantidad_ml: mlNum || null,
                                  registrado_por: usuario?.id,
                                })
                                if (error) throw error
                              }
                            }
                            const { error: errEnf } = await supabase.from('animales_enfermeria').insert({
                              corral_origen_id: revStateM[i]?.id, descripcion: enf.desc, diagnostico: enf.diag,
                              tratamiento: productosValidos.map(p => p.prod).join(', ') || null,
                              cantidad_ml: productosValidos.reduce((s, p) => s + (parseFloat(p.ml) || 0), 0) || null,
                              estado: enf.mover_enfermeria ? 'en_enfermeria' : 'en tratamiento',
                              registrado_por: usuario?.id,
                            })
                            if (errEnf) throw errEnf
                          }
                          const n = [...revStateM]
                          n[i] = {...n[i], confirmado: true}
                          setRevStateM(n)
                          setGuardandoM(false)
                        } catch(err) {
                          alert('Error: ' + (err.message || JSON.stringify(err)))
                          setGuardandoM(false)
                        }
                      }} disabled={guardandoM}
                        style={{ width: '100%', padding: '10px', background: CM.amber, border: 'none', borderRadius: 8, color: '#1A0A00', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: CM.sans, marginTop: 8 }}>
                        {guardandoM ? 'Guardando...' : '✓ Confirmar tratamiento'}
                      </button>
                      {c.confirmado && (
                        <div style={{ textAlign: 'center', fontSize: 12, color: CM.green, marginTop: 6, fontWeight: 600 }}>✓ Tratamiento registrado</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={confirmarRevisionM} disabled={guardandoM}
                style={{ width: '100%', background: CM.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: CM.sans, marginBottom: 8 }}>
                {guardandoM ? 'Guardando...' : 'Confirmar revision completa'}
              </button>
            </>
          )}

          {pantSan === 'evento' && (
            <>
              <div style={{ fontSize: 12, color: CM.muted, marginBottom: '1rem', lineHeight: 1.6 }}>
                Registra un evento sanitario puntual — vacunacion, tratamiento, etc.
              </div>
              <div style={{ marginBottom: '.85rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Corral</div>
                <select value={formEventoM.corral_id} onChange={e => setFormEventoM({...formEventoM, corral_id: e.target.value})}
                  style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans }}>
                  <option value="">Selecciona un corral</option>
                  {corralesActivosM.map(c => <option key={c.id} value={c.id}>Corral {c.numero} - {c.rol} - {c.animales || 0} anim.</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '.85rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Producto</div>
                {stockSanitarioM.length === 0
                  ? <div style={{ padding: '11px 12px', background: CM.surface2, borderRadius: 8, fontSize: 13, color: CM.muted }}>No hay productos en stock sanitario.</div>
                  : <select value={formEventoM.prod_id}
                      onChange={e => {
                        const prod = stockSanitarioM.find(p => String(p.id) === e.target.value)
                        setFormEventoM({...formEventoM, prod_id: e.target.value, producto: prod?.producto || ''})
                      }}
                      style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans }}>
                      <option value="">— Seleccioná un producto —</option>
                      {stockSanitarioM.map(p => (
                        <option key={p.id} value={p.id}>{p.producto} · {(p.cantidad_ml || 0).toLocaleString('es-AR')} {p.unidad || 'ml'} en stock</option>
                      ))}
                    </select>
                }
              </div>
              <div style={{ marginBottom: '.85rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Dosis ml/animal</div>
                <input type="number" inputMode="decimal" placeholder="5" value={formEventoM.dosis_ml}
                  onChange={e => setFormEventoM({...formEventoM, dosis_ml: e.target.value})}
                  style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: CM.mono, fontWeight: 600, color: CM.amber, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '.85rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Cantidad de animales</div>
                <input type="number" inputMode="numeric" placeholder="0" value={formEventoM.cantidad}
                  onChange={e => setFormEventoM({...formEventoM, cantidad: e.target.value})}
                  style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: CM.mono, fontWeight: 600, color: CM.green, boxSizing: 'border-box' }} />
              </div>
              {formEventoM.prod_id && formEventoM.dosis_ml && formEventoM.cantidad && (() => {
                const mlTotal = Math.round(parseInt(formEventoM.cantidad) * parseFloat(formEventoM.dosis_ml))
                const prod = stockSanitarioM.find(p => String(p.id) === String(formEventoM.prod_id))
                const stockActual = prod?.cantidad_ml || 0
                const alcanza = stockActual >= mlTotal
                return (
                  <div style={{ background: alcanza ? '#1A2E1A' : '#2E1A1A', border: `1px solid ${alcanza ? CM.green : CM.red}`, borderRadius: 8, padding: '10px 12px', marginBottom: '.85rem' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: alcanza ? CM.green : CM.red }}>
                      {mlTotal.toLocaleString('es-AR')} ml totales ({formEventoM.cantidad} animales × {formEventoM.dosis_ml} ml)
                    </div>
                    <div style={{ fontSize: 11, color: CM.muted, marginTop: 3 }}>
                      Stock actual: {stockActual.toLocaleString('es-AR')} ml · {alcanza ? `Quedan ${(stockActual - mlTotal).toLocaleString('es-AR')} ml` : `⚠ Faltan ${(mlTotal - stockActual).toLocaleString('es-AR')} ml`}
                    </div>
                  </div>
                )
              })()}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Observaciones</div>
                <input type="text" placeholder="descripcion, diagnostico, etc." value={formEventoM.observaciones}
                  onChange={e => setFormEventoM({...formEventoM, observaciones: e.target.value})}
                  style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans, boxSizing: 'border-box' }} />
              </div>
              <button onClick={registrarEventoM} disabled={guardandoM}
                style={{ width: '100%', background: CM.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: CM.sans, marginBottom: 8 }}>
                {guardandoM ? 'Guardando...' : 'Registrar evento'}
              </button>
              <button onClick={() => setPantSan('alertas')}
                style={{ width: '100%', background: 'transparent', border: `1px solid ${CM.border}`, borderRadius: 10, padding: 12, fontSize: 14, color: CM.muted, cursor: 'pointer', fontFamily: CM.sans }}>
                Cancelar
              </button>
            </>
          )}

          {pantSan === 'mortalidad' && (
            <>
              <div style={{ background: '#3D1A1A', border: '1px solid #F09595', borderRadius: 12, padding: '1rem', marginBottom: '.85rem', fontSize: 12, color: '#F09595', lineHeight: 1.6 }}>
                Registra la muerte de un animal. Se descuenta del corral automaticamente.
              </div>
              <div style={{ marginBottom: '.85rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Fecha</div>
                <input type="date" value={formMort.fecha} onChange={e => setFormMort({...formMort, fecha: e.target.value})}
                  style={{ width: '100%', background: CM.surface, border: '1px solid ' + CM.border, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '.85rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Corral</div>
                <select value={formMort.corral_id} onChange={e => setFormMort({...formMort, corral_id: e.target.value})}
                  style={{ width: '100%', background: CM.surface, border: '1px solid ' + CM.border, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans }}>
                  <option value="">Selecciona un corral</option>
                  {corrales.filter(c => (c.animales || 0) > 0 && c.rol !== 'deshabilitado').map(c => <option key={c.id} value={c.id}>C-{c.numero} - {c.animales} anim.</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '.85rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Cantidad</div>
                <input type="number" inputMode="numeric" value={formMort.cantidad} onChange={e => setFormMort({...formMort, cantidad: e.target.value})} min="1"
                  style={{ width: '100%', background: CM.surface, border: '1px solid ' + CM.border, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: CM.mono, fontWeight: 600, color: '#F09595', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Causa</div>
                <select value={formMort.causa} onChange={e => setFormMort({...formMort, causa: e.target.value})}
                  style={{ width: '100%', background: CM.surface, border: '1px solid ' + CM.border, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans }}>
                  <option value="">Sin especificar</option>
                  {['Neumonia', 'Enterotoxemia', 'Accidente', 'Timpanismo', 'Diarrea', 'Causa desconocida', 'Otro'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={guardarMortalidadM} disabled={guardandoMort}
                style={{ width: '100%', background: '#7A1A1A', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: CM.sans, marginBottom: 8 }}>
                {guardandoMort ? 'Registrando...' : 'Registrar muerte'}
              </button>
              <button onClick={() => nav && nav('home')}
                style={{ width: '100%', background: 'transparent', border: '1px solid ' + CM.border, borderRadius: 10, padding: 12, fontSize: 14, color: CM.muted, cursor: 'pointer', fontFamily: CM.sans }}>
                Cancelar
              </button>

              <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', letterSpacing: '.05em', margin: '1.5rem 0 .65rem' }}>Últimas muertes registradas</div>
              {mortalidad.length === 0 && <div style={{ fontSize: 12, color: CM.muted, textAlign: 'center', padding: '1rem' }}>Todavía no hay muertes registradas.</div>}
              {[...mortalidad].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en)).slice(0, 6).map(m => {
                const corralM = corrales.find(c => c.id === m.corral_id)
                return (
                  <div key={m.id} style={{ background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 10, padding: '.75rem .9rem', marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#F09595' }}>{m.cantidad} animal{m.cantidad !== 1 ? 'es' : ''} · {corralM ? `C-${corralM.numero}` : '—'}</div>
                        <div style={{ fontSize: 12, color: CM.muted, marginTop: 2 }}>{m.causa || 'Sin especificar'}</div>
                      </div>
                      <div style={{ fontSize: 11, color: CM.muted, fontFamily: CM.mono }}>{m.fecha ? new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : ''}</div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {pantSan === 'historial' && (() => {
            const TIPO_LABELS_M = { ingreso: 'Ingreso', revision: 'Revision', tratamiento: 'Tratamiento', segunda_dosis: '2da dosis', mortalidad: 'Mortandad' }
            const eventosM = eventos.filter(e => e.producto !== 'Sin novedad').slice(0, 30)
            return (
              <div>
                <div style={{ fontSize: 12, color: CM.muted, marginBottom: '1rem' }}>Últimos {eventosM.length} eventos registrados — para confirmar que quedó todo guardado.</div>
                {eventosM.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: CM.muted, fontSize: 13 }}>Todavía no hay eventos registrados.</div>}
                {eventosM.map(e => (
                  <div key={e.id} style={{ background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 10, padding: '.85rem', marginBottom: '.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{e.producto || TIPO_LABELS_M[e.tipo] || e.tipo}</div>
                      <div style={{ fontSize: 11, color: CM.muted, fontFamily: CM.mono }}>{new Date(e.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</div>
                    </div>
                    <div style={{ fontSize: 12, color: CM.muted }}>
                      {e.corrales?.numero ? `C-${e.corrales.numero}` : 'Todos'} · {TIPO_LABELS_M[e.tipo] || e.tipo}
                      {e.cantidad_ml ? ` · ${e.cantidad_ml} ml` : ''}
                      {e.cantidad_animales ? ` · ${e.cantidad_animales} anim.` : ''}
                    </div>
                    {e.observaciones && <div style={{ fontSize: 12, color: CM.text, marginTop: 4 }}>{e.observaciones}</div>}
                    <div style={{ fontSize: 10, color: CM.muted, marginTop: 4 }}>Registrado por {e.usuarios?.nombre || '—'}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          {pantSan === 'stock' && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Stock sanitario</div>
              <div style={{ fontSize: 12, color: CM.muted, marginBottom: '1rem' }}>Solo lectura — los ingresos se registran desde la PC en Sanidad.</div>
              {stockSanitarioM.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: CM.muted, fontSize: 13 }}>No hay productos cargados.</div>
              )}
              {stockSanitarioM.map(p => {
                const cant = p.cantidad_ml || 0
                const bajo = cant < (p.minimo_stock || 50)
                return (
                  <div key={p.id} style={{ background: CM.surface, border: `1px solid ${bajo ? CM.red : CM.border}`, borderRadius: 10, padding: '1rem', marginBottom: '.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{p.producto}</div>
                        <div style={{ fontSize: 11, color: CM.muted, marginTop: 2 }}>{p.tipo || '—'}{p.laboratorio ? ` · ${p.laboratorio}` : ''}</div>
                        {p.carencia_dias > 0 && <div style={{ fontSize: 11, color: CM.amber, marginTop: 2 }}>⚠ Carencia: {p.carencia_dias} días</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: CM.mono, color: bajo ? CM.red : CM.green }}>{cant.toLocaleString('es-AR')}</div>
                        <div style={{ fontSize: 11, color: CM.muted }}>{p.unidad || 'ml'}</div>
                        {bajo && <div style={{ fontSize: 11, color: CM.red, fontWeight: 600 }}>⚠ Stock bajo</div>}
                      </div>
                    </div>
                  </div>
                )
              })}

              <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', letterSpacing: '.05em', margin: '1.25rem 0 .65rem' }}>Últimos 5 ingresos registrados</div>
              {(() => {
                const nuevos = historialSan.map(ing => ({ id: 'n'+ing.id, nombre: ing.insumo_nombre, cantidad: ing.cantidad, fecha: ing.fecha, proveedor: ing.proveedor, estadoPago: ing.estado_pago, tienePrecio: !!ing.precio_unitario }))
                const viejos = historialSanLegacy.map(ing => ({ id: 'l'+ing.id, nombre: ing.insumo_nombre, cantidad: ing.cantidad_kg, fecha: (ing.creado_en || '').split('T')[0], proveedor: ing.proveedor, estadoPago: ing.estado_pago, tienePrecio: !!ing.precio_por_kg }))
                const todos = [...nuevos, ...viejos].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 5)
                if (todos.length === 0) return <div style={{ fontSize: 12, color: CM.muted, textAlign: 'center', padding: '1rem' }}>Todavía no hay ingresos cargados.</div>
                return todos.map(ing => (
                  <div key={ing.id} style={{ background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '.7rem .9rem', marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{ing.nombre}</div>
                        <div style={{ fontSize: 11, color: CM.muted, marginTop: 2 }}>
                          {ing.fecha ? new Date(ing.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'}
                          {ing.proveedor ? ` · ${ing.proveedor}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: CM.mono, color: CM.green }}>{(ing.cantidad || 0).toLocaleString('es-AR')} ml</div>
                      </div>
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
        </MobileScroll>
      </div>
    )
  }
  // ── FIN MODO CELULAR — de acá para abajo sigue el modo PC, sin cambios ──

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
                  // "Ya vacunado" se calcula desde los eventos guardados en la base (no solo de
                  // esta sesión del navegador), para que se vea igual en cualquier PC/celular.
                  const eventosVacunacion = eventosVacunacionIngreso.filter(e => e.lote_id === l.id || (!e.lote_id && e.corral_id === l.corral_cuarentena_id))
                  const confirmada = vac.confirmada || yaVacunadoIngreso(l) || eventosVacunacion.length > 0
                  const resumenGuardado = eventosVacunacion.length > 0
                    ? eventosVacunacion.map(e => ({ nombre: e.producto, dosis: e.cantidad_animales ? +(e.cantidad_ml / e.cantidad_animales).toFixed(1) : null, mlTotal: e.cantidad_ml || 0 }))
                    : null
                  const resumenMostrar = vac.resumen || resumenGuardado || []
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
                            {resumenMostrar.map(r => `${r.nombre} ${r.dosis ? `${r.dosis}ml/animal ` : ''}(${r.mlTotal.toLocaleString('es-AR')} ml)`).join(' · ')}
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
                                    const vacunasParaGuardar = []
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
                                      vacunasParaGuardar.push({ productoId: prod.id, nombre: prod.n, dosisMlPorAnimal: dosis })
                                    }
                                    const { error, resumen } = await confirmarVacunacionIngreso(supabase, { lote: l, vacunas: vacunasParaGuardar, usuario })
                                    if (error) {
                                      alert('Error al confirmar vacunación: ' + error.message)
                                      setVacunacionLote(prev => ({...prev, [l.id]: {...prev[l.id], guardando: false}}))
                                      return
                                    }
                                    await cargarProductos()
                                    await cargarDatos()
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
                    {st.enfermos.map((e, ei) => (
                      <div key={ei} style={{ border: `1px solid ${S.border}`, borderRadius: 8, padding: '.75rem', marginBottom: '.65rem', background: S.surface }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 60px 32px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <input type="text" value={e.desc} placeholder="ej. novillo negro, oreja cortada"
                            onChange={ev => updEnfermo(i, ei, 'desc', ev.target.value)}
                            style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface }} />
                          <select value={e.diag} onChange={ev => updEnfermo(i, ei, 'diag', ev.target.value)}
                            style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface }}>
                            {DIAGNOSTICOS.map(d => <option key={d}>{d}</option>)}
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: S.red, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                            <input type="checkbox" checked={e.mover_enfermeria || false} onChange={ev => updEnfermo(i, ei, 'mover_enfermeria', ev.target.checked)} />
                            Enf.
                          </label>
                          <button onClick={() => delEnfermo(i, ei)}
                            style={{ border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, borderRadius: 5, width: 28, height: 28, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✕
                          </button>
                        </div>
                        <div style={{ paddingLeft: 12, borderLeft: `2px solid ${S.border}` }}>
                          {(e.productos || []).map((p, pi) => (
                            <div key={pi} style={{ display: 'grid', gridTemplateColumns: '200px 90px 28px', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                              <select value={p.prod} onChange={ev => {
                                const prod = productos.find(x => x.n === ev.target.value)
                                updProductoEnfermo(i, ei, pi, 'prod', ev.target.value)
                                updProductoEnfermo(i, ei, pi, 'prod_id', prod?.id || null)
                              }}
                                style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 12, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface }}>
                                <option value="">— Producto —</option>
                                {productos.map(x => <option key={x.n} value={x.n}>{x.n} ({x.cantidad_ml?.toLocaleString('es-AR')} {x.unidad})</option>)}
                              </select>
                              <input type="number" value={p.ml || ''} placeholder="ml" onChange={ev => updProductoEnfermo(i, ei, pi, 'ml', ev.target.value)}
                                style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 12, background: S.surface }} />
                              <button onClick={() => delProductoEnfermo(i, ei, pi)}
                                style={{ border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, borderRadius: 5, width: 24, height: 24, cursor: 'pointer', fontSize: 11 }}>✕</button>
                            </div>
                          ))}
                          <button onClick={() => addProductoEnfermo(i, ei)}
                            style={{ padding: '3px 8px', fontSize: 11, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                            + Otro producto para este animal
                          </button>
                        </div>
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
      {tab === 'historial' && (() => {
        const hace14dias = new Date(); hace14dias.setDate(hace14dias.getDate() - 14)
        const eventosRecientes = eventos.filter(e => new Date(e.creado_en) >= hace14dias)
        const eventosArchivados = eventos.filter(e => new Date(e.creado_en) < hace14dias)
        const TIPO_COLORS = {
          ingreso: { bg: S.accentLight, color: S.accent, label: 'Ingreso' },
          revision: { bg: S.purpleLight, color: S.purple, label: 'Revision' },
          tratamiento: { bg: S.amberLight, color: S.amber, label: 'Tratamiento' },
          segunda_dosis: { bg: S.amberLight, color: S.amber, label: '2da dosis' },
          mortalidad: { bg: S.redLight, color: S.red, label: 'Mortandad' },
        }
        const TablaEventos = ({ lista }) => (
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
                {lista.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay eventos registrados.</td></tr>
                )}
                {lista.map(e => {
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
        )
        return (
          <div>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>Últimos 14 días · {eventosRecientes.length} eventos</div>
            <TablaEventos lista={eventosRecientes} />
            {eventosArchivados.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <button onClick={() => setVerArchivoSan(!verArchivoSan)}
                  style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, background: S.bg, border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                  {verArchivoSan ? '▲ Ocultar archivadas' : `▾ Ver archivadas (${eventosArchivados.length})`}
                </button>
                {verArchivoSan && (
                  <div style={{ marginTop: 10 }}>
                    <TablaEventos lista={eventosArchivados} />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={filtroTipoStock} onChange={e => setFiltroTipoStock(e.target.value)}
                style={{ padding: '7px 12px', fontSize: 12, border: `1px solid ${S.border}`, borderRadius: 6, background: S.surface, color: filtroTipoStock ? S.accent : S.muted, fontWeight: filtroTipoStock ? 600 : 400 }}>
                <option value="">Todos los tipos</option>
                {[...new Set(productos.map(p => p.tipo))].sort().map(t => <option key={t} value={t}>{t}</option>)}
              </select>
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
                    {[...new Set(['Vacuna', 'Antibiotico', 'Antiparasitario', 'Vitamina', 'Antiinflamatorio', ...productos.map(p => p.tipo), 'Otro'])].map(t => <option key={t}>{t}</option>)}
                    <option value="__nuevo__">+ Nuevo tipo...</option>
                  </select>
                  {formNuevoProd.tipo === '__nuevo__' && (
                    <input type="text" value={tipoCustomNuevo} onChange={e => setTipoCustomNuevo(e.target.value)}
                      placeholder="Escribí el nuevo tipo" autoFocus
                      style={{ width: '100%', marginTop: 6, padding: '9px 12px', border: `1px solid ${S.accent}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                  )}
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
                {productos.filter(p => !filtroTipoStock || p.tipo === filtroTipoStock).length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>
                    {filtroTipoStock ? `No hay productos de tipo "${filtroTipoStock}".` : 'No hay productos. Usá "+ Nuevo producto" para agregar.'}
                  </td></tr>
                )}
                {productos.filter(p => !filtroTipoStock || p.tipo === filtroTipoStock).map((p, i) => {
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
                                {[...new Set(['Vacuna', 'Antibiotico', 'Antiparasitario', 'Vitamina', 'Antiinflamatorio', ...productos.map(p => p.tipo), 'Otro'])].map(t => <option key={t}>{t}</option>)}
                                <option value="__nuevo__">+ Nuevo tipo...</option>
                              </select>
                              {editProd.tipo === '__nuevo__' && (
                                <input type="text" value={tipoCustomEdit} onChange={e => setTipoCustomEdit(e.target.value)}
                                  placeholder="Escribí el nuevo tipo" autoFocus
                                  style={{ width: '100%', marginTop: 6, padding: '7px 10px', border: `1px solid ${S.accent}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                              )}
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
          {historialSan.length > 0 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '.75rem' }}>Últimos ingresos registrados</div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: S.bg }}>
                      {['Fecha', 'Producto', 'Cantidad', 'Proveedor', 'Remito', 'Estado', ''].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historialSan.map(ing => (
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
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={async () => {
                              const nuevaCant = prompt('Nueva cantidad:', ing.cantidad)
                              if (!nuevaCant) return
                              const nuevoProveedor = prompt('Proveedor:', ing.proveedor || '')
                              const nuevoRemito = prompt('N° Remito/Factura:', ing.numero_factura || '')
                              await supabase.from('compras_insumos').update({ cantidad: parseFloat(nuevaCant), proveedor: nuevoProveedor || null, numero_factura: nuevoRemito || null }).eq('id', ing.id)
                              await cargarProductos()
                            }} style={{ padding: '3px 8px', fontSize: 11, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 5, cursor: 'pointer' }}>✏</button>
                            <button onClick={async () => {
                              if (!confirm(`¿Eliminar ingreso de ${ing.insumo_nombre}?`)) return
                              await supabase.from('compras_insumos').delete().eq('id', ing.id)
                              await cargarProductos()
                            }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>🗑</button>
                          </div>
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
