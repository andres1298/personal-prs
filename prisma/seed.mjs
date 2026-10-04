import { getPrisma } from '../src/lib/server/prisma.js';
import { seedMovements } from './catalog.mjs';

const prisma = getPrisma();
try {
  await seedMovements(prisma);
  console.log('Movement catalog seeded.');
} catch {
  console.error('Movement catalog seeding failed. Check the private database configuration.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
