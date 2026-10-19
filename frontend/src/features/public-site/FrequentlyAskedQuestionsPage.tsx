import { Link } from 'react-router-dom'

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

export function FrequentlyAskedQuestionsPage() {
  return <div className="public-page faq-page">
    <header className="faq-heading">
      <h1>Preguntas frecuentes</h1>
      <p className="page-intro">Encontrá respuestas a las dudas más comunes sobre tu cuenta, las sedes y el uso de M-TEAM.</p>
    </header>
    {faqGroups.map((group, groupIndex) => <section className="faq-group" key={group.title} aria-labelledby={`faq-group-${groupIndex}`}>
      <h2 id={`faq-group-${groupIndex}`}>{group.title}</h2>
      <div className="faq-list">{group.items.map((item) => <details className="faq-item" key={item.question}>
        <summary>{item.question}</summary>
        <div className="faq-answer"><p>{item.answer}</p></div>
      </details>)}</div>
    </section>)}
  </div>
}
