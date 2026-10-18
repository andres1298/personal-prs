// Minimal line figures, one per lift group, drawn on a 48 pt grid.
const FIGURES = {
  // Back squat at the bottom: bar across the shoulders, hips back.
  Squats: <>
    <path d="M7 14h34M7 10v8M41 10v8" />
    <circle cx="24" cy="8" r="3" />
    <path d="M24 14 18 29l12 1-2 12M18 29l-1 5" />
  </>,
  // Front rack: bar resting on the shoulders, standing tall.
  Cleans: <>
    <path d="M9 18h30M9 14v8M39 14v8" />
    <circle cx="24" cy="10" r="3" />
    <path d="M24 15v15l-4 13M24 30l4 13" />
  </>,
  // Strict press lockout: bar overhead, arms straight.
  Presses: <>
    <path d="M9 6h30M9 2v8M39 2v8" />
    <circle cx="24" cy="12" r="3" />
    <path d="M17 6l7 10 7-10M24 16v14l-3 13M24 30l3 13" />
  </>,
  // Split jerk: bar overhead, legs split front and back.
  Jerks: <>
    <path d="M9 6h30M9 2v8M39 2v8" />
    <circle cx="24" cy="12" r="3" />
    <path d="M17 6l7 10 7-10M24 16v12l8 6v9M24 28l-9 7-4 7" />
  </>,
  // Overhead squat catch: wide grip, deep squat.
  Snatches: <>
    <path d="M4 6h40M4 2v8M44 2v8" />
    <circle cx="24" cy="13" r="3" />
    <path d="M11 6l13 11 13-11M24 17v12l-8 3 1 11M24 29l8 3-1 11" />
  </>,
  // Deadlift setup: hips hinged, plate on the floor.
  Deadlifts: <>
    <circle cx="13" cy="14" r="3" />
    <path d="M16 17l14 6-4 9 2 11M16 17l3 18" />
    <circle cx="19" cy="37" r="6" />
  </>,
};

export default function GroupIcon({ name, className }) {
  return <svg
    viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true" focusable="false"
  >{FIGURES[name]}</svg>;
}
