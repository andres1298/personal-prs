// Fake data for local UX captures. No real records or credentials.
const groups = [
  ['LIFT', 'Squats', 'WEIGHT', ['Back Squat', 'Front Squat', 'Overhead Squat']],
  ['LIFT', 'Cleans', 'WEIGHT', ['Clean', 'Hang Power Clean', 'Hang Squat Clean', 'Muscle Clean', 'Power Clean', 'Squat Clean']],
  ['LIFT', 'Presses', 'WEIGHT', ['Strict Press', 'Push Press', 'Bench Press']],
  ['LIFT', 'Jerks', 'WEIGHT', ['Push Jerk', 'Split Jerk', 'Clean & Jerk']],
  ['LIFT', 'Snatches', 'WEIGHT', ['Snatch', 'Power Snatch', 'Hang Power Snatch', 'Squat Snatch']],
  ['LIFT', 'Deadlifts', 'WEIGHT', ['Deadlift', 'Sumo Deadlift']],
  ['CARDIO', 'Run', 'TIME', ['400 m', '1 mile', '5 km']],
  ['CARDIO', 'Row', 'TIME', ['500 m Row', '2 km Row']],
  ['CARDIO', 'Bike', 'TIME', ['50 cal Bike']],
  ['BENCHMARK', 'Girls', 'TIME', ['Fran', 'Grace', 'Isabel', 'Helen', 'Diane']],
  ['BENCHMARK', 'Heroes', 'TIME', ['Murph', 'DT']],
];
export const movements = [
  ...groups.flatMap(([category, groupName, measurementType, names]) => names.map((name) => ({
    id: name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-'), name, category, groupName, measurementType, custom: false, hidden: false,
  }))),
  { id: 'c1', name: 'Zercher Squat', category: 'LIFT', groupName: 'Squats', measurementType: 'WEIGHT', custom: true, hidden: false },
  { id: 'c2', name: 'DB Snatch', category: 'LIFT', groupName: 'Mancuernas', measurementType: 'WEIGHT', custom: true, hidden: false },
];
const r = (move, value, rm, date) => ({ move, value, rm, date, notes: '' });
export const records = [
  r('Back Squat', 245, 1, '2026-03-02'), r('Back Squat', 260, 1, '2026-08-30'), r('Back Squat', 235, 3, '2026-07-15'), r('Back Squat', 215, 5, '2026-06-10'),
  r('Front Squat', 215, 1, '2026-07-04'), r('Overhead Squat', 115, 5, '2026-05-01'),
  r('Clean', 195, 1, '2026-06-01'), r('Power Clean', 175, 1, '2026-09-12'), r('Squat Clean', 185, 1, '2026-09-01'), r('Hang Power Clean', 165, 1, '2026-04-20'),
  r('Strict Press', 115, 1, '2026-05-11'), r('Push Press', 155, 1, '2026-05-25'), r('Bench Press', 185, 1, '2026-04-22'),
  r('Push Jerk', 165, 3, '2026-08-08'), r('Split Jerk', 185, 1, '2026-02-02'), r('Clean & Jerk', 185, 1, '2026-09-20'),
  r('Snatch', 135, 1, '2026-06-18'), r('Power Snatch', 125, 1, '2026-06-18'),
  r('Deadlift', 330, 1, '2026-07-30'), r('Sumo Deadlift', 315, 3, '2026-03-30'),
  r('DB Snatch', 60, 1, '2026-02-10'),
  { move: 'Fran', value: 285, date: '2026-08-10', notes: '' },
];
