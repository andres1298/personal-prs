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

export const movementCatalog = groups.flatMap(([category, groupName, measurementType, names]) =>
  names.map((name) => ({
    id: name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-'),
    name, category, groupName, measurementType,
  })),
);

export async function seedMovements(prisma) {
  await prisma.$transaction(movementCatalog.map((movement) => prisma.movement.upsert({
    where: { id: movement.id }, create: movement, update: movement,
  })));
}
