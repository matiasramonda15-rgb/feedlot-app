import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const ROL_COLOR = {
  libre:        { bg: '#E8F4EB', border: '#7BC67A', text: '#1E5C2E' },
  Libre:        { bg: '#E8F4EB', border: '#7BC67A', text: '#1E5C2E' },
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
    numero:    c.numero || c['número'] || String(c.id),
    capacidad: c.capacidad || c['Capacidad'] || 100,
    rol:       (c.rol || 'libre').toLowerCase(),
    sub:       c.sub || c['Suplente'] || null,
    activo:    c.activo ?? c['Activo'] ?? true,
    animales:  c.animales || 0,
    gdp:       c.gdp || null,
    peso_prom_actual: c.peso_prom_actual || null,
  }
}

const LAYOUT = [
  { fila: 'Corrales 1–8 · cap. 100', grupos: [[4,3,2,1],[5,6,7,8]] },
  { fila: 'Corrales 9–14',           grupos: [[11,10,9],[12,13,14]] },
]

export default function Corrales({ usuario }) {
  const [corrales, setCorrales] = useState([])
  const [seleccionado, setSeleccionado] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarCorrales() }, [])

  async function cargarCorrales() {
    const { data, error } = await supabase.from('corrales').select('*').order('id')
    if (error) console.error('Error cargando corrales:', error)
    setCorrales((data || []).map(normalizar))
    setLoading(false)
  }

  async function cambiarRol(corralId, nuevoRol) {
    await supabase.from('corrales').update({ rol: nuevoRol, actualizado: new Date().toISOString() }).eq('id', corralId)
    await cargarCorrales()
  }

  const byNum = Object.fromEntries(corrales.map(c => [c.numero, c]))
  const sel = seleccionado ? corrales.find(c => c.id === seleccionado.id) : null

  if (loading) return <div style={{ padding: '2rem', color: '#9E9A94', fontSize: 13 }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Corrales y tropas</h1>
        <div style={{ fontSize: 12, color: '#6B6760', fontFamily: "'IBM Plex Mono', monospace" }}>
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
              {byNum['manga'] && <CorralBox c={byNum['manga']} label="Manga" sel={sel} onClick={setSeleccionado} />}
              <div style={{ height: 6 }} />
              {['15','16','17'].filter(n => byNum[n]).map(n => <CorralBox key={n} c={byNum[n]} sel={sel} onClick={setSeleccionado} />)}
            </div>
            <div>
              {LAYOUT.map((bloque, bi) => (
                <div key={bi} style={{ marginBottom: '1.1rem' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#9E9A94', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>{bloque.fila}</div>
                  {bloque.grupos.map((fila, fi) => (
                    <div key={fi} style={{ display: 'flex', gap: 7, marginBottom: fi === 0 ? 7 : 0 }}>
                      {fila.map(n => byNum[String(n)] ? <CorralBox key={n} c={byNum[String(n)]} sel={sel} onClick={setSeleccionado} /> : null)}
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
              { label: 'Acumulación',    val: corrales.filter(c=>c.rol==='acumulacion').reduce((a,c)=>a+(c.animales||0),0), color: '#1A3D6B' },
              { label: 'Enfermería',     val: corrales.filter(c=>c.rol==='enfermeria').reduce((a,c)=>a+(c.animales||0),0), color: '#7A1A1A' },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: m.color }}>{m.val}</div>
                <div style={{ fontSize: 10, color: '#9E9A94', textTransform: 'uppercase', letterSpacing: '.04em' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 10, padding: '1.25rem', position: 'sticky', top: '1rem' }}>
          {!sel
            ? <div style={{ fontSize: 13, color: '#9E9A94', textAlign: 'center', padding: '2rem 0' }}>Tocá un corral para ver el detalle y las acciones disponibles.</div>
            : <PanelDetalle corral={sel} onCambiarRol={cambiarRol} usuario={usuario} />
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
  const disabled = c.rol === 'deshabilitado'

  return (
    <div onClick={() => !disabled && onClick(c)}
      style={{
        flex: 1, borderRadius: 8, border: `2px solid ${isSelected ? '#1A3D6B' : rc.border}`,
        padding: '.6rem .4rem', textAlign: 'center', cursor: disabled ? 'default' : 'pointer',
        background: rc.bg, opacity: disabled ? .4 : 1, transition: 'all .15s',
        outline: isSelected ? '3px solid #1A3D6B' : 'none', outlineOffset: 2,
      }}>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: rc.text, lineHeight: 1, marginBottom: 2 }}>
        {label || c.numero}
      </div>
      <div style={{ fontSize: 9, color: rc.text, opacity: .8, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {c.rol === 'clasificado' ? (c.sub?.split('·')[0]?.trim() || 'Clasif.') : c.rol === 'deshabilitado' ? '—' : c.rol}
      </div>
      <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: rc.text }}>{c.animales||0}/{c.capacidad}</div>
      <div style={{ height: 3, background: 'rgba(0,0,0,.1)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct>90?'#E24B4A':rc.border, borderRadius: 2 }} />
      </div>
    </div>
  )
}

function PanelDetalle({ corral, onCambiarRol, usuario }) {
  const rc = ROL_COLOR[corral.rol] || ROL_COLOR.libre
  const pct = corral.capacidad > 0 ? Math.round((corral.animales||0) / corral.capacidad * 100) : 0
  const esDueno = ['dueno'].includes(usuario?.rol)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{corral.numero === 'manga' ? 'Manga' : `Corral ${corral.numero}`}</div>
        <span style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{corral.rol}</span>
      </div>
      <div style={{ fontSize: 12, color: '#9E9A94', marginBottom: '1rem' }}>{corral.sub || 'Sin asignación específica'}</div>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: '#6B6760' }}>Ocupación</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{corral.animales||0} / {corral.capacidad} ({pct}%)</span>
        </div>
        <div style={{ height: 6, background: '#F7F5F0', borderRadius: 3, overflow: 'hidden', border: '1px solid #E2DDD6' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct>90?'#E24B4A':rc.border, borderRadius: 3 }} />
        </div>
      </div>
      {esDueno && corral.rol === 'libre' && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #E2DDD6' }}>
          <div style={{ fontSize: 11, color: '#6B6760', marginBottom: 8 }}>Asignar rol:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {['cuarentena','acumulacion','enfermeria','transitorio'].map(r => (
              <button key={r} onClick={() => onCambiarRol(corral.id, r)}
                style={{ border: '1px solid #E2DDD6', background: '#fff', borderRadius: 6, padding: '6px 8px', fontSize: 11, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", color: '#6B6760' }}>
                {r.charAt(0).toUpperCase()+r.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F7F5F0' }}>
      <span style={{ color: '#6B6760', fontSize: 13 }}>{label}</span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: color || '#1A1916', fontSize: 13 }}>{value}</span>
    </div>
  )
}
