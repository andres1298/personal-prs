import Skeleton, { Loading } from './skeleton';

/**
 * The athlete's app before anything is known: a day strip, a title and two cards, over the tab
 * bar's shape, so the first paint already looks like the screen that follows.
 */
export function AppSkeleton() {
  return <Loading as="main" className="page screen-skeleton" label="Cargando la app">
    <div className="wrap">
      <div className="sk-week">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="sk-day" />)}</div>
      <Skeleton width="46%" height={13} />
      <Skeleton width="70%" height={32} radius={10} />
      {[3, 2].map((rows, card) => <div className="sk-card" key={card}>
        <Skeleton width="38%" height={18} />
        {Array.from({ length: rows }, (_, index) => <div className="sk-line" key={index}>
          <Skeleton width={`${54 - index * 8}%`} height={16} />
          <Skeleton width={84} height={40} radius={12} />
        </div>)}
      </div>)}
    </div>
    <nav className="tab-bar" aria-hidden="true">
      <div className="tab-group">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="sk-tab" />)}</div>
      <span className="tab-action"><Skeleton width={24} height={24} radius={8} /></span>
    </nav>
  </Loading>;
}

/** The coach's workspace before its data arrives: the navigation and a calendar of empty days. */
export function CoachSkeleton() {
  return <Loading className="coach" label="Cargando el espacio del coach">
    <aside className="coach-side" aria-hidden="true">
      <Skeleton className="sk-brand" width={110} height={26} />
      <div className="coach-nav">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="sk-nav" />)}</div>
    </aside>
    <div className="coach-main">
      <Skeleton width="min(320px, 70%)" height={34} radius={10} />
      <div className="sk-toolbar"><Skeleton width={180} height={42} radius={12} /><Skeleton width={140} height={42} radius={12} /></div>
      <div className="cal-week sk-calendar">{Array.from({ length: 14 }, (_, index) => <div className="cal-cell" key={index}><header><Skeleton width={26} height={16} /></header><Skeleton /></div>)}</div>
    </div>
  </Loading>;
}
