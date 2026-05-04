import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Btn, Loader } from './Tablero'

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
  const [loading, setLoading] = useState(true)
  const [alertas, setAlertas] = useState([])
  const [corrales, setCorrales] = useState([])
  const [lotes, setLotes] = useState([])
  const [enfermeria, setEnfermeria] = useState([])
  const [mortalidad, setMortalidad] = useState([])
  const [eventos, setEventos] = useState([])
  const [revisiones, setRevisiones] = useState([])
  const [productos, setProductos] = useState(PRODUCTOS_DEFAULT)
  const [revState, setRevState] = useState([])
  const [formProd, setFormProd] = useState({ show: false, nombre: '', tipo: 'Vacuna', lab: '', car: '' })
  const esDueno = ['dueno', 'secretaria'].includes(usuario?.rol)

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
          await supabase.from('animales_enfermeria').insert({
            corral_origen_id: corrales[i].id,
            descripcion: enf.desc, diagnostico: enf.diag, tratamiento: enf.prod,
            estado: 'en tratamiento', registrado_por: usuario?.id,
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
    const n = [...revState]; n[i] = { ok: false, enfermos: [{ desc: '', diag: 'Conjuntivitis', prod: '' }] }; setRevState(n)
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

  async function guardarProd() {
    if (!formProd.nombre.trim()) { alert('Ingresa el nombre'); return }
    setProductos([...productos, { n: formProd.nombre.trim(), tipo: formProd.tipo, lab: formProd.lab, car: parseInt(formProd.car) || 0 }])
    setFormProd({ show: false, nombre: '', tipo: 'Vacuna', lab: '', car: '' })
  }

  async function eliminarProd(i) {
    if (!confirm(`Eliminar "${productos[i].n}"?`)) return
    const p = [...productos]; p.splice(i, 1); setProductos(p)
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

  const TABS = ['alertas', 'ingreso', 'revision', 'historial', 'productos']
  const TAB_LABELS = ['Alertas', 'Protocolo ingreso', 'Revision bisemanal', 'Historial', 'Productos']

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
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t ? 600 : 500, cursor: 'pointer', color: tab === t ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif", position: 'relative' }}>
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
                <div style={{ padding: '.85rem 0', borderBottom: `1px solid ${S.border}`, display: 'flex', gap: '1rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Dia 0 — Alliance + Feedlot (lote completo)</div>
                    <div style={{ fontSize: 12, color: S.muted, lineHeight: 1.6 }}>{l.cantidad} animales · {new Date(l.fecha_ingreso).toLocaleDateString('es-AR')}</div>
                  </div>
                </div>
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
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, color: dias >= 10 ? S.text : S.muted }}>Dia 10 — Cierre del protocolo</div>
                    <div style={{ fontSize: 12, color: S.muted, lineHeight: 1.6 }}>El lote pasa a acumulacion y queda bajo revision bisemanal.</div>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 170px 160px 32px', gap: 8, padding: '4px 0 8px', borderBottom: `1px solid ${S.border}`, marginBottom: 4 }}>
                      {['Descripcion del animal','Diagnostico','Producto aplicado',''].map(h => (
                        <div key={h} style={{ fontSize: 10, fontWeight: 600, color: S.hint, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</div>
                      ))}
                    </div>
                    {st.enfermos.map((e, ei) => (
                      <div key={ei} style={{ display: 'grid', gridTemplateColumns: '1fr 170px 160px 32px', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${S.border}` }}>
                        <input type="text" value={e.desc} placeholder="ej. novillo negro, oreja cortada"
                          onChange={ev => updEnfermo(i, ei, 'desc', ev.target.value)}
                          style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface }} />
                        <select value={e.diag} onChange={ev => updEnfermo(i, ei, 'diag', ev.target.value)}
                          style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface }}>
                          {DIAGNOSTICOS.map(d => <option key={d}>{d}</option>)}
                        </select>
                        <select value={e.prod} onChange={ev => updEnfermo(i, ei, 'prod', ev.target.value)}
                          style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface }}>
                          <option value="">— Producto —</option>
                          {productos.map(p => <option key={p.n} value={p.n}>{p.n}</option>)}
                        </select>
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
      {tab === 'productos' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Productos y vacunas</h2>
              <div style={{ fontSize: 12, color: S.muted }}>Los cargas vos · aparecen al registrar un evento</div>
            </div>
            <button onClick={() => setFormProd({...formProd, show: !formProd.show})}
              style={{ padding: '8px 16px', background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Agregar producto
            </button>
          </div>

          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
            {formProd.show && (
              <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '.75rem' }}>Nuevo producto</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  {[
                    { label: 'Nombre', key: 'nombre', type: 'text', placeholder: 'ej. Alliance' },
                    { label: 'Laboratorio', key: 'lab', type: 'text', placeholder: 'ej. MSD Animal Health' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{f.label}</label>
                      <input type={f.type} placeholder={f.placeholder} value={formProd[f.key]}
                        onChange={e => setFormProd({...formProd, [f.key]: e.target.value})}
                        style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Tipo</label>
                    <select value={formProd.tipo} onChange={e => setFormProd({...formProd, tipo: e.target.value})}
                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface }}>
                      {['Vacuna','Antibiotico','Antiparasitario','Vitamina','Antiinflamatorio','Otro'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Carencia (dias)</label>
                    <input type="number" placeholder="0 = sin carencia" min="0" value={formProd.car}
                      onChange={e => setFormProd({...formProd, car: e.target.value})}
                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setFormProd({...formProd, show: false})} style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Cancelar</button>
                  <button onClick={guardarProd} style={{ padding: '5px 10px', fontSize: 12, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600 }}>Guardar</button>
                </div>
              </div>
            )}

            {productos.map((p, i) => {
              const tc = TIPO_BADGE[p.tipo] || TIPO_BADGE.Otro
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.85rem 0', borderBottom: `1px solid ${S.border}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.n}</div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>
                      <Badge bg={tc.bg} color={tc.color}>{p.tipo}</Badge>
                      <span style={{ marginLeft: 6 }}>{p.lab}</span>
                    </div>
                  </div>
                  <div style={{ minWidth: 110, textAlign: 'right', fontSize: 12 }}>
                    {p.car > 0 ? <span style={{ color: S.amber, fontWeight: 600 }}>Carencia: {p.car} dias</span> : <span style={{ color: S.hint }}>Sin carencia</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => eliminarProd(i)} style={{ padding: '5px 10px', fontSize: 12, background: S.redLight, border: `1px solid #F09595`, color: S.red, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Eliminar</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
