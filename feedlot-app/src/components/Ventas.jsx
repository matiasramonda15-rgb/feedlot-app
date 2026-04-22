// Ventas.jsx
export default function Ventas() {
  return <Placeholder titulo="Compra / Venta" sub="Registro de compras y ventas de hacienda" />
}

// Alimentacion.jsx — en su propio archivo
export function AlimentacionMod() {
  return <Placeholder titulo="Alimentación" sub="Registro diario de mixers y stock de insumos" />
}

// Sanidad.jsx — en su propio archivo
export function SanidadMod() {
  return <Placeholder titulo="Sanidad" sub="Protocolo de ingreso · revisión bisemanal · historial" />
}

function Placeholder({ titulo, sub }) {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{titulo}</h1>
      <div style={{ fontSize: 12, color: '#6B6760', fontFamily: "'IBM Plex Mono', monospace", marginBottom: '1.5rem' }}>{sub}</div>
      <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 10, padding: '2rem', textAlign: 'center', color: '#9E9A94', fontSize: 13 }}>
        Módulo en integración — disponible en la próxima sesión.
      </div>
    </div>
  )
}
