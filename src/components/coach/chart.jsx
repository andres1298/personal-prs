'use client';

import { useEffect, useRef } from 'react';

/** A design token's current value, so charts follow the light and dark themes. */
export const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const SERIES_COLORS = ['--b-blue', '--b-pink', '--b-green', '--b-yellow', '--b-lilac', '--b-cyan', '--b-lime', '--b-coral'];

/**
 * A Chart.js chart drawn with the app's tokens. `build({ token })` returns { type, data, options };
 * it runs again when `deps` change. `height` is a minimum: the chart grows to fill its card. Bars and points come in one after another unless the device
 * asks for reduced motion. `summary` is the text alternative for screen readers.
 */
export default function Chart({ build, deps, height = 260, summary }) {
  const canvas = useRef(null);
  useEffect(() => {
    let active = true;
    let chart;
    import('chart.js/auto').then(({ default: ChartJs }) => {
      if (!active || !canvas.current) return;
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const { type, data, options = {} } = build({ token });
      const ink = token('--ink2');
      const line = token('--line');
      const axis = (scale = {}) => ({
        ...scale, grid: { color: line, drawTicks: false, ...scale.grid }, border: { display: false },
        ticks: { color: ink, font: { weight: 700, size: 12 }, padding: 8, ...scale.ticks },
      });
      chart = new ChartJs(canvas.current, {
        type, data,
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: still ? false : { duration: 900, easing: 'easeOutQuart', delay: (context) => (context.type === 'data' ? context.dataIndex * 70 + context.datasetIndex * 120 : 0) },
          ...options,
          scales: options.scales && Object.fromEntries(Object.entries(options.scales).map(([key, scale]) => [key, axis(scale)])),
          plugins: {
            legend: { display: data.datasets.length > 1, position: 'bottom', labels: { color: token('--ink'), usePointStyle: true, pointStyle: 'rectRounded', padding: 16, font: { weight: 700, size: 13 } } },
            tooltip: { backgroundColor: token('--inverse'), titleColor: token('--inverse-ink'), bodyColor: token('--inverse-ink'), padding: 12, cornerRadius: 10, titleFont: { weight: 800 }, bodyFont: { weight: 600 }, boxPadding: 6 },
            ...options.plugins,
          },
        },
      });
      ChartJs.defaults.font.family = getComputedStyle(document.body).fontFamily;
    });
    return () => { active = false; chart?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <div className="chart-box" style={{ minHeight: height }}><canvas ref={canvas} role="img" aria-label={summary} /></div>;
}
