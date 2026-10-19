import { useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi, type Branch } from '../../service/backend-api'
import { EmptyState, ErrorState, LoadingState, UnavailableState } from '../workspace/ApiStates'
import { Icon } from '../workspace/Icon'
import { SafeImage } from '../workspace/SafeImage'

export function PublicSite() {
  const { pathname } = useLocation()
  const active = pathname === '/' ? 'Inicio' : pathname === '/preguntas-frecuentes' ? 'preguntas-frecuentes' : pathname.slice(1).split('/')[0]
  return <div className="public-site">
    <header className="public-header">
      <Link className="brand-lockup" to="/" aria-label="M-Team Gimnasio, inicio"><span className="brand-mark">M</span><span>M-TEAM <b>GIMNASIO</b></span></Link>
      <nav className="public-nav" aria-label="Navegación principal">{[['Inicio','/'],['Sedes','/sedes'],['Eventos','/eventos'],['Novedades','/novedades'],['Preguntas frecuentes','/preguntas-frecuentes']].map(([label,href])=><Link key={href} className={active===href.slice(1)||(href==='/'&&active==='Inicio')?'active':''} to={href}>{label}</Link>)}</nav>
      <div className="public-actions"><Link className="button button-secondary" to="/iniciar-sesion">Iniciar sesión</Link><Link className="button button-primary" to="/crear-cuenta">Crear cuenta</Link></div>
      <Link className="mobile-signin" to="/iniciar-sesion">Ingresar</Link>
    </header>
    <main>{pathname==='/sedes'?<BranchesPage/>:pathname.startsWith('/sedes/')?<BranchDetailsPage id={pathname.split('/')[2]??''}/>:pathname==='/eventos'?<PublicUnavailable title="Eventos"/>:pathname==='/novedades'?<PublicUnavailable title="Novedades"/>:pathname==='/preguntas-frecuentes'?<FrequentlyAskedQuestionsPage/>:<LandingPage/>}</main>
    <footer className="public-footer"><Brand/><span>Tu mejor versión, nuestro compromiso.</span><Link to="/preguntas-frecuentes">Preguntas frecuentes</Link><span>Consultá nuestras sedes activas</span></footer>
    <nav className="mobile-public-tabs" aria-label="Navegación"><Link className={active==='Inicio'?'selected':''} to="/"><Icon name="home"/>Inicio</Link><Link className={active==='sedes'?'selected':''} to="/sedes"><Icon name="pin"/>Sedes</Link><Link className={active==='eventos'?'selected':''} to="/eventos"><Icon name="trophy"/>Eventos</Link><Link className={active==='novedades'?'selected':''} to="/novedades"><Icon name="megaphone"/>Novedades</Link><Link className={active==='preguntas-frecuentes'?'selected':''} to="/preguntas-frecuentes"><Icon name="info"/>Ayuda</Link><Link to="/iniciar-sesion"><Icon name="user"/>Ingresar</Link></nav>
  </div>
}

function Brand(){return <span className="brand-lockup"><span className="brand-mark">M</span><span>M-TEAM <b>GIMNASIO</b></span></span>}
function SectionTitle({title,link,href}:{title:string;link?:string;href?:string}){return <div className="section-title"><h2>{title}</h2>{link&&href&&<Link to={href}>{link} <span>→</span></Link>}</div>}

function LandingPage(){
  const loader=useCallback(()=>backendApi.listBranches('',1,3),[])
  const {data,loading,error,reload}=useApiResource(loader)
  return <>
    <section className="landing-hero"><div className="hero-copy"><span className="eyebrow">M-TEAM GIMNASIO</span><h1>Entrená en M-TEAM</h1><p>Una sola cuota mensual para entrenar en las sedes activas.</p><div className="hero-buttons"><Link className="button button-primary" to="/crear-cuenta">Crear cuenta</Link><Link className="button button-dark" to="/iniciar-sesion">Ya soy socio</Link></div></div><div className="hero-highlights"><Highlight icon="wallet" label="Cuota mensual" value="Consultala al ingresar"/><Highlight icon="calendar" label="Clases" value="Cronograma semanal"/><Highlight icon="qr" label="Ingreso" value="Acceso según tu cuenta"/></div></section>
    <section className="public-section"><SectionTitle title="Nuestras sedes" link="Ver las sedes" href="/sedes"/>{loading?<LoadingState/>:error?<ErrorState message={error} retry={()=>void reload()}/>:<BranchCards branches={data?.items??[]} compact/>}</section>
    <section className="public-section"><SectionTitle title="Próximos eventos"/><UnavailableState module="Eventos"/></section>
    <section className="landing-cta"><h2>¿Empezamos?</h2><p>Creá tu cuenta y acercate al mostrador para registrar el primer pago.</p><Link className="button button-primary" to="/crear-cuenta">Crear cuenta</Link></section>
  </>
}

function Highlight({icon,label,value}:{icon:'wallet'|'calendar'|'qr';label:string;value:string}){return <div className="hero-highlight"><Icon name={icon}/><div><span>{label}</span><strong>{value}</strong></div></div>}

function BranchCards({branches,compact=false}:{branches:Branch[];compact?:boolean}){
  if(!branches.length)return <EmptyState message="No hay sedes activas para mostrar."/>
  return <div className={`branch-grid ${compact?'compact':''}`}>{branches.map(branch=><article className="branch-card" key={branch.id}><SafeImage className="media-placeholder" src={branch.imageUrl} alt={`Sede ${branch.name}`}/><div className="branch-info"><div className="card-title-row"><h3><Link to={`/sedes/${branch.id}`}>{branch.name}</Link></h3><span className="badge badge-info">Abierta</span></div><p><Icon name="pin"/>{branch.address}</p><p><Icon name="clock"/>{branch.openingHours}</p><p><Icon name="phone"/>{branch.phone}</p><a className="button button-secondary directions" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.address)}`} target="_blank" rel="noreferrer"><Icon name="map"/> Cómo llegar</a></div></article>)}</div>
}

function BranchesPage(){
  const loader=useCallback(()=>backendApi.listBranches(),[])
  const {data,loading,error,reload}=useApiResource(loader)
  return <div className="public-page"><SectionTitle title="Sedes"/><p className="page-intro">Estas son las sedes activas informadas por M-TEAM.</p>{loading?<LoadingState/>:error?<ErrorState message={error} retry={()=>void reload()}/>:<BranchCards branches={data?.items??[]}/>}</div>
}

function BranchDetailsPage({id}:{id:string}){
  const loader=useCallback(()=>backendApi.getBranch(id),[id])
  const {data:branch,loading,error,reload}=useApiResource(loader)
  if(loading)return <div className="public-page"><LoadingState/></div>
  if(error||!branch)return <div className="public-page"><ErrorState message={error||'La sede no existe o está desactivada.'} retry={()=>void reload()}/></div>
  const mapsKey=import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const place=encodeURIComponent(branch.address)
  const mapSrc=mapsKey?`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${place}`:`https://maps.google.com/maps?q=${place}&output=embed`
  return <div className="public-page branch-detail-page"><Link className="text-link" to="/sedes">← Volver a sedes</Link><SectionTitle title={branch.name}/><div className="branch-detail-grid"><article className="branch-card"><SafeImage className="media-placeholder" src={branch.imageUrl} alt={`Sede ${branch.name}`}/><div className="branch-info"><p><Icon name="pin"/>{branch.address}</p><p><Icon name="clock"/>{branch.openingHours}</p><p><Icon name="phone"/>{branch.phone}</p></div></article><section className="branch-detail-info surface-card"><h2>Información de la sede</h2><p>{branch.description}</p><h2>Clases programadas</h2>{branch.scheduledClasses?.length?branch.scheduledClasses.map(item=><p key={item.id}><strong>{item.activity}</strong> · {new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(item.startsAt))}{item.trainer?` · ${item.trainer.firstName} ${item.trainer.lastName}`:' · Sin entrenador asignado'}</p>):<EmptyState message="No hay clases programadas para esta sede."/>}</section></div><iframe className="branch-map branch-detail-map" title={`Google Maps: ${branch.name}`} src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></div>
}

function PublicUnavailable({title}:{title:string}){return <div className="public-page"><SectionTitle title={title}/><UnavailableState module={title}/></div>}

const faqGroups = [
  {
    title: 'Empezar y acceder a tu cuenta',
    items: [
      { question: '¿Cómo empiezo a usar M-TEAM?', answer: <>Creá tu cuenta desde <Link to="/crear-cuenta">Crear cuenta</Link> y acercate al mostrador para registrar el primer pago. Después vas a poder iniciar sesión y consultar tu información como socio.</> },
      { question: '¿Qué hago si olvidé mi contraseña?', answer: <>En <Link to="/iniciar-sesion">Iniciar sesión</Link>, elegí la opción para restablecerla e ingresá el correo de tu cuenta. Vas a recibir un enlace que vence a los 30 minutos y se puede usar una sola vez.</> },
    ],
  },
  {
    title: 'Sedes, clases e ingreso',
    items: [
      { question: '¿Cómo consulto las sedes y sus horarios?', answer: <>Entrá en <Link to="/sedes">Sedes</Link> para ver las sedes activas, su dirección, horario y teléfono. Abrí una sede para consultar también su información y las clases programadas.</> },
      { question: '¿Dónde veo el cronograma de clases?', answer: <>Iniciá sesión y abrí <strong>Clases</strong> en tu espacio de socio. El cronograma muestra las clases programadas por semana; también podés revisar las clases de una sede desde su detalle público.</> },
      { question: '¿Cómo ingreso con el código QR?', answer: <>Desde <strong>Acceso QR</strong>, permití el uso de la cámara y apuntá al código fijo del molinete. Esperá el resultado antes de ingresar. Si el navegador no habilitó la cámara, permití el acceso en sus ajustes y volvé a intentar.</> },
    ],
  },
  {
    title: 'Cuota y apto médico',
    items: [
      { question: '¿Dónde consulto mi cuota y mis pagos?', answer: <>En tu espacio de socio, abrí <strong>Mis pagos</strong> para ver el valor vigente, el estado de la cuota, su vencimiento y el historial de pagos acreditados. Si la cuota figura vencida, acercate al mostrador para registrar el pago.</> },
      { question: '¿Cómo cargo el apto médico y qué pasa después?', answer: <>Abrí <strong>Apto médico</strong> y cargá un PDF, JPG o PNG de hasta 5 MB, o tomá una foto. Debe incluir nombre y documento, fecha de emisión, aptitud para actividad física, firma y sello profesional. Queda <strong>Pendiente</strong> hasta que lo revise un administrador; si lo rechaza, vas a ver la observación y podrás reemplazarlo. Un apto aprobado no vence.</> },
      { question: '¿Puedo ingresar mientras revisan mi primer apto?', answer: <>Durante los primeros 20 días desde tu primer pago acreditado podés ingresar aunque el apto todavía no esté aprobado. Cuando termine ese período, necesitás tenerlo aprobado para ingresar.</> },
    ],
  },
]

function FrequentlyAskedQuestionsPage() {
  return <div className="public-page faq-page">
    <SectionTitle title="Preguntas frecuentes"/>
    <p className="page-intro">Encontrá respuestas a las dudas más comunes sobre tu cuenta, las sedes y el uso de M-TEAM.</p>
    {faqGroups.map((group) => <section className="faq-group" key={group.title} aria-labelledby={`faq-${group.title}`}>
      <h2 id={`faq-${group.title}`}>{group.title}</h2>
      <div className="faq-list">{group.items.map((item) => <details className="faq-item" key={item.question}>
        <summary>{item.question}</summary>
        <div className="faq-answer"><p>{item.answer}</p></div>
      </details>)}</div>
    </section>)}
  </div>
}
