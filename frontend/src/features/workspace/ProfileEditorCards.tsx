import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { UserRole } from '../authentication/auth-types'
import { backendApi, type OwnProfile } from '../../service/backend-api'
import { Icon } from './Icon'
import { UserAvatar } from './UserAvatar'
export function ContactDataCard({ profile, role, onUpdated, onCancel }: { profile: OwnProfile; role: UserRole; onUpdated: (profile: OwnProfile) => void; onCancel?: () => void }) {
  const [email, setEmail] = useState(profile.email)
  const [phone, setPhone] = useState(profile.phone)
  const [emergencyName, setEmergencyName] = useState(profile.memberProfile?.emergencyContactName ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(profile.memberProfile?.emergencyContactPhone ?? '')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    setError('')
    try {
      const updated = await backendApi.updateOwnProfile({
        email,
        phone,
        ...(role === 'MEMBER' ? { emergencyContactName: emergencyName, emergencyContactPhone: emergencyPhone } : {}),
      })
      onUpdated(updated)
      setNotice('Cambios guardados correctamente.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setEmail(profile.email)
    setPhone(profile.phone)
    setEmergencyName(profile.memberProfile?.emergencyContactName ?? '')
    setEmergencyPhone(profile.memberProfile?.emergencyContactPhone ?? '')
    setNotice('')
    setError('')
    onCancel?.()
  }

  return <section className="surface-card profile-section profile-contact-section" aria-labelledby="contact-data-title">
    <h2 id="contact-data-title">Datos de contacto</h2>
    <form onSubmit={submit}>
      <div className="profile-edit-grid">
        <EditableField label="Correo electrónico" value={email} type="email" onChange={setEmail}/>
        <EditableField label="Teléfono" value={phone} type="tel" onChange={setPhone}/>
      </div>
      {role === 'MEMBER' && <div className="profile-emergency-block"><h3>Contacto de emergencia</h3><div className="profile-edit-grid"><EditableField label="Nombre y apellido" value={emergencyName} onChange={setEmergencyName}/><EditableField label="Teléfono" value={emergencyPhone} type="tel" onChange={setEmergencyPhone}/></div></div>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="profile-form-actions">
        <button type="button" className="button button-secondary" onClick={cancel}>Cancelar</button>
        <button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
      {role === 'MEMBER' && <Link className="button button-secondary profile-mobile-medical-button" to="/socio/apto-medico"><Icon name="file" size={18}/>Apto médico</Link>}
    </form>
  </section>
}

export function ProfileIdentityCard({ profile, role, onUpdated }: { profile: OwnProfile; role: UserRole; onUpdated: (profile: OwnProfile) => void }) {
  const [photoSaving, setPhotoSaving] = useState(false)
  const [error, setError] = useState('')

  async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('La foto debe estar en formato JPG o PNG.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La foto no puede superar los 5 MB.')
      return
    }
    setPhotoSaving(true)
    try {
      onUpdated(await backendApi.updateOwnPhoto(file))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo actualizar la foto de perfil.')
    } finally {
      setPhotoSaving(false)
    }
  }

  return <section className="surface-card profile-section profile-identity-section" aria-label="Resumen del perfil">
    <div className="profile-identity-avatar"><UserAvatar {...profile} className="profile-photo"/></div>
    <h2>{profile.firstName} {profile.lastName}</h2>
    {role === 'TRAINER' && <p className="trainer-profile-specialty">{profile.trainerProfile?.specialty || 'Especialidad no informada'}</p>}
    <span className="member-status">{role === 'MEMBER' ? 'Socio' : role === 'TRAINER' ? 'Entrenador' : 'Administrador'} · Cuenta {profile.status === 'ACTIVE' ? 'activa' : 'inactiva'}</span>
    <label className="button button-secondary profile-photo-action" htmlFor="profile-photo"><Icon name="image" size={18}/>{photoSaving ? 'Subiendo…' : 'Cambiar fotografía'}</label>
    <input id="profile-photo" className="sr-only" type="file" accept="image/jpeg,image/png" onChange={changePhoto} disabled={photoSaving}/>
    <small className="field-hint">JPG o PNG · máximo 5 MB</small>
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>
}

export function SecurityCard({ onPasswordChange }: { onPasswordChange: () => void }) {
  return <section className="surface-card profile-section profile-security-section" aria-labelledby="security-title">
    <h2 id="security-title">Seguridad</h2>
    <p>Protegé tu cuenta con una contraseña segura.</p>
    <button type="button" className="button button-secondary" onClick={onPasswordChange}><Icon name="lock" size={18}/>Cambiar contraseña</button>
  </section>
}

function EditableField({ label, value, type = 'text', onChange }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return <label className="read-field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)}/></label>
}
