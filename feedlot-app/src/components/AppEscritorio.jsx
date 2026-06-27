import { useState, Suspense, lazy } from 'react'
import Sidebar from './Sidebar'

var Tablero      = lazy(() => import('./Tablero'))
var Corrales     = lazy(() => import('./Corrales'))
var Ingresos     = lazy(() => import('./Ingresos'))
var Pesada       = lazy(() => import('./Pesada'))
var Ventas       = lazy(() => import('./Ventas'))
var Alimentacion = lazy(() => import('./Alimentacion'))
var Sanidad      = lazy(() => import('./Sanidad'))
var Reportes     = lazy(() => import('./Reportes'))
var Agricultura  = lazy(() => import('./Agricultura'))
var Servicios    = lazy(() => import('./Servicios'))
var Personal     = lazy(() => import('./Personal'))
var Gastos       = lazy(() => import('./Gastos'))
var Comercial    = lazy(() => import('./Comercial'))
var Contactos    = lazy(() => import('./Contactos'))
var Activos      = lazy(() => import('./Activos'))
var Insumos      = lazy(() => import('./Insumos'))

function Placeholder({ titulo, descripcion }) {
  return (
    <div style={{ padding: '3rem', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{titulo}</div>
      <div style={{ fontSize: 14, color: '#6B6760' }}>{descripcion}</div>
    </div>
  )
}

const MODULOS = {
  tablero:      Tablero,
  corrales:     Corrales,
  ingresos:     Ingresos,
  pesada:       Pesada,
  ventas:       Ventas,
  alimentacion: Alimentacion,
  sanidad:      Sanidad,
  reportes:     Reportes,
  agricultura:  Agricultura,
  servicios:    Servicios,
  personal:     Personal,
  gastos:       Gastos,
  comercial:    Comercial,
  contactos:    Contactos,
  activos:      Activos,
  socios:       Activos,
  insumos:      Insumos,
}

function LoadingModulo() {
  return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#9E9A94', fontSize: 13 }}>
      Cargando...
    </div>
  )
}

export default function AppEscritorio({ usuario, onLogout }) {
  const [modulo, setModulo] = useState('tablero')
  const Componente = MODULOS[modulo] || Tablero
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif", background: '#F7F5F0' }}>
      <Sidebar modulo={modulo} setModulo={setModulo} usuario={usuario} onLogout={onLogout} />
      <main style={{ padding: '1.75rem', overflowX: 'hidden' }}>
        <Suspense fallback={<LoadingModulo />}>
          <Componente usuario={usuario} />
        </Suspense>
      </main>
    </div>
  )
}
