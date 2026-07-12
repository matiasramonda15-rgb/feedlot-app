// AppMovil v2
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { confirmarVacunacionIngreso, registrarTratamientoSanitario, cargarStockSanitario, yaVacunadoIngreso } from '../shared/sanidadLogic'
import { confirmarRacionesDia, agregarRolloExtra } from '../shared/alimentacionLogic'
import { moverAnimalesEntreCorrales } from '../shared/corralesLogic'
import { registrarIngresoLote } from '../shared/ingresosLogic'
import { registrarVenta } from '../shared/ventasLogic'
import { registrarServicioTercero } from '../shared/serviciosLogic'
import Corrales from '../components/Corrales'
import Ingresos from '../components/Ingresos'
import Ventas from '../components/Ventas'
import Pesada from '../components/Pesada'
import Alimentacion from '../components/Alimentacion'
import Sanidad from '../components/Sanidad'
import Servicios from '../components/Servicios'
import Agricultura from '../components/Agricultura'
import { confirmarPesadaClasificacion } from '../shared/pesadaLogic'
var C = {
  bg: '#1A2E1A', surface: '#243324', surface2: '#2E3F2E',
  border: '#3A4F3A', text: '#E8F0E8', muted: '#8FA88F',
  green: '#7EC87E', amber: '#F5C97A', red: '#F09595',
  blue: '#7EB8F7', mono: "'IBM Plex Mono', monospace", sans: "'IBM Plex Sans', sans-serif",
}
export default function AppMovil({ usuario, onLogout }) {
  const [pantalla, setPantalla] = useState('home')
  const [datos, setDatos] = useState({ corrales: [], proximaPesada: null, alertas: [] })
  const nav = (p) => setPantalla(p)
  const esEncargado = ['dueno', 'encargado'].includes(usuario?.rol)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const [{ data: corrales }, { data: cfg }, { data: alertas }, { data: lotes }, { data: ventas }, { data: stockBajo }, { data: movimientos }, { data: stockSan }] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('pesadas').select('fecha, creado_en').order('creado_en', { ascending: false }).limit(1).single(),
      supabase.from('alertas').select('*').eq('resuelta', false).order('fecha_vence'),
      supabase.from('lotes').select('id, codigo, procedencia, fecha_ingreso, corral_cuarentena_id, cantidad, vacunado_ingreso').order('created_at', { ascending: false }),
      supabase.from('ventas').select('id, comprador, precio_kg, kg_vivo_total, kg_neto, cantidad, corral_id, creado_en, corrales(numero)').is('precio_kg', null).order('creado_en', { ascending: false }),
      supabase.from('stock_insumos').select('*'),
      supabase.from('movimientos').select('corral_destino_id, fecha').order('fecha', { ascending: false }),
      cargarStockSanitario(supabase),
    ])
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
    const ayerStr = ayer.toISOString().split('T')[0]
    const [{ data: formulasDB }, { data: cfgMixer }, { data: racionesAyer }, { data: revisionesHoy }] = await Promise.all([
      supabase.from('formulas_mixer').select('*').order('orden'),
      supabase.from('configuracion').select('clave, valor').in('clave', ['capacidad_mixer_terminacion', 'capacidad_mixer_recria', 'capacidad_mixer_acostumbramiento', 'fecha_term_c']),
      supabase.from('raciones_app').select('corral_id, kg_total, fecha, creado_en').order('creado_en', { ascending: false }).limit(500),
      supabase.from('revisiones').select('id, creado_en').eq('tipo', 'bisemanal').order('creado_en', { ascending: false }).limit(1),
    ])
    // Construir formulas desde BD
    const formulasObj = {
      seco: { acostumbramiento: [], recria: [], terminacion: [] },
      humedo: { acostumbramiento: [], recria: [], terminacion: [] }
    }
    ;(formulasDB || []).forEach(row => {
      if (formulasObj[row.dieta] && formulasObj[row.dieta][row.etapa]) {
        formulasObj[row.dieta][row.etapa].push({ n: row.ingrediente, kg: row.kg, c: row.color || '#888' })
      }
    })
    const procedencias = [...new Set((lotes || []).map(x => x.procedencia).filter(Boolean))].sort()
    const compradores = [...new Set((ventas || []).filter(v => v.comprador).map(v => v.comprador))].sort()
    const corralesOrdenados = (corrales || []).sort((a, b) => parseInt(a.numero) - parseInt(b.numero))
    const capMixer = {
      acostumbramiento: parseInt((cfgMixer || []).find(c => c.clave === 'capacidad_mixer_acostumbramiento')?.valor || '2000'),
      recria: parseInt((cfgMixer || []).find(c => c.clave === 'capacidad_mixer_recria')?.valor || '2500'),
      terminacion: parseInt((cfgMixer || []).find(c => c.clave === 'capacidad_mixer_terminacion')?.valor || '4200'),
    }
    const fechaTermC = (cfgMixer || []).find(c => c.clave === 'fecha_term_c')?.valor || null
    // Usar el kg_total mas reciente por corral
    // Encontrar la fecha más reciente de raciones (puede ser hoy o ayer)
    const fechasRaciones = [...new Set((racionesAyer || []).map(r => r.fecha))].sort().reverse()
    const fechaUltimaRacion = fechasRaciones[0] || null
    const kgsAyer = {}
    let dietaAyer = 'seco'
    ;(racionesAyer || []).filter(r => r.fecha === fechaUltimaRacion).forEach(r => {
      if (kgsAyer[r.corral_id] === undefined) kgsAyer[r.corral_id] = r.kg_total ?? 0
      if (r.tipo_dieta) dietaAyer = r.tipo_dieta
    })
    // Calcular próxima pesada: última pesada + 40 días
    const ultimaPesadaFecha = cfg?.fecha || cfg?.creado_en?.split('T')[0]
    let proximaPesadaCalc = null
    if (ultimaPesadaFecha) {
      const d = new Date(ultimaPesadaFecha + 'T12:00:00')
      d.setDate(d.getDate() + 40)
      proximaPesadaCalc = d.toISOString().split('T')[0]
    }
    const hoyStr = new Date().toISOString().split('T')[0]
    const revisionHoyHecha = (revisionesHoy || []).some(r => (r.creado_en || '').split('T')[0] === hoyStr)
    setDatos({ corrales: corralesOrdenados, proximaPesada: proximaPesadaCalc, alertas: alertas || [], procedencias, compradores, ventasSinPrecio: ventas || [], stockBajo: (stockBajo || []).filter(s => (s.cantidad_kg || 0) <= (s.minimo_kg || 0) && (!s.pedido_realizado_hasta || s.pedido_realizado_hasta < hoyStr)), stockSanitario: (stockSan || []).filter(p => !p.pedido_realizado_hasta || p.pedido_realizado_hasta < hoyStr), formulas: formulasObj, capMixer, fechaTermC, kgsAyer, dietaAyer, lotes: lotes || [], movimientos: movimientos || [], revisionHoyHecha })
  }

  const pantallas = {
    home:        <Home usuario={usuario} nav={nav} onLogout={onLogout} datos={datos} onReload={cargarDatos} />,
    corrales:    <Corrales usuario={usuario} mobile={true} nav={nav} />,
    ingreso:     <Ingresos usuario={usuario} mobile={true} nav={nav} />,
    pesada:      <Pesada usuario={usuario} mobile={true} nav={nav} />,
    alimentacion:<Alimentacion usuario={usuario} mobile={true} nav={nav} />,
    sanidad:     <Sanidad usuario={usuario} mobile={true} nav={nav} />,
    venta:       <Ventas usuario={usuario} mobile={true} nav={nav} />,
    novedad:     <PlaceholderMovil titulo="Novedad / Movimiento" nav={nav} />,
    servicios:   <Servicios usuario={usuario} mobile={true} nav={nav} />,
    agricultura: <Agricultura usuario={usuario} mobile={true} nav={nav} />,
  }
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: C.sans, color: C.text, position: 'relative', overflow: 'hidden' }}>
      {pantallas[pantalla] || pantallas.home}
    </div>
  )
}
function Topbar({ titulo, sub, onBack, onLogout }) {
  return (
    <div style={{ background: C.surface, padding: '1rem', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
      {onBack && <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.green, fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{sub}</div>}
      </div>
      {onLogout && <button onClick={onLogout} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 11, padding: '4px 10px', cursor: 'pointer', fontFamily: C.sans }}>Salir</button>}
    </div>
  )
}
function Scroll({ children }) {
  return <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>{children}</div>
}
function Home({ usuario, nav, onLogout, datos }) {
  const { proximaPesada, alertas, corrales, stockBajo, stockSanitario } = datos
  const proximaDate = proximaPesada ? new Date(proximaPesada + 'T12:00:00') : null
  const diasPesada = proximaDate ? Math.ceil((proximaDate - new Date()) / (1000 * 60 * 60 * 24)) : null
  const totalAnimales = corrales.reduce((s, c) => s + (c.animales || 0), 0)
  const esSoloLectura = usuario?.rol === 'lectura'

  const tareas = []
  if (diasPesada !== null && diasPesada <= 7) {
    tareas.push({ icon: '⚖️', titulo: 'Pesada proxima', sub: `${proximaDate.toLocaleDateString('es-AR')} - en ${diasPesada} dias`, pantalla: 'pesada', urgente: true })
  }
  alertas.slice(0, 3).forEach(a => {
    tareas.push({ icon: '💉', titulo: a.titulo, sub: a.descripcion, pantalla: 'sanidad', urgente: true })
  })
  // Stock bajo mínimo — Alimentos
  if (stockBajo && stockBajo.length > 0) {
    stockBajo.forEach(s => {
      tareas.push({ icon: '📦', titulo: `Stock bajo: ${s.insumo}`, sub: `${s.cantidad_kg?.toLocaleString('es-AR')} kg · mínimo ${s.minimo_kg?.toLocaleString('es-AR')} kg · Avisar para reponer`, pantalla: 'alimentacion', tabDestino: 'stock', urgente: true, stockId: s.id, stockTabla: 'stock_insumos' })
    })
  }
  // Stock bajo mínimo — Sanitario
  if (stockSanitario && stockSanitario.length > 0) {
    stockSanitario.filter(p => p.activo !== false && (p.cantidad_ml || 0) <= (p.minimo_stock || 0) && p.minimo_stock > 0).forEach(p => {
      tareas.push({ icon: '💊', titulo: `Stock bajo: ${p.producto}`, sub: `${(p.cantidad_ml||0).toLocaleString('es-AR')} ${p.unidad||'ml'} · mínimo ${(p.minimo_stock||0).toLocaleString('es-AR')} ${p.unidad||'ml'} · Avisar para reponer`, pantalla: 'sanidad', tabDestino: 'stock', urgente: true, stockId: p.id, stockTabla: 'stock_sanitario' })
    })
  }

  // Corrales en cuarentena próximos a vencer (ingresados hace más de 8 días)
  const corralesCuarentena = corrales.filter(c => c.rol === 'cuarentena' && (c.animales || 0) > 0)
  corralesCuarentena.forEach(c => {
    // Usar fecha del último lote en ese corral (más reciente primero)
    const ultimoLote = (datos.lotes || []).find(l => l.corral_cuarentena_id === c.id)
    const ultimaFecha = ultimoLote?.fecha_ingreso || ((datos.movimientos || []).find(m => m.corral_destino_id === c.id)?.fecha?.split('T')[0]) || null
    const diasDesde = ultimaFecha
      ? (() => {
          const hoy = new Date()
          const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`
          const diff = new Date(hoyStr) - new Date(ultimaFecha)
          return Math.floor(diff / (1000 * 60 * 60 * 24))
        })()
      : null
    tareas.push({
      icon: '🐄',
      titulo: `Cuarentena C-${c.numero} — ${diasDesde !== null ? `${diasDesde} días` : 'fecha desconocida'}`,
      sub: `${c.animales || 0} animales · último ingreso ${ultimaFecha ? new Date(ultimaFecha + 'T12:00:00').toLocaleDateString('es-AR') : '?'}`,
      pantalla: 'sanidad',
      urgente: diasDesde === null || diasDesde >= 8
    })
  })

  // Revision bisemanal los lunes (1) y jueves (4) — pero no si ya se confirmó hoy
  const diaSemana = new Date().getDay()
  if ((diaSemana === 1 || diaSemana === 4) && !datos.revisionHoyHecha) {
    tareas.unshift({ icon: '🔍', titulo: 'Revision bisemanal de corrales', sub: 'Hoy corresponde revisar todos los corrales', pantalla: 'sanidad', tabDestino: 'revision', urgente: true })
  }

  if (tareas.length === 0) {
    tareas.push({ icon: '✅', titulo: 'Sin tareas urgentes', sub: 'Todo en orden', pantalla: 'sanidad', urgente: false })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Feedlot" sub={`Hola, ${usuario?.nombre || 'Empleado'} - ${totalAnimales} animales`} onLogout={onLogout} />
      <Scroll>
        {esSoloLectura && (
          <div style={{ background: '#1A3D6B', border: `1px solid #2E5FA3`, borderRadius: 10, padding: '.75rem .9rem', marginBottom: '.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>👁️</span>
            <span style={{ fontSize: 12, color: '#D6E4F5' }}>Modo solo lectura — podés ver todo, pero no se pueden guardar cambios.</span>
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.65rem' }}>Tareas del dia</div>
        {tareas.map((t, i) => (
          <div key={i}
            style={{ background: C.surface, border: `1px solid ${t.urgente ? C.amber : C.border}`, borderRadius: 12, padding: '.9rem', marginBottom: '.65rem', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div onClick={() => { 
                  if (t.tabDestino) { window.__sanidadTab = t.tabDestino; window.__alimentacionTab = t.tabDestino }
                  nav(t.pantalla) 
                }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: 'pointer' }}>
              <div style={{ fontSize: 24 }}>{t.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.titulo}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{t.sub}</div>
              </div>
            </div>
            {t.stockId ? (
              <button onClick={async (e) => {
                e.stopPropagation()
                const hasta = new Date(); hasta.setDate(hasta.getDate() + 4)
                await supabase.from(t.stockTabla).update({ pedido_realizado_hasta: hasta.toISOString().split('T')[0] }).eq('id', t.stockId)
                if (onReload) await onReload()
              }} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, background: C.greenLight || '#1A3D2E', border: `1px solid ${C.green}`, color: C.green, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ✓ Pedido hecho
              </button>
            ) : (
              <div onClick={() => nav(t.pantalla)} style={{ fontSize: 18, color: C.muted, cursor: 'pointer' }}>›</div>
            )}
          </div>
        ))}
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.07em', margin: '1rem 0 .65rem' }}>Acciones rapidas</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: '📍', label: 'Corrales', p: 'corrales' },
            { icon: '🐄', label: 'Nuevo ingreso', p: 'ingreso' },
            { icon: '⚖️', label: 'Pesada', p: 'pesada' },
            { icon: '🌾', label: 'Alimentacion', p: 'alimentacion' },
            { icon: '💊', label: 'Sanidad', p: 'sanidad' },
            { icon: '💰', label: 'Carga venta', p: 'venta' },
            ...(['matias_eu@hotmail.com','martin@campo.com','braian@campo.com','oscar@campo.com'].includes(usuario?.email) ? [{ icon: '🚜', label: 'Servicios', p: 'servicios' }] : []),
            ...(usuario?.rol === 'dueno' || usuario?.rol === 'lectura' ? [{ icon: '🌱', label: 'Agricultura', p: 'agricultura' }] : []),
          ].map((a, i) => (
            <div key={i} onClick={() => nav(a.p)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '.85rem', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{a.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{a.label}</div>
            </div>
          ))}
        </div>
      </Scroll>
    </div>
  )
}

function PlaceholderMovil({ titulo, nav }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo={titulo} onBack={() => nav('home')} />
      <Scroll>
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: C.muted, fontSize: 13 }}>
          Modulo en integracion.<br />Disponible pronto.
        </div>
      </Scroll>
    </div>
  )
}

