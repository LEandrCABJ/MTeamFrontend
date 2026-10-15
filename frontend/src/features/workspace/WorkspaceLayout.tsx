import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AuthUser } from '../authentication/auth-types'
import { Icon } from './Icon'
import { MobileTabBar } from './MobileTabBar'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { UserAvatar } from './UserAvatar'
import { ROLE_BASE, ROLE_LABEL, type NavEntry } from './navigation'
import './workspace-user.css'

export function WorkspaceLayout({ user, active, title, notice, onDismissNotice, onLogout, mobileBackHref, mobileTitle, children }: {
  user: AuthUser
  active: NavEntry
  title: string
  notice?: string
  onDismissNotice: () => void
  onLogout: () => void
  mobileBackHref?: string
  mobileTitle?: string
  children: ReactNode
}) {
  return <div className="app-shell">
    <WorkspaceSidebar user={user} active={active} onLogout={onLogout}/>
    <div className="app-main">
      {user.role !== 'ADMIN' && <section className="mobile-user-bar" aria-label="Cuenta de usuario">
        <Link className="mobile-user-profile" to={`${ROLE_BASE[user.role]}/perfil`} aria-label="Ir a mi perfil">
          <UserAvatar {...user}/>
          <span><strong>{user.firstName} {user.lastName}</strong><small>{ROLE_LABEL[user.role]}</small></span>
        </Link>
        <button type="button" className="mobile-user-logout" onClick={onLogout}><Icon name="logout" size={18}/><span>Cerrar sesión</span></button>
      </section>}
      <header className="app-topbar">
        {mobileBackHref && <Link className="app-topbar-back" to={mobileBackHref} aria-label="Volver"><Icon name="back" size={22}/></Link>}
        <h1 className="app-topbar-title">{mobileTitle ?? title}</h1>
      </header>
      <main className="app-content">
        {notice && <div className="app-notice-error" role="alert"><Icon name="alert" size={20}/><span>{notice}</span><button type="button" className="text-link" onClick={onDismissNotice}>Cerrar</button></div>}
        {children}
      </main>
    </div>
    <MobileTabBar role={user.role} active={active}/>
  </div>
}
