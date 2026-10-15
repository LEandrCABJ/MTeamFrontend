import { useCallback, useEffect, useRef, useState } from 'react'
import { backendApi, type Notification } from '../../service/backend-api'
import { formatDateTime } from '../../service/date-time'
import { useApiResource } from '../../hooks/use-api-resource'
import { EmptyState, ErrorState, LoadingState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { PageHeader } from '../workspace/PageHeader'
import { NOTIFICATION_POLL_INTERVAL_MS } from './notifications-context'
import { useNotifications } from './use-notifications'
import './communications.css'

const RETURN_REFRESH_MIN_GAP_MS = 5_000

function typeLabel(notification: Notification) {
  const labels: Record<Notification['type'], string> = { MEMBERSHIP_PRICE_CHANGED: 'Cuota', MEMBERSHIP_EXPIRING: 'Cuota', MEMBERSHIP_EXPIRED: 'Cuota', MEDICAL_CERTIFICATE_REVIEWED: 'Apto médico', CLASS_CHANGED: 'Clases', EVENT_CANCELLED: 'Eventos', GENERAL: 'General' }
  return labels[notification.type]
}

function iconFor(notification: Notification) {
  if (notification.type === 'EVENT_CANCELLED') return 'trophy'
  if (notification.type === 'CLASS_CHANGED') return 'calendar'
  if (notification.type === 'MEDICAL_CERTIFICATE_REVIEWED') return 'file'
  return 'bell'
}

export function NotificationsScreen() {
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [failedNotification, setFailedNotification] = useState<Notification | 'all' | null>(null)
  const isSavingRef = useRef(false)
  const lastRefreshAt = useRef(0)
  const { unreadCount, refreshUnreadCount, syncUnreadCount } = useNotifications()
  const loader = useCallback(() => backendApi.listNotifications({ page, limit: 20 }), [page])
  const { data, loading, error, reload, refresh } = useApiResource(loader)

  // The account-wide counter, not the page on screen, decides whether "mark all" has anything to do.
  const reportedUnread = data?.unreadCount
  const unreadTotal = reportedUnread ?? unreadCount ?? data?.items.filter((item) => !item.readAt).length ?? 0

  useEffect(() => {
    if (reportedUnread !== undefined) syncUnreadCount(reportedUnread)
  }, [reportedUnread, syncUnreadCount])

  // New notifications can arrive while the screen stays open: refresh in the background every minute
  // and when the user comes back to the tab, without replacing the list by a loading state.
  useEffect(() => {
    const refreshWhenVisible = (minGap: number) => () => {
      if (document.visibilityState !== 'visible' || isSavingRef.current) return
      if (Date.now() - lastRefreshAt.current < minGap) return
      lastRefreshAt.current = Date.now()
      void refresh()
    }
    const poll = refreshWhenVisible(0)
    const onReturn = refreshWhenVisible(RETURN_REFRESH_MIN_GAP_MS)
    const interval = window.setInterval(poll, NOTIFICATION_POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
    }
  }, [refresh])

  async function saveReadStatus(notification: Notification | 'all') {
    if (isSavingRef.current || (notification !== 'all' && notification.readAt)) return
    isSavingRef.current = true
    setIsSaving(true)
    setActionError('')
    setSuccessMessage('')
    setFailedNotification(null)
    try {
      if (notification === 'all') await backendApi.markAllNotificationsAsRead()
      else await backendApi.markNotificationAsRead(notification.id)
      setSuccessMessage(notification === 'all' ? 'Todas las notificaciones se marcaron como leídas.' : 'Notificación marcada como leída.')
      await Promise.all([reload(), refreshUnreadCount()])
    } catch {
      setActionError('No se pudo guardar el estado de lectura. Intentá nuevamente.')
      setFailedNotification(notification)
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  return <div className="app-page communications-page">
    <PageHeader title="Notificaciones" description="Avisos de tu cuenta y novedades operativas.">
      <button type="button" className="button button-secondary" onClick={() => void saveReadStatus('all')} disabled={isSaving || loading || !!error || unreadTotal === 0}><Icon name="check" size={16}/>Marcar todas como leídas</button>
    </PageHeader>
    {actionError && <div className="notification-feedback error-message" role="alert"><p>{actionError}</p>{failedNotification && <button type="button" className="button button-secondary" disabled={isSaving} onClick={() => void saveReadStatus(failedNotification)}>Reintentar</button>}</div>}
    {successMessage && <p className="notification-feedback" role="status">{successMessage}</p>}
    {isSaving && <p role="status">Guardando estado de lectura…</p>}
    {loading ? <LoadingState message="Cargando notificaciones…"/> : error ? <ErrorState message={error} retry={() => void reload()}/> : !data?.items.length ? <EmptyState message="No tenés notificaciones para mostrar."/> : <div className="notification-list">
      {data.items.map((notification) => <article key={notification.id} className={`notification-item ${notification.readAt ? '' : 'is-unread'}`}>
        <span className="notification-icon"><Icon name={iconFor(notification)} size={18}/></span>
        <div>
          <div className="notification-meta"><span>{typeLabel(notification)}</span><span className="notification-read-status">{notification.readAt ? 'Leída' : 'No leída'}</span><time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time></div>
          <h2>{notification.title}</h2>
          <p>{notification.message}</p>
          {!notification.readAt && <button type="button" className="text-link" disabled={isSaving} onClick={() => void saveReadStatus(notification)}>Marcar como leída</button>}
        </div>
      </article>)}
    </div>}
    {data && data.total > data.limit && <div className="table-pagination"><span>Página {page} de {Math.ceil(data.total / data.limit)}</span><div><button type="button" className="button button-secondary" disabled={isSaving || loading || page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" className="button button-secondary" disabled={isSaving || loading || page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>}
  </div>
}
