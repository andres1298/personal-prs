import Image from 'next/image';
import Link from 'next/link';
import Icon from '../components/ui/icon';
import HeroPhone from '../components/landing/hero-phone';
import PlateDemo from '../components/landing/plate-demo';
import TimerDemo from '../components/landing/timer-demo';
import ProgressDemo from '../components/landing/progress-demo';
import { SITE_DESCRIPTION, SITE_IMAGE, SITE_NAME, SITE_TITLE, siteUrl } from '../lib/site';
import './landing.css';

// Public landing page: static, indexable and zoomable. The app itself lives at /app.
export const metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  keywords: ['PR CrossFit', 'calculadora de discos', 'calculadora de barra', 'porcentajes 1RM', 'registro de marcas personales', 'timer AMRAP EMOM Tabata', 'calentamiento levantamiento olímpico'],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: 'es_LA',
    images: [SITE_IMAGE],
  },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION, images: [SITE_IMAGE] },
};

export const viewport = { userScalable: true, maximumScale: 5 };

const SIGN_UP = '/register';
const DEMO = '/app?demo=1';
const SIGN_IN = '/app';

const MOVES = [
  ['Back Squat', '--b-pink'], ['Clean & Jerk', '--b-green'], ['Snatch', '--b-lilac'], ['Fran', '--b-lilac'], ['Deadlift', '--b-cyan'],
  ['Push Press', '--b-yellow'], ['Murph', '--b-pink'], ['Front Squat', '--b-pink'], ['Power Clean', '--b-blue'], ['Bar Muscle-Ups', '--b-lime'],
  ['2 km Row', '--b-cyan'], ['Split Jerk', '--b-green'], ['Grace', '--b-lilac'], ['Overhead Squat', '--b-pink'], ['Double-Unders', '--b-lime'],
];

const FEATURES = [
  { icon: 'trophy', color: '--b-pink', title: 'Todos tus PRs', text: '1RM, 3RM y 5RM de cada levantamiento, tiempos de benchmarks y cardio, y repeticiones máximas de gimnasia.', wide: true },
  { icon: 'barbell', color: '--b-blue', title: 'Discos por lado', text: 'Elige el porcentaje y ve qué discos poner, con la barra y los discos que tiene tu box.' },
  { icon: 'flame', color: '--b-yellow', title: 'Calentamiento listo', text: 'Una escalera desde la barra sola, con saltos parejos y pocos cambios de discos.' },
  { icon: 'timer', color: '--b-green', title: 'Timer de workout', text: 'AMRAP, EMOM, Tabata y For Time con cuenta regresiva y avisos de sonido.' },
  { icon: 'chart', color: '--b-lilac', title: 'Tu progreso', text: 'Una gráfica por movimiento con cada marca y su fecha, en lb y en kg.' },
  { icon: 'sparkles', color: '--b-cyan', title: 'Tus movimientos', text: 'Crea movimientos y categorías propias, o apaga los que no haces.' },
  { icon: 'bolt', color: '--b-lime', title: 'Como una app', text: 'Agrégala a tu pantalla de inicio y mantén la pantalla encendida mientras entrenas.', wide: true },
];

const STEPS = [
  { title: 'Crea tu cuenta', text: 'Con tu correo y una contraseña. Confirmas desde el enlace que te llega y listo.', color: '--b-yellow' },
  { title: 'Registra tus PRs', text: 'Uno por uno o varios a la vez con la carga rápida. La fecha y la nota son opcionales.', color: '--b-pink' },
  { title: 'Entrena con el peso exacto', text: 'Elige el porcentaje del día, arma la barra y sigue la escalera de calentamiento.', color: '--b-green' },
];

const FAQ = [
  ['¿Cuánto cuesta?', 'Nada. Crear tu cuenta y usar la app es gratis.'],
  ['¿Tengo que descargar algo?', 'No. Funciona en el navegador del teléfono o de la computadora. Si quieres, agrégala a la pantalla de inicio desde Safari o Chrome y se abre como una app más.'],
  ['¿Puedo probarla sin crear una cuenta?', 'Sí. La demo abre la app completa con datos de ejemplo. Lo que cambies ahí no se guarda.'],
  ['¿Usa libras o kilos?', 'Los pesos se registran en libras, como en la mayoría de boxes, y cada carga muestra su equivalente en kilos.'],
  ['¿Qué barras y discos usa la calculadora?', 'Barra de 45, 35 o 15 lb y discos de 55 a 2.5 lb. En Ajustes marcas los que tiene tu box y la calculadora solo usa esos.'],
  ['¿Qué movimientos puedo registrar?', 'Sentadillas, cleans, snatches, presses, jerks y deadlifts en 1RM, 3RM y 5RM; cardio y benchmarks como Fran o Murph por tiempo; y gimnasia por repeticiones máximas. También puedes crear los tuyos.'],
  ['¿Quién ve mis marcas?', 'Solo tú. Tus registros quedan asociados a tu cuenta y no son públicos.'],
];

function structuredData() {
  const url = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${url}/#website`, url, name: SITE_NAME, inLanguage: 'es' },
      {
        '@type': 'WebApplication',
        '@id': `${url}/#app`,
        name: SITE_NAME,
        url,
        description: SITE_DESCRIPTION,
        applicationCategory: 'HealthApplication',
        applicationSubCategory: 'CrossFit y levantamiento de pesas',
        operatingSystem: 'iOS, Android, Windows, macOS',
        browserRequirements: 'Requiere JavaScript y un navegador actual.',
        inLanguage: 'es',
        image: `${url}${SITE_IMAGE.url}`,
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: FEATURES.map((feature) => `${feature.title}: ${feature.text}`),
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}/#faq`,
        mainEntity: FAQ.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })),
      },
    ],
  };
}

// Phones that installed the app before it moved keep / as their start URL: send them to the app.
const STANDALONE_REDIRECT = "if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)location.replace('/app')";

function Header() {
  return <header className="lp-header">
    <div className="lp-wrap lp-header-inner">
      <Link href="/" className="lp-brand" aria-label={`${SITE_NAME}, inicio`}>
        <Image src="/icon-192.png" width={36} height={36} alt="" priority />
        <span className="display">{SITE_NAME}</span>
      </Link>
      <nav className="lp-nav" aria-label="Secciones">
        <a href="#demo">Demo</a>
        <a href="#timer">Timer</a>
        <a href="#funciones">Funciones</a>
        <a href="#preguntas">Preguntas</a>
      </nav>
      <div className="lp-header-actions">
        <Link href={SIGN_IN} className="lp-link">Entrar</Link>
        <Link href={SIGN_UP} className="lp-btn lp-btn-small">Crear cuenta</Link>
      </div>
    </div>
  </header>;
}

function Hero() {
  return <section className="lp-hero" aria-labelledby="hero-title">
    <div className="lp-wrap lp-hero-grid">
      <div className="lp-hero-copy">
        <p className="lp-eyebrow lp-enter" style={{ '--d': 0 }}><span className="lp-dot" />Para CrossFit y levantamiento olímpico</p>
        <h1 id="hero-title" className="display lp-hero-title">
          <span className="lp-line"><span className="lp-enter-up" style={{ '--d': 1 }}>Tus PRs.</span></span>{' '}
          <span className="lp-line"><span className="lp-enter-up lp-mark" style={{ '--d': 2 }}>Tu barra.</span></span>{' '}
          <span className="lp-line"><span className="lp-enter-up" style={{ '--d': 3 }}>Sin</span></span>{' '}
          <span className="lp-line"><span className="lp-enter-up" style={{ '--d': 4 }}>cálculos.</span></span>
        </h1>
        <p className="lp-lead lp-enter" style={{ '--d': 5 }}>
          Guarda tus marcas personales, elige el porcentaje del día y ve exactamente qué discos poner a cada lado de la barra.
          Con calentamiento y timer incluidos.
        </p>
        <div className="lp-ctas lp-enter" style={{ '--d': 6 }}>
          <Link href={SIGN_UP} className="lp-btn lp-btn-large">Crear cuenta gratis<Icon name="arrowRight" size={20} weight={2.6} /></Link>
          <Link href={DEMO} className="lp-btn lp-btn-outline lp-btn-large">Abrir la demo</Link>
        </div>
        <ul className="lp-checks lp-enter" style={{ '--d': 7 }}>
          <li><Icon name="check" size={18} weight={3} />Gratis</li>
          <li><Icon name="check" size={18} weight={3} />Sin descargar nada</li>
          <li><Icon name="check" size={18} weight={3} />lb y kg</li>
        </ul>
      </div>
      <div className="lp-hero-visual">
        <div className="lp-phone"><HeroPhone /></div>
        <div className="lp-sticker lp-sticker-a" aria-hidden="true"><Icon name="arrowUp" size={18} weight={3} /><b className="display">+35 lb</b><span>Back Squat</span></div>
        <div className="lp-sticker lp-sticker-b" aria-hidden="true"><Icon name="timer" size={18} weight={2.6} /><b className="display num">0:20</b><span>Tabata</span></div>
        <div className="lp-sticker lp-sticker-c" aria-hidden="true"><b className="display">80%</b><span>de tu PR</span></div>
      </div>
    </div>
  </section>;
}

function Marquee() {
  const row = (reverse) => <div className={`lp-marquee-track${reverse ? ' reverse' : ''}`}>
    {[0, 1].map((copy) => <ul key={copy} aria-hidden={copy === 1 || undefined}>
      {(reverse ? [...MOVES].reverse() : MOVES).map(([name, color]) => <li key={name} style={{ '--c': `var(${color})` }}>{name}</li>)}
    </ul>)}
  </div>;
  return <section className="lp-marquee" aria-label="Algunos movimientos que puedes registrar">
    {row(false)}
    {row(true)}
  </section>;
}

function SectionHead({ id, eyebrow, title, children, color }) {
  return <div className="lp-section-head" data-reveal>
    <p className="lp-eyebrow"><span className="lp-dot" style={color ? { background: `var(${color})` } : undefined} />{eyebrow}</p>
    <h2 id={id} className="display">{title}</h2>
    {children && <p className="lp-section-lead">{children}</p>}
  </div>;
}

export default function LandingPage() {
  return <div className="lp">
    <script dangerouslySetInnerHTML={{ __html: STANDALONE_REDIRECT }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, '\\u003c') }} />
    <a className="lp-skip" href="#contenido">Saltar al contenido</a>
    <Header />
    <main id="contenido">
      <Hero />
      <Marquee />

      <section id="demo" className="lp-section" aria-labelledby="demo-title">
        <div className="lp-wrap">
          <SectionHead id="demo-title" eyebrow="Demo en vivo" title="Pruébala aquí. Sin cuenta." color="--b-blue">
            Es la misma calculadora de la app. Cambia el PR, el porcentaje o la barra y mira cómo se arma la carga y el calentamiento.
          </SectionHead>
          <div data-reveal><PlateDemo /></div>
        </div>
      </section>

      <section id="progreso" className="lp-section" aria-labelledby="progress-title">
        <div className="lp-wrap lp-split">
          <SectionHead id="progress-title" eyebrow="Progreso" title="Mira cuánto has subido." color="--b-pink">
            Cada PR queda con su fecha. La gráfica de cada movimiento te muestra la tendencia, y en los tiempos, bajar es ganar.
          </SectionHead>
          <div data-reveal><ProgressDemo /></div>
        </div>
      </section>

      <section id="timer" className="lp-section lp-dark" aria-labelledby="timer-title">
        <div className="lp-wrap lp-split reverse">
          <SectionHead id="timer-title" eyebrow="Timer" title="El reloj del WOD, en tu bolsillo." color="--b-green">
            AMRAP, EMOM, Tabata y For Time con diez segundos para prepararte y cuenta regresiva antes de cada ronda.
            Si pausas, sigue con una cuenta de cinco. Pruébalo:
          </SectionHead>
          <div data-reveal><TimerDemo /></div>
        </div>
      </section>

      <section id="funciones" className="lp-section" aria-labelledby="features-title">
        <div className="lp-wrap">
          <SectionHead id="features-title" eyebrow="Funciones" title="Todo lo que usas en el box." color="--b-yellow" />
          <ul className="lp-bento">
            {FEATURES.map((feature, index) => <li key={feature.title} className={`lp-block${feature.wide ? ' wide' : ''}`}
              style={{ '--c': `var(${feature.color})`, '--i': index }} data-reveal>
              <span className="lp-block-icon"><Icon name={feature.icon} size={26} weight={2.4} /></span>
              <h3 className="display">{feature.title}</h3>
              <p>{feature.text}</p>
            </li>)}
          </ul>
        </div>
      </section>

      <section id="como-funciona" className="lp-section" aria-labelledby="steps-title">
        <div className="lp-wrap">
          <SectionHead id="steps-title" eyebrow="Cómo funciona" title="Tres pasos y a entrenar." color="--b-green" />
          <ol className="lp-steps">
            {STEPS.map((step, index) => <li key={step.title} style={{ '--c': `var(${step.color})` }} data-reveal>
              <span className="lp-step-number display num">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="display">{step.title}</h3>
              <p>{step.text}</p>
            </li>)}
          </ol>
        </div>
      </section>

      <section id="preguntas" className="lp-section" aria-labelledby="faq-title">
        <div className="lp-wrap lp-faq-grid">
          <SectionHead id="faq-title" eyebrow="Preguntas" title="Lo que quieres saber." color="--b-lilac">
            ¿Te queda otra duda? Abre la demo: es la app completa con datos de ejemplo.
          </SectionHead>
          <div className="lp-faq" data-reveal>
            {FAQ.map(([question, answer]) => <details key={question}>
              <summary><h3>{question}</h3><Icon name="plus" size={22} weight={2.6} /></summary>
              <p>{answer}</p>
            </details>)}
          </div>
        </div>
      </section>

      <section className="lp-final" aria-labelledby="final-title">
        <div className="lp-wrap">
          <div className="lp-final-block" data-reveal>
            <h2 id="final-title" className="display">Tu próximo PR empieza con el peso correcto.</h2>
            <p>Crea tu cuenta en un minuto, o abre la demo y explora la app con datos de ejemplo.</p>
            <div className="lp-ctas">
              <Link href={SIGN_UP} className="lp-btn lp-btn-large lp-btn-ink">Crear cuenta gratis<Icon name="arrowRight" size={20} weight={2.6} /></Link>
              <Link href={DEMO} className="lp-btn lp-btn-large lp-btn-outline-ink">Abrir la demo</Link>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-inner">
        <div className="lp-brand">
          <Image src="/icon-192.png" width={32} height={32} alt="" />
          <span className="display">{SITE_NAME}</span>
        </div>
        <nav aria-label="Enlaces del pie">
          <Link href={SIGN_UP}>Crear cuenta</Link>
          <Link href={SIGN_IN}>Entrar</Link>
          <Link href={DEMO}>Demo</Link>
          <a href="#preguntas">Preguntas</a>
        </nav>
        <p>© {new Date().getFullYear()} {SITE_NAME}. Hecho para entrenar.</p>
      </div>
    </footer>
  </div>;
}
