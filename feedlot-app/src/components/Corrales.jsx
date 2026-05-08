import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const ROL_COLOR = {
  libre:        { bg: '#E8F4EB', border: '#7BC67A', text: '#1E5C2E' },
  cuarentena:   { bg: '#FDF0E0', border: '#EF9F27', text: '#7A4500' },
  acumulacion:  { bg: '#E8EFF8', border: '#378ADD', text: '#1A3D6B' },
  clasificado:  { bg: '#F0EAFB', border: '#9F8ED4', text: '#3D1A6B' },
  enfermeria:   { bg: '#FDF0F0', border: '#F09595', text: '#7A1A1A' },
  transitorio:  { bg: '#F5F0E8', border: '#C8B88A', text: '#7A6520' },
  deshabilitado:{ bg: '#EBEBEB', border: '#C8C8C8', text: '#888' },
}

function normalizar(c) {
  return {
    id:        c.id,
    numero:    c.numero || String(c.id),
    capacidad: c.capacidad || 100,
    rol:       (c.rol || 'libre').toLowerCase(),
    sub:       c.sub || null,
    activo:    c.activo ?? true,
    animales:  c.animales || 0,
  }
}

const LAYOUT = [
  { fila: 'Corrales 1-8 - cap. 100', grupos: [[4,3,2,1],[5,6,7,8]] },
  { fila: 'Corrales 9-14',           grupos: [[11,10,9],[12,13,14]] },
]

const ROLES = ['libre','cuarentena','acumulacion','clasificado','enfermeria','transitorio','deshabilitado']

export default function Corrales({ usuario }) {
  const [corrales, setCorrales] = useState([])
  const [seleccionado, setSeleccionado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [vistaPanel, setVistaPanel] = useState('detalle')
  const [movForm, setMovForm] = useState({ destino_id: '', cantidad: '', motivo: '', rolDestino: '', subDestino: '' })
  const [guardando, setGuardando] = useState(false)
  const [movimientos, setMovimientos] = useState([])
  const [movArchivo, setMovArchivo] = useState([])
  const [verArchivoMov, setVerArchivoMov] = useState(false)
  const esDueno = ['dueno', 'encargado'].includes(usuario?.rol)

  useEffect(() => { cargarCorrales() }, [])

  async function cargarCorrales() {
    const [{ data, error }, { data: movs }] = await Promise.all([
      supabase.from('corrales').select('*').order('id'),
      supabase.from('movimientos')
        .select('*, origen:corral_origen_id(numero), destino:corral_destino_id(numero), usuario:registrado_por(nombre)')
        .order('fecha', { ascending: false })
        .limit(100),
    ])
    if (error) console.error('Error cargando corrales:', error)
    setCorrales((data || []).map(normalizar).sort((a, b) => parseInt(a.numero) - parseInt(b.numero)))
    setMovimientos((movs || []).slice(0, 10))
    setMovArchivo((movs || []).slice(10))
    setLoading(false)
  }

  async function cambiarRol(corralId, nuevoRol, sub = null) {
    await supabase.from('corrales').update({ rol: nuevoRol, sub: sub || null }).eq('id', corralId)
    await cargarCorrales()
    setSeleccionado(prev => prev ? {...prev, rol: nuevoRol, sub} : prev)
  }

  async function moverAnimales() {
    const sel = corrales.find(c => c.id === seleccionado?.id)
    if (!movForm.destino_id) { alert('Selecciona el corral destino'); return }
    if (!movForm.cantidad || parseInt(movForm.cantidad) <= 0) { alert('Ingresa la cantidad'); return }
    const cantidad = parseInt(movForm.cantidad)
    if (cantidad > (sel?.animales || 0)) { alert(`No hay suficientes animales. Disponibles: ${sel?.animales}`); return }

    const corralDestino = corrales.find(c => String(c.id) === String(movForm.destino_id))
    const destinoEsLibre = corralDestino?.rol === 'libre'
    if (destinoEsLibre && !movForm.rolDestino) { alert('Seleccioná el rol del corral destino'); return }
    if (destinoEsLibre && movForm.rolDestino === 'clasificado' && !movForm.subDestino) { alert('Seleccioná el rango del corral clasificado'); return }

    setGuardando(true)
    const destinoId = parseInt(movForm.destino_id)

    await supabase.from('movimientos').insert({
      tipo: 'traslado',
      corral_origen_id: sel.id,
      corral_destino_id: destinoId,
      cantidad,
      motivo: movForm.motivo || null,
      registrado_por: usuario?.id,
    })

    // Actualizar origen — auto-libre si quedó vacío
    const nuevosOrigen = (sel.animales || 0) - cantidad
    const updateOrigen = { animales: nuevosOrigen }
    if (nuevosOrigen === 0) { updateOrigen.rol = 'libre'; updateOrigen.sub = null }
    await supabase.from('corrales').update(updateOrigen).eq('id', sel.id)

    // Actualizar destino — asignar rol si era libre
    const { data: dest } = await supabase.from('corrales').select('animales').eq('id', destinoId).single()
    const updateDestino = { animales: (dest?.animales || 0) + cantidad }
    if (destinoEsLibre) {
      updateDestino.rol = movForm.rolDestino
      updateDestino.sub = movForm.rolDestino === 'clasificado' ? movForm.subDestino : null
    }
    await supabase.from('corrales').update(updateDestino).eq('id', destinoId)

    await cargarCorrales()
    setMovForm({ destino_id: '', cantidad: '', motivo: '', rolDestino: '', subDestino: '' })
    setVistaPanel('detalle')
    setGuardando(false)
    alert(`${cantidad} animales movidos.${nuevosOrigen === 0 ? ' El corral origen quedó libre.' : ''}`)
  }

  async function eliminarMovimiento(id) {
    if (!confirm('¿Eliminar este movimiento del historial?')) return
    await supabase.from('movimientos').delete().eq('id', id)
    await cargarCorrales()
  }

  const byNum = Object.fromEntries(corrales.map(c => [c.numero, c]))
  const sel = seleccionado ? corrales.find(c => c.id === seleccionado.id) : null

  if (loading) return <div style={{ padding: '2rem', color: '#9E9A94', fontSize: 13 }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Corrales y tropas</h1>
        <div style={{ fontSize: 12, color: '#6B6760', fontFamily: 'monospace' }}>
          {corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado').length} activos · {corrales.filter(c => c.rol === 'libre').length} libres
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 12, padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: '1.25rem' }}>
            {['libre','cuarentena','acumulacion','clasificado','enfermeria','transitorio'].map(rol => {
              const c = ROL_COLOR[rol]
              return (
                <div key={rol} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B6760' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c.bg, border: `1px solid ${c.border}` }} />
                  {rol.charAt(0).toUpperCase() + rol.slice(1)}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {byNum['manga'] && <CorralBox c={byNum['manga']} label="Manga" sel={sel} onClick={c => { setSeleccionado(c); setVistaPanel('detalle') }} />}
              <div style={{ height: 6 }} />
              {['15','16','17'].filter(n => byNum[n]).map(n => <CorralBox key={n} c={byNum[n]} sel={sel} onClick={c => { setSeleccionado(c); setVistaPanel('detalle') }} />)}
            </div>

            <div>
              {LAYOUT.map((bloque, bi) => (
                <div key={bi} style={{ marginBottom: '1.1rem' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#9E9A94', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>{bloque.fila}</div>
                  {bloque.grupos.map((fila, fi) => (
                    <div key={fi} style={{ display: 'flex', gap: 7, marginBottom: fi === 0 ? 7 : 0 }}>
                      {fila.map(n => byNum[String(n)] ? <CorralBox key={n} c={byNum[String(n)]} sel={sel} onClick={c => { setSeleccionado(c); setVistaPanel('detalle') }} /> : null)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: '1.25rem', padding: '1rem 0', borderTop: '1px solid #E2DDD6' }}>
            {[
              { label: 'Total animales', val: corrales.reduce((a,c)=>a+(c.animales||0),0), color: '#1A1916' },
              { label: 'En cuarentena',  val: corrales.filter(c=>c.rol==='cuarentena').reduce((a,c)=>a+(c.animales||0),0), color: '#7A4500' },
              { label: 'Acumulacion',    val: corrales.filter(c=>c.rol==='acumulacion').reduce((a,c)=>a+(c.animales||0),0), color: '#1A3D6B' },
              { label: 'Enfermeria',     val: corrales.filter(c=>c.rol==='enfermeria').reduce((a,c)=>a+(c.animales||0),0), color: '#7A1A1A' },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: m.color }}>{m.val}</div>
                <div style={{ fontSize: 10, color: '#9E9A94', textTransform: 'uppercase', letterSpacing: '.04em' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 10, padding: '1.25rem', position: 'sticky', top: '1rem' }}>
          {!sel
            ? <div style={{ fontSize: 13, color: '#9E9A94', textAlign: 'center', padding: '2rem 0' }}>Toca un corral para ver el detalle y las acciones disponibles.</div>
            : (
              <>
                {vistaPanel === 'detalle' && <PanelDetalle corral={sel} corrales={corrales} onCambiarRol={cambiarRol} onMover={() => setVistaPanel('mover')} usuario={usuario} esDueno={esDueno} />}
                {vistaPanel === 'mover' && (
                  <PanelMover
                    corral={sel}
                    corrales={corrales}
                    form={movForm}
                    setForm={setMovForm}
                    onGuardar={moverAnimales}
                    onCancelar={() => setVistaPanel('detalle')}
                    guardando={guardando}
                  />
                )}
              </>
            )
          }
        </div>
      </div>

      {/* HISTORIAL DE MOVIMIENTOS */}
      <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 10, padding: '1.25rem', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.07em' }}>
            Historial de movimientos
          </div>
          <span style={{ fontSize: 11, color: '#9E9A94' }}>últimos 10 movimientos</span>
        </div>
        <div style={{ border: '1px solid #E2DDD6', borderRadius: 8, overflow: 'hidden', marginBottom: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F7F5F0' }}>
                {['Fecha', 'Tipo', 'Origen', 'Destino', 'Cantidad', 'Motivo', 'Registrado por', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#6B6760', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #E2DDD6', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#9E9A94', fontSize: 13 }}>No hay movimientos registrados.</td></tr>
              )}
              {movimientos.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #E2DDD6' }}>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                    {new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    <div style={{ fontSize: 10, color: '#9E9A94' }}>{new Date(m.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#E8EFF8', color: '#1A3D6B' }}>
                      {m.tipo || 'traslado'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>C-{m.origen?.numero || m.corral_origen_id}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>C-{m.destino?.numero || m.corral_destino_id}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{m.cantidad}</td>
                  <td style={{ padding: '9px 12px', color: '#6B6760' }}>{m.motivo || <span style={{ color: '#9E9A94' }}>—</span>}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12, color: '#6B6760' }}>{m.usuario?.nombre || '—'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <button onClick={() => eliminarMovimiento(m.id)}
                      style={{ background: '#FDF0F0', border: '1px solid #F09595', borderRadius: 5, color: '#7A1A1A', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Archivo */}
        {movArchivo.length > 0 && (
          <div>
            <button onClick={() => setVerArchivoMov(!verArchivoMov)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontSize: 12, background: 'transparent', border: '1px solid #E2DDD6', color: '#6B6760', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", marginBottom: '1rem' }}>
              {verArchivoMov ? '▾' : '▸'} Archivo ({movArchivo.length} movimientos anteriores)
            </button>
            {verArchivoMov && (
              <div style={{ border: '1px solid #E2DDD6', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F7F5F0' }}>
                      {['Fecha', 'Tipo', 'Origen', 'Destino', 'Cantidad', 'Motivo', 'Registrado por', ''].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#6B6760', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #E2DDD6', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movArchivo.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #E2DDD6', opacity: 0.75 }}>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                          {new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          <div style={{ fontSize: 10, color: '#9E9A94' }}>{new Date(m.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#E8EFF8', color: '#1A3D6B' }}>{m.tipo || 'traslado'}</span>
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>C-{m.origen?.numero || m.corral_origen_id}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>C-{m.destino?.numero || m.corral_destino_id}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{m.cantidad}</td>
                        <td style={{ padding: '9px 12px', color: '#6B6760' }}>{m.motivo || <span style={{ color: '#9E9A94' }}>—</span>}</td>
                        <td style={{ padding: '9px 12px', fontSize: 12, color: '#6B6760' }}>{m.usuario?.nombre || '—'}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <button onClick={() => eliminarMovimiento(m.id)}
                            style={{ background: '#FDF0F0', border: '1px solid #F09595', borderRadius: 5, color: '#7A1A1A', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CorralBox({ c, label, sel, onClick }) {
  const rc = ROL_COLOR[c.rol] || ROL_COLOR.libre
  const isSelected = sel?.id === c.id
  const pct = c.capacidad > 0 ? Math.round((c.animales||0) / c.capacidad * 100) : 0

  return (
    <div onClick={() => onClick(c)}
      style={{
        flex: 1, borderRadius: 8, border: `2px solid ${isSelected ? '#1A3D6B' : rc.border}`,
        padding: '.6rem .4rem', textAlign: 'center', cursor: 'pointer',
        background: rc.bg, opacity: c.rol === 'deshabilitado' ? .5 : 1, transition: 'all .15s',
        outline: isSelected ? '3px solid #1A3D6B' : 'none', outlineOffset: 2,
      }}>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: rc.text, lineHeight: 1, marginBottom: 2 }}>
        {label || c.numero}
      </div>
      <div style={{ fontSize: 9, color: rc.text, opacity: .8, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {c.rol === 'clasificado' ? (c.sub ? `Rango ${c.sub}` : 'Clasif.') : c.rol === 'deshabilitado' ? '-' : c.rol}
      </div>
      <div style={{ fontSize: 10, fontFamily: 'monospace', color: rc.text }}>{c.animales||0}/{c.capacidad}</div>
      <div style={{ height: 3, background: 'rgba(0,0,0,.1)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct>90?'#E24B4A':rc.border, borderRadius: 2 }} />
      </div>
    </div>
  )
}

function PanelDetalle({ corral, corrales, onCambiarRol, onMover, usuario, esDueno }) {
  const rc = ROL_COLOR[corral.rol] || ROL_COLOR.libre
  const pct = corral.capacidad > 0 ? Math.round((corral.animales||0) / corral.capacidad * 100) : 0
  const [cambiandoRol, setCambiandoRol] = useState(false)
  const [rolNuevo, setRolNuevo] = useState('')
  const [subNuevo, setSubNuevo] = useState('')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{corral.numero === 'manga' ? 'Manga' : `Corral ${corral.numero}`}</div>
        <span style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
          {corral.rol === 'clasificado' && corral.sub ? `Rango ${corral.sub}` : corral.rol}
        </span>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: '#6B6760' }}>Ocupacion</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{corral.animales||0} / {corral.capacidad} ({pct}%)</span>
        </div>
        <div style={{ height: 6, background: '#F7F5F0', borderRadius: 3, overflow: 'hidden', border: '1px solid #E2DDD6' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct>90?'#E24B4A':rc.border, borderRadius: 3 }} />
        </div>
      </div>

      {(corral.animales || 0) > 0 && (
        <button onClick={onMover}
          style={{ width: '100%', background: '#E8EFF8', border: '1px solid #378ADD', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: 600, color: '#1A3D6B', cursor: 'pointer', marginBottom: 10 }}>
          Mover animales a otro corral
        </button>
      )}

      {esDueno && (
        <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #E2DDD6' }}>
          {!cambiandoRol
            ? <button onClick={() => { setCambiandoRol(true); setRolNuevo(''); setSubNuevo('') }}
                style={{ background: '#F7F5F0', border: '1px solid #E2DDD6', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', color: '#6B6760' }}>
                Cambiar rol del corral
              </button>
            : (
              <div>
                <div style={{ fontSize: 11, color: '#6B6760', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Nuevo rol</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
                  {['libre','cuarentena','acumulacion','clasificado','enfermeria','transitorio','deshabilitado'].filter(r => r !== corral.rol).map(r => (
                    <button key={r} onClick={() => { setRolNuevo(r); if (r !== 'clasificado') setSubNuevo('') }}
                      style={{ border: `1px solid ${rolNuevo === r ? '#1A3D6B' : '#E2DDD6'}`, background: rolNuevo === r ? '#E8EFF8' : '#fff', borderRadius: 6, padding: '6px 8px', fontSize: 11, cursor: 'pointer', color: rolNuevo === r ? '#1A3D6B' : '#6B6760', fontWeight: rolNuevo === r ? 600 : 400 }}>
                      {r.charAt(0).toUpperCase()+r.slice(1)}
                    </button>
                  ))}
                </div>
                {rolNuevo === 'clasificado' && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#6B6760', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Rango</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                      {['A','B','C','D','E','F','G'].map(r => (
                        <button key={r} onClick={() => setSubNuevo(r)}
                          style={{ border: `1px solid ${subNuevo === r ? '#3D1A6B' : '#E2DDD6'}`, background: subNuevo === r ? '#F0EAFB' : '#fff', borderRadius: 6, padding: '6px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: subNuevo === r ? '#3D1A6B' : '#6B6760', fontFamily: 'monospace' }}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => {
                    if (!rolNuevo) { alert('Seleccioná un rol'); return }
                    if (rolNuevo === 'clasificado' && !subNuevo) { alert('Seleccioná el rango'); return }
                    onCambiarRol(corral.id, rolNuevo, rolNuevo === 'clasificado' ? subNuevo : null)
                    setCambiandoRol(false)
                  }}
                    style={{ flex: 1, background: '#1A3D6B', border: 'none', borderRadius: 6, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>
                    Confirmar
                  </button>
                  <button onClick={() => setCambiandoRol(false)}
                    style={{ flex: 1, border: '1px solid #E2DDD6', background: '#F7F5F0', borderRadius: 6, padding: '8px', fontSize: 12, cursor: 'pointer', color: '#9E9A94' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}

function PanelMover({ corral, corrales, form, setForm, onGuardar, onCancelar, guardando }) {
  const destinosDisponibles = corrales.filter(c => c.id !== corral.id && c.rol !== 'deshabilitado')
  const corralDestino = corrales.find(c => String(c.id) === String(form.destino_id))
  const destinoEsLibre = corralDestino?.rol === 'libre'

  const S = {
    border: '#E2DDD6', muted: '#6B6760', accent: '#1A3D6B', accentLight: '#E8EFF8',
    purple: '#3D1A6B', purpleLight: '#F0EAFB', bg: '#F7F5F0', surface: '#fff',
  }

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Mover animales</div>
      <div style={{ fontSize: 12, color: S.muted, marginBottom: '1rem' }}>
        Origen: Corral {corral.numero} · {corral.animales || 0} animales disponibles
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Corral destino</label>
        <select style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 13, background: S.surface }}
          value={form.destino_id} onChange={e => setForm({...form, destino_id: e.target.value, rolDestino: '', subDestino: ''})}>
          <option value="">Selecciona destino</option>
          {destinosDisponibles.map(c => (
            <option key={c.id} value={c.id}>
              Corral {c.numero} · {c.rol === 'libre' ? 'LIBRE' : c.rol === 'clasificado' && c.sub ? `Rango ${c.sub}` : c.rol} · {c.animales || 0} anim.
            </option>
          ))}
        </select>
      </div>

      {/* Si el destino es libre, pedir rol */}
      {destinoEsLibre && (
        <div style={{ background: S.accentLight, border: `1px solid #85B7EB`, borderRadius: 8, padding: '1rem', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.accent, textTransform: 'uppercase', marginBottom: 8 }}>
            Corral libre — ¿qué rol le asignás?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: form.rolDestino === 'clasificado' ? 8 : 0 }}>
            {['cuarentena','acumulacion','clasificado','enfermeria'].map(r => (
              <button key={r} onClick={() => setForm({...form, rolDestino: r, subDestino: ''})}
                style={{ border: `1px solid ${form.rolDestino === r ? S.accent : S.border}`, background: form.rolDestino === r ? S.accentLight : S.surface, borderRadius: 6, padding: '7px', fontSize: 12, fontWeight: form.rolDestino === r ? 600 : 400, cursor: 'pointer', color: form.rolDestino === r ? S.accent : S.muted }}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          {form.rolDestino === 'clasificado' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.purple, textTransform: 'uppercase', marginBottom: 6 }}>Rango</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {['A','B','C','D','E','F','G'].map(r => (
                  <button key={r} onClick={() => setForm({...form, subDestino: r})}
                    style={{ border: `1px solid ${form.subDestino === r ? S.purple : S.border}`, background: form.subDestino === r ? S.purpleLight : S.surface, borderRadius: 6, padding: '7px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: form.subDestino === r ? S.purple : S.muted, fontFamily: 'monospace' }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Cantidad a mover</label>
        <input type="number" min="1" max={corral.animales || 0} placeholder="0"
          value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})}
          style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: '#9E9A94', marginTop: 3 }}>Max: {corral.animales || 0} animales</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Motivo (opcional)</label>
        <input type="text" placeholder="ej. clasificacion, enfermedad, etc."
          value={form.motivo} onChange={e => setForm({...form, motivo: e.target.value})}
          style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancelar}
          style={{ flex: 1, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '9px', fontSize: 13, cursor: 'pointer', color: S.muted }}>
          Cancelar
        </button>
        <button onClick={onGuardar} disabled={guardando}
          style={{ flex: 1, background: S.accent, border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>
          {guardando ? 'Moviendo...' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}
