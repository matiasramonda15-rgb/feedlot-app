import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './components/Login'
import AppEscritorio from './components/AppEscritorio'
import AppMovil from './mobile/AppMovil'

export default function App() {
  const [session, setSession] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)
  const [esMobil, setEsMobil] = useState(false)

  useEffect(() => {
    // Detectar si es móvil
    setEsMobil(window.innerWidth < 768)
    window.addEventListener('resize', () => setEsMobil(window.innerWidth < 768))

    // Verificar sesión activa
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) cargarUsuario(session.user.id)
      else setLoading(false)
    })

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) cargarUsuario(session.user.id)
      else { setUsuario(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function cargarUsuario(userId) {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single()
    setUsuario(data)
    setLoading(false)
  }

  if (loading) return <Splash />

  if (!session) return <Login />

  // Empleados de campo → app móvil (también si acceden desde celu)
  const esEmpleado = usuario?.rol === 'empleado' || usuario?.rol === 'encargado'
 if (esEmpleado && esMobil) {
    return <AppMovil usuario={usuario} onLogout={() => supabase.auth.signOut()} />
  }

  return <AppEscritorio usuario={usuario} onLogout={() => supabase.auth.signOut()} />
}

function Splash() {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F7F5F0', fontFamily: "'IBM Plex Sans', sans-serif"
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A3D6B', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Feedlot
        </div>
        <div style={{ fontSize: 12, color: '#9E9A94' }}>Cargando...</div>
      </div>
    </div>
  )
}
