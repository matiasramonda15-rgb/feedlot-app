import { supabase } from '../supabase'

const ITEMS = [
  { id: 'tablero',      label: 'Tablero',              roles: ['dueno','secretaria','encargado','empleado'] },
  { id: 'corrales',     label: 'Corrales y tropas',    roles: ['dueno','secretaria','encargado','empleado'] },
  { id: 'ingresos',     label: 'Ingresos',             roles: ['dueno','secretaria','encargado','empleado'] },
  { id: 'pesada',       label: 'Pesada y clasificación', roles: ['dueno','encargado','empleado'] },
  { id: 'sanidad',      label: 'Sanidad',              roles: ['dueno','secretaria','encargado','empleado'] },
  { id: 'alimentacion', label: 'Alimentación',         roles: ['dueno','encargado','empleado'] },
  { id: 'ventas',       label: 'Ventas',               roles: ['dueno','secretaria'] },
]

const REPORTES = [
  { id: 'rentabilidad', label: 'Rentabilidad',   roles: ['dueno'] },
  { id: 'gdp',          label: 'GDP y conversión', roles: ['dueno'] },
  { id: 'costos',       label: 'Costos',          roles: ['dueno'] },
]

export default function Sidebar({ modulo, setModulo, usuario, onLogout }) {
  const rol = usuario?.rol || 'empleado'

  const itemsFiltrados = ITEMS.filter(i => i.roles.includes(rol))
  const reportesFiltrados = REPORTES.filter(i => i.roles.includes(rol))

  return (
    <aside style={{ background: '#1A3D6B', padding: '1.25rem 0', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, overflowY: 'auto' }}>
      <div style={{ padding: '0 1.25rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.1)', marginBottom: '1rem' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: '.08em', textTransform: 'uppercase' }}>Feedlot</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>Sistema de gestión</div>
      </div>

      <NavSection label="Principal" items={itemsFiltrados} modulo={modulo} setModulo={setModulo} />

      {reportesFiltrados.length > 0 && (
        <NavSection label="Reportes" items={reportesFiltrados} modulo={modulo} setModulo={setModulo} />
      )}

      <div style={{ marginTop: 'auto', padding: '1rem .75rem', borderTop: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ padding: '7px 10px', marginBottom: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{usuario?.nombre || 'Usuario'}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>{usuario?.rol}</div>
        </div>
        <button onClick={onLogout} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,.15)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", textAlign: 'left' }}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

function NavSection({ label, items, modulo, setModulo }) {
  return (
    <div style={{ padding: '0 .75rem', marginBottom: '1.25rem' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.3)', letterSpacing: '.1em', textTransform: 'uppercase', padding: '0 .5rem', marginBottom: '.4rem' }}>{label}</div>
      {items.map(item => (
        <div key={item.id} onClick={() => setModulo(item.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
            color: modulo === item.id ? '#fff' : 'rgba(255,255,255,.6)',
            background: modulo === item.id ? 'rgba(255,255,255,.15)' : 'transparent',
            fontWeight: modulo === item.id ? 500 : 400,
            fontSize: 12, marginBottom: 2, transition: 'all .15s',
          }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: modulo === item.id ? '#7EB8F7' : 'rgba(255,255,255,.3)', flexShrink: 0 }} />
          {item.label}
        </div>
      ))}
    </div>
  )
}
