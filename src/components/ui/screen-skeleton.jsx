import Skeleton, { Loading } from './skeleton';

const TabBarSkeleton = () => <nav className="tab-bar" aria-hidden="true">
  <div className="tab-group">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="sk-tab" />)}</div>
  <span className="tab-action"><Skeleton width={24} height={24} radius={8} /></span>
</nav>;

/** The athlete's plan before anything is known: a day strip, a title and two session cards, over the tab bar. */
export function AppSkeleton() {
  return <Loading as="main" className="page screen-skeleton" label="Cargando tu plan">
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
    <TabBarSkeleton />
  </Loading>;
}

/** Execute before anything is known, for members without a plan: its title and the movement groups. */
export function ExecSkeleton() {
  return <Loading as="main" className="page screen-skeleton" label="Cargando tus PRs">
    <div className="wrap">
      <Skeleton width="40%" height={13} />
      <Skeleton width="58%" height={38} radius={10} />
      <div className="category-grid">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="skeleton-tile" />)}</div>
    </div>
    <TabBarSkeleton />
  </Loading>;
}

/**
 * The coach's workspace before its data arrives: the navigation and a calendar of empty days.
 * Styled in globals.css, so it can show on /app before the coach's own styles are loaded.
 */
export function CoachSkeleton() {
  return <Loading className="cs" label="Cargando el calendario">
    <aside className="cs-side" aria-hidden="true">
      <Skeleton className="cs-brand" width={110} height={26} />
      {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="cs-nav" />)}
    </aside>
    <div className="cs-main">
      <Skeleton width="min(320px, 70%)" height={34} radius={10} />
      <div className="cs-toolbar"><Skeleton width={180} height={42} radius={12} /><Skeleton width={140} height={42} radius={12} /></div>
      <div className="cs-week">{Array.from({ length: 14 }, (_, index) => <div className="cs-cell" key={index}>
        <Skeleton width={26} height={16} radius={6} /><Skeleton className="cs-cell-body" />
      </div>)}</div>
    </div>
  </Loading>;
}

/**
 * The loading screen drawn before the server knows the role: the three skeletons, of which CSS
 * shows only the one the <head> script marked on <html data-shell> (the athlete's plan by default).
 */
export function ShellSkeleton() {
  return <>
    <div className="shell-variant" data-for="plan"><AppSkeleton /></div>
    <div className="shell-variant" data-for="exec"><ExecSkeleton /></div>
    <div className="shell-variant" data-for="coach"><CoachSkeleton /></div>
  </>;
}
