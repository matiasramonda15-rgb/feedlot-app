// v3 - reescrito desde cero
import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './UI'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', borderStrong: '#C8C2B8',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}
const inp = { width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }
const inpMono = { ...inp, fontFamily: 'monospace' }
const Lbl = ({ c, children }) => <div style={{ fontSize: 10, fontWeight: 600, color: c || S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{children}</div>
const Btn = ({ onClick, disabled, ghost, red, children, style = {} }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, border: `1px solid ${red ? S.red : ghost ? S.border : S.accent}`, background: red ? S.red : ghost ? 'transparent' : S.accent, color: red ? '#fff' : ghost ? S.muted : '#fff', borderRadius: 6, fontFamily: "'IBM Plex Sans', sans-serif", ...style }}>
    {children}
  </button>
)

// Lectura de factura con IA — desactivada por ahora (carga manual).
// Cuando esté lista la integración con la suscripción, cambiar a true.
const FACTURA_IA_HABILITADA = false

const CATEGORIAS = ['Novillos 2-3 años', 'Novillos 3-4 años', 'Novillitos', 'Terneros', 'Vaquillonas', 'Vacas', 'Toros']
const PROCEDENCIAS_DEFAULT = ['La Pampa', 'Córdoba', 'Buenos Aires', 'Santa Fe', 'Entre Ríos']

// Convierte sublotes viejos (formato plano: un vendedor = una tropa) al formato
// nuevo de dos niveles (un vendedor puede traer varias tropas con distinto precio).
// Si ya vienen en formato nuevo, los deja igual. No pisa nada existente.
function normalizarSublotes(raw) {
  if (!raw?.length) return []
  return raw.map(s => {
    if (Array.isArray(s.tropas)) return s
    // Formato viejo: {vendedor, cuit, cabezas, kg, precio_kg, subtotal}
    return {
      vendedor: s.vendedor || '',
      cuit: s.cuit || '',
      tropas: [{ cabezas: s.cabezas || '', kg: s.kg || '', precio_kg: s.precio_kg || '', subtotal: s.subtotal || '' }],
    }
  })
}

export default function Ingresos({ usuario }) {
  const [tab, setTab] = useState('lista')
  const [showDetalleMeses, setShowDetalleMeses] = useState(false)
  const [showDetallePrecio, setShowDetallePrecio] = useState(false)
  const [showDetalleKg, setShowDetalleKg] = useState(false)
  const [lotes, setLotes] = useState([])
  const [corrales, setCorrales] = useState([])
  const [contactos, setContactos] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista') // 'lista' | 'nuevo' | 'editar'
  const [editandoLote, setEditandoLote] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Nuevo ingreso form
  const [form, setForm] = useState({
    procedencia: '', otraProcedencia: '', categoria: 'Novillos 2-3 años',
    cantidad: '', kg_bascula: '', observaciones: '', corral_cuarentena_id: '',
  })

  // Completar datos (precio, kg factura, comercial)
  const [editandoPrecio, setEditandoPrecio] = useState(null)
  const [leyendoFactura, setLeyendoFactura] = useState(false)
  // { id, kg_factura, precio_compra, monto_total, plazo_dias, comision_monto, comision_a_quien, comision_es_paralela }

  // Estado pagos
  const [formPagoCompra, setFormPagoCompra] = useState({ monto: '', forma_pago: 'transferencia', fecha: new Date().toISOString().split('T')[0], numero_cheque: '', banco: '', fecha_vencimiento_cheque: '', es_negro: false })

  // Calculadora
  const [calc, setCalc] = useState({ precio_venta: '', kg_venta: '', desbaste_venta: '8', kg_compra: '', conversion_mf: '6.8', aumento_diario: '1.25', costo_dieta: '220', sanidad_animal: '9500', gastos_fijos_mes: '20000', flete_compra: '', flete_venta: '', comision_compra_pct: '', comision_venta_pct: '', margen_deseado: '15' })

  const esDueno = usuario?.rol === 'dueno'

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: lotesDB }, { data: corralesDB }, { data: ctDB }] = await Promise.all([
      supabase.from('lotes').select('*').order('created_at', { ascending: false }),
      supabase.from('corrales').select('id, numero, rol, sub, animales').order('numero'),
      supabase.from('contactos').select('id, nombre, cuit').eq('activo', true).order('nombre'),
    ])
    setLotes(lotesDB || [])
    setCorrales(corralesDB || [])
    setContactos(ctDB || [])
    setLoading(false)
  }

  async function guardarIngreso() {
    if (!form.cantidad || !form.kg_bascula) { alert('Completá cantidad y kg báscula'); return }
    setGuardando(true)
    // Resolver procedencia — si es nuevo, crear contacto
    let procFinal = null
    if (form.procedencia === 'Nuevo') {
      const nombre = form.otraProcedencia?.trim()
      if (nombre) {
        const existente = contactos.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())
        if (!existente) {
          await supabase.from('contactos').insert({ nombre, tipo: 'proveedor_hacienda', activo: true })
          await cargarDatos()
        }
        procFinal = nombre
      }
    } else {
      procFinal = form.procedencia || null
    }
    const { data: nuevoLote } = await supabase.from('lotes').insert({
      procedencia: procFinal, categoria: form.categoria,
      cantidad: parseInt(form.cantidad), kg_bascula: parseFloat(form.kg_bascula),
      observaciones: form.observaciones || null,
      corral_cuarentena_id: form.corral_cuarentena_id ? parseInt(form.corral_cuarentena_id) : null,
      estado: 'activo', fecha_ingreso: new Date().toISOString().split('T')[0],
      peso_prom_ingreso: form.cantidad && form.kg_bascula ? Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad)) : null,
    }).select().single()
    if (form.corral_cuarentena_id && nuevoLote) {
      const corral = corrales.find(c => c.id === parseInt(form.corral_cuarentena_id))
      const nuevosAnim = (corral?.animales || 0) + parseInt(form.cantidad)
      await supabase.from('corrales').update({ animales: nuevosAnim, rol: 'cuarentena' }).eq('id', parseInt(form.corral_cuarentena_id))
    }
    await cargarDatos()
    setVista('lista')
    setForm({ procedencia: '', otraProcedencia: '', categoria: 'Novillos 2-3 años', cantidad: '', kg_bascula: '', observaciones: '', corral_cuarentena_id: '' })
    setGuardando(false)
  }

  async function guardarEdicion() {
    if (!editandoLote) return
    setGuardando(true)
    const procFinal = form.procedencia === 'Otro' ? (form.otraProcedencia?.trim() || null) : (form.procedencia || null)
    await supabase.from('lotes').update({
      procedencia: procFinal || null, categoria: form.categoria,
      cantidad: parseInt(form.cantidad) || null, kg_bascula: parseFloat(form.kg_bascula) || null,
      observaciones: form.observaciones || null,
      corral_cuarentena_id: form.corral_cuarentena_id ? parseInt(form.corral_cuarentena_id) : null,
    }).eq('id', editandoLote.id)
    await cargarDatos()
    setVista('lista')
    setEditandoLote(null)
    setGuardando(false)
  }

  async function leerFacturaConIA(file) {
    if (!file) return
    setLeyendoFactura(true)
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })
      const mediaType = file.type || (file.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
      const { data: parsed, error: fnError } = await supabase.functions.invoke('leer-factura', {
        body: { base64, mediaType },
      })
      if (fnError) throw new Error(fnError.message || 'Error al leer la factura')
      if (parsed?.error) throw new Error(parsed.error)
      setEditandoPrecio(prev => ({
        ...prev,
        nro_factura: parsed.nro_factura || prev?.nro_factura || '',
        feria_nombre: parsed.feria_nombre || prev?.feria_nombre || '',
        kg_factura: parsed.total_kg ? String(parsed.total_kg) : (prev?.kg_factura || ''),
        monto_total: parsed.total_final ? String(parsed.total_final) : (prev?.monto_total || ''),
        importe_bruto: parsed.importe_bruto ? String(parsed.importe_bruto) : (prev?.importe_bruto || ''),
        sublotes: parsed.sublotes?.length > 0 ? normalizarSublotes(parsed.sublotes) : (prev?.sublotes || []),
        gastos_feria: parsed.gastos_feria ? { comision: String(parsed.gastos_feria.comision||''), iva_pct: String(parsed.gastos_feria.iva_pct||''), iva_monto: String(parsed.gastos_feria.iva_monto||''), dte: String(parsed.gastos_feria.dte||'') } : (prev?.gastos_feria || {}),
        cuotas_pago: parsed.cuotas?.length > 0 ? parsed.cuotas.map((c, i) => ({ nro_factura: String(i+1), fecha: c.fecha, monto: String(c.monto) })) : (prev?.cuotas_pago || []),
      }))
      alert('Factura leida correctamente. Revisá los datos antes de guardar.')
    } catch(err) {
      alert('Error al leer la factura: ' + (err.message || 'Intentá de nuevo'))
    }
    setLeyendoFactura(false)
  }

  async function guardarPrecio(lote) {
    const hayTropas = editandoPrecio?.sublotes?.length > 0
    const todasTropas = hayTropas ? editandoPrecio.sublotes.flatMap(p => p.tropas || []) : []
    if (!hayTropas && !editandoPrecio?.monto_total && !editandoPrecio?.precio_compra) { alert('Ingresá el monto total o el precio'); return }
    if (hayTropas && todasTropas.every(t => !t.subtotal)) { alert('Cargá los kilos y precio de al menos una tropa'); return }

    // Si hay tropas cargadas, el monto y los kg salen de sumarlas (no del campo manual)
    const kgFac = hayTropas
      ? todasTropas.reduce((s, t) => s + (parseFloat(t.kg) || 0), 0) || null
      : (editandoPrecio.kg_factura ? parseFloat(editandoPrecio.kg_factura) : null)
    const montoTotal = hayTropas
      ? todasTropas.reduce((s, t) => s + (parseFloat(t.subtotal) || 0), 0) || null
      : (editandoPrecio.monto_total ? parseFloat(editandoPrecio.monto_total) : (kgFac && editandoPrecio.precio_compra ? Math.round(kgFac * parseFloat(editandoPrecio.precio_compra)) : null))
    const precio = hayTropas
      ? (kgFac && montoTotal ? Math.round(montoTotal / kgFac) : null)
      : (editandoPrecio.precio_compra ? parseFloat(editandoPrecio.precio_compra) : null)
    const comMonto = editandoPrecio.comision_monto ? parseFloat(editandoPrecio.comision_monto) : 0

    // Resolver procedencia
    let procFinal = editandoPrecio.procedencia !== 'Nuevo' ? (editandoPrecio.procedencia || lote.procedencia) : lote.procedencia
    if (editandoPrecio.procedencia === 'Nuevo' && editandoPrecio.nuevaProcedencia?.trim()) {
      const nombre = editandoPrecio.nuevaProcedencia.trim()
      const existente = contactos.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())
      if (!existente) await supabase.from('contactos').insert({ nombre, tipo: 'proveedor_hacienda', activo: true })
      procFinal = nombre
    }

    // Si hay tropas por proveedor: crear los contactos nuevos que falten, y armar
    // la procedencia general del lote juntando los nombres de todos los proveedores
    let sublotesFinal = editandoPrecio.sublotes
    if (hayTropas) {
      sublotesFinal = []
      for (const prov of editandoPrecio.sublotes) {
        let nombreProv = prov.vendedor
        if (prov.vendedor === 'Nuevo' && prov.nuevaProcedencia?.trim()) {
          nombreProv = prov.nuevaProcedencia.trim()
          const existente = contactos.find(c => c.nombre.toLowerCase() === nombreProv.toLowerCase())
          if (!existente) await supabase.from('contactos').insert({ nombre: nombreProv, tipo: 'proveedor_hacienda', activo: true })
        }
        sublotesFinal.push({ ...prov, vendedor: nombreProv })
      }
      const nombresProveedores = [...new Set(sublotesFinal.map(p => p.vendedor).filter(Boolean))]
      if (nombresProveedores.length > 0) procFinal = nombresProveedores.join(', ')
    }

    // Todavía no hay factura de la feria en este punto (eso lo carga Paula después,
    // en Gestión Comercial) — por ahora el monto se registra como informal/negro.
    const montoNegro = montoTotal

    await supabase.from('lotes').update({
      kg_factura: kgFac,
      precio_compra: precio,
      monto_total_con_iva: montoTotal,
      monto_negro: montoNegro,
      fecha_vencimiento_pago: editandoPrecio.fecha_vencimiento_pago || null,
      comision_monto: comMonto || null,
      comision_a_quien: editandoPrecio.comision_a_quien || null,
      comision_es_paralela: editandoPrecio.comision_es_paralela || false,
      procedencia: procFinal,
      sublotes: hayTropas ? sublotesFinal : null,
      // nro_factura, feria_nombre, gastos_feria y cuotas_pago NO se tocan acá:
      // esos se cargan y editan exclusivamente en la pestaña "Gestión comercial".
    }).eq('id', lote.id)
    setEditandoPrecio(null)
    await cargarDatos()
  }


  async function eliminarLote(id) {
    if (!confirm('¿Eliminar este ingreso?')) return
    const lote = lotes.find(l => l.id === id)
    if (lote?.corral_cuarentena_id && lote?.cantidad) {
      const corral = corrales.find(c => c.id === lote.corral_cuarentena_id)
      const nuevosAnim = Math.max(0, (corral?.animales || 0) - lote.cantidad)
      const upd = { animales: nuevosAnim }
      if (nuevosAnim === 0) { upd.rol = 'libre'; upd.sub = null }
      await supabase.from('corrales').update(upd).eq('id', lote.corral_cuarentena_id)
    }
    await supabase.from('lotes').delete().eq('id', id)
    await cargarDatos()
  }

  if (loading) return <Loader />

  const lotesSinPrecio = esDueno ? lotes.filter(l => !l.precio_compra && !l.monto_total_con_iva) : []
  const loteEditandoExtra = (esDueno && editandoPrecio?.id && !lotesSinPrecio.find(l => l.id === editandoPrecio.id))
    ? lotes.find(l => l.id === editandoPrecio.id)
    : null
  const lotesParaCompletar = loteEditandoExtra ? [loteEditandoExtra, ...lotesSinPrecio] : lotesSinPrecio
  const compradores = [...new Set(lotes.map(l => l.procedencia).filter(Boolean))]

  // Métricas encabezado
  const ahora = new Date()
  const anioActual = ahora.getFullYear()
  const mesActual = ahora.getMonth()
  const lotesAnio = lotes.filter(l => l.created_at && new Date(l.created_at).getFullYear() === anioActual)
  const lotesMes = lotes.filter(l => l.created_at && new Date(l.created_at).getFullYear() === anioActual && new Date(l.created_at).getMonth() === mesActual)
  const totalAnimAnio = lotesAnio.reduce((s, l) => s + (l.cantidad || 0), 0)
  const totalAnimMes = lotesMes.reduce((s, l) => s + (l.cantidad || 0), 0)
  const lotesConPrecio = lotes.filter(l => l.precio_compra)
  const precioPromedio = lotesConPrecio.length > 0
    ? Math.round(lotesConPrecio.reduce((s, l) => s + l.precio_compra, 0) / lotesConPrecio.length)
    : null
  const lotesConKg = lotes.filter(l => l.cantidad && l.kg_bascula)
  const totalKgIngresados = lotesConKg.reduce((s, l) => s + l.kg_bascula, 0)
  const totalAnimIngresados = lotesConKg.reduce((s, l) => s + l.cantidad, 0)
  const kgPromedio = totalAnimIngresados > 0 ? Math.round(totalKgIngresados / totalAnimIngresados) : null

  // Kg promedio del mes actual
  const lotesMesConKg = lotesMes.filter(l => l.cantidad && l.kg_bascula)
  const kgPromedioMes = lotesMesConKg.length > 0
    ? Math.round(lotesMesConKg.reduce((s, l) => s + l.kg_bascula, 0) / lotesMesConKg.reduce((s, l) => s + l.cantidad, 0))
    : null

  // Detalle por mes
  const ingresosPorMes = {}
  lotes.forEach(l => {
    const fecha = new Date(l.created_at || l.fecha_ingreso)
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    if (!ingresosPorMes[key]) ingresosPorMes[key] = { cantidad: 0, ingresos: 0, kgTotal: 0, precioSum: 0, precioCount: 0 }
    ingresosPorMes[key].cantidad += l.cantidad || 0
    ingresosPorMes[key].ingresos += 1
    ingresosPorMes[key].kgTotal += l.kg_bascula || 0
    if (l.precio_compra) { ingresosPorMes[key].precioSum += l.precio_compra; ingresosPorMes[key].precioCount += 1 }
  })
  const mesesOrdenados = Object.entries(ingresosPorMes).sort((a, b) => b[0].localeCompare(a[0]))

  const TABS = [
    { key: 'lista', label: 'Ingresos' },
    { key: 'gestion', label: 'Gestión comercial' },
    { key: 'calculadora', label: '🧮 Calculadora precio máximo' },
  ]

  // ── VISTA NUEVO / EDITAR ──
  if (vista === 'nuevo' || vista === 'editar') {
    const corralesLibres = corrales.filter(c => c.rol === 'libre' || c.rol === 'cuarentena' || (vista === 'editar' && c.id === editandoLote?.corral_cuarentena_id))
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <button onClick={() => { setVista('lista'); setEditandoLote(null) }} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: 13 }}>← Volver</button>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{vista === 'nuevo' ? 'Nuevo ingreso' : `Editar ingreso · C-${editandoLote?.corrales?.numero || ''}`}</div>
        </div>
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.5rem', maxWidth: 700 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <Lbl>Procedencia / Vendedor</Lbl>
              <select value={form.procedencia} onChange={e => setForm({...form, procedencia: e.target.value, otraProcedencia: ''})} style={inp}>
                <option value="">— Seleccioná —</option>
                {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}</option>)}
                <option value="Nuevo">+ Nuevo contacto...</option>
              </select>
            </div>
            {form.procedencia === 'Nuevo' && (
              <div>
                <Lbl>Nombre del vendedor *</Lbl>
                <input type="text" value={form.otraProcedencia} onChange={e => setForm({...form, otraProcedencia: e.target.value})} style={inp} placeholder="Se guardará como contacto" />
              </div>
            )}
            <div>
              <Lbl>Categoría</Lbl>
              <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} style={inp}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Lbl>Cantidad de animales</Lbl>
              <input type="number" value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})} style={inpMono} />
            </div>
            <div>
              <Lbl>Kg báscula (control)</Lbl>
              <input type="number" value={form.kg_bascula} onChange={e => setForm({...form, kg_bascula: e.target.value})} style={inpMono} />
            </div>
            <div>
              <Lbl>Corral cuarentena</Lbl>
              <select value={form.corral_cuarentena_id} onChange={e => setForm({...form, corral_cuarentena_id: e.target.value})} style={inp}>
                <option value="">— Sin asignar —</option>
                {corralesLibres.map(c => <option key={c.id} value={c.id}>C-{c.numero} ({c.rol})</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Lbl>Observaciones</Lbl>
              <input type="text" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} style={inp} />
            </div>
          </div>
          {form.cantidad && form.kg_bascula && (
            <div style={{ background: S.accentLight, borderRadius: 6, padding: '8px 12px', marginBottom: '1rem', fontSize: 12, color: S.accent }}>
              Peso promedio: <strong>{Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad))} kg/animal</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={vista === 'nuevo' ? guardarIngreso : guardarEdicion} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</Btn>
            <Btn ghost onClick={() => { setVista('lista'); setEditandoLote(null) }}>Cancelar</Btn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>Ingresos de hacienda</div>
        {esDueno && (
          <Btn onClick={() => {
            setVista('nuevo')
            setForm({ procedencia: '', otraProcedencia: '', categoria: 'Novillos 2-3 años', cantidad: '', kg_bascula: '', observaciones: '', corral_cuarentena_id: '' })
          }}>+ Nuevo ingreso</Btn>
        )}
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1rem' }}>
        {/* Comprados este año — expandible */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
          <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Comprado este año</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: totalAnimAnio > 0 ? S.green : S.text }}>{totalAnimAnio.toLocaleString('es-AR')}</div>
          <div style={{ fontSize: 11, color: S.hint, marginTop: 3, marginBottom: 6 }}>{lotesAnio.length} ingreso{lotesAnio.length !== 1 ? 's' : ''} · este año</div>
          <button onClick={() => setShowDetalleMeses(!showDetalleMeses)}
            style={{ fontSize: 11, color: S.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {showDetalleMeses ? '▴ Ocultar detalle' : '▾ Ver por mes'}
          </button>
        </div>
        {/* Comprados este mes */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
          <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Comprado este mes</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: totalAnimMes > 0 ? S.green : S.text }}>{totalAnimMes.toLocaleString('es-AR')}</div>
          <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>{lotesMes.length} ingreso{lotesMes.length !== 1 ? 's' : ''}</div>
        </div>
        {/* Precio prom — expandible */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
          <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Precio prom. compra</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: S.text }}>{precioPromedio ? `$${precioPromedio.toLocaleString('es-AR')}` : '—'}</div>
          <div style={{ fontSize: 11, color: S.hint, marginTop: 3, marginBottom: 6 }}>$/kg · promedio histórico</div>
          <button onClick={() => setShowDetallePrecio(!showDetallePrecio)}
            style={{ fontSize: 11, color: S.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {showDetallePrecio ? '▴ Ocultar detalle' : '▾ Ver por mes'}
          </button>
        </div>
        {/* Kg prom — expandible */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
          <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Kg prom. por animal</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: S.text }}>{kgPromedio ? `${kgPromedio.toLocaleString('es-AR')} kg` : '—'}</div>
          <div style={{ fontSize: 11, color: S.hint, marginTop: 3, marginBottom: kgPromedioMes ? 4 : 6 }}>histórico ponderado</div>
          {kgPromedioMes && <div style={{ fontSize: 12, color: S.accent, fontFamily: 'monospace', fontWeight: 600 }}>{kgPromedioMes.toLocaleString('es-AR')} kg <span style={{ fontSize: 10, fontWeight: 400, color: S.muted }}>este mes</span></div>}
          <button onClick={() => setShowDetalleKg(!showDetalleKg)}
            style={{ fontSize: 11, color: S.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', marginTop: 4 }}>
            {showDetalleKg ? '▴ Ocultar detalle' : '▾ Ver por mes'}
          </button>
        </div>
      </div>

      {/* Detalle comprados por mes */}
      {showDetalleMeses && mesesOrdenados.length > 0 && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', padding: '10px 14px', borderBottom: `1px solid ${S.border}` }}>Compras por mes</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: S.bg }}>
              {['Mes', 'Ingresos', 'Animales'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Animales' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {mesesOrdenados.map(([key, data]) => {
                const [anio, mes] = key.split('-')
                const nombreMes = new Date(parseInt(anio), parseInt(mes) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                return (
                  <tr key={key} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 14px', fontWeight: 600, textTransform: 'capitalize' }}>{nombreMes}</td>
                    <td style={{ padding: '9px 14px', color: S.muted }}>{data.ingresos} ingreso{data.ingresos !== 1 ? 's' : ''}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: S.green }}>{data.cantidad.toLocaleString('es-AR')}</td>
                  </tr>
                )
              })}
              <tr style={{ background: S.bg, borderTop: `2px solid ${S.border}` }}>
                <td style={{ padding: '9px 14px', fontWeight: 700 }}>Total</td>
                <td style={{ padding: '9px 14px', color: S.muted }}>{lotes.length} ingresos</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: S.green }}>{lotes.reduce((s,l)=>s+(l.cantidad||0),0).toLocaleString('es-AR')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle precio por mes */}
      {showDetallePrecio && mesesOrdenados.length > 0 && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', padding: '10px 14px', borderBottom: `1px solid ${S.border}` }}>Precio promedio de compra por mes</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: S.bg }}>
              {['Mes', 'Ingresos con precio', 'Precio prom. $/kg'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Precio prom. $/kg' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {mesesOrdenados.map(([key, data]) => {
                const [anio, mes] = key.split('-')
                const nombreMes = new Date(parseInt(anio), parseInt(mes) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                const precioProm = data.precioCount > 0 ? Math.round(data.precioSum / data.precioCount) : null
                return (
                  <tr key={key} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 14px', fontWeight: 600, textTransform: 'capitalize' }}>{nombreMes}</td>
                    <td style={{ padding: '9px 14px', color: S.muted }}>{data.precioCount} ingreso{data.precioCount !== 1 ? 's' : ''}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: precioProm ? S.green : S.hint }}>{precioProm ? `$${precioProm.toLocaleString('es-AR')}` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle kg por mes */}
      {showDetalleKg && mesesOrdenados.length > 0 && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', padding: '10px 14px', borderBottom: `1px solid ${S.border}` }}>Kg promedio por animal — por mes</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: S.bg }}>
              {['Mes', 'Animales', 'Kg totales', 'Kg prom./animal'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Kg prom./animal' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {mesesOrdenados.map(([key, data]) => {
                const [anio, mes] = key.split('-')
                const nombreMes = new Date(parseInt(anio), parseInt(mes) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                const kgProm = data.cantidad > 0 && data.kgTotal > 0 ? Math.round(data.kgTotal / data.cantidad) : null
                return (
                  <tr key={key} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 14px', fontWeight: 600, textTransform: 'capitalize' }}>{nombreMes}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace' }}>{data.cantidad.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: S.muted }}>{(data.kgTotal/1000).toFixed(1)} tn</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{kgProm ? `${kgProm.toLocaleString('es-AR')} kg` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Banner lotes sin precio */}
      {lotesParaCompletar.length > 0 && (
        <div style={{ background: S.amberLight, border: `1px solid #EF9F27`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: '1rem' }}>
            {lotesSinPrecio.length > 0 ? `⚠ ${lotesSinPrecio.length} ingreso${lotesSinPrecio.length !== 1 ? 's' : ''} sin precio de compra` : '✏️ Editando datos comerciales'}
          </div>
          {lotesParaCompletar.map(l => {
            const isEdit = editandoPrecio?.id === l.id
            const kgBas = l.kg_bascula || 0
            const kgTropas = isEdit && editandoPrecio.sublotes?.length > 0 ? editandoPrecio.sublotes.flatMap(p=>p.tropas||[]).reduce((s,t)=>s+(parseFloat(t.kg)||0),0) : null
            const kgFac = kgTropas || parseFloat(editandoPrecio?.kg_factura || l.kg_factura || 0)
            const diffKg = kgBas && kgFac ? kgBas - kgFac : null
            const diffPct = diffKg !== null && kgFac > 0 ? (diffKg / kgFac * 100) : null
            const alertaDiff = diffPct !== null && Math.abs(diffPct) > 3
            // Total usa kg factura
            const kgPrecio = isEdit ? (parseFloat(editandoPrecio.kg_factura) || 0) : (l.kg_factura || 0)
            const precioCalc = isEdit ? parseFloat(editandoPrecio.precio_compra || 0) : 0
            const montoCalc = isEdit ? parseFloat(editandoPrecio.monto_total || 0) : 0
            // Bidireccional
            return (
              <div key={l.id} style={{ background: S.surface, borderRadius: 8, padding: '1rem', marginBottom: 8, border: `1px solid ${isEdit ? S.accent : S.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isEdit ? '1rem' : 0 }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>C-{corrales.find(c => c.id === l.corral_cuarentena_id)?.numero || l.corral_cuarentena_id}</strong>
                    {' · '}{l.cantidad} animales
                    {' · '}{(l.kg_vivo_total || l.kg_bascula || 0).toLocaleString('es-AR')} kg brutos
                    {l.categoria && ` · ${l.categoria}`}
                    {' · '}{l.fecha_ingreso ? new Date(l.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-AR') : ''}
                  </div>
                  {!isEdit && (
                    <Btn onClick={() => setEditandoPrecio({
                      id: l.id,
                      kg_factura: l.kg_factura ? String(l.kg_factura) : '',
                      precio_compra: l.precio_compra ? String(l.precio_compra) : '',
                      monto_total: l.monto_total_con_iva ? String(l.monto_total_con_iva) : '',
                      importe_bruto: l.monto_facturado ? String(l.monto_facturado) : '',
                      monto_facturado: l.monto_facturado ? String(l.monto_facturado) : '',
                      paralelo: (l.monto_total_con_iva && l.monto_facturado) ? String(Math.max(0, l.monto_total_con_iva - l.monto_facturado)) : '',
                      plazo_dias: l.plazo_dias ? String(l.plazo_dias) : '',
                      fecha_vencimiento_pago: l.fecha_vencimiento_pago || '',
                      comision_monto: l.comision_monto ? String(l.comision_monto) : '',
                      comision_a_quien: l.comision_a_quien || '',
                      comision_es_paralela: l.comision_es_paralela || false,
                      procedencia: l.procedencia || '',
                      nuevaProcedencia: '',
                      nro_factura: l.nro_factura || '',
                      feria_nombre: l.feria_nombre || '',
                      cuotas_pago: (l.cuotas_pago || []).map(c => ({ nro_factura: c.nro_factura || '', fecha: c.fecha || '', monto: String(c.monto || '') })),
                      sublotes: normalizarSublotes(l.sublotes),
                      gastos_feria: l.gastos_feria || {},
                    })} style={{ fontSize: 12, padding: '5px 12px' }}>
                      Completar datos
                    </Btn>
                  )}
                  {isEdit && (
                    <button onClick={() => setEditandoPrecio(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: 13 }}>✕</button>
                  )}
                </div>

                {isEdit && (
                  <div>
                    {/* Botón leer factura con IA — oculto hasta integrar la suscripción (carga manual por ahora) */}
                    {FACTURA_IA_HABILITADA && (
                    <div style={{ background: S.accentLight, border: `1px solid ${S.accent}`, borderRadius: 8, padding: '12px 16px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: S.accent }}>📎 Leer factura con IA</div>
                        <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>Subí la imagen o PDF de la factura y Claude extrae los datos automáticamente</div>
                      </div>
                      <label style={{ cursor: 'pointer' }}>
                        <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => e.target.files[0] && leerFacturaConIA(e.target.files[0])} />
                        <div style={{ padding: '7px 14px', background: leyendoFactura ? S.muted : S.accent, color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {leyendoFactura ? '⏳ Leyendo...' : '📎 Subir factura'}
                        </div>
                      </label>
                    </div>
                    )}

                    {/* Tropas por proveedor */}
                    {editandoPrecio.sublotes?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Lbl>Proveedores y tropas</Lbl>
                          <button onClick={() => setEditandoPrecio({...editandoPrecio, sublotes: [...(editandoPrecio.sublotes||[]), {vendedor:'',cuit:'',tropas:[{cabezas:'',kg:'',precio_kg:'',subtotal:''}]}]})}
                            style={{ padding: '3px 8px', fontSize: 11, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>+ Agregar proveedor</button>
                        </div>
                        {(editandoPrecio.sublotes||[]).map((prov, pi) => (
                          <div key={pi} style={{ border: `1px solid ${S.border}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: prov.vendedor === 'Nuevo' ? 6 : 8 }}>
                              <select value={prov.vendedor||''} onChange={e => { const n=[...editandoPrecio.sublotes]; n[pi]={...n[pi],vendedor:e.target.value, nuevaProcedencia:''}; setEditandoPrecio({...editandoPrecio,sublotes:n}) }}
                                style={{ border: `1px solid ${S.border}`, borderRadius: 5, padding: '6px 9px', fontSize: 12, fontWeight: 600, boxSizing: 'border-box' }}>
                                <option value="">— Vendedor / proveedor —</option>
                                {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}</option>)}
                                <option value="Nuevo">+ Nuevo contacto...</option>
                              </select>
                              <button onClick={() => { const n=editandoPrecio.sublotes.filter((_,i)=>i!==pi); setEditandoPrecio({...editandoPrecio,sublotes:n}) }}
                                style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 14 }} title="Quitar proveedor">✕</button>
                            </div>
                            {prov.vendedor === 'Nuevo' && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8, marginBottom: 8 }}>
                                <input placeholder="Nombre del nuevo vendedor" value={prov.nuevaProcedencia||''} onChange={e => { const n=[...editandoPrecio.sublotes]; n[pi]={...n[pi],nuevaProcedencia:e.target.value}; setEditandoPrecio({...editandoPrecio,sublotes:n}) }}
                                  style={{ border: `1px solid ${S.border}`, borderRadius: 5, padding: '6px 9px', fontSize: 12, boxSizing: 'border-box' }} />
                                <input placeholder="CUIT" value={prov.cuit||''} onChange={e => { const n=[...editandoPrecio.sublotes]; n[pi]={...n[pi],cuit:e.target.value}; setEditandoPrecio({...editandoPrecio,sublotes:n}) }}
                                  style={{ border: `1px solid ${S.border}`, borderRadius: 5, padding: '6px 9px', fontSize: 12, boxSizing: 'border-box' }} />
                              </div>
                            )}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead><tr style={{ background: S.bg }}>
                                {['Cabezas', 'Kg', '$/kg', 'Subtotal', ''].map(h => (
                                  <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                                ))}
                              </tr></thead>
                              <tbody>
                                {(prov.tropas||[]).map((tr, ti) => (
                                  <tr key={ti} style={{ borderBottom: `1px solid ${S.border}` }}>
                                    <td style={{ padding: '4px 6px' }}><input type="number" value={tr.cabezas||''} onChange={e => { const n=[...editandoPrecio.sublotes]; const trs=[...n[pi].tropas]; trs[ti]={...trs[ti],cabezas:e.target.value}; n[pi]={...n[pi],tropas:trs}; setEditandoPrecio({...editandoPrecio,sublotes:n}) }} style={{ border: `1px solid ${S.border}`, borderRadius: 4, padding: '5px 8px', fontSize: 12, width: 70, textAlign: 'right', fontFamily: 'monospace', boxSizing: 'border-box' }} /></td>
                                    <td style={{ padding: '4px 6px' }}><input type="number" value={tr.kg||''} onChange={e => { const n=[...editandoPrecio.sublotes]; const trs=[...n[pi].tropas]; const kg=parseFloat(e.target.value)||0; const sub=kg*(parseFloat(trs[ti].precio_kg)||0); trs[ti]={...trs[ti],kg:e.target.value,subtotal:sub?String(Math.round(sub)):''}; n[pi]={...n[pi],tropas:trs}; setEditandoPrecio({...editandoPrecio,sublotes:n}) }} style={{ border: `1px solid ${S.border}`, borderRadius: 4, padding: '5px 8px', fontSize: 12, width: 90, textAlign: 'right', fontFamily: 'monospace', boxSizing: 'border-box' }} /></td>
                                    <td style={{ padding: '4px 6px' }}><input type="number" value={tr.precio_kg||''} onChange={e => { const n=[...editandoPrecio.sublotes]; const trs=[...n[pi].tropas]; const p=parseFloat(e.target.value)||0; const sub=(parseFloat(trs[ti].kg)||0)*p; trs[ti]={...trs[ti],precio_kg:e.target.value,subtotal:sub?String(Math.round(sub)):''}; n[pi]={...n[pi],tropas:trs}; setEditandoPrecio({...editandoPrecio,sublotes:n}) }} style={{ border: `1px solid ${S.border}`, borderRadius: 4, padding: '5px 8px', fontSize: 12, width: 90, textAlign: 'right', fontFamily: 'monospace', boxSizing: 'border-box' }} /></td>
                                    <td style={{ padding: '4px 6px', fontFamily: 'monospace', fontSize: 12, color: S.accent, fontWeight: 600 }}>{tr.subtotal ? '$'+Number(tr.subtotal).toLocaleString('es-AR') : '—'}</td>
                                    <td style={{ padding: '4px 6px' }}>
                                      {(prov.tropas||[]).length > 1 && <button onClick={() => { const n=[...editandoPrecio.sublotes]; n[pi]={...n[pi],tropas:n[pi].tropas.filter((_,i)=>i!==ti)}; setEditandoPrecio({...editandoPrecio,sublotes:n}) }} style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 14 }} title="Quitar tropa">✕</button>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <button onClick={() => { const n=[...editandoPrecio.sublotes]; n[pi]={...n[pi],tropas:[...(n[pi].tropas||[]),{cabezas:'',kg:'',precio_kg:'',subtotal:''}]}; setEditandoPrecio({...editandoPrecio,sublotes:n}) }}
                              style={{ marginTop: 6, padding: '3px 8px', fontSize: 11, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 5, cursor: 'pointer' }}>
                              + Otra tropa de {(prov.vendedor === 'Nuevo' ? prov.nuevaProcedencia : prov.vendedor) || 'este proveedor'}
                            </button>
                          </div>
                        ))}
                        {(() => {
                          const todasTropas = (editandoPrecio.sublotes||[]).flatMap(p => p.tropas||[])
                          const totCab = todasTropas.reduce((s,t)=>s+(parseInt(t.cabezas)||0),0)
                          const totKg = todasTropas.reduce((s,t)=>s+(parseFloat(t.kg)||0),0)
                          const totMonto = todasTropas.reduce((s,t)=>s+(parseFloat(t.subtotal)||0),0)
                          const kgCampo = l.kg_bascula || 0
                          const diff = (totKg && kgCampo) ? Math.abs(totKg - kgCampo) / kgCampo * 100 : null
                          return (
                            <div style={{ background: S.accentLight, borderRadius: 8, padding: '10px 12px' }}>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>
                                TOTAL: {totCab} cab. · {totKg.toLocaleString('es-AR')} kg · <span style={{ color: S.accent }}>${totMonto.toLocaleString('es-AR')}</span>
                              </div>
                              {diff !== null && (
                                <div style={{ fontSize: 11, marginTop: 4, color: diff > 3 ? S.red : S.green, fontWeight: 600 }}>
                                  {diff > 3 ? '⚠' : '✓'} Diferencia vs báscula campo: {diff.toFixed(1)}% ({kgCampo.toLocaleString('es-AR')} kg campo vs {totKg.toLocaleString('es-AR')} kg tropas)
                                </div>
                              )}
                            </div>
                          )
                        })()}
                        <button onClick={() => setEditandoPrecio({...editandoPrecio, sublotes: []})}
                          style={{ marginTop: 8, padding: '3px 8px', fontSize: 11, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 5, cursor: 'pointer' }}>
                          ✕ Quitar desglose por proveedor
                        </button>
                      </div>
                    )}
                    {!editandoPrecio.sublotes?.length && (
                      <button onClick={() => setEditandoPrecio({...editandoPrecio, sublotes: [{vendedor:'',cuit:'',tropas:[{cabezas:'',kg:'',precio_kg:'',subtotal:''}]}]})}
                        style={{ padding: '6px 12px', fontSize: 11, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', marginBottom: 12 }}>
                        + ¿Vino más de un proveedor, o tropas con distinto precio, en este camión?
                      </button>
                    )}

                    {/* Fila 1: Procedencia/Vendedor — solo si no hay desglose por proveedor (para eso ya está arriba) */}
                    {!editandoPrecio.sublotes?.length && (
                    <div style={{ marginBottom: 12 }}>
                      <Lbl>Procedencia / Vendedor</Lbl>
                      <select value={editandoPrecio.procedencia || ''} onChange={e => setEditandoPrecio({...editandoPrecio, procedencia: e.target.value, nuevaProcedencia: ''})}
                        style={{ ...inp, marginBottom: editandoPrecio.procedencia === 'Nuevo' ? 6 : 0 }}>
                        <option value="">— Seleccioná —</option>
                        {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}</option>)}
                        <option value="Nuevo">+ Nuevo contacto...</option>
                      </select>
                      {editandoPrecio.procedencia === 'Nuevo' && (
                        <input type="text" placeholder="Nombre del vendedor (se guardará como contacto)" value={editandoPrecio.nuevaProcedencia || ''}
                          onChange={e => setEditandoPrecio({...editandoPrecio, nuevaProcedencia: e.target.value})} style={inp} />
                      )}
                    </div>
                    )}

                    {/* Fila 2: Kg Factura / Kg Campo / % dif */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <Lbl c={S.accent}>Kg Factura</Lbl>
                        {editandoPrecio.sublotes?.length > 0 ? (
                          <div style={{ padding: '9px 12px', border: `1px solid ${S.accent}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', background: S.accentLight, fontWeight: 700, color: S.accent }}>
                            {kgFac ? kgFac.toLocaleString('es-AR') : '—'}
                            <span style={{ fontSize: 10, fontWeight: 400, color: S.muted, marginLeft: 6 }}>(suma tropas)</span>
                          </div>
                        ) : (
                          <input type="number" value={editandoPrecio.kg_factura} onChange={e => {
                            const kgF = e.target.value
                            const monto = editandoPrecio.monto_total
                            const precio = monto && kgF ? String(Math.round(parseFloat(monto) / parseFloat(kgF))) : editandoPrecio.precio_compra
                            setEditandoPrecio({...editandoPrecio, kg_factura: kgF, precio_compra: precio})
                          }} placeholder="Kg según factura" style={{...inpMono, border: `1px solid ${S.accent}`, fontWeight: 600}} />
                        )}
                      </div>
                      <div>
                        <Lbl>Kg Campo (báscula)</Lbl>
                        <div style={{ padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', background: S.bg, color: S.muted, fontWeight: 600 }}>
                          {kgBas ? kgBas.toLocaleString('es-AR') : '—'}
                        </div>
                      </div>
                      <div>
                        <Lbl>% Diferencia</Lbl>
                        <div style={{ padding: '9px 12px', border: `1px solid ${alertaDiff ? '#F09595' : (diffPct !== null ? '#97C459' : S.border)}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', background: alertaDiff ? S.redLight : (diffPct !== null ? S.greenLight : S.bg), fontWeight: 700, color: alertaDiff ? S.red : (diffPct !== null ? S.green : S.hint) }}>
                          {diffPct !== null ? `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%${alertaDiff ? ' ⚠' : ' ✓'}` : '—'}
                        </div>
                        {alertaDiff && <div style={{ fontSize: 10, color: S.red, marginTop: 2 }}>Diferencia mayor al 3% — verificar</div>}
                      </div>
                    </div>

                    {/* Fila 3: Monto Total — se calcula solo si hay tropas cargadas */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <Lbl c={S.accent}>Monto Total Compra $</Lbl>
                        {editandoPrecio.sublotes?.length > 0 ? (
                          <div style={{ padding: '9px 12px', border: `1px solid ${S.accent}`, borderRadius: 6, fontSize: 14, fontFamily: 'monospace', background: S.accentLight, fontWeight: 700, color: S.accent, maxWidth: 280 }}>
                            ${(editandoPrecio.sublotes||[]).flatMap(p=>p.tropas||[]).reduce((s,t)=>s+(parseFloat(t.subtotal)||0),0).toLocaleString('es-AR')}
                            <span style={{ fontSize: 10, fontWeight: 400, color: S.muted, marginLeft: 6 }}>(suma de las tropas de arriba)</span>
                          </div>
                        ) : (
                          <input type="number" value={editandoPrecio.monto_total} onChange={e => {
                            const monto = e.target.value
                            const kgF = parseFloat(editandoPrecio.kg_factura) || 0
                            const precio = monto && kgF ? String(Math.round(parseFloat(monto) / kgF)) : editandoPrecio.precio_compra
                            setEditandoPrecio({...editandoPrecio, monto_total: monto, precio_compra: precio})
                          }} placeholder="Total a pagar" style={{...inpMono, border: `1px solid ${S.accent}`, fontWeight: 600, maxWidth: 280}} />
                        )}
                      </div>
                    </div>

                    {/* Vencimiento — campo simple para compras sin factura */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div>
                        <Lbl>Plazo (días)</Lbl>
                        <input type="number" value={editandoPrecio.plazo_dias || ''} min="0"
                          onChange={e => {
                            const dias = parseInt(e.target.value) || 0
                            const fechaVto = dias > 0 ? new Date(Date.now() + dias * 86400000).toISOString().split('T')[0] : ''
                            setEditandoPrecio({...editandoPrecio, plazo_dias: e.target.value, fecha_vencimiento_pago: fechaVto})
                          }}
                          placeholder="ej. 30"
                          style={inpMono} />
                      </div>
                      <div>
                        <Lbl>Fecha vencimiento</Lbl>
                        <input type="date" value={editandoPrecio.fecha_vencimiento_pago || ''}
                          onChange={e => setEditandoPrecio({...editandoPrecio, fecha_vencimiento_pago: e.target.value})}
                          style={inp} />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: S.hint, marginBottom: 12 }}>
                      El N° de factura, la feria, las retenciones/cargos y las cuotas de pago se cargan después, en la pestaña "Gestión comercial", cuando llega la factura.
                    </div>

                                        <div style={{ display: 'flex', gap: 8 }}>
                      <Btn onClick={() => guardarPrecio(l)} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</Btn>
                      <Btn ghost onClick={() => setEditandoPrecio(null)}>Cancelar</Btn>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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

      {/* ── TAB INGRESOS ── */}
      {tab === 'lista' && (
        <div>
          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ background: S.bg }}>
                  {['Fecha', 'Corral', 'Procedencia', 'Categoría', 'Cantidad', 'Kg báscula', 'Kg factura', 'Diferencia', 'Precio/kg', 'Precio real $/kg', 'Total', 'Vto pago', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lotes.length === 0 && (
                  <tr><td colSpan={12} style={{ padding: '3rem', textAlign: 'center', color: S.hint }}>No hay ingresos registrados.</td></tr>
                )}
                {lotes.map(l => {
                  const kgBas = l.kg_bascula || 0
                  const kgFac = l.kg_factura || 0
                  const diffKg = kgBas && kgFac ? kgBas - kgFac : null
                  const diffPct = diffKg !== null && kgFac > 0 ? (diffKg / kgFac * 100) : null
                  const alertaDiff = diffPct !== null && Math.abs(diffPct) > 3
                  const kgParaTotal = kgFac > 0 ? kgFac : kgBas
                  const ivaMontoCalc = l.monto_facturado != null ? Math.round(l.monto_facturado * (l.iva_pct || 10.5) / 100) : (l.iva_monto || 0)
                  const totalGC = (l.monto_facturado != null || l.monto_negro != null)
                    ? (l.monto_facturado || 0) + ivaMontoCalc + (l.monto_negro || 0)
                    : null
                  const total = totalGC || l.monto_total_con_iva || (kgParaTotal && l.precio_compra ? Math.round(kgParaTotal * l.precio_compra) : null)
                  const vtoColor = l.fecha_vencimiento_pago && new Date(l.fecha_vencimiento_pago) < new Date() ? S.red : S.muted
                  return (
                    <tr key={l.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted, whiteSpace: 'nowrap' }}>
                        {l.fecha_ingreso ? new Date(l.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>C-{corrales.find(c => c.id === l.corral_cuarentena_id)?.numero || l.corral_cuarentena_id || '—'}</td>
                      <td style={{ padding: '8px 12px', color: S.muted }}>{l.procedencia || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: 11, color: S.muted }}>{l.categoria || '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right' }}>{l.cantidad?.toLocaleString('es-AR') || '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', color: S.muted }}>{kgBas ? kgBas.toLocaleString('es-AR') : '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', fontWeight: kgFac ? 600 : 400, color: kgFac ? S.text : S.hint }}>{kgFac ? kgFac.toLocaleString('es-AR') : '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right' }}>
                        {diffPct !== null ? (
                          <span style={{ color: alertaDiff ? S.red : S.green, fontWeight: alertaDiff ? 700 : 400 }}>
                            {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%{alertaDiff ? ' ⚠' : ''}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', color: l.precio_compra ? S.text : S.hint }}>
                        {l.precio_compra ? `$${l.precio_compra.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right' }}>
                        {(() => {
                          if (!kgParaTotal || (l.monto_facturado == null && l.monto_negro == null)) return <span style={{ color: S.hint }}>—</span>
                          const real = Math.round(((l.monto_facturado || 0) + (l.monto_negro || 0) - (l.comision_monto || 0)) / kgParaTotal)
                          return `$${real.toLocaleString('es-AR')}`
                        })()}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 600, color: total ? S.red : S.hint }}>
                        {total ? `-$${total.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: vtoColor, whiteSpace: 'nowrap' }}>
                        {l.fecha_vencimiento_pago ? new Date(l.fecha_vencimiento_pago + 'T12:00:00').toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        {esDueno && (
                          <>
                            <button onClick={() => { setEditandoPrecio({
                              id: l.id,
                              kg_factura: l.kg_factura ? String(l.kg_factura) : '',
                              precio_compra: l.precio_compra ? String(l.precio_compra) : '',
                              monto_total: l.monto_total_con_iva ? String(l.monto_total_con_iva) : '',
                              monto_facturado: l.monto_facturado ? String(l.monto_facturado) : '',
                              paralelo: (l.monto_total_con_iva && l.monto_facturado) ? String(Math.max(0, l.monto_total_con_iva - l.monto_facturado)) : '',
                              plazo_dias: l.plazo_dias ? String(l.plazo_dias) : '',
                      fecha_vencimiento_pago: l.fecha_vencimiento_pago || '',
                              comision_monto: l.comision_monto ? String(l.comision_monto) : '',
                              comision_a_quien: l.comision_a_quien || '',
                              comision_es_paralela: l.comision_es_paralela || false,
                              procedencia: l.procedencia || '',
                              nuevaProcedencia: '',
                              cuotas_pago: (l.cuotas_pago || []).map(c => ({ nro_factura: c.nro_factura || '', fecha: c.fecha || '', monto: String(c.monto || '') })),
                            }) }}
                              style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer', marginRight: 4 }}>Editar</button>
                            <button onClick={() => eliminarLote(l.id)}
                              style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB GESTIÓN COMERCIAL ── */}
      {tab === 'gestion' && (
        <GestionComercial lotes={lotes} corrales={corrales} esDueno={esDueno} cargarDatos={cargarDatos} contactos={contactos} />
      )}

      {/* ── TAB CALCULADORA ── */}
      {tab === 'calculadora' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Calculadora de precio máximo de compra</div>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: '1.5rem' }}>Ingresá los parámetros estimados y el sistema calcula el precio máximo a pagar por kg en la compra</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.green, textTransform: 'uppercase', marginBottom: '1rem' }}>Venta estimada</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Precio venta $/kg vivo', key: 'precio_venta', placeholder: '4250' },
                    { label: 'Kg venta por animal', key: 'kg_venta', placeholder: '380' },
                    { label: 'Desbaste venta %', key: 'desbaste_venta', placeholder: '8' },
                    { label: 'Flete venta $/animal', key: 'flete_venta', placeholder: '0' },
                    { label: 'Comisión venta %', key: 'comision_venta_pct', placeholder: '0' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                      <input type="number" value={calc[f.key]} onChange={e => setCalc({...calc, [f.key]: e.target.value})} placeholder={f.placeholder}
                        style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, textTransform: 'uppercase', marginBottom: '1rem' }}>Parámetros feedlot</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Kg compra por animal', key: 'kg_compra', placeholder: '267' },
                    { label: 'Aumento diario kg', key: 'aumento_diario', placeholder: '1.25' },
                    { label: 'Conversión MF/kg carne', key: 'conversion_mf', placeholder: '6.8' },
                    { label: 'Costo dieta $/kg comida', key: 'costo_dieta', placeholder: '220' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                      <input type="number" value={calc[f.key]} onChange={e => setCalc({...calc, [f.key]: e.target.value})} placeholder={f.placeholder}
                        style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.red, textTransform: 'uppercase', marginBottom: '1rem' }}>Gastos por animal</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Sanidad $/animal', key: 'sanidad_animal', placeholder: '9500' },
                    { label: 'Gastos fijos $/animal/mes', key: 'gastos_fijos_mes', placeholder: '20000' },
                    { label: 'Flete compra $/animal', key: 'flete_compra', placeholder: '12000' },
                    { label: 'Comisión compra %', key: 'comision_compra_pct', placeholder: '0' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                      <input type="number" value={calc[f.key]} onChange={e => setCalc({...calc, [f.key]: e.target.value})} placeholder={f.placeholder}
                        style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.amber, textTransform: 'uppercase', marginBottom: 8 }}>Rentabilidad anual deseada %</div>
                <input type="number" value={calc.margen_deseado} onChange={e => setCalc({...calc, margen_deseado: e.target.value})} placeholder="15"
                  style={{ width: '100%', border: `1px solid ${S.amber}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace', fontWeight: 600 }} />
              </div>
            </div>
            <div>
              {(() => {
                const pV=parseFloat(calc.precio_venta)||0, kgV=parseFloat(calc.kg_venta)||0
                const desbaste=parseFloat(calc.desbaste_venta)/100||0.08
                const kgC=parseFloat(calc.kg_compra)||0
                const aumDia=parseFloat(calc.aumento_diario)||1.25
                const convMF=parseFloat(calc.conversion_mf)||6.8
                const costDieta=parseFloat(calc.costo_dieta)||220
                const sanidad=parseFloat(calc.sanidad_animal)||9500
                const gfMes=parseFloat(calc.gastos_fijos_mes)||20000
                const flC=parseFloat(calc.flete_compra)||0
                const flV=parseFloat(calc.flete_venta)||0
                const comV=parseFloat(calc.comision_venta_pct)/100||0
                const comC=parseFloat(calc.comision_compra_pct)/100||0
                const margen=parseFloat(calc.margen_deseado)/100||0.15
                if (!pV||!kgV||!kgC) return (
                  <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '2rem', textAlign: 'center', color: S.hint }}>
                    Completá precio de venta, kg venta y kg compra para ver el cálculo.
                  </div>
                )
                const kgNetoV=kgV*(1-desbaste)
                const aumento=kgV-kgC
                const dias=aumDia>0?Math.round(aumento/aumDia):0
                const meses=dias/30
                const kgComida=aumento*convMF
                const costComida=kgComida*costDieta
                const gfTotal=gfMes*meses
                const comVMonto=kgNetoV*pV*comV
                const comCMonto=kgC*comC
                const ingresoNeto=kgNetoV*pV-flV-comVMonto
                const costosSinCompra=costComida+sanidad+gfTotal+flC+comCMonto
                const precioMaxEq=(ingresoNeto-costosSinCompra)/kgC
                const factorM=1+(margen*meses/12)
                const precioMaxConM=(ingresoNeto-costosSinCompra*factorM)/(kgC*factorM)
                const costos=[
                  {label:'Alimentación', val:Math.round(costComida)},
                  {label:'Sanidad', val:Math.round(sanidad)},
                  {label:'Gastos fijos', val:Math.round(gfTotal)},
                  {label:'Flete compra', val:Math.round(flC)},
                  {label:'Flete venta', val:Math.round(flV)},
                  {label:'Comisión venta', val:Math.round(comVMonto)},
                ].filter(c=>c.val>0)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                      {[
                        {label:'Días feedlot', val:`${dias} días`, sub:`${meses.toFixed(1)} meses`},
                        {label:'Aumento total', val:`${aumento} kg`, sub:`${kgC} a ${kgV} kg`},
                        {label:'Kg comida total', val:`${Math.round(kgComida).toLocaleString('es-AR')} kg`, sub:`Conv. ${convMF}`},
                      ].map((c,i)=>(
                        <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
                          <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: S.accent }}>{c.val}</div>
                          <div style={{ fontSize: 11, color: S.hint }}>{c.sub}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: S.red, textTransform: 'uppercase', marginBottom: '1rem' }}>Costos sin compra</div>
                      {costos.map((c,i)=>(
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: `1px solid ${S.border}` }}>
                          <span style={{ color: S.muted }}>{c.label}</span>
                          <span style={{ fontFamily: 'monospace', color: S.red }}>-${c.val.toLocaleString('es-AR')}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', fontWeight: 700 }}>
                        <span>Total costos sin compra</span>
                        <span style={{ fontFamily: 'monospace', color: S.red }}>-${Math.round(costosSinCompra).toLocaleString('es-AR')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderTop: `1px solid ${S.border}` }}>
                        <span style={{ color: S.green }}>Ingreso neto venta</span>
                        <span style={{ fontFamily: 'monospace', color: S.green }}>+${Math.round(ingresoNeto).toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                    <div style={{ background: S.accent, borderRadius: 10, padding: '1.5rem', color: '#fff' }}>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>Precio máximo de compra — Punto de equilibrio</div>
                      <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'monospace' }}>${Math.max(0,Math.round(precioMaxEq)).toLocaleString('es-AR')}</div>
                      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>por kg vivo</div>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', margin: '12px 0' }} />
                      <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>Con rentabilidad del {calc.margen_deseado}% anual</div>
                      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace' }}>${Math.max(0,Math.round(precioMaxConM)).toLocaleString('es-AR')}</div>
                      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>por kg vivo</div>
                    </div>
                    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Sensibilidad — precio compra vs rentabilidad</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead><tr style={{ background: S.bg }}>
                          {['Precio compra $/kg','Costo total','Ingreso neto','Ganancia','Rent. anual'].map(h=>(
                            <th key={h} style={{ padding:'6px 10px', textAlign:'right', fontWeight:600, color:S.muted, fontSize:10, textTransform:'uppercase', borderBottom:`1px solid ${S.border}` }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {[0.85,0.90,0.95,1.0,1.05,1.10].map(factor=>{
                            const pC=Math.round(precioMaxEq*factor)
                            const cTotal=pC*kgC+costosSinCompra
                            const gan=ingresoNeto-cTotal
                            const rentA=meses>0?((gan/cTotal)*(12/meses)*100):0
                            const esRef=factor===1.0
                            return (
                              <tr key={factor} style={{ borderBottom:`1px solid ${S.border}`, background:esRef?S.accentLight:'transparent' }}>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:esRef?700:400 }}>${pC.toLocaleString('es-AR')}</td>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', color:S.red }}>-${cTotal.toLocaleString('es-AR')}</td>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', color:S.green }}>+${Math.round(ingresoNeto).toLocaleString('es-AR')}</td>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:600, color:gan>=0?S.green:S.red }}>{gan>=0?'+':''}{Math.round(gan).toLocaleString('es-AR')}</td>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:600, color:rentA>=0?S.green:S.red }}>{rentA.toFixed(1)}%</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── GESTIÓN COMERCIAL (componente separado) ──

function generarReciboCompra(lote, pagos, corrales) {
  const fecha = pagos[0]?.fecha ? new Date(pagos[0].fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('es-AR')
  const proveedor = lote.procedencia || ''
  // Datos fiscales del/los proveedor/es: si hay facturas cargadas por proveedor, se juntan;
  // si no, se usa el dato viejo a nivel lote (compatibilidad con lotes cargados antes de este cambio)
  const datosFiscales = (lote.facturas_feria?.length > 0)
    ? {
        iva: [...new Set(lote.facturas_feria.map(f => f.condicion_iva).filter(Boolean))].join(' / ') || lote.proveedor_iva || '',
        localidad: [...new Set(lote.facturas_feria.map(f => f.localidad).filter(Boolean))].join(' / ') || lote.proveedor_localidad || '',
        cuit: [...new Set(lote.facturas_feria.map(f => f.cuit).filter(Boolean))].join(' / ') || lote.proveedor_cuit || '',
        cbu: [...new Set(lote.facturas_feria.map(f => f.cbu).filter(Boolean))].join(' / ') || lote.proveedor_cbu || '',
      }
    : { iva: lote.proveedor_iva || '', localidad: lote.proveedor_localidad || '', cuit: lote.proveedor_cuit || '', cbu: lote.proveedor_cbu || '' }
  const totalMonto = pagos.reduce((s, p) => s + (p.monto || 0), 0)
  const entero = Math.floor(totalMonto)
  const unidades = ['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE']
  const decenas = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const centenas = ['','CIEN','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']
  function nAL(n) {
    if (n === 0) return 'CERO'; let r = ''
    if (n >= 1000000) { const m = Math.floor(n/1000000); r += (m===1?'UN MILLÓN ':nAL(m)+' MILLONES '); n %= 1000000 }
    if (n >= 1000) { const m = Math.floor(n/1000); r += (m===1?'MIL ':nAL(m)+' MIL '); n %= 1000 }
    if (n >= 100) { r += (n===100?'CIEN ':centenas[Math.floor(n/100)]+' '); n %= 100 }
    if (n >= 20) { r += decenas[Math.floor(n/10)]; if (n%10>0) r += ' Y '+unidades[n%10]; r += ' ' }
    else if (n > 0) r += unidades[n]+' '
    return r.trim()
  }
  const centavos = Math.round((totalMonto - entero) * 100)
  const enLetras = nAL(entero) + ' PESOS' + (centavos > 0 ? ' CON ' + nAL(centavos) + ' CENTAVOS' : '') + '.-'
  const corralNum = corrales.find(c => c.id === lote.corral_cuarentena_id)?.numero || ''
  const concepto = `Compra hacienda — ${lote.procedencia || ''} ${lote.categoria || ''} · ${lote.cantidad || ''} cabezas · C-${corralNum}`

  const filasPago = pagos.flatMap(p => {
    const tipo = p.tipo || p.forma_pago || ''
    const subtipo = p.subtipo_cheque || ''
    const esParalelo = p.es_paralelo || p.es_negro
    const medioCheque = tipo === 'cheque' ? 'CHEQUE' : 'E-CHEQ'
    let desc = tipo === 'transferencia' ? 'TRANSFERENCIA' : tipo === 'efectivo' ? 'EFECTIVO' : tipo === 'cuenta_corriente' ? 'CUENTA CORRIENTE' : subtipo === 'propio' ? `${medioCheque} PROPIO` : subtipo === 'tercero' ? `${medioCheque} TERCERO` : tipo.toUpperCase()
    if (esParalelo) desc += ' (PARALELO)'

    // E-cheq propio — usa cheque_propio (nuevo) o campos legacy
    if (subtipo === 'propio') {
      const nro = p.cheque_propio?.numero || p.numero_cheque || ''
      const banco = p.cheque_propio?.banco || p.banco || ''
      const vto = p.cheque_propio?.fecha_vencimiento || p.fecha_vencimiento_cheque || ''
      return [`<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${[nro, banco].filter(Boolean).join(' · ')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${vto ? new Date(vto+'T12:00:00').toLocaleDateString('es-AR') : ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${(p.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      </tr>`]
    }

    // E-cheq tercero — una fila por cheque con detalle
    if (subtipo === 'tercero' && p.cheque_tercero_detalle?.length > 0) {
      return p.cheque_tercero_detalle.map(ch => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">#${ch.numero || '—'} · ${ch.banco || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR') : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${(ch.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      </tr>`)
    }

    // Transferencia, efectivo, cuenta corriente
    return [`<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;"></td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;"></td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${(p.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
    </tr>`]
  }).join('')

  const bloque = `<div style="border:1px solid #333;padding:20px;font-family:Arial,sans-serif;font-size:12px;width:100%;box-sizing:border-box;">
    <table style="width:100%;margin-bottom:10px;"><tr>
      <td style="width:33%;vertical-align:top;"><div style="font-weight:bold;">Pedro Barciocco 1221</div><div>TEL: 3574-442656</div><div style="margin-top:8px;border:1px solid #333;display:inline-block;padding:2px 6px;font-weight:bold;">X &nbsp; NO VALIDO COMO FACTURA</div><div style="font-size:11px;margin-top:2px;">Orden de pago</div></td>
      <td style="width:34%;text-align:center;vertical-align:middle;"><div style="font-size:22px;font-weight:900;">RAMONDA</div><div style="font-size:14px;font-weight:600;">HNOS S.A.</div></td>
      <td style="width:33%;text-align:right;vertical-align:top;"><div>CUIT: &nbsp;30-71682182-6</div><div>I.V.A. &nbsp;Responsable inscripto</div></td>
    </tr></table>
    <hr style="border:1px solid #333;margin:8px 0;">
    <table style="width:100%;border:1px solid #333;border-collapse:collapse;">
      <tr><td colspan="2" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;">Entrego a:</td></tr>
      <tr><td style="padding:4px 8px;width:50%;">Nombre: <strong>${proveedor}</strong></td><td style="padding:4px 8px;">I.V.A.: ${datosFiscales.iva}</td></tr>
      <tr><td style="padding:4px 8px;">Localidad: ${datosFiscales.localidad}</td><td style="padding:4px 8px;">CUIT/DNI: ${datosFiscales.cuit}</td></tr>
      <tr><td style="padding:4px 8px;">C.B.U: ${datosFiscales.cbu}</td><td style="padding:4px 8px;">FECHA &nbsp;<strong>${fecha}</strong></td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td colspan="2" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #333;">Concepto</td></tr>
      <tr><td colspan="2" style="padding:6px 8px;">${concepto}</td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td colspan="4" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #333;">Medio de pago</td></tr>
      <tr style="background:#eee;">
        <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #333;font-size:11px;">DESCRIPCIÓN</th>
        <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">NRO/CHEQUE</th>
        <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">FECHA COBRO</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #333;font-size:11px;">IMPORTE</th>
      </tr>
      ${filasPago}
      <tr style="border-top:1px solid #333;"><td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">IMPORTE TOTAL &nbsp; $</td><td style="padding:8px;text-align:right;font-weight:bold;">${totalMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td style="padding:6px 8px;">Cantidad de pesos: &nbsp;${enLetras}</td></tr>
      <tr><td style="padding:20px 8px 30px 8px;">&nbsp;</td></tr>
      <tr><td style="padding:8px;"><table style="width:100%;"><tr><td style="width:40%;text-align:center;border-top:1px solid #333;">Firma</td><td style="width:20%;"></td><td style="width:40%;text-align:center;border-top:1px solid #333;">DNI</td></tr></table></td></tr>
    </table>
  </div>`

  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo pago hacienda</title><style>@media print{.no-print{display:none;}}body{font-family:Arial,sans-serif;background:#fff;padding:10px;}</style></head><body>
    <div style="text-align:right;margin-bottom:10px;" class="no-print"><button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#1A3D6B;color:#fff;border:none;border-radius:6px;">🖨️ Imprimir / Guardar PDF</button></div>
    ${bloque}<div style="border-top:2px dashed #999;margin:16px 0;text-align:center;font-size:11px;color:#999;padding:4px 0;">✂ &nbsp;&nbsp; CORTAR AQUÍ &nbsp;&nbsp; ✂</div>${bloque}
  </body></html>`)
  win.document.close()
}

// Convierte/migra las facturas de un lote al formato nuevo (una factura por proveedor/tropa).
// Si ya existen facturas_feria, las usa tal cual. Si hay datos del sistema viejo (una sola
// factura general en cuotas_pago), arma un bloque por cada una. Si no hay nada, arranca un
// bloque por cada proveedor de las tropas cargadas en Ingresos (si las hay).
function normalizarFacturas(l) {
  if (l.facturas_feria?.length > 0) {
    return l.facturas_feria.map(f => ({
      proveedor: f.proveedor || '', cuit: f.cuit || '', localidad: f.localidad || '', condicion_iva: f.condicion_iva || '', cbu: f.cbu || '',
      nro_factura: f.nro_factura || '', feria_nombre: f.feria_nombre || '',
      kg_factura: f.kg_factura != null ? String(f.kg_factura) : '', precio_neto: f.precio_neto != null ? String(f.precio_neto) : '',
      comision: f.comision != null ? String(f.comision) : '', dte: f.dte != null ? String(f.dte) : '',
      vencimientos: (f.vencimientos || [{ fecha: '', monto: '', pagado: false }]).map(v => ({ fecha: v.fecha || '', monto: String(v.monto || ''), pagado: v.pagado || false })),
    }))
  }
  if (l.cuotas_pago?.length > 0) {
    return l.cuotas_pago.map(c => ({
      proveedor: l.procedencia || '', cuit: l.proveedor_cuit || '', nro_factura: c.nro_factura || '', feria_nombre: l.feria_nombre || '',
      kg_factura: '', precio_neto: '', comision: '', dte: '',
      vencimientos: (c.vencimientos || [{ fecha: c.fecha, monto: c.monto, pagado: false }]).map(v => ({ fecha: v.fecha || '', monto: String(v.monto || ''), pagado: v.pagado || false })),
    }))
  }
  if (l.sublotes?.length > 0) {
    return l.sublotes.map(s => ({ proveedor: s.vendedor || '', cuit: s.cuit || '', nro_factura: '', feria_nombre: '', kg_factura: '', precio_neto: '', comision: '', dte: '', vencimientos: [{ fecha: '', monto: '', pagado: false }] }))
  }
  return [{ proveedor: l.procedencia || '', cuit: '', nro_factura: '', feria_nombre: '', kg_factura: '', precio_neto: '', comision: '', dte: '', vencimientos: [{ fecha: '', monto: '', pagado: false }] }]
}

function GestionComercial({ lotes, corrales, esDueno, cargarDatos, contactos }) {
  const S = {
    bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', muted: '#6B6760', hint: '#9E9A94', text: '#1A1916',
    accent: '#378ADD', accentLight: '#E8EFF8', green: '#1E5C2E', greenLight: '#E8F4EB',
    red: '#7A1A1A', redLight: '#FDF0F0', amber: '#7A4500', amberLight: '#FDF0E0', purple: '#3D1A6B', purpleLight: '#F0EAFB',
  }
  const inp = { width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }
  const Lbl = ({ children, c }) => <label style={{ fontSize: 11, fontWeight: 600, color: c || S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>{children}</label>

  const IVA_PCT = 10.5
  const [editandoFactura, setEditandoFactura] = useState(null)
  const [formFactura, setFormFactura] = useState({ fecha_factura: '', observaciones_pago: '', facturas: [] })
  const [pagosMap, setPagosMap] = useState({})
  const [chequesCartera, setChequesCartera] = useState([])
  const PAGO_INIT = { tipo: 'transferencia', monto: '', es_paralela: false, subtipo_cheque: '', cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' }, cheque_tercero_ids: [] }
  const [registrandoPago, setRegistrandoPago] = useState(null)
  const [formPago, setFormPago] = useState({ fecha: new Date().toISOString().split('T')[0], pagos: [{...PAGO_INIT}] })
  const [pagosExpandidos, setPagosExpandidos] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false)
  const [filtroArchivadas, setFiltroArchivadas] = useState({ proveedor: '', desde: '', hasta: '' })

  useEffect(() => { cargarPagos() }, [lotes])

  async function cargarPagos() {
    if (!lotes.length) return
    const ids = lotes.map(l => l.id)
    const [{ data }, { data: ch }] = await Promise.all([
      supabase.from('pagos_compras').select('*').in('lote_id', ids).order('fecha'),
      supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento', { ascending: true }),
    ])
    const map = {}
    ;(data || []).forEach(p => {
      if (!map[p.lote_id]) map[p.lote_id] = []
      map[p.lote_id].push(p)
    })
    setPagosMap(map)
    setChequesCartera(ch || [])
  }

  function totalLoteCalc(l) {
    const ivaMontoCalc = l.monto_facturado != null ? Math.round(l.monto_facturado * (l.iva_pct || 10.5) / 100) : (l.iva_monto || Math.round((l.monto_total_con_iva || 0) * (l.iva_pct || 10.5) / (100 + (l.iva_pct || 10.5))))
    const totalGC = (l.monto_facturado != null || l.monto_negro != null) ? (l.monto_facturado || 0) + ivaMontoCalc + (l.monto_negro || 0) : null
    const kgBase = l.kg_factura > 0 ? l.kg_factura : l.kg_bascula
    return totalGC || l.monto_total_con_iva || (l.precio_compra && kgBase ? Math.round(kgBase * l.precio_compra) : 0)
  }

  async function guardarFactura(lote) {
    const bloques = (formFactura.facturas || []).filter(f => f.nro_factura || f.kg_factura || f.precio_neto || (f.vencimientos || []).some(v => v.monto))
    const facturasCalc = bloques.map(f => {
      const kg = parseFloat(f.kg_factura) || 0
      const precioNeto = parseFloat(f.precio_neto) || 0
      const vencsFiltrados = (f.vencimientos || []).filter(v => v.fecha || v.monto)
      // El monto neto sale de kg×precio; si no cargaron eso, se toma de la suma de los vencimientos cargados
      const montoNeto = (kg && precioNeto) ? Math.round(kg * precioNeto) : vencsFiltrados.reduce((s, v) => s + (parseFloat(v.monto) || 0), 0)
      const ivaMonto = Math.round(montoNeto * IVA_PCT / 100)
      const gastos = (parseFloat(f.comision) || 0) + (parseFloat(f.dte) || 0)
      const totalFactura = montoNeto + ivaMonto + gastos
      return {
        proveedor: f.proveedor || null, cuit: f.cuit || null, localidad: f.localidad || null, condicion_iva: f.condicion_iva || null, cbu: f.cbu || null,
        nro_factura: f.nro_factura || null, feria_nombre: f.feria_nombre || null,
        kg_factura: kg || null, precio_neto: precioNeto || null, monto_neto: montoNeto, iva_monto: ivaMonto,
        comision: parseFloat(f.comision) || null, dte: parseFloat(f.dte) || null, gastos_total: gastos, total_factura: totalFactura,
        vencimientos: vencsFiltrados.map(v => ({ fecha: v.fecha || null, monto: parseFloat(v.monto) || 0, pagado: v.pagado || false })),
      }
    })
    const totalNeto = facturasCalc.reduce((s, f) => s + f.monto_neto, 0)
    const totalIva = facturasCalc.reduce((s, f) => s + f.iva_monto, 0)
    const totalFacturadoConTodo = facturasCalc.reduce((s, f) => s + f.total_factura, 0)
    const montoTotalOriginal = lote.monto_total_con_iva || null
    const montoNegro = montoTotalOriginal != null ? Math.max(0, montoTotalOriginal - totalFacturadoConTodo) : null
    const primeraFactura = facturasCalc[0]?.nro_factura || null

    // cuotas_pago (aplanado): se sigue completando para que el banner de vencimientos
    // próximos y el resto del sistema, que ya lo leen, sigan funcionando sin cambios.
    const cuotasPagoCompat = facturasCalc.map(f => ({ nro_factura: f.nro_factura, vencimientos: f.vencimientos }))

    await supabase.from('lotes').update({
      numero_factura: primeraFactura,
      fecha_factura: formFactura.fecha_factura || null,
      monto_facturado: totalNeto > 0 ? totalNeto : null,
      iva_pct: IVA_PCT,
      iva_monto: totalIva,
      monto_negro: montoNegro,
      observaciones_pago: formFactura.observaciones_pago || null,
      facturas_feria: facturasCalc.length > 0 ? facturasCalc : null,
      cuotas_pago: cuotasPagoCompat.length > 0 ? cuotasPagoCompat : null,
    }).eq('id', lote.id)
    setEditandoFactura(null)
    await cargarDatos()
  }

  function renderFormFactura(l) {
    const facturas = formFactura.facturas || []
    const totalOperacion = l.monto_total_con_iva || 0
    const totalFacturadoTodo = facturas.reduce((s, f) => {
      const kg = parseFloat(f.kg_factura) || 0
      const precio = parseFloat(f.precio_neto) || 0
      const vencs = (f.vencimientos || []).filter(v => v.fecha || v.monto)
      const neto = (kg && precio) ? kg * precio : vencs.reduce((sv, v) => sv + (parseFloat(v.monto) || 0), 0)
      const iva = neto * IVA_PCT / 100
      const gastos = (parseFloat(f.comision) || 0) + (parseFloat(f.dte) || 0)
      return s + neto + iva + gastos
    }, 0)
    const paralelo = totalOperacion > 0 ? Math.max(0, totalOperacion - totalFacturadoTodo) : 0
    const nombresProveedoresTropas = [...new Set((l.sublotes || []).map(s => s.vendedor).filter(Boolean))]

    return (
      <div>
        <div style={{ marginBottom: 10 }}>
          <Lbl>Fecha de factura</Lbl>
          <input type="date" value={formFactura.fecha_factura} onChange={e => setFormFactura({...formFactura, fecha_factura: e.target.value})} style={{...inp, maxWidth: 200}} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase' }}>Facturas por proveedor (IVA {IVA_PCT}% incluido siempre)</div>
          <button onClick={() => setFormFactura({...formFactura, facturas: [...facturas, { proveedor: '', cuit: '', localidad: '', condicion_iva: '', cbu: '', nro_factura: '', feria_nombre: '', kg_factura: '', precio_neto: '', comision: '', dte: '', vencimientos: [{ fecha: '', monto: '', pagado: false }] }]})}
            style={{ padding: '3px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
            + Agregar factura
          </button>
        </div>

        {facturas.length === 0 && (
          <div style={{ fontSize: 12, color: S.hint, padding: '6px 0', marginBottom: 8 }}>Sin facturas cargadas todavía.</div>
        )}

        {facturas.map((f, fi) => {
          const kg = parseFloat(f.kg_factura) || 0
          const precio = parseFloat(f.precio_neto) || 0
          const vencs = (f.vencimientos || []).filter(v => v.fecha || v.monto)
          const montoNeto = (kg && precio) ? kg * precio : vencs.reduce((s, v) => s + (parseFloat(v.monto) || 0), 0)
          const ivaMonto = Math.round(montoNeto * IVA_PCT / 100)
          const gastos = (parseFloat(f.comision) || 0) + (parseFloat(f.dte) || 0)
          const totalFactura = montoNeto + ivaMonto + gastos
          const totalVencs = vencs.reduce((s, v) => s + (parseFloat(v.monto) || 0), 0)
          const set = patch => { const n = [...facturas]; n[fi] = { ...n[fi], ...patch }; setFormFactura({...formFactura, facturas: n}) }

          return (
            <div key={fi} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 7, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 8, marginBottom: 8 }}>
                <select value={f.proveedor || ''} onChange={e => {
                  const nombre = e.target.value
                  const ct = (contactos || []).find(c => c.nombre === nombre)
                  set(ct ? { proveedor: nombre, cuit: ct.cuit || f.cuit, localidad: ct.localidad || f.localidad, condicion_iva: ct.iva || f.condicion_iva, cbu: ct.cbu || f.cbu } : { proveedor: nombre })
                }} style={{...inp, fontWeight: 600}}>
                  <option value="">— Proveedor de esta factura —</option>
                  {nombresProveedoresTropas.map(n => <option key={n} value={n}>{n} (tropa del ingreso)</option>)}
                  {(contactos || []).filter(c => !nombresProveedoresTropas.includes(c.nombre)).map(c => <option key={c.id} value={c.nombre}>{c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}</option>)}
                </select>
                <input placeholder="CUIT" value={f.cuit || ''} onChange={e => set({ cuit: e.target.value })} style={{...inp, fontSize: 12}} />
                <button onClick={() => setFormFactura({...formFactura, facturas: facturas.filter((_, i) => i !== fi)})}
                  style={{ padding: '5px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>✕ Quitar factura</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input placeholder="Localidad (opcional)" value={f.localidad || ''} onChange={e => set({ localidad: e.target.value })} style={{...inp, fontSize: 12}} />
                <input placeholder="Condición IVA (ej. Resp. Inscripto)" value={f.condicion_iva || ''} onChange={e => set({ condicion_iva: e.target.value })} style={{...inp, fontSize: 12}} />
                <input placeholder="CBU (opcional)" value={f.cbu || ''} onChange={e => set({ cbu: e.target.value })} style={{...inp, fontSize: 12}} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div><Lbl>N° Factura</Lbl><input type="text" value={f.nro_factura || ''} placeholder="0001-00012345" onChange={e => set({ nro_factura: e.target.value })} style={{...inp, fontFamily: 'monospace'}} /></div>
                <div><Lbl>Feria / Remate</Lbl><input type="text" value={f.feria_nombre || ''} placeholder="ej. Guillermo Lehmann" onChange={e => set({ feria_nombre: e.target.value })} style={inp} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div><Lbl c={S.accent}>Kg (según esta factura)</Lbl><input type="number" value={f.kg_factura || ''} onChange={e => set({ kg_factura: e.target.value })} style={{...inp, fontFamily: 'monospace', border: `1px solid ${S.accent}`}} /></div>
                <div><Lbl c={S.accent}>Precio neto $/kg</Lbl><input type="number" value={f.precio_neto || ''} onChange={e => set({ precio_neto: e.target.value })} style={{...inp, fontFamily: 'monospace', border: `1px solid ${S.accent}`}} /></div>
                <div>
                  <Lbl>Neto → c/IVA {IVA_PCT}%</Lbl>
                  <div style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 6 }}>
                    ${montoNeto.toLocaleString('es-AR')} → ${(montoNeto + ivaMonto).toLocaleString('es-AR')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div><Lbl>Comisión feria $ (si aplica)</Lbl><input type="number" value={f.comision || ''} placeholder="opcional" onChange={e => set({ comision: e.target.value })} style={{...inp, fontFamily: 'monospace'}} /></div>
                <div><Lbl>DTE $ (si aplica)</Lbl><input type="number" value={f.dte || ''} placeholder="opcional" onChange={e => set({ dte: e.target.value })} style={{...inp, fontFamily: 'monospace'}} /></div>
                <div>
                  <Lbl c={S.purple}>Total esta factura</Lbl>
                  <div style={{ padding: '8px 10px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, background: S.purpleLight, color: S.purple, borderRadius: 6 }}>
                    ${totalFactura.toLocaleString('es-AR')}
                  </div>
                </div>
              </div>

              <div style={{ paddingLeft: 8, borderLeft: `2px solid ${S.amber}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: S.amber, textTransform: 'uppercase' }}>Fechas de pago</div>
                  <div style={{ fontSize: 11, color: Math.abs(totalVencs - totalFactura) > 1 ? S.red : S.green, fontWeight: 600 }}>
                    {totalVencs.toLocaleString('es-AR')} / {totalFactura.toLocaleString('es-AR')} {Math.abs(totalVencs - totalFactura) <= 1 && totalVencs > 0 ? '✓' : ''}
                  </div>
                </div>
                {(f.vencimientos || []).map((v, vi) => (
                  <div key={vi} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'flex-end', marginBottom: 6 }}>
                    <div>
                      {vi === 0 && <div style={{ fontSize: 10, color: S.muted, marginBottom: 3 }}>Fecha</div>}
                      <input type="date" value={v.fecha || ''}
                        onChange={e => { const vs = f.vencimientos.map((x,j) => j===vi ? {...x, fecha: e.target.value} : x); set({ vencimientos: vs }) }}
                        style={{...inp, border: `1px solid ${v.pagado ? '#97C459' : S.amber}`, background: v.pagado ? S.greenLight : S.surface}} />
                    </div>
                    <div>
                      {vi === 0 && <div style={{ fontSize: 10, color: S.muted, marginBottom: 3 }}>Monto $ (con IVA)</div>}
                      <input type="number" value={v.monto || ''} placeholder="0"
                        onChange={e => { const vs = f.vencimientos.map((x,j) => j===vi ? {...x, monto: e.target.value} : x); set({ vencimientos: vs }) }}
                        style={{...inp, fontFamily: 'monospace', border: `1px solid ${v.pagado ? '#97C459' : S.accent}`, background: v.pagado ? S.greenLight : S.surface}} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: v.pagado ? S.green : S.muted, cursor: 'pointer', whiteSpace: 'nowrap', marginTop: vi === 0 ? 18 : 0, paddingBottom: 8 }}>
                      <input type="checkbox" checked={v.pagado || false}
                        onChange={e => { const vs = f.vencimientos.map((x,j) => j===vi ? {...x, pagado: e.target.checked} : x); set({ vencimientos: vs }) }} />
                      {v.pagado ? '✓ Pagado' : 'Pagado'}
                    </label>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                      <button onClick={() => set({ vencimientos: [...f.vencimientos, { fecha: '', monto: '', pagado: false }] })}
                        style={{ padding: '7px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 4, cursor: 'pointer', marginTop: vi === 0 ? 18 : 0 }}>+</button>
                      {(f.vencimientos || []).length > 1 && (
                        <button onClick={() => set({ vencimientos: f.vencimientos.filter((_,j) => j !== vi) })}
                          style={{ padding: '7px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 4, cursor: 'pointer', marginTop: vi === 0 ? 18 : 0 }}>✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {facturas.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 7, padding: '10px 12px', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: S.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Total operación (Ingresos)</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{totalOperacion ? `$${totalOperacion.toLocaleString('es-AR')}` : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: S.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Total facturado (todas)</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>${totalFacturadoTodo.toLocaleString('es-AR')}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: paralelo > 0 ? S.purple : S.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Paralelo</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: paralelo > 0 ? S.purple : S.hint, background: paralelo > 0 ? '#F3E8FF' : 'transparent', padding: '2px 6px', borderRadius: 4 }}>
                {totalOperacion > 0 ? `$${paralelo.toLocaleString('es-AR')}` : '—'}
              </div>
            </div>
          </div>
        )}

        <div>
          <Lbl>Observaciones</Lbl>
          <input type="text" value={formFactura.observaciones_pago || ''} onChange={e => setFormFactura({...formFactura, observaciones_pago: e.target.value})} style={{...inp, marginBottom: 10}} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => guardarFactura(l)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
          <button onClick={() => setEditandoFactura(null)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    )
  }

  async function registrarPago(lote) {
    const totalPagos = formPago.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    if (!totalPagos) { alert('Ingresá el monto'); return }
    setGuardando(true)

    const totalLote = totalLoteCalc(lote)
    const pagosActuales = pagosMap[lote.id] || []

    for (const pago of formPago.pagos) {
      const monto = parseFloat(pago.monto) || 0
      if (!monto) continue
      const formaPago = pago.tipo
      let desc = `Pago compra ${lote.procedencia || ''} C-${corrales.find(c => c.id === lote.corral_cuarentena_id)?.numero || lote.corral_cuarentena_id}`
      if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
        const detalleCheques = pago.cheque_tercero_ids.map(chId => {
          const ch = chequesCartera.find(c => String(c.id) === chId)
          return ch ? `#${ch.numero || 's/n'} ${ch.banco || ''} vto.${ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : '—'}` : null
        }).filter(Boolean).join(', ')
        desc += ` — Entregado a ${lote.procedencia || 'proveedor'}: cheque(s) ${detalleCheques}`
      }

      // Armar detalle de cheques tercero para el recibo
      let cheque_tercero_detalle = null
      if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
        cheque_tercero_detalle = pago.cheque_tercero_ids.map(chId => {
          const ch = chequesCartera.find(c => String(c.id) === chId)
          return ch ? { id: ch.id, numero: ch.numero, banco: ch.banco, monto: ch.monto, fecha_vencimiento: ch.fecha_vencimiento } : null
        }).filter(Boolean)
      }

      const { data: pagoInsertado } = await supabase.from('pagos_compras').insert({
        lote_id: lote.id, fecha: formPago.fecha, monto,
        forma_pago: formaPago,
        subtipo_cheque: pago.subtipo_cheque || null,
        cuota_idx: formPago.cuota_idx ?? null,
        numero_cheque: pago.subtipo_cheque === 'propio' ? pago.cheque_propio.numero || null : null,
        banco: pago.subtipo_cheque === 'propio' ? pago.cheque_propio.banco || null : null,
        fecha_vencimiento_cheque: pago.subtipo_cheque === 'propio' ? pago.cheque_propio.fecha_vencimiento || null : null,
        cheque_propio: pago.subtipo_cheque === 'propio' ? pago.cheque_propio : null,
        cheque_tercero_detalle,
        es_negro: pago.es_paralela || false,
        descripcion: desc,
      }).select().single()

      let pagoCajaId = null
      if (pago.es_paralela) {
        const { data: cp } = await supabase.from('caja_paralela').insert({ fecha: formPago.fecha, tipo: 'egreso', descripcion: desc, monto, pago_compra_id: pagoInsertado?.id }).select().single()
        pagoCajaId = cp?.id || null
      } else {
        const { data: co } = await supabase.from('caja_oficial').insert({ fecha: formPago.fecha, tipo: 'egreso', categoria: 'Pago compra hacienda', descripcion: desc, monto, forma_pago: formaPago, pago_compra_id: pagoInsertado?.id }).select().single()
        pagoCajaId = co?.id || null
      }

      if (pago.subtipo_cheque === 'propio' && pago.cheque_propio.fecha_vencimiento) {
        await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, monto, fecha_cobro: formPago.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, beneficiario: lote.procedencia || null, estado: 'en_cartera', es_paralelo: pago.es_paralela || false, es_electronico: pago.tipo === 'e-cheq', caja_oficial_id: pagoCajaId, pago_compra_id: pagoInsertado?.id })
      } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
        for (const chId of pago.cheque_tercero_ids) {
          await supabase.from('cheques').update({ estado: 'entregado', beneficiario: lote.procedencia || null }).eq('id', parseInt(chId))
        }
      }
    }

    const totalPagado = pagosActuales.reduce((s, p) => s + (p.monto || 0), 0) + totalPagos
    const nuevoEstado = totalLote && totalPagado > 0 && totalPagado >= totalLote * 0.99 ? 'pagado' : 'pendiente'

    // Marcar vencimientos seleccionados como pagados en cuotas_pago
    const selKeys = formPago.vencimientos_sel || []
    if (selKeys.length > 0 && lote.cuotas_pago?.length > 0) {
      const nuevasCuotas = lote.cuotas_pago.map((factura, fi) => ({
        ...factura,
        vencimientos: (factura.vencimientos || [{ fecha: factura.fecha, monto: factura.monto, pagado: false }]).map((v, vi) => ({
          ...v,
          pagado: v.pagado || selKeys.includes(`${fi}-${vi}`)
        }))
      }))
      await supabase.from('lotes').update({ estado_pago: nuevoEstado, cuotas_pago: nuevasCuotas }).eq('id', lote.id)
    } else {
      await supabase.from('lotes').update({ estado_pago: nuevoEstado }).eq('id', lote.id)
    }

    setRegistrandoPago(null)
    setFormPago({ fecha: new Date().toISOString().split('T')[0], vencimientos_sel: [], pagos: [{...PAGO_INIT}] })
    setGuardando(false)
    await cargarDatos()
    await cargarPagos()
  }

  async function eliminarPago(p, l, pagos, total) {
    if (!confirm('¿Eliminar este pago? Se eliminará de la caja y se revertirán los cheques usados.')) return
    const { data: chAsoc } = await supabase.from('cheques').select('id').eq('pago_compra_id', p.id).eq('tipo', 'emitido').maybeSingle()
    if (chAsoc) await supabase.from('cheques').delete().eq('id', chAsoc.id)
    if (p.descripcion && p.descripcion.includes('Entregado a')) {
      const matchNums = [...p.descripcion.matchAll(/#(\S+)/g)].map(m => m[1]).filter(n => n !== 's/n')
      for (const num of matchNums) {
        await supabase.from('cheques').update({ estado: 'en_cartera', beneficiario: null }).eq('numero', num).eq('estado', 'entregado')
      }
    }
    await supabase.from('caja_oficial').delete().eq('pago_compra_id', p.id)
    await supabase.from('caja_paralela').delete().eq('pago_compra_id', p.id)
    await supabase.from('pagos_compras').delete().eq('id', p.id)
    const pagosRest = pagos.filter(pp => pp.id !== p.id)
    const totalPagadoRest = pagosRest.reduce((s, pp) => s + (pp.monto || 0), 0)
    const nuevoEstado = total && totalPagadoRest > 0 && totalPagadoRest >= total * 0.99 ? 'pagado' : 'pendiente'
    await supabase.from('lotes').update({ estado_pago: nuevoEstado }).eq('id', l.id)
    await cargarDatos()
    await cargarPagos()
  }

  const hoy40 = new Date(Date.now() - 40 * 86400000)
  const lotesActivos = lotes.filter(l => !(l.estado_pago === 'pagado' && l.created_at && new Date(l.created_at) < hoy40))
  const lotesArchivados = lotes.filter(l => l.estado_pago === 'pagado' && l.created_at && new Date(l.created_at) < hoy40)
  const archFiltrados = lotesArchivados.filter(l => {
    if (filtroArchivadas.proveedor && !((l.procedencia || '').toLowerCase().includes(filtroArchivadas.proveedor.toLowerCase()))) return false
    if (filtroArchivadas.desde && (l.fecha_ingreso || '') < filtroArchivadas.desde) return false
    if (filtroArchivadas.hasta && (l.fecha_ingreso || '') > filtroArchivadas.hasta) return false
    return true
  })

  const ESTADOS = { pendiente: { bg: S.amberLight, color: S.amber, label: 'Pendiente' }, precio_cargado: { bg: S.accentLight, color: S.accent, label: 'Precio cargado' }, facturado: { bg: S.purpleLight, color: S.purple, label: 'Facturado' }, pagado: { bg: S.greenLight, color: S.green, label: 'Pagado' } }

  function estadoDeLote(l, total, totalPagado) {
    if (l.estado_pago === 'pagado') return 'pagado'
    if (l.numero_factura || l.monto_facturado != null) return 'facturado'
    if (l.precio_compra || l.monto_total_con_iva) return 'precio_cargado'
    return 'pendiente'
  }

  return (
    <div>
      {/* Vencimientos próximos — filtra por vencimientos individuales no pagados */}
      {(() => {
        const hoy7 = new Date(Date.now() + 7 * 86400000)
        const vencProximos = lotesActivos.flatMap(l => {
          if (l.estado_pago === 'pagado') return []
          if (l.cuotas_pago?.length > 0) {
            return l.cuotas_pago.flatMap(f =>
              (f.vencimientos || [{ fecha: f.fecha, monto: f.monto, pagado: false }])
                .filter(v => !v.pagado && v.fecha && new Date(v.fecha + 'T12:00:00') <= hoy7)
                .map(v => ({ lote: l, fecha: v.fecha, monto: v.monto, nro: f.nro_factura }))
            )
          }
          if (l.fecha_vencimiento_pago && new Date(l.fecha_vencimiento_pago + 'T12:00:00') <= hoy7) {
            return [{ lote: l, fecha: l.fecha_vencimiento_pago, monto: null, nro: null }]
          }
          return []
        })
        if (vencProximos.length === 0) return null
        return (
          <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.red, marginBottom: 6 }}>⚠ Vencimientos pendientes en los próximos 7 días</div>
            {vencProximos.map((v, i) => {
              const corralNum = corrales.find(c => c.id === v.lote.corral_cuarentena_id)?.numero || v.lote.corral_cuarentena_id
              return (
                <div key={i} style={{ fontSize: 12, color: S.red, marginBottom: 2 }}>
                  C-{corralNum} · {v.lote.procedencia || 'Sin proveedor'}
                  {v.nro ? ` · Fact. ${v.nro}` : ''}
                  {v.monto ? ` · $${parseFloat(v.monto).toLocaleString('es-AR')}` : ''}
                  {' · vence '}{new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-AR')}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Pendientes de factura — precio ya cargado por Jesús/dueño, pero Paula todavía no cargó la factura de la feria */}
      {(() => {
        const pendientesFactura = lotesActivos.filter(l => estadoDeLote(l, 0, 0) === 'precio_cargado')
        if (pendientesFactura.length === 0) return null
        return (
          <div style={{ background: S.amberLight, border: '1px solid #D4A054', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: 6 }}>📋 {pendientesFactura.length} lote{pendientesFactura.length !== 1 ? 's' : ''} con precio cargado, esperando la factura de la feria</div>
            {pendientesFactura.map(l => {
              const corralNum = corrales.find(c => c.id === l.corral_cuarentena_id)?.numero || l.corral_cuarentena_id
              const monto = l.monto_total_con_iva || l.precio_compra
              return (
                <div key={l.id} style={{ fontSize: 12, color: S.amber, marginBottom: 2 }}>
                  C-{corralNum} · {l.procedencia || 'Sin proveedor'}{monto ? ` · $${monto.toLocaleString('es-AR')}` : ''}
                  {l.fecha_ingreso ? ` · ingresó ${new Date(l.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-AR')}` : ''}
                </div>
              )
            })}
          </div>
        )
      })()}


      <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
          <thead><tr style={{ background: S.bg }}>
            {['Fecha','Corral','Proveedor','Total','Facturado','Negro','IVA','Vence','Estado','Editar','Pago'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {lotesActivos.length === 0 && <tr><td colSpan={11} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay ingresos.</td></tr>}
            {lotesActivos.map(l => {
              const pagos = pagosMap[l.id] || []
              const total = totalLoteCalc(l)
              const totalPagado = pagos.reduce((s, p) => s + (p.monto || 0), 0)
              const saldo = total ? total - totalPagado : null
              const isReg = registrandoPago === l.id
              const isEditFactura = editandoFactura === l.id
              const estKey = estadoDeLote(l, total, totalPagado)
              const ec = ESTADOS[estKey]
              const venceProx = l.fecha_vencimiento_pago && l.estado_pago !== 'pagado' && new Date(l.fecha_vencimiento_pago) <= new Date(Date.now() + 7 * 86400000)
              const corralNum = corrales.find(c => c.id === l.corral_cuarentena_id)?.numero || l.corral_cuarentena_id

              return (
                <React.Fragment key={l.id}>
                  <tr style={{ borderBottom: `1px solid ${S.border}`, background: venceProx ? '#FFF5F5' : 'transparent' }}>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11 }}>{l.fecha_ingreso ? new Date(l.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 600 }}>C-{corralNum}</td>
                    <td style={{ padding: '7px 10px' }}>{l.procedencia || '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>{total > 0 ? '-$' + total.toLocaleString('es-AR') : '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: S.green }}>{l.monto_facturado != null ? '$' + l.monto_facturado.toLocaleString('es-AR') : '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: S.purple }}>{l.monto_negro > 0 ? '$' + l.monto_negro.toLocaleString('es-AR') : '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11 }}>{l.iva_monto ? '$' + l.iva_monto.toLocaleString('es-AR') : '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11, fontWeight: venceProx ? 700 : 400, color: venceProx ? S.red : S.text }}>
                      {l.fecha_vencimiento_pago ? new Date(l.fecha_vencimiento_pago + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, border: `1px solid ${ec.color}`, borderRadius: 5, background: ec.bg, color: ec.color }}>{ec.label}</span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <button onClick={() => { setEditandoFactura(l.id); setFormFactura({ fecha_factura: l.fecha_factura || '', observaciones_pago: l.observaciones_pago || '', facturas: normalizarFacturas(l) }) }}
                        style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ✏️ Editar
                      </button>
                    </td>
                    <td style={{ padding: '7px 10px', minWidth: 180 }}>
                      <button onClick={() => setPagosExpandidos(prev => ({...prev, [l.id]: !prev[l.id]}))}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: 'pointer', border: `1px solid ${saldo > 0 ? '#F09595' : S.green}`, background: saldo > 0 ? S.redLight : S.greenLight, color: saldo > 0 ? S.red : S.green }}>
                        {saldo > 0 ? `Saldo $${Math.round(saldo).toLocaleString('es-AR')}` : pagos.length > 0 ? '✓ Pagado' : '— Sin pagos —'}
                        <span style={{ fontSize: 9 }}>{pagosExpandidos[l.id] ? '▲' : '▼'}</span>
                      </button>
                    </td>
                  </tr>

                  {pagosExpandidos[l.id] && (
                    <tr style={{ background: S.bg }}>
                      <td colSpan={11} style={{ padding: 0, borderBottom: `1px solid ${S.border}` }}>
                        <div style={{ padding: '1.25rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: l.cuotas_pago?.length > 0 ? '1fr 1fr' : '1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                            {l.cuotas_pago?.length > 0 && (
                              <div>
                                <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Facturas y vencimientos</div>
                                {l.cuotas_pago.map((factura, fi) => {
                                  const vencimientos = factura.vencimientos || (factura.fecha ? [{ fecha: factura.fecha, monto: factura.monto, pagado: false }] : [])
                                  return (
                                    <div key={fi} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 7, padding: '8px 10px', marginBottom: 6 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: S.accent, fontFamily: 'monospace' }}>
                                        {factura.nro_factura || `Factura ${fi + 1}`}
                                        <span style={{ fontFamily: 'sans-serif', fontWeight: 400, color: S.muted, marginLeft: 8 }}>
                                          Total: ${vencimientos.reduce((s, v) => s + (parseFloat(v.monto) || 0), 0).toLocaleString('es-AR')}
                                        </span>
                                      </div>
                                      {vencimientos.map((v, vi) => {
                                        const vencida = v.fecha && new Date(v.fecha + 'T12:00:00') < new Date() && !v.pagado
                                        return (
                                          <div key={vi} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: 5, marginBottom: 3, background: v.pagado ? S.greenLight : S.bg, border: `1px solid ${v.pagado ? '#97C459' : vencida ? '#F09595' : S.border}` }}>
                                            <span style={{ fontSize: 12, color: v.pagado ? S.green : vencida ? S.red : S.muted }}>
                                              {v.pagado ? '✓ ' : vencida ? '⚠ ' : '○ '}
                                              {v.fecha ? new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                                            </span>
                                            <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: v.pagado ? S.green : S.text }}>
                                              ${(parseFloat(v.monto) || 0).toLocaleString('es-AR')}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Pagos realizados</div>
                              {pagos.length === 0 && <div style={{ fontSize: 13, color: S.hint }}>Sin pagos registrados.</div>}
                              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, overflow: 'hidden' }}>
                                {pagos.map((p, pi) => (
                                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderBottom: pi < pagos.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                                    <span style={{ fontSize: 13 }}>{p.forma_pago}{p.numero_cheque ? ` #${p.numero_cheque}` : ''}{p.es_negro ? ' · paralelo' : ''}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <span style={{ fontSize: 13, fontFamily: 'monospace' }}>${p.monto?.toLocaleString('es-AR')}</span>
                                      <button onClick={() => eliminarPago(p, l, pagos, total)} style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {pagos.length > 0 && (
                              <button onClick={() => generarReciboCompra(l, pagos, corrales)}
                                style={{ padding: '7px 14px', fontSize: 12, background: S.surface, border: `1px solid ${S.border}`, color: S.text, borderRadius: 6, cursor: 'pointer' }}>🖨️ Recibo</button>
                            )}
                            {!isReg && l.precio_compra && (
                              <button onClick={() => { setRegistrandoPago(l.id); setFormPago({ fecha: new Date().toISOString().split('T')[0], cuota_idx: null, vencimientos_sel: [], pagos: [{...PAGO_INIT, monto: saldo > 0 ? String(Math.round(saldo)) : ''}] }) }}
                                style={{ flex: 1, padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.greenLight, border: `1px solid ${S.green}`, color: S.green, borderRadius: 6, cursor: 'pointer' }}>+ Registrar pago</button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {isEditFactura && (
                    <tr style={{ background: S.accentLight }}>
                      <td colSpan={11} style={{ padding: '1.25rem' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, textTransform: 'uppercase', marginBottom: 12 }}>Gestión comercial — C-{corralNum}</div>
                        {renderFormFactura(l)}
                      </td>
                    </tr>
                  )}

                  {isReg && (
                    <tr style={{ background: S.bg }}>
                      <td colSpan={11} style={{ padding: '12px 16px', borderBottom: `1px solid ${S.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: S.green }}>Nuevo pago</div>
                          <button onClick={() => setFormPago({...formPago, pagos: [...formPago.pagos, {...PAGO_INIT}]})}
                            style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${S.green}`, color: S.green, borderRadius: 5, cursor: 'pointer' }}>+ Agregar forma de pago</button>
                        </div>

                        {/* Selección de vencimientos a pagar */}
                        {l.cuotas_pago?.length > 0 && (() => {
                          const vencsSinPagar = l.cuotas_pago.flatMap((factura, fi) =>
                            (factura.vencimientos || [factura]).filter(v => !v.pagado && v.monto).map((v, vi) => ({
                              key: `${fi}-${vi}`, fi, vi,
                              nro: factura.nro_factura || `Factura ${fi + 1}`,
                              fecha: v.fecha, monto: parseFloat(v.monto) || 0,
                            }))
                          )
                          if (vencsSinPagar.length === 0) return null
                          const sel = formPago.vencimientos_sel || []
                          const totalSel = vencsSinPagar.filter(v => sel.includes(v.key)).reduce((s, v) => s + v.monto, 0)
                          return (
                            <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 7, padding: '10px', marginBottom: 10 }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Vencimientos a pagar (opcional)</div>
                              {vencsSinPagar.map(v => (
                                <label key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 5, marginBottom: 4, cursor: 'pointer', background: sel.includes(v.key) ? S.greenLight : S.surface, border: `1px solid ${sel.includes(v.key) ? '#97C459' : S.border}` }}>
                                  <input type="checkbox" checked={sel.includes(v.key)} onChange={() => {
                                    const nuevos = sel.includes(v.key) ? sel.filter(k => k !== v.key) : [...sel, v.key]
                                    const nuevoTotal = vencsSinPagar.filter(x => nuevos.includes(x.key)).reduce((s, x) => s + x.monto, 0)
                                    setFormPago({...formPago, vencimientos_sel: nuevos, pagos: formPago.pagos.map((p, i) => i === 0 ? {...p, monto: nuevoTotal > 0 ? String(nuevoTotal) : p.monto} : p)})
                                  }} />
                                  <span style={{ fontSize: 12, color: S.muted }}>{v.nro}</span>
                                  <span style={{ fontSize: 12 }}>{v.fecha ? new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                                  <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, marginLeft: 'auto' }}>${v.monto.toLocaleString('es-AR')}</span>
                                </label>
                              ))}
                              {sel.length > 0 && (
                                <div style={{ fontSize: 12, color: S.green, fontWeight: 600, marginTop: 6 }}>
                                  Total seleccionado: ${totalSel.toLocaleString('es-AR')}
                                </div>
                              )}
                            </div>
                          )
                        })()}
                        <div style={{ marginBottom: 10 }}>
                          <Lbl>Fecha</Lbl>
                          <input type="date" value={formPago.fecha} onChange={e => setFormPago({...formPago, fecha: e.target.value})} style={{ ...inp, maxWidth: 180 }} />
                        </div>
                        {l.cuotas_pago?.length > 0 && (() => {
                          const pagosPorCuota = {}
                          pagos.forEach(p => { if (p.cuota_idx != null) pagosPorCuota[p.cuota_idx] = (pagosPorCuota[p.cuota_idx] || 0) + (p.monto || 0) })
                          return (
                            <div style={{ marginBottom: 10 }}>
                              <Lbl>Corresponde a la cuota</Lbl>
                              <select value={formPago.cuota_idx ?? ''} onChange={e => {
                                const idx = e.target.value === '' ? null : parseInt(e.target.value)
                                const saldoCuota = idx != null ? (l.cuotas_pago[idx].monto || 0) - (pagosPorCuota[idx] || 0) : null
                                const nuevosPagos = formPago.pagos.map((p, i) => i === 0 ? {...p, monto: saldoCuota != null ? String(Math.round(saldoCuota)) : p.monto} : p)
                                setFormPago({...formPago, cuota_idx: idx, pagos: nuevosPagos})
                              }} style={inp}>
                                <option value="">— Sin asociar a cuota —</option>
                                {l.cuotas_pago.map((c, ci) => {
                                  const saldoCuota = (c.monto || 0) - (pagosPorCuota[ci] || 0)
                                  return (
                                    <option key={ci} value={ci} disabled={saldoCuota <= 0}>
                                      {c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'} — ${c.monto?.toLocaleString('es-AR')} {saldoCuota <= 0 ? '(pagada)' : `(saldo $${saldoCuota.toLocaleString('es-AR')})`}
                                    </option>
                                  )
                                })}
                              </select>
                            </div>
                          )
                        })()}
                        {formPago.pagos.map((pago, idx) => (
                          <div key={idx} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 7, padding: '10px', marginBottom: 8 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'flex-end', marginBottom: (pago.tipo === 'e-cheq' || pago.tipo === 'cheque') ? 8 : 0 }}>
                              <div><Lbl>Forma de pago</Lbl>
                                <select value={pago.tipo} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, tipo: e.target.value, subtipo_cheque: ''} : p); setFormPago({...formPago, pagos: n}) }} style={inp}>
                                  <option value="transferencia">Transferencia</option>
                                  <option value="efectivo">Efectivo</option>
                                  <option value="cheque">Cheque</option>
                                  <option value="e-cheq">E-cheq</option>
                                  <option value="cuenta_corriente">Cuenta corriente</option>
                                </select>
                              </div>
                              <div><Lbl>Monto $</Lbl>
                                <input type="number" value={pago.monto} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, monto: e.target.value} : p); setFormPago({...formPago, pagos: n}) }} style={{...inp, fontFamily: 'monospace'}} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: S.purple, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  <input type="checkbox" checked={pago.es_paralela} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, es_paralela: e.target.checked} : p); setFormPago({...formPago, pagos: n}) }} />
                                  Caja 2
                                </label>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                                {formPago.pagos.length > 1 && <button onClick={() => setFormPago({...formPago, pagos: formPago.pagos.filter((_,i) => i!==idx)})} style={{ padding: '5px 8px', fontSize: 10, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 4, cursor: 'pointer' }}>✕</button>}
                              </div>
                            </div>
                            {(pago.tipo === 'e-cheq' || pago.tipo === 'cheque') && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: S.hint, textTransform: 'uppercase', marginBottom: 6 }}>
                                  {pago.tipo === 'e-cheq' ? '💻 E-cheq' : '📄 Cheque'}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginBottom: pago.subtipo_cheque ? 8 : 0 }}>
                                  {(pago.es_paralela ? ['tercero'] : ['propio', 'tercero']).map(t => (
                                    <button key={t} onClick={() => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, subtipo_cheque: p.subtipo_cheque===t?'':t} : p); setFormPago({...formPago, pagos: n}) }}
                                      style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${pago.subtipo_cheque===t ? S.accent : S.border}`, background: pago.subtipo_cheque===t ? S.accentLight : 'transparent', color: pago.subtipo_cheque===t ? S.accent : S.muted }}>
                                      {t === 'propio' ? '📤 Propio' : '📥 Tercero'}
                                    </button>
                                  ))}
                                </div>
                                {pago.subtipo_cheque === 'propio' && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                                    <div><Lbl>N° cheque</Lbl><input type="text" value={pago.cheque_propio.numero} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, numero: e.target.value}} : p); setFormPago({...formPago, pagos: n}) }} style={inp} /></div>
                                    <div><Lbl>Banco</Lbl><input type="text" value={pago.cheque_propio.banco} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, banco: e.target.value}} : p); setFormPago({...formPago, pagos: n}) }} style={inp} /></div>
                                    <div><Lbl>Vencimiento *</Lbl><input type="date" value={pago.cheque_propio.fecha_vencimiento} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, fecha_vencimiento: e.target.value}} : p); setFormPago({...formPago, pagos: n}) }} style={{ ...inp, borderColor: S.amber }} /></div>
                                  </div>
                                )}
                                {pago.subtipo_cheque === 'tercero' && (
                                  <div style={{ marginTop: 8 }}>
                                    {(() => {
                                      const lista = chequesCartera.filter(ch => (pago.es_paralela ? ch.es_paralelo : !ch.es_paralelo) && (ch.es_electronico === (pago.tipo === 'e-cheq') || ch.es_electronico == null))
                                      return lista.length === 0
                                        ? <div style={{ fontSize: 13, color: S.hint }}>No hay cheques en cartera.</div>
                                        : lista.map(ch => (
                                          <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', border: `1px solid ${pago.cheque_tercero_ids?.includes(String(ch.id)) ? S.accent : S.border}`, borderRadius: 6, background: pago.cheque_tercero_ids?.includes(String(ch.id)) ? S.accentLight : S.surface, cursor: 'pointer', marginBottom: 5 }}>
                                            <input type="checkbox" checked={pago.cheque_tercero_ids?.includes(String(ch.id)) || false} onChange={() => {
                                              const actuales = pago.cheque_tercero_ids || []
                                              const yaEsta = actuales.includes(String(ch.id))
                                              const nuevosIds = yaEsta ? actuales.filter(id => id !== String(ch.id)) : [...actuales, String(ch.id)]
                                              const nuevoMonto = nuevosIds.reduce((s, id) => s + (chequesCartera.find(c => String(c.id) === id)?.monto || 0), 0)
                                              const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_tercero_ids: nuevosIds, monto: String(nuevoMonto || '')} : p)
                                              setFormPago({...formPago, pagos: n})
                                            }} />
                                            <div style={{ fontSize: 13 }}><strong>${ch.monto?.toLocaleString('es-AR')}</strong><span style={{ color: S.muted, marginLeft: 8 }}>#{ch.numero||'sin nro'} · {ch.banco||'—'} · vence {ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR') : '—'}</span></div>
                                          </label>
                                        ))
                                    })()}
                                    {pago.cheque_tercero_ids?.length > 0 && (
                                      <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, marginTop: 6, padding: '6px 10px', background: S.accentLight, borderRadius: 6 }}>
                                        {pago.cheque_tercero_ids.length} cheque{pago.cheque_tercero_ids.length !== 1 ? 's' : ''} seleccionado{pago.cheque_tercero_ids.length !== 1 ? 's' : ''} · Total: ${parseFloat(pago.monto || 0).toLocaleString('es-AR')}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {saldo > 0 && (() => {
                          const tp = formPago.pagos.reduce((s,p) => s+(parseFloat(p.monto)||0), 0)
                          return (
                            <div style={{ background: Math.abs(saldo-tp) < 0.5 ? S.greenLight : S.amberLight, border: `1px solid ${Math.abs(saldo-tp) < 0.5 ? '#97C459' : '#EF9F27'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>
                              Saldo: <strong>${Math.round(saldo).toLocaleString('es-AR')}</strong> · Pagos: <strong>${tp.toLocaleString('es-AR')}</strong>
                              {Math.abs(saldo-tp) >= 0.5 && <span style={{ marginLeft: 12, color: S.amber, fontWeight: 600 }}>Diferencia: ${Math.round(saldo-tp).toLocaleString('es-AR')}</span>}
                            </div>
                          )
                        })()}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => registrarPago(l)} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Registrar pago'}</button>
                          <button onClick={() => setRegistrandoPago(null)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
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

      {/* ARCHIVADAS */}
      {lotesArchivados.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <button onClick={() => setMostrarArchivadas(m => !m)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, cursor: 'pointer', color: S.muted, width: '100%' }}>
            <span>📁</span>
            <span>Archivadas ({lotesArchivados.length})</span>
            <span style={{ marginLeft: 'auto' }}>{mostrarArchivadas ? '▲' : '▼'}</span>
          </button>
          {mostrarArchivadas && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <input type="text" placeholder="Filtrar por proveedor..." value={filtroArchivadas.proveedor}
                  onChange={e => setFiltroArchivadas(f => ({...f, proveedor: e.target.value}))}
                  style={{ flex: 1, padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 12, background: S.surface }} />
                <input type="date" value={filtroArchivadas.desde} onChange={e => setFiltroArchivadas(f => ({...f, desde: e.target.value}))}
                  style={{ padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 12, background: S.surface }} />
                <input type="date" value={filtroArchivadas.hasta} onChange={e => setFiltroArchivadas(f => ({...f, hasta: e.target.value}))}
                  style={{ padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 12, background: S.surface }} />
                {(filtroArchivadas.proveedor || filtroArchivadas.desde || filtroArchivadas.hasta) && (
                  <button onClick={() => setFiltroArchivadas({ proveedor: '', desde: '', hasta: '' })}
                    style={{ padding: '7px 12px', fontSize: 12, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 6, cursor: 'pointer' }}>✕ Limpiar</button>
                )}
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {archFiltrados.length === 0
                  ? <div style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>Sin resultados</div>
                  : archFiltrados.map(l => {
                    const totalArch = totalLoteCalc(l)
                    return (
                      <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${S.border}` }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>C-{corrales.find(c => c.id === l.corral_cuarentena_id)?.numero || l.corral_cuarentena_id} · {l.procedencia || '—'}</div>
                          <div style={{ fontSize: 11, color: S.muted }}>{l.fecha_ingreso ? new Date(l.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-AR') : ''} · {l.cantidad} animales</div>
                        </div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: S.red, fontSize: 14 }}>
                          {totalArch > 0 ? `-$${totalArch.toLocaleString('es-AR')}` : '—'}
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 
