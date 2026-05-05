import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Btn, Loader } from './Tablero'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', borderStrong: '#C8C2B8',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
}

const CAP_MIXER = 4000

const FORMULAS = {
  seco: {
    acostumbramiento: [
      {n:'Rollo (heno)',     kg:38,  c:'#639922'},
      {n:'Maiz grano seco', kg:39,  c:'#E8A020'},
      {n:'Vitaminas',       kg:2,   c:'#5090E0'},
      {n:'Urea',            kg:0.5, c:'#9060C0'},
      {n:'Antibiotico',     kg:0.2, c:'#E05050'},
      {n:'Desparasitante',  kg:0.1, c:'#C06030'},
      {n:'Soja (expeller)', kg:3,   c:'#20A060'},
      {n:'Agua',            kg:17,  c:'#60A0E0'},
    ],
    recria: [
      {n:'Rollo (heno)',     kg:26,  c:'#639922'},
      {n:'Maiz grano seco', kg:55,  c:'#E8A020'},
      {n:'Vitaminas',       kg:2,   c:'#5090E0'},
      {n:'Urea',            kg:1,   c:'#9060C0'},
      {n:'Agua',            kg:17,  c:'#60A0E0'},
    ],
    terminacion: [
      {n:'Rollo (heno)',     kg:13,  c:'#639922'},
      {n:'Maiz grano seco', kg:68,  c:'#E8A020'},
      {n:'Vitaminas',       kg:1,   c:'#5090E0'},
      {n:'Urea',            kg:1,   c:'#9060C0'},
      {n:'Agua',            kg:17,  c:'#60A0E0'},
    ],
  },
  humedo: {
    acostumbramiento: [
      {n:'Rollo (heno)',        kg:27,  c:'#639922'},
      {n:'Maiz grano seco',    kg:21,  c:'#E8A020'},
      {n:'Maiz grano humedo',  kg:27,  c:'#C08000'},
      {n:'Vitaminas',          kg:2,   c:'#5090E0'},
      {n:'Urea',               kg:0.6, c:'#9060C0'},
      {n:'Antibiotico',        kg:0.3, c:'#E05050'},
      {n:'Desparasitante',     kg:0.2, c:'#C06030'},
      {n:'Soja (expeller)',    kg:3,   c:'#20A060'},
      {n:'Agua',               kg:21,  c:'#60A0E0'},
    ],
    recria: [
      {n:'Rollo (heno)',       kg:21,  c:'#639922'},
      {n:'Maiz grano seco',   kg:24,  c:'#E8A020'},
      {n:'Maiz grano humedo', kg:33,  c:'#C08000'},
      {n:'Vitaminas',         kg:1,   c:'#5090E0'},
      {n:'Urea',              kg:1,   c:'#9060C0'},
      {n:'Agua',              kg:20,  c:'#60A0E0'},
    ],
    terminacion: [
      {n:'Rollo (heno)',       kg:13,  c:'#639922'},
      {n:'Maiz grano seco',   kg:28,  c:'#E8A020'},
      {n:'Maiz grano humedo', kg:38,  c:'#C08000'},
      {n:'Vitaminas',         kg:1,   c:'#5090E0'},
      {n:'Urea',              kg:1,   c:'#9060C0'},
      {n:'Agua',              kg:20,  c:'#60A0E0'},
    ],
  },
}

const ETAPA_INFO = [
  { key: 'acostumbramiento', label: 'Mixer 1 - Acostumbramiento - 0 a 10 dias', badge: 'warn' },
  { key: 'recria',           label: 'Mixer 2 - Recria - 11 dias hasta 290 kg',  badge: 'info' },
  { key: 'terminacion',      label: 'Mixer 3 - Terminacion - 291 kg hasta venta', badge: 'ok' },
]

export default function Alimentacion({ usuario }) {
  const [tab, setTab] = useState('registro')
  const [loading, setLoading] = useState(true)
  const [corrales, setCorrales] = useState([])
  const [stockDB, setStockDB] = useState([])
  const [historial, setHistorial] = useState([])
  const [historialArchivo, setHistorialArchivo] = useState([])
  const [verArchivo, setVerArchivo] = useState(false)
  const [ingresosStock, setIngresosStock] = useState([])
  const [ingresosPendientes, setIngresosPendientes] = useState([])
  const [editandoPrecio, setEditandoPrecio] = useState({})
  const [formulaActiva, setFormulaActiva] = useState('seco')
  const [formulaDieta, setFormulaDieta] = useState('seco')
  const [formulas, setFormulas] = useState(JSON.parse(JSON.stringify(FORMULAS)))
  const [caps, setCaps] = useState([CAP_MIXER, CAP_MIXER, CAP_MIXER])
  const [editando, setEditando] = useState({})
  const [showFormIngreso, setShowFormIngreso] = useState(false)
  const [formIngreso, setFormIngreso] = useState({ insumo: 'Rollo (heno)', fecha: new Date().toISOString().split('T')[0], cantidad: '', precio_kg: '', proveedor: '', remito: '' })
  const [guardando, setGuardando] = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  const [kgsHoy, setKgsHoy] = useState([[800, 2400], [840, 900], [1160, 1225]])
  const [piletas, setPiletas] = useState([[null, null], [null, null], [null, null]])

  const MIXERS_CONFIG = [
    { id: 'acost', num: 'Mixer 1', nombre: 'Acostumbramiento', etapa: 'acostumbramiento', headerGrad: '#FDF0E0', corralesRoles: ['cuarentena', 'acumulacion'] },
    { id: 'recria', num: 'Mixer 2', nombre: 'Recria', etapa: 'recria', headerGrad: '#E8EFF8', corralesRoles: ['clasificado'] },
    { id: 'term', num: 'Mixer 3', nombre: 'Terminacion', etapa: 'terminacion', headerGrad: '#E8F4EB', corralesRoles: ['clasificado'] },
  ]

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const hace7dias = new Date()
    hace7dias.setDate(hace7dias.getDate() - 7)
    const hace7diasISO = hace7dias.toISOString()

    const [{ data: c }, { data: s }, { data: h }, { data: ha }, { data: is_ }, { data: ip }] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'libre').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('stock_insumos').select('*').order('insumo'),
      supabase.from('raciones_diarias').select('*, corrales(numero), usuarios:registrado_por(nombre)')
        .gte('creado_en', hace7diasISO).order('creado_en', { ascending: false }),
      supabase.from('raciones_diarias').select('*, corrales(numero), usuarios:registrado_por(nombre)')
        .lt('creado_en', hace7diasISO).order('creado_en', { ascending: false }).limit(100),
      supabase.from('ingresos_stock').select('*').order('creado_en', { ascending: false }).limit(50),
      supabase.from('ingresos_stock').select('*').is('precio_por_kg', null).order('creado_en', { ascending: false }),
    ])
    setCorrales(c || [])
    setStockDB(s || [])
    setHistorial(h || [])
    setHistorialArchivo(ha || [])
    setIngresosStock(is_ || [])
    setIngresosPendientes(ip || [])
    setLoading(false)
  }

  const corralesMixer = [
    corrales.filter(c => c.rol === 'cuarentena' || c.rol === 'acumulacion'),
    corrales.filter(c => c.rol === 'clasificado').slice(0, 2),
    corrales.filter(c => c.rol === 'clasificado').slice(2),
  ]

  useEffect(() => {
    if (corrales.length > 0) {
      const nuevosKgs = corralesMixer.map(grupo => grupo.map(c => Math.round((c.animales || 0) * 10)))
      setKgsHoy(nuevosKgs)
      setPiletas(corralesMixer.map(g => g.map(() => null)))
    }
  }, [corrales])

  function setPileta(mi, ci, tipo) {
    const base = kgsHoy[mi]?.[ci] || 0
    const newKgs = kgsHoy.map(g => [...g])
    newKgs[mi][ci] = tipo === 'bajo' ? Math.max(0, base - 100) : tipo === 'normal' ? base : base + 100
    setKgsHoy(newKgs)
    const newPils = piletas.map(g => [...g])
    newPils[mi][ci] = tipo
    setPiletas(newPils)
  }

  function updateKg(mi, ci, val) {
    const newKgs = kgsHoy.map(g => [...g])
    newKgs[mi][ci] = parseInt(val) || 0
    setKgsHoy(newKgs)
  }

  function calcIngredientes(etapa, totalKg) {
    return formulas[formulaActiva][etapa].map(ing => ({
      ...ing, kgTotal: Math.round(ing.kg * totalKg / 100)
    }))
  }

  // Calcula el costo estimado de una ración dado etapa y kg totales
  function calcCosto(etapa, totalKg) {
    if (!totalKg || totalKg === 0) return null
    const ings = formulas[formulaActiva][etapa]
    let costo = 0
    let tienePrecio = false
    ings.forEach(ing => {
      // Busca el insumo en stockDB por nombre exacto o por coincidencia parcial
      const stock = stockDB.find(s =>
        s.insumo.toLowerCase() === ing.n.toLowerCase() ||
        s.insumo.toLowerCase().includes(ing.n.toLowerCase().split(' ')[0].toLowerCase())
      )
      if (stock?.precio_referencia) {
        costo += (ing.kg / 100) * totalKg * stock.precio_referencia
        tienePrecio = true
      }
    })
    return tienePrecio ? Math.round(costo) : null
  }

  async function actualizarPrecioReferencia(insumoId) {
    const { data: todosIngresos } = await supabase
      .from('ingresos_stock')
      .select('cantidad_kg, precio_por_kg')
      .eq('insumo_id', insumoId)
      .not('precio_por_kg', 'is', null)
    if (todosIngresos && todosIngresos.length > 0) {
      const totalKg = todosIngresos.reduce((s, i) => s + (i.cantidad_kg || 0), 0)
      const promPonderado = todosIngresos.reduce((s, i) => s + (i.precio_por_kg || 0) * (i.cantidad_kg || 0), 0) / totalKg
      await supabase.from('stock_insumos').update({
        precio_referencia: Math.round(promPonderado * 100) / 100,
        precio_referencia_actualizado_en: new Date().toISOString(),
      }).eq('id', insumoId)
    }
  }

  async function confirmarTodo() {
    setGuardando(true)
    const registros = []
    corralesMixer.forEach((grupo, mi) => {
      grupo.forEach((c, ci) => {
        const kgTotal = kgsHoy[mi]?.[ci] || 0
        const costoEst = calcCosto(MIXERS_CONFIG[mi].etapa, kgTotal)
        registros.push({
          mixer: MIXERS_CONFIG[mi].nombre,
          corral_id: c.id,
          formula: formulaActiva,
          kg_total: kgTotal,
          costo_estimado: costoEst,
          registrado_por: usuario?.id,
        })
      })
    })
    await supabase.from('raciones_diarias').insert(registros)
    await cargarDatos()
    setConfirmado(true)
    setGuardando(false)
    setTimeout(() => setConfirmado(false), 5000)
  }

  async function eliminarRacion(id) {
    if (!confirm('¿Eliminar esta racion?')) return
    await supabase.from('raciones_diarias').delete().eq('id', id)
    await cargarDatos()
  }

  async function eliminarTodasRaciones() {
    if (!confirm('¿Eliminar TODAS las raciones de los últimos 7 días? Esta acción no se puede deshacer.')) return
    const hace7dias = new Date()
    hace7dias.setDate(hace7dias.getDate() - 7)
    await supabase.from('raciones_diarias').delete().gte('creado_en', hace7dias.toISOString())
    await cargarDatos()
  }

  async function guardarIngreso() {
    if (!formIngreso.cantidad) { alert('Ingresa la cantidad'); return }
    setGuardando(true)
    const item = stockDB.find(s => s.insumo === formIngreso.insumo)
    if (item) {
      await supabase.from('stock_insumos').update({
        cantidad_kg: (item.cantidad_kg || 0) + parseFloat(formIngreso.cantidad),
        actualizado_en: new Date().toISOString(),
      }).eq('id', item.id)
      await supabase.from('ingresos_stock').insert({
        insumo_id: item.id,
        insumo_nombre: formIngreso.insumo,
        cantidad_kg: parseFloat(formIngreso.cantidad),
        precio_por_kg: formIngreso.precio_kg ? parseFloat(formIngreso.precio_kg) : null,
        total: formIngreso.precio_kg ? parseFloat(formIngreso.cantidad) * parseFloat(formIngreso.precio_kg) : null,
        registrado_por: usuario?.nombre || usuario?.email,
        precio_cargado_por: formIngreso.precio_kg ? (usuario?.nombre || usuario?.email) : null,
        precio_cargado_en: formIngreso.precio_kg ? new Date().toISOString() : null,
      })
      if (formIngreso.precio_kg) {
        await actualizarPrecioReferencia(item.id)
      }
    }
    await cargarDatos()
    setShowFormIngreso(false)
    setFormIngreso({ insumo: 'Rollo (heno)', fecha: new Date().toISOString().split('T')[0], cantidad: '', precio_kg: '', proveedor: '', remito: '' })
    setGuardando(false)
  }

  async function guardarPrecioIngreso(ing) {
    const ep = editandoPrecio[ing.id]
    if (!ep?.precio) { alert('Ingresa el precio'); return }
    const precioNum = parseFloat(ep.precio)
    await supabase.from('ingresos_stock').update({
      precio_por_kg: precioNum,
      total: ing.cantidad_kg * precioNum,
      proveedor: ep.proveedor || null,
      remito: ep.remito || null,
      precio_cargado_por: usuario?.nombre || usuario?.email,
      precio_cargado_en: new Date().toISOString(),
    }).eq('id', ing.id)
    // Recalcular precio promedio ponderado
    await actualizarPrecioReferencia(ing.insumo_id)
    const nuevo = { ...editandoPrecio }
    delete nuevo[ing.id]
    setEditandoPrecio(nuevo)
    await cargarDatos()
  }

  function updateIng(fKey, eKey, idx, val) {
    const newF = JSON.parse(JSON.stringify(formulas))
    newF[fKey][eKey][idx].kg = parseFloat(val) || 0
    setFormulas(newF)
  }

  function guardarDieta(fKey, eKey) {
    const total = formulas[fKey][eKey].reduce((a, x) => a + x.kg, 0)
    if (Math.abs(total - 100) > 0.1) { alert(`La suma debe ser 100 kg. Actualmente: ${total.toFixed(1)} kg`); return }
    setEditando({ ...editando, [`${fKey}_${eKey}`]: false })
  }

  if (loading) return <Loader />

  const hoy = new Date()

  const TABS = [
    { key: 'registro', label: 'Registro diario' },
    { key: 'formulas', label: 'Formulas de mixer' },
    { key: 'stock', label: 'Stock de insumos' },
    { key: 'historial', label: 'Historial' },
  ]

  // Costo total del día
  const costoTotalDia = MIXERS_CONFIG.reduce((total, mx, mi) => {
    const kgsMixer = kgsHoy[mi] || []
    const totalMixer = kgsMixer.reduce((a, b) => a + b, 0)
    const costo = calcCosto(mx.etapa, totalMixer)
    return total + (costo || 0)
  }, 0)

  const tienePreciosReferencia = stockDB.some(s => s.precio_referencia)

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}{t.key === 'stock' && ingresosPendientes.length > 0 ? ` (${ingresosPendientes.length})` : ''}
          </button>
        ))}
      </div>

      {/* ── REGISTRO DIARIO ── */}
      {tab === 'registro' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Registro diario</h1>
              <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace' }}>
                {hoy.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} · tres mixers separados
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: S.muted }}>Formula activa:</span>
              <div style={{ display: 'flex', border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {[['seco', 'Maiz seco'], ['humedo', 'Maiz humedo']].map(([key, label]) => (
                  <button key={key} onClick={() => setFormulaActiva(key)}
                    style={{ padding: '8px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', background: formulaActiva === key ? S.accent : 'transparent', color: formulaActiva === key ? '#fff' : S.muted, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: S.accentLight, border: '1px solid #85B7EB', borderRadius: 8, padding: '.9rem 1rem', fontSize: 13, color: S.accent, marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Cada mixer se prepara por separado. Ajusta los kg por corral segun la lectura de piletas, y el sistema te dice cuantos kg poner de cada ingrediente.
          </div>

          {/* Resumen de costo del día */}
          {tienePreciosReferencia && costoTotalDia > 0 && (
            <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '.9rem 1rem', fontSize: 13, color: S.green, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Costo estimado total del día</span>
              <strong style={{ fontFamily: 'monospace', fontSize: 16 }}>${costoTotalDia.toLocaleString('es-AR')}</strong>
            </div>
          )}

          {MIXERS_CONFIG.map((mx, mi) => {
            const grupo = corralesMixer[mi] || []
            const kgsMixer = kgsHoy[mi] || []
            const totalMixer = kgsMixer.reduce((a, b) => a + b, 0)
            const cap = caps[mi]
            const necesitaCargas = totalMixer > cap
            const numCargas = totalMixer > 0 ? Math.ceil(totalMixer / cap) : 1
            const ings = calcIngredientes(mx.etapa, totalMixer)
            const costoMixer = calcCosto(mx.etapa, totalMixer)
            const totalAnimalesMixer = grupo.reduce((a, c) => a + (c.animales || 0), 0)

            return (
              <div key={mx.id} style={{ border: `1px solid ${S.border}`, borderRadius: 12, marginBottom: '1.25rem', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${S.border}`, background: `linear-gradient(90deg, ${mx.headerGrad} 0%, ${S.surface} 100%)` }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: S.muted, marginBottom: 2 }}>{mx.num}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: S.text }}>{mx.nombre}</div>
                    <div style={{ fontSize: 12, color: S.muted, marginTop: 1 }}>
                      {mx.etapa === 'acostumbramiento' ? '0-10 dias' : mx.etapa === 'recria' ? 'hasta 290 kg' : '291 kg hasta venta'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: S.muted }}>
                      Cap. mixer:
                      <input type="number" value={cap} min="500" step="100"
                        onChange={e => { const n = [...caps]; n[mi] = parseInt(e.target.value) || 4000; setCaps(n) }}
                        style={{ width: 80, border: `1px solid ${S.border}`, borderRadius: 5, padding: '4px 8px', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, textAlign: 'right', background: S.surface }} />
                      kg
                    </div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: S.muted, fontSize: 12 }}>
                      Ayer: {(grupo.reduce((a, c) => a + Math.round((c.animales || 0) * 10), 0)).toLocaleString('es-AR')} kg
                    </span>
                    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: necesitaCargas ? S.redLight : S.greenLight, color: necesitaCargas ? S.red : S.green }}>
                      Hoy: {totalMixer.toLocaleString('es-AR')} kg
                    </span>
                  </div>
                </div>

                <div style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 90px 140px 1fr 100px 110px', gap: 10, padding: '0 0 6px', borderBottom: `1px solid ${S.border}`, marginBottom: 4 }}>
                    {['Corral', 'Ayer kg', 'Pileta hoy', 'Kg hoy', '', 'Costo est.'].map(h => (
                      <div key={h} style={{ fontSize: 10, fontWeight: 600, color: S.hint, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</div>
                    ))}
                  </div>
                  {grupo.length === 0 && <div style={{ padding: '1rem 0', color: S.hint, fontSize: 13 }}>No hay corrales asignados a este mixer.</div>}
                  {grupo.map((c, ci) => {
                    const kgAyer = Math.round((c.animales || 0) * 10)
                    const kgHoy = kgsMixer[ci] || 0
                    const diff = kgHoy - kgAyer
                    const pSel = (piletas[mi] || [])[ci]
                    const costoCorral = calcCosto(mx.etapa, kgHoy)
                    const costoPorAnimal = costoCorral && (c.animales || 0) > 0
                      ? Math.round(costoCorral / c.animales)
                      : null
                    return (
                      <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '130px 90px 140px 1fr 100px 110px', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${S.border}` }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>Corral {c.numero}</div>
                          <div style={{ fontSize: 11, color: S.muted }}>{c.rol} - {c.animales || 0} anim.</div>
                        </div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 500, fontSize: 13, color: S.muted }}>{kgAyer.toLocaleString('es-AR')} kg</div>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[['bajo', 'Sobro', '-100', S.green, S.greenLight], ['normal', 'Poco', '=', S.accent, S.accentLight], ['vacio', 'Vacio', '+100', S.amber, S.amberLight]].map(([tipo, label, sub, color, bg]) => (
                            <button key={tipo} onClick={() => setPileta(mi, ci, tipo)}
                              style={{ border: `1px solid ${pSel === tipo ? color : S.border}`, borderRadius: 5, padding: '4px 7px', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: pSel === tipo ? bg : 'transparent', color: pSel === tipo ? color : S.muted, fontFamily: "'IBM Plex Sans', sans-serif", lineHeight: 1.3, textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {label}<br />{sub}
                            </button>
                          ))}
                        </div>
                        <div>
                          <input type="number" value={kgHoy} onChange={e => updateKg(mi, ci, e.target.value)}
                            style={{ width: 100, border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 15, fontFamily: 'monospace', fontWeight: 600, textAlign: 'right', color: S.text, background: S.surface }} />
                        </div>
                        <div>
                          <span style={{ display: 'inline-block', fontSize: 11, fontFamily: 'monospace', fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: diff > 0 ? S.amberLight : diff < 0 ? S.greenLight : S.bg, color: diff > 0 ? S.amber : diff < 0 ? S.green : S.hint, border: diff === 0 ? `1px solid ${S.border}` : 'none' }}>
                            {diff === 0 ? '=' : (diff > 0 ? '+' : '') + diff} kg
                          </span>
                        </div>
                        <div>
                          {costoCorral ? (
                            <div>
                              <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: S.green }}>${costoCorral.toLocaleString('es-AR')}</div>
                              {costoPorAnimal && <div style={{ fontSize: 10, color: S.muted }}>${costoPorAnimal.toLocaleString('es-AR')}/anim.</div>}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: S.hint }}>—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 2px', marginTop: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: S.muted }}>Total mixer</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: necesitaCargas ? S.red : S.accent }}>{totalMixer.toLocaleString('es-AR')} kg</span>
                      {costoMixer && (
                        <div style={{ fontSize: 12, color: S.green, fontFamily: 'monospace', marginTop: 2 }}>
                          Costo est.: <strong>${costoMixer.toLocaleString('es-AR')}</strong>
                          {totalAnimalesMixer > 0 && <span style={{ color: S.muted, fontWeight: 400 }}> · ${Math.round(costoMixer / totalAnimalesMixer).toLocaleString('es-AR')}/animal</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1rem 1.25rem', borderTop: `1px solid ${S.border}`, background: S.bg }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.5rem' }}>
                    Orden de carga — {mx.nombre}
                  </div>
                  {necesitaCargas && (
                    <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 8, padding: '.9rem 1rem', fontSize: 13, color: S.amber, marginBottom: '.75rem', lineHeight: 1.6 }}>
                      <strong>Supera la capacidad del mixer ({cap.toLocaleString('es-AR')} kg).</strong> Necesitas <strong>{numCargas} cargas</strong> de ~{Math.ceil(totalMixer / numCargas).toLocaleString('es-AR')} kg cada una.
                    </div>
                  )}
                  {totalMixer > 0 && (() => {
                    if (necesitaCargas) {
                      const kgPorCarga = Math.ceil(totalMixer / numCargas)
                      const cargas = []
                      for (let ci = 0; ci < numCargas; ci++) {
                        const kgEstaCarga = Math.min(kgPorCarga, totalMixer - ci * kgPorCarga)
                        const factor = kgEstaCarga / totalMixer
                        cargas.push({ kg: kgEstaCarga, ings: ings.map(i => ({ ...i, kgCarga: Math.round(i.kgTotal * factor) })) })
                      }
                      return cargas.map((cg, ci) => {
                        let acum = 0
                        return (
                          <div key={ci} style={{ marginBottom: '.75rem' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: ci === 0 ? S.accent : S.green, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.4rem' }}>
                              Carga {ci + 1} de {numCargas} · {cg.kg.toLocaleString('es-AR')} kg
                            </div>
                            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                  <tr style={{ background: S.bg }}>
                                    {['Ingrediente', 'Kg', 'Acumulado'].map((h, i) => (
                                      <th key={h} style={{ padding: '7px 10px', textAlign: i === 0 ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {cg.ings.map((ing, ii) => { acum += ing.kgCarga; return (
                                    <tr key={ii} style={{ borderBottom: `1px solid ${S.border}` }}>
                                      <td style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: ing.c }} />{ing.n}
                                      </td>
                                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{ing.kgCarga.toLocaleString('es-AR')}</td>
                                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{acum.toLocaleString('es-AR')}</td>
                                    </tr>
                                  )})}
                                  <tr style={{ background: S.bg, borderTop: `2px solid ${S.borderStrong}` }}>
                                    <td style={{ padding: '7px 10px', fontWeight: 700 }}>Total carga {ci + 1}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: ci === 0 ? S.accent : S.green }}>{cg.kg.toLocaleString('es-AR')} kg</td>
                                    <td />
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })
                    } else {
                      let acum = 0
                      return (
                        <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr style={{ background: S.bg }}>
                                {['Ingrediente', 'Kg a cargar', 'Acumulado'].map((h, i) => (
                                  <th key={h} style={{ padding: '7px 10px', textAlign: i === 0 ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {ings.map((ing, ii) => { acum += ing.kgTotal; return (
                                <tr key={ii} style={{ borderBottom: `1px solid ${S.border}` }}>
                                  <td style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ing.c }} />{ing.n}
                                  </td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{ing.kgTotal.toLocaleString('es-AR')}</td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{acum.toLocaleString('es-AR')}</td>
                                </tr>
                              )})}
                              <tr style={{ background: S.bg, borderTop: `2px solid ${S.borderStrong}` }}>
                                <td style={{ padding: '7px 10px', fontWeight: 700 }}>Total mixer</td>
                                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: S.accent }}>{totalMixer.toLocaleString('es-AR')} kg</td>
                                <td />
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )
                    }
                  })()}
                </div>
              </div>
            )
          })}

          {confirmado && (
            <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '.9rem 1rem', fontSize: 13, color: S.green, marginBottom: '1rem' }}>
              <strong>Jornada confirmada.</strong> {kgsHoy.flat().reduce((a, b) => a + b, 0).toLocaleString('es-AR')} kg totales en 3 mixers.
              {costoTotalDia > 0 && <span> · Costo estimado: <strong>${costoTotalDia.toLocaleString('es-AR')}</strong></span>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '.5rem' }}>
            <button style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              Imprimir las 3 ordenes
            </button>
            <button onClick={confirmarTodo} disabled={guardando}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              {guardando ? 'Guardando...' : 'Confirmar jornada completa'}
            </button>
          </div>
        </div>
      )}

      {/* ── FORMULAS ── */}
      {tab === 'formulas' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Formulas de mixer</h1>
              <div style={{ fontSize: 12, color: S.muted }}>Kg por cada 100 kg de mezcla</div>
            </div>
          </div>
          <div style={{ background: S.accentLight, border: '1px solid #85B7EB', borderRadius: 8, padding: '.9rem 1rem', fontSize: 13, color: S.accent, marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Cada 100 kg de mixer, el sistema multiplica por el total del dia.
          </div>
          <div style={{ display: 'flex', border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden', width: 'fit-content', marginBottom: '1.5rem' }}>
            {[['seco', 'Maiz seco'], ['humedo', 'Maiz humedo']].map(([key, label]) => (
              <button key={key} onClick={() => setFormulaDieta(key)}
                style={{ padding: '8px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', background: formulaDieta === key ? S.accent : 'transparent', color: formulaDieta === key ? '#fff' : S.muted, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                {label}
              </button>
            ))}
          </div>
          {ETAPA_INFO.map(e => {
            const key = `${formulaDieta}_${e.key}`
            const ings = formulas[formulaDieta][e.key]
            const total = ings.reduce((a, x) => a + x.kg, 0)
            const totalOk = Math.abs(total - 100) < 0.1
            const modoEdit = editando[key] || false
            let acum = 0
            return (
              <div key={key} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{e.label}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: totalOk ? S.green : S.red, fontWeight: 600 }}>Total: {total.toFixed(1)} / 100 kg {!totalOk && '⚠'}</span>
                    {!modoEdit
                      ? <button onClick={() => setEditando({ ...editando, [key]: true })}
                          style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Editar</button>
                      : <>
                          <button onClick={() => guardarDieta(formulaDieta, e.key)}
                            style={{ padding: '5px 10px', fontSize: 12, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600 }}>Guardar</button>
                          <button onClick={() => { setEditando({ ...editando, [key]: false }); setFormulas(JSON.parse(JSON.stringify(FORMULAS))) }}
                            style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Cancelar</button>
                        </>
                    }
                  </div>
                </div>
                <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: S.bg }}>
                        {['Ingrediente', 'Kg / 100', '% aprox', 'Acumulado', 'Precio ref.'].map((h, i) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ings.map((ing, ii) => {
                        acum += ing.kg
                        const stockItem = stockDB.find(s =>
                          s.insumo.toLowerCase() === ing.n.toLowerCase() ||
                          s.insumo.toLowerCase().includes(ing.n.toLowerCase().split(' ')[0].toLowerCase())
                        )
                        return (
                          <tr key={ii} style={{ borderBottom: `1px solid ${S.border}` }}>
                            <td style={{ padding: '9px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 9, height: 9, borderRadius: '50%', background: ing.c, flexShrink: 0 }} />{ing.n}
                              </div>
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                              {modoEdit
                                ? <input type="number" step="0.1" min="0" max="100" value={ing.kg}
                                    onChange={ev => updateIng(formulaDieta, e.key, ii, ev.target.value)}
                                    style={{ width: 72, border: `1px solid ${S.border}`, borderRadius: 5, padding: '5px 8px', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, textAlign: 'right', background: S.surface }} />
                                : <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ing.kg}</span>
                              }
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                              <div>
                                <div style={{ fontSize: 11, fontFamily: 'monospace', color: S.muted, marginBottom: 3 }}>{(ing.kg).toFixed(1)}%</div>
                                <div style={{ height: 4, background: S.border, borderRadius: 2, overflow: 'hidden', width: 80, marginLeft: 'auto' }}>
                                  <div style={{ width: `${Math.min(100, ing.kg)}%`, height: '100%', borderRadius: 2, background: ing.c }} />
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{acum.toFixed(1)}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                              {stockItem?.precio_referencia
                                ? <span style={{ color: S.green, fontWeight: 600 }}>${stockItem.precio_referencia.toLocaleString('es-AR')}/kg</span>
                                : <span style={{ color: S.hint }}>—</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                      <tr style={{ background: S.bg, borderTop: `2px solid ${S.borderStrong}` }}>
                        <td style={{ padding: '9px 12px', fontWeight: 700 }}>Total</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: totalOk ? S.green : S.red }}>{total.toFixed(1)}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: totalOk ? S.green : S.red }}>100%</td>
                        <td /><td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── STOCK ── */}
      {tab === 'stock' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Stock de insumos</h1>
              <div style={{ fontSize: 12, color: S.muted }}>Se descuenta al confirmar cada jornada</div>
            </div>
            <button onClick={() => setShowFormIngreso(!showFormIngreso)}
              style={{ padding: '8px 16px', fontSize: 13, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500 }}>
              + Registrar ingreso
            </button>
          </div>

          {stockDB.some(s => s.cantidad_kg <= s.minimo_kg) && (
            <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 8, padding: '.9rem 1rem', fontSize: 13, color: S.amber, marginBottom: '1rem', lineHeight: 1.6 }}>
              Algunos insumos estan bajos. Verifica antes de la proxima racion.
            </div>
          )}

          {showFormIngreso && (
            <div style={{ background: S.surface, border: `2px solid ${S.accent}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Registrar ingreso de insumo</div>
                <button onClick={() => setShowFormIngreso(false)} style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cerrar</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Insumo</label>
                  <select value={formIngreso.insumo} onChange={e => setFormIngreso({...formIngreso, insumo: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface }}>
                    {stockDB.map(s => <option key={s.id}>{s.insumo}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Fecha</label>
                  <input type="date" value={formIngreso.fecha} onChange={e => setFormIngreso({...formIngreso, fecha: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Cantidad (kg)</label>
                  <input type="number" placeholder="ej. 5000" value={formIngreso.cantidad} onChange={e => setFormIngreso({...formIngreso, cantidad: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Precio por kg ($ - opcional)</label>
                  <input type="number" placeholder="ej. 130" value={formIngreso.precio_kg} onChange={e => setFormIngreso({...formIngreso, precio_kg: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Proveedor</label>
                  <input type="text" value={formIngreso.proveedor} onChange={e => setFormIngreso({...formIngreso, proveedor: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Remito</label>
                  <input type="text" value={formIngreso.remito} onChange={e => setFormIngreso({...formIngreso, remito: e.target.value})}
                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowFormIngreso(false)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Cancelar</button>
                <button onClick={guardarIngreso} disabled={guardando} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  {guardando ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </div>
          )}

          {/* ── INGRESOS PENDIENTES DE PRECIO ── */}
          {['dueno', 'secretaria'].includes(usuario?.rol) && ingresosPendientes.length > 0 && (
            <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: '.85rem' }}>
                ⚠ {ingresosPendientes.length} ingreso{ingresosPendientes.length !== 1 ? 's' : ''} sin precio cargado
              </div>
              {ingresosPendientes.map(ing => {
                const ep = editandoPrecio[ing.id]
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
                        <button onClick={() => setEditandoPrecio({ ...editandoPrecio, [ing.id]: { precio: '', proveedor: '', remito: '' } })}
                          style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", flexShrink: 0, marginLeft: 12 }}>
                          Cargar precio
                        </button>
                      )}
                    </div>
                    {ep && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Precio por kg ($) *</label>
                            <input type="number" placeholder="ej. 130" value={ep.precio}
                              onChange={e => setEditandoPrecio({ ...editandoPrecio, [ing.id]: { ...ep, precio: e.target.value } })}
                              style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontWeight: 600 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Proveedor</label>
                            <input type="text" placeholder="ej. Agrosol" value={ep.proveedor}
                              onChange={e => setEditandoPrecio({ ...editandoPrecio, [ing.id]: { ...ep, proveedor: e.target.value } })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Remito</label>
                            <input type="text" placeholder="nro de remito" value={ep.remito}
                              onChange={e => setEditandoPrecio({ ...editandoPrecio, [ing.id]: { ...ep, remito: e.target.value } })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
                          </div>
                        </div>
                        {ep.precio && (
                          <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: S.green }}>
                            Total: <strong>${(ing.cantidad_kg * parseFloat(ep.precio)).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</strong> ({ing.cantidad_kg?.toLocaleString('es-AR')} kg × ${parseFloat(ep.precio).toLocaleString('es-AR')})
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => guardarPrecioIngreso(ing)}
                            style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                            Guardar precio
                          </button>
                          <button onClick={() => { const n = { ...editandoPrecio }; delete n[ing.id]; setEditandoPrecio(n) }}
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
          )}

          {/* ── HISTORIAL DE INGRESOS DE STOCK ── */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>
              Historial de ingresos
            </div>
            {ingresosStock.length === 0
              ? <div style={{ fontSize: 13, color: S.hint }}>No hay ingresos registrados.</div>
              : (
                <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: S.bg }}>
                        {['Fecha', 'Insumo', 'Cantidad', 'Precio/kg', 'Total', 'Proveedor', 'Registrado por', ''].map((h, i) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: i > 1 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ingresosStock.map(ing => (
                        <tr key={ing.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted }}>{new Date(ing.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 600 }}>{ing.insumo_nombre}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{ing.cantidad_kg?.toLocaleString('es-AR')} kg</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {ing.precio_por_kg
                              ? `$${ing.precio_por_kg.toLocaleString('es-AR')}`
                              : <span style={{ color: S.amber, fontSize: 11, fontWeight: 600 }}>Pendiente</span>}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                            {ing.total ? `$${ing.total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '-'}
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{ing.proveedor || '-'}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{ing.registrado_por || '-'}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <button onClick={async () => {
                              if (!confirm('¿Eliminar este ingreso del historial?')) return
                              await supabase.from('ingresos_stock').delete().eq('id', ing.id)
                              await cargarDatos()
                            }} style={{ padding: '3px 8px', fontSize: 11, background: '#FDF0F0', border: '1px solid #F09595', color: '#7A1A1A', borderRadius: 5, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>

          <StockABM stockDB={stockDB} onReload={cargarDatos} onShowIngreso={() => setShowFormIngreso(true)} />
        </div>
      )}

      {/* ── HISTORIAL DE RACIONES ── */}
      {tab === 'historial' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Historial de raciones</h1>
              <div style={{ fontSize: 12, color: S.muted }}>Ultimos 7 dias · {historial.length} registros</div>
            </div>
            {historial.length > 0 && (
              <button onClick={eliminarTodasRaciones}
                style={{ padding: '8px 14px', fontSize: 12, background: S.redLight, border: `1px solid #F09595`, color: S.red, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600 }}>
                Eliminar todos
              </button>
            )}
          </div>

          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: '1.25rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Fecha', 'Corral', 'Mixer', 'Formula', 'Kg total', 'Costo est.', 'Por', ''].map(h => (
                    <th key={h} style={{ background: S.bg, padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay raciones en los ultimos 7 dias.</td></tr>
                )}
                {historial.map(h => (
                  <tr key={h.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{new Date(h.creado_en || h.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</td>
                    <td style={{ padding: '9px 12px' }}>{h.corrales?.numero ? `C-${h.corrales.numero}` : '-'}</td>
                    <td style={{ padding: '9px 12px' }}>{h.mixer}</td>
                    <td style={{ padding: '9px 12px' }}>{h.formula}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{(h.kg_total || 0).toLocaleString('es-AR')}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.green, fontWeight: 600 }}>
                      {h.costo_estimado ? `$${h.costo_estimado.toLocaleString('es-AR')}` : <span style={{ color: S.hint, fontWeight: 400 }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{h.usuarios?.nombre || '-'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <button onClick={() => eliminarRacion(h.id)}
                        style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: `1px solid #F09595`, color: S.red, borderRadius: 5, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ARCHIVO */}
          <button onClick={() => setVerArchivo(!verArchivo)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", marginBottom: '1rem' }}>
            {verArchivo ? '▾' : '▸'} Archivo ({historialArchivo.length} registros anteriores a 7 dias)
          </button>
          {verArchivo && (
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Fecha', 'Corral', 'Mixer', 'Formula', 'Kg total', 'Costo est.', 'Por'].map(h => (
                      <th key={h} style={{ background: S.bg, padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historialArchivo.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay raciones archivadas.</td></tr>
                  )}
                  {historialArchivo.map(h => (
                    <tr key={h.id} style={{ borderBottom: `1px solid ${S.border}`, opacity: 0.75 }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{new Date(h.creado_en || h.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px' }}>{h.corrales?.numero ? `C-${h.corrales.numero}` : '-'}</td>
                      <td style={{ padding: '9px 12px' }}>{h.mixer}</td>
                      <td style={{ padding: '9px 12px' }}>{h.formula}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{(h.kg_total || 0).toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.green, fontWeight: 600 }}>
                        {h.costo_estimado ? `$${h.costo_estimado.toLocaleString('es-AR')}` : <span style={{ color: S.hint, fontWeight: 400 }}>—</span>}
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{h.usuarios?.nombre || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StockABM({ stockDB, onReload, onShowIngreso }) {
  const [nuevoInsumo, setNuevoInsumo] = useState({ show: false, nombre: '', minimo_kg: '' })
  const [editMinimo, setEditMinimo] = useState({})
  const [guardando, setGuardando] = useState(false)
  const COLORES = { 'Rollo (heno)': '#639922', 'Maiz grano seco': '#E8A020', 'Vitaminas': '#5090E0', 'Urea': '#9060C0', 'Soja (expeller)': '#20A060' }

  async function agregarInsumo() {
    if (!nuevoInsumo.nombre.trim()) { alert('Ingresa el nombre del insumo'); return }
    setGuardando(true)
    await supabase.from('stock_insumos').insert({ insumo: nuevoInsumo.nombre.trim(), cantidad_kg: 0, minimo_kg: parseInt(nuevoInsumo.minimo_kg) || 0 })
    await onReload()
    setNuevoInsumo({ show: false, nombre: '', minimo_kg: '' })
    setGuardando(false)
  }

  async function eliminarInsumo(id, nombre) {
    if (!confirm(`Eliminar "${nombre}" del stock?`)) return
    await supabase.from('stock_insumos').delete().eq('id', id)
    await onReload()
  }

  async function guardarMinimo(id, valor) {
    await supabase.from('stock_insumos').update({ minimo_kg: parseInt(valor) || 0 }).eq('id', id)
    setEditMinimo({ ...editMinimo, [id]: false })
    await onReload()
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 10, padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.07em' }}>Estado actual</div>
        <button onClick={() => setNuevoInsumo({ show: true, nombre: '', minimo_kg: '' })}
          style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: '1px solid #E2DDD6', color: '#6B6760', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Nuevo insumo
        </button>
      </div>
      {nuevoInsumo.show && (
        <div style={{ background: '#F7F5F0', border: '1px solid #E2DDD6', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '.75rem' }}>Nuevo insumo</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Nombre</label>
              <input type="text" placeholder="ej. Pellet de soja" value={nuevoInsumo.nombre}
                onChange={e => setNuevoInsumo({ ...nuevoInsumo, nombre: e.target.value })}
                style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 6, padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Minimo de alerta (kg)</label>
              <input type="number" placeholder="ej. 500" value={nuevoInsumo.minimo_kg}
                onChange={e => setNuevoInsumo({ ...nuevoInsumo, minimo_kg: e.target.value })}
                style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 6, padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setNuevoInsumo({ show: false, nombre: '', minimo_kg: '' })}
              style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', border: '1px solid #E2DDD6', color: '#6B6760', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Cancelar</button>
            <button onClick={agregarInsumo} disabled={guardando}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: '#1E5C2E', border: '1px solid #1E5C2E', color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              {guardando ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      )}
      {stockDB.length === 0 && <p style={{ fontSize: 13, color: '#9E9A94' }}>No hay insumos registrados.</p>}
      {stockDB.map(s => {
        const bajo = s.cantidad_kg <= s.minimo_kg
        const pct = Math.min(100, Math.round(s.cantidad_kg / Math.max(s.minimo_kg * 3, s.cantidad_kg, 1) * 100))
        const barColor = bajo ? '#E24B4A' : pct < 40 ? '#EF9F27' : '#1E5C2E'
        const c = COLORES[s.insumo] || '#808080'
        const editando = editMinimo[s.id]
        return (
          <div key={s.id} style={{ padding: '.85rem 0', borderBottom: '1px solid #E2DDD6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0 }} />{s.insumo}
                {s.precio_referencia && (
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#1E5C2E', background: '#E8F4EB', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                    ${s.precio_referencia.toLocaleString('es-AR')}/kg
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: barColor }}>{s.cantidad_kg.toLocaleString('es-AR')} kg</span>
                <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: bajo ? '#FDF0F0' : pct < 40 ? '#FDF0E0' : '#E8F4EB', color: bajo ? '#7A1A1A' : pct < 40 ? '#7A4500' : '#1E5C2E' }}>
                  {bajo ? '⚠ Bajo minimo' : 'OK'}
                </span>
                <button onClick={() => onShowIngreso()}
                  style={{ padding: '4px 8px', fontSize: 11, background: 'transparent', border: '1px solid #E2DDD6', color: '#6B6760', borderRadius: 5, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>+ Ingreso</button>
                <button onClick={() => eliminarInsumo(s.id, s.insumo)}
                  style={{ padding: '4px 8px', fontSize: 11, background: '#FDF0F0', border: '1px solid #F09595', color: '#7A1A1A', borderRadius: 5, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Eliminar</button>
              </div>
            </div>
            <div style={{ height: 6, background: '#F7F5F0', borderRadius: 3, overflow: 'hidden', border: '1px solid #E2DDD6', marginBottom: 4 }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: barColor }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6B6760' }}>
              <span>Minimo de alerta:</span>
              {editando ? (
                <>
                  <input type="number" defaultValue={s.minimo_kg} id={`min_${s.id}`}
                    style={{ width: 80, border: '1px solid #E2DDD6', borderRadius: 5, padding: '3px 7px', fontFamily: 'monospace', fontSize: 12, textAlign: 'right' }} />
                  <button onClick={() => guardarMinimo(s.id, document.getElementById(`min_${s.id}`).value)}
                    style={{ padding: '3px 8px', fontSize: 11, background: '#1E5C2E', border: '1px solid #1E5C2E', color: '#fff', borderRadius: 5, cursor: 'pointer' }}>Ok</button>
                  <button onClick={() => setEditMinimo({ ...editMinimo, [s.id]: false })}
                    style={{ padding: '3px 8px', fontSize: 11, background: 'transparent', border: '1px solid #E2DDD6', color: '#6B6760', borderRadius: 5, cursor: 'pointer' }}>✕</button>
                </>
              ) : (
                <>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.minimo_kg.toLocaleString('es-AR')} kg</span>
                  <button onClick={() => setEditMinimo({ ...editMinimo, [s.id]: true })}
                    style={{ padding: '2px 6px', fontSize: 10, background: 'transparent', border: '1px solid #E2DDD6', color: '#9E9A94', borderRadius: 4, cursor: 'pointer' }}>Editar</button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
