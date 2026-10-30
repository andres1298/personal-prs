-- Gymnastics movements are measured in maximum unbroken repetitions.
-- The shared Gymnastics movements are added by the catalog seed (npm run db:seed).
ALTER TYPE "MeasurementType" ADD VALUE 'REPS';

ALTER TYPE "MovementCategory" ADD VALUE 'GYMNASTICS';
