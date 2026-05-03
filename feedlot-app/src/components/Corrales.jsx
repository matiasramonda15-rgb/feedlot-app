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
    numero:    c.numero || c['numero'] || String(c.id),
    capacidad: c.capacidad || c['Capacidad'] || 100,
    rol:       (c.rol || 'libre').toLowerCase(),
    sub:       c.sub || c['Suplente'] || null,
    activo:    c.activo ?? c['Activo'] ?? true,
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
  const [movForm, setMovForm] = useState({ destino_id: '', cantidad: '', motivo: '' })
  const [guardando, setGuardando] = useState(false)
  const esDueno = ['dueno'].includes(usuario?.rol)

  useEffect(() => { cargarCorrales() }, [])

  async function cargarCorrales() {
    const { data, error } = await supabase.from('corrales').select('*').order('id')
    if (error) console.error('Error cargando corrales:', error)
    console.log('Datos recibidos:', data)
    setCorrales((data || []).map(normalizar))
    setLoading(false)
  }

  async function cambiarRol(corralId, nuevoRol) {
    await supabase.from('corrales').update({ rol: nuevoRol }).eq('id', corralId)
    await cargarCorrales()
    setSeleccionado(prev => prev ? {...prev, rol: nuevoRol} : prev)
  }

  async function moverAnimales() {
    const sel = corrales.find(c => c.id === seleccionado?.id)
    if (!movForm.destino_id) { alert('Selecciona el corral destino'); return }
    if (!movForm.cantidad || parseInt(movForm.cantidad) <= 0) { alert('Ingresa la cantidad'); return }
    const cantidad = parseInt(movForm.cantidad)
    if (cantidad > (sel?.animales || 0)) { alert(`No hay suficientes animales. Disponibles: ${sel?.animales}`); return }
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

    await supabase.from('corrales').update({ animales: (sel.animales || 0) - cantidad }).eq('id', sel.id)
    const { data: dest } = await supabase.from('corrales').select('animales').eq('id', destinoId).single()
    await supabase.from('corrales').update({ animales: (dest?.animales || 0) + cantidad }).eq('id', destinoId)

    await cargarCorrales()
    setMovForm({ destino_id: '', cantidad: '', motivo: '' })
    setVistaPanel('detalle')
    setGuardando(false)
    alert(`${cantidad} animales movidos correctamente`)
  }

  const byNum = Object.fromEntries(corrales.map(c => [c.numero, c]))
  const sel = seleccionado ? corrales.find(c => c.id === seleccionado.id) : null

  if (loading) return <div style={{ padding: '2rem', color: '#9E9A94', fontSize: 13 }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Corrales y tropas</h1>
        <div style={{ fontSize: 12, color: '#6B6760', fontFamily: 'monospace' }}>
          {corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado').length} activos - {corrales.filter(c => c.rol === 'libre').length} libres
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
    </div>
  )
}

function CorralBox({ c, label, sel, onClick }) {
  const rc = ROL_COLOR[c.rol] || ROL_COLOR.libre
  const isSelected = sel?.id === c.id
  const pct = c.capacidad > 0 ? Math.round((c.animales||0) / c.capacidad * 100) : 0
  const disabled = false

  return (
    <div onClick={() => !disabled && onClick(c)}
      style={{
        flex: 1, borderRadius: 8, border: `2px solid ${isSelected ? '#1A3D6B' : rc.border}`,
        padding: '.6rem .4rem', textAlign: 'center', cursor: disabled ? 'default' : 'pointer',
        background: rc.bg, opacity: c.rol === 'deshabilitado' ? .5 : 1, transition: 'all .15s',
        outline: isSelected ? '3px solid #1A3D6B' : 'none', outlineOffset: 2,
      }}>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: rc.text, lineHeight: 1, marginBottom: 2 }}>
        {label || c.numero}
      </div>
      <div style={{ fontSize: 9, color: rc.text, opacity: .8, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {c.rol === 'clasificado' ? (c.sub?.split('·')[0]?.trim() || 'Clasif.') : c.rol === 'deshabilitado' ? '-' : c.rol}
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{corral.numero === 'manga' ? 'Manga' : `Corral ${corral.numero}`}</div>
        <span style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{corral.rol}</span>
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
          <div style={{ fontSize: 11, color: '#6B6760', marginBottom: 8 }}>
            {cambiandoRol ? 'Selecciona el nuevo rol:' : (
              <button onClick={() => setCambiandoRol(true)}
                style={{ background: '#F7F5F0', border: '1px solid #E2DDD6', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', color: '#6B6760' }}>
                Cambiar rol del corral
              </button>
            )}
          </div>
          {cambiandoRol && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {['libre','cuarentena','acumulacion','clasificado','enfermeria','transitorio','deshabilitado'].filter(r => r !== corral.rol).map(r => (
                <button key={r} onClick={() => { onCambiarRol(corral.id, r); setCambiandoRol(false) }}
                  style={{ border: '1px solid #E2DDD6', background: '#fff', borderRadius: 6, padding: '6px 8px', fontSize: 11, cursor: 'pointer', color: '#6B6760' }}>
                  {r.charAt(0).toUpperCase()+r.slice(1)}
                </button>
              ))}
              <button onClick={() => setCambiandoRol(false)}
                style={{ border: '1px solid #E2DDD6', background: '#F7F5F0', borderRadius: 6, padding: '6px 8px', fontSize: 11, cursor: 'pointer', color: '#9E9A94', gridColumn: '1/-1' }}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PanelMover({ corral, corrales, form, setForm, onGuardar, onCancelar, guardando }) {
  const destinosDisponibles = corrales.filter(c => c.id !== corral.id && c.rol !== 'deshabilitado')

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Mover animales</div>
      <div style={{ fontSize: 12, color: '#6B6760', marginBottom: '1rem' }}>
        Origen: Corral {corral.numero} - {corral.animales || 0} animales disponibles
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Corral destino</label>
        <select style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, background: '#fff' }}
          value={form.destino_id} onChange={e => setForm({...form, destino_id: e.target.value})}>
          <option value="">Selecciona destino</option>
          {destinosDisponibles.map(c => (
            <option key={c.id} value={c.id}>Corral {c.numero} - {c.rol} - {c.animales || 0} anim.</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Cantidad a mover</label>
        <input type="number" min="1" max={corral.animales || 0} placeholder="0"
          value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})}
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: '#9E9A94', marginTop: 3 }}>Max: {corral.animales || 0} animales</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Motivo (opcional)</label>
        <input type="text" placeholder="ej. clasificacion, enfermedad, etc."
          value={form.motivo} onChange={e => setForm({...form, motivo: e.target.value})}
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancelar}
          style={{ flex: 1, background: '#F7F5F0', border: '1px solid #E2DDD6', borderRadius: 8, padding: '9px', fontSize: 13, cursor: 'pointer', color: '#6B6760' }}>
          Cancelar
        </button>
        <button onClick={onGuardar} disabled={guardando}
          style={{ flex: 1, background: '#1A3D6B', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>
          {guardando ? 'Moviendo...' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}
