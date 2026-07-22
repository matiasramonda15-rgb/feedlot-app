import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './UI'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const ACTIVIDADES = ['Feedlot', 'Agricultura', 'Servicios']

function fmt(n) {
  if (n == null || n === 0) return ''
  return Math.round(n).toLocaleString('es-AR')
}

export default function Presupuesto({ usuario }) {
  const [actividad, setActividad] = useState('Feedlot')
  const [loading, setLoading] = useState(true)
  const [filasIngreso, setFilasIngreso] = useState({})  // { categoria: { 'YYYY-M': monto } }
  const [filasEgreso, setFilasEgreso] = useState({})
  const [proyecciones, setProyecciones] = useState({})  // clave `${tipo}|${categoria}|${anio}|${mes}` -> { monto, es_proyeccion }
  const [editando, setEditando] = useState(null)
  const [valorEditando, setValorEditando] = useState('')
  const [guardando, setGuardando] = useState(false)

  const hoy = new Date()
  const MESES_ATRAS = 6, MESES_ADELANTE = 12
  const meses = []
  for (let i = -MESES_ATRAS; i <= MESES_ADELANTE; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    meses.push({ anio: d.getFullYear(), mes: d.getMonth() + 1, key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, esFuturo: i > 0, esActual: i === 0 })
  }

  useEffect(() => { cargar() }, [actividad])

  async function cargar() {
    setLoading(true)
    const anioDesde = meses[0].anio, mesDesde = meses[0].mes
    const fechaDesde = `${anioDesde}-${String(mesDesde).padStart(2, '0')}-01`

    const ingresos = {}   // categoria -> { 'anio-mes': monto }
    const egresos = {}
    const suma = (obj, categoria, fecha, monto) => {
      if (!fecha || !monto) return
      const d = new Date(fecha + 'T12:00:00')
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`
      if (!obj[categoria]) obj[categoria] = {}
      obj[categoria][key] = (obj[categoria][key] || 0) + monto
    }

    if (actividad === 'Feedlot') {
      const [{ data: ventas }, { data: lotes }, { data: compras }, { data: pagosEmp }, { data: gastos }] = await Promise.all([
        supabase.from('ventas').select('total, creado_en, comprador').gte('creado_en', fechaDesde),
        supabase.from('lotes').select('monto_facturado, iva_monto, monto_negro, fecha_ingreso, procedencia').gte('fecha_ingreso', fechaDesde),
        supabase.from('compras_insumos').select('total, fecha, proveedor, insumo_tipo').gte('fecha', fechaDesde).in('insumo_tipo', ['alimentacion', 'sanitario']),
        supabase.from('pagos_empleados').select('monto, fecha, creado_en, empleados(nombre, actividad)').gte('fecha', fechaDesde),
        supabase.from('gastos_generales').select('monto, fecha, categoria, actividad').gte('fecha', fechaDesde).in('actividad', ['Feedlot', 'General']),
      ])
      ;(ventas || []).forEach(v => suma(ingresos, `Venta hacienda — ${v.comprador || 'sin comprador'}`, v.creado_en?.split('T')[0], v.total))
      ;(lotes || []).forEach(l => {
        const total = (l.monto_facturado || 0) + (l.iva_monto || 0) + (l.monto_negro || 0)
        suma(egresos, `Compra hacienda — ${l.procedencia || 'sin procedencia'}`, l.fecha_ingreso, total)
      })
      ;(compras || []).forEach(c => suma(egresos, `Insumos — ${c.proveedor || 'sin proveedor'}`, c.fecha, c.total))
      ;(pagosEmp || []).forEach(p => {
        const act = p.empleados?.actividad
        if (act !== 'Feedlot' && act !== 'General') return
        const monto = act === 'General' ? (p.monto || 0) / 3 : (p.monto || 0)
        suma(egresos, `Sueldo — ${p.empleados?.nombre || 'empleado'}`, p.fecha || p.creado_en?.split('T')[0], monto)
      })
      ;(gastos || []).forEach(g => {
        const monto = g.actividad === 'General' ? (g.monto || 0) / 3 : (g.monto || 0)
        suma(egresos, `Gastos generales — ${g.categoria || 'otro'}`, g.fecha, monto)
      })
    } else if (actividad === 'Agricultura') {
      const [{ data: ventasG }, { data: compras }, { data: ordenes }, { data: gastosAgro }, { data: pagosEmp }, { data: gastos }] = await Promise.all([
        supabase.from('ventas_granos').select('total, monto_negro, fecha, comprador, estado').gte('fecha', fechaDesde).neq('estado', 'pactada'),
        supabase.from('compras_insumos').select('total, fecha, proveedor').gte('fecha', fechaDesde).eq('insumo_tipo', 'agro'),
        supabase.from('ordenes_trabajo').select('costo_total, fecha, proveedor, tipo').gte('fecha', fechaDesde).eq('es_propia', false),
        supabase.from('gastos_generales').select('monto, fecha, categoria, actividad').gte('fecha', fechaDesde).eq('actividad', 'Agricultura'),
        supabase.from('pagos_empleados').select('monto, fecha, creado_en, empleados(nombre, actividad)').gte('fecha', fechaDesde),
        supabase.from('gastos_generales').select('monto, fecha, categoria, actividad').gte('fecha', fechaDesde).eq('actividad', 'General'),
      ])
      ;(ventasG || []).forEach(v => suma(ingresos, `Venta granos — ${v.comprador || 'sin comprador'}`, v.fecha, (v.total || 0) + (v.monto_negro || 0)))
      ;(compras || []).forEach(c => suma(egresos, `Insumos — ${c.proveedor || 'sin proveedor'}`, c.fecha, c.total))
      ;(ordenes || []).forEach(o => suma(egresos, `${o.tipo || 'Orden de trabajo'} — ${o.proveedor || 'sin proveedor'}`, o.fecha, o.costo_total))
      ;(gastosAgro || []).forEach(g => suma(egresos, `Gastos generales — ${g.categoria || 'otro'}`, g.fecha, g.monto))
      ;(pagosEmp || []).forEach(p => {
        const act = p.empleados?.actividad
        if (act !== 'Agricultura' && act !== 'General') return
        const monto = act === 'General' ? (p.monto || 0) / 3 : (p.monto || 0)
        suma(egresos, `Sueldo — ${p.empleados?.nombre || 'empleado'}`, p.fecha || p.creado_en?.split('T')[0], monto)
      })
      ;(gastos || []).forEach(g => suma(egresos, `Gastos generales — ${g.categoria || 'otro'}`, g.fecha, (g.monto || 0) / 3))
    } else if (actividad === 'Servicios') {
      const [{ data: servicios }, { data: pagosEmp }, { data: gastosServ }, { data: gastos }] = await Promise.all([
        supabase.from('servicios_terceros').select('total, monto_negro, fecha, creado_en, cliente, tipo_servicio, orden_trabajo_id, labor').gte('fecha', fechaDesde),
        supabase.from('pagos_empleados').select('monto, fecha, creado_en, empleados(nombre, actividad)').gte('fecha', fechaDesde),
        supabase.from('gastos_generales').select('monto, fecha, categoria, actividad').gte('fecha', fechaDesde).eq('actividad', 'Servicios'),
        supabase.from('gastos_generales').select('monto, fecha, categoria, actividad').gte('fecha', fechaDesde).eq('actividad', 'General'),
      ])
      ;(servicios || []).forEach(s => {
        if (s.tipo_servicio === 'propio' && !s.orden_trabajo_id) return
        suma(ingresos, `${s.labor || 'Servicio'} — ${s.cliente || 'sin cliente'}`, s.fecha || s.creado_en?.split('T')[0], (s.total || 0) + (s.monto_negro || 0))
      })
      ;(gastosServ || []).forEach(g => suma(egresos, `Gastos generales — ${g.categoria || 'otro'}`, g.fecha, g.monto))
      ;(pagosEmp || []).forEach(p => {
        const act = p.empleados?.actividad
        if (act !== 'Servicios' && act !== 'General') return
        const monto = act === 'General' ? (p.monto || 0) / 3 : (p.monto || 0)
        suma(egresos, `Sueldo — ${p.empleados?.nombre || 'empleado'}`, p.fecha || p.creado_en?.split('T')[0], monto)
      })
      ;(gastos || []).forEach(g => suma(egresos, `Gastos generales — ${g.categoria || 'otro'}`, g.fecha, (g.monto || 0) / 3))
    }

    // Proyecciones guardadas (meses futuros, y correcciones manuales de meses pasados)
    const { data: proy } = await supabase.from('presupuesto_lineas').select('*').eq('actividad', actividad).gte('anio', anioDesde)
    const proyMap = {}
    ;(proy || []).forEach(p => { proyMap[`${p.tipo}|${p.categoria}|${p.anio}|${p.mes}`] = p })

    setFilasIngreso(ingresos)
    setFilasEgreso(egresos)
    setProyecciones(proyMap)
    setLoading(false)
  }

  // Valor a mostrar en una celda: si hay una proyección/corrección guardada, esa gana;
  // si no, el dato real calculado de las tablas; si no hay nada, vacío.
  function valorCelda(tipo, categoria, m) {
    const clave = `${tipo}|${categoria}|${m.anio}|${m.mes}`
    if (proyecciones[clave]) return proyecciones[clave].monto
    const filas = tipo === 'ingreso' ? filasIngreso : filasEgreso
    return filas[categoria]?.[m.key] || 0
  }

  async function guardarCelda(tipo, categoria, m) {
    const monto = parseFloat(valorEditando) || 0
    setGuardando(true)
    const { error } = await supabase.from('presupuesto_lineas').upsert({
      actividad, tipo, categoria, anio: m.anio, mes: m.mes, monto, es_proyeccion: m.esFuturo,
    }, { onConflict: 'actividad,tipo,categoria,anio,mes' })
    if (error) { alert('Error al guardar: ' + error.message); setGuardando(false); return }
    setProyecciones({...proyecciones, [`${tipo}|${categoria}|${m.anio}|${m.mes}`]: { monto, es_proyeccion: m.esFuturo }})
    setEditando(null)
    setGuardando(false)
  }

  if (loading) return <Loader />

  const categoriasIngreso = Object.keys(filasIngreso).sort()
  const categoriasEgreso = Object.keys(filasEgreso).sort()
  // Totales por mes
  const totalIngresoMes = m => categoriasIngreso.reduce((s, c) => s + valorCelda('ingreso', c, m), 0)
  const totalEgresoMes = m => categoriasEgreso.reduce((s, c) => s + valorCelda('egreso', c, m), 0)
  let acumulado = 0

  const Fila = ({ tipo, categoria, color }) => (
    <tr style={{ borderBottom: `1px solid ${S.border}` }}>
      <td style={{ padding: '6px 12px', fontSize: 12, color: S.text, position: 'sticky', left: 0, background: S.surface, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{categoria}</td>
      {meses.map(m => {
        const clave = `${tipo}|${categoria}|${m.anio}|${m.mes}`
        const val = valorCelda(tipo, categoria, m)
        const esEdit = editando === clave
        const esCorregido = !!proyecciones[clave]
        return (
          <td key={m.key} onClick={() => { if (!esEdit) { setEditando(clave); setValorEditando(val ? String(Math.round(val)) : '') } }}
            style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, cursor: 'pointer', background: m.esActual ? '#FFFBEA' : esEdit ? S.accentLight : 'transparent', color: esCorregido ? S.amber : color, minWidth: 78 }}>
            {esEdit ? (
              <input autoFocus type="number" value={valorEditando} onChange={e => setValorEditando(e.target.value)}
                onBlur={() => guardarCelda(tipo, categoria, m)}
                onKeyDown={e => { if (e.key === 'Enter') guardarCelda(tipo, categoria, m); if (e.key === 'Escape') setEditando(null) }}
                style={{ width: 70, fontSize: 12, fontFamily: 'monospace', textAlign: 'right', border: `1px solid ${S.accent}`, borderRadius: 3, padding: '2px 4px' }} />
            ) : (fmt(val) || <span style={{ color: S.hint }}>—</span>)}
          </td>
        )
      })}
    </tr>
  )

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0 }}>Presupuesto</h1>
        <div style={{ fontSize: 13, color: S.muted, marginTop: 4 }}>
          Meses pasados: datos reales de la app (tocá una celda para corregirla a mano si hace falta). Meses futuros: cargá vos la proyección — se guarda sola.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        {ACTIVIDADES.map(a => (
          <button key={a} onClick={() => setActividad(a)}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: `1px solid ${actividad === a ? S.accent : S.border}`, background: actividad === a ? S.accent : S.surface, color: actividad === a ? '#fff' : S.muted, cursor: 'pointer' }}>
            {a}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: S.hint, marginBottom: 8 }}>
        <span style={{ color: S.amber, fontWeight: 600 }}>■</span> = corregido a mano · celda vacía = sin datos ese mes
      </div>

      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto', maxHeight: '75vh' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: S.bg, zIndex: 2 }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: S.muted, position: 'sticky', left: 0, background: S.bg, zIndex: 3 }}>{actividad}</th>
              {meses.map(m => (
                <th key={m.key} style={{ padding: '8px 8px', textAlign: 'right', fontSize: 11, color: m.esFuturo ? S.accent : S.muted, fontWeight: m.esActual ? 700 : 600, background: m.esActual ? '#FFFBEA' : S.bg }}>{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={meses.length + 1} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: S.green, textTransform: 'uppercase', letterSpacing: '.05em', background: S.greenLight, position: 'sticky', left: 0 }}>Ingresos</td></tr>
            {categoriasIngreso.map(c => <Fila key={c} tipo="ingreso" categoria={c} color={S.green} />)}
            {categoriasIngreso.length === 0 && <tr><td colSpan={meses.length + 1} style={{ padding: '10px 12px', fontSize: 12, color: S.hint }}>Sin datos de ingresos en este período.</td></tr>}

            <tr><td colSpan={meses.length + 1} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: S.red, textTransform: 'uppercase', letterSpacing: '.05em', background: S.redLight, position: 'sticky', left: 0 }}>Egresos</td></tr>
            {categoriasEgreso.map(c => <Fila key={c} tipo="egreso" categoria={c} color={S.red} />)}
            {categoriasEgreso.length === 0 && <tr><td colSpan={meses.length + 1} style={{ padding: '10px 12px', fontSize: 12, color: S.hint }}>Sin datos de egresos en este período.</td></tr>}

            <tr style={{ borderTop: `2px solid ${S.border}`, background: S.bg }}>
              <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, position: 'sticky', left: 0, background: S.bg }}>Balance del mes</td>
              {meses.map(m => {
                const bal = totalIngresoMes(m) - totalEgresoMes(m)
                return <td key={m.key} style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: bal >= 0 ? S.green : S.red, background: m.esActual ? '#FFFBEA' : S.bg }}>{fmt(bal)}</td>
              })}
            </tr>
            <tr style={{ background: S.accentLight }}>
              <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: S.accent, position: 'sticky', left: 0, background: S.accentLight }}>Acumulado</td>
              {meses.map(m => {
                acumulado += totalIngresoMes(m) - totalEgresoMes(m)
                return <td key={m.key} style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: acumulado >= 0 ? S.accent : S.red }}>{fmt(acumulado)}</td>
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
