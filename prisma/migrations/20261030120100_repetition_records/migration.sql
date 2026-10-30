-- Repetition records (gymnastics) have no repetition maximum and count whole repetitions.
-- Kept apart from the migration that adds the enum value, which must be committed before it is used.
ALTER TABLE "PersonalRecord" DROP CONSTRAINT "PersonalRecord_repetition_max_check";
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_repetition_max_check"
    CHECK (
        ("measurementType" = 'WEIGHT' AND "repetitionMax" IS NOT NULL AND "repetitionMax" IN (1, 3, 5))
        OR ("measurementType" = 'TIME' AND "repetitionMax" IS NULL)
        OR ("measurementType" = 'REPS' AND "repetitionMax" IS NULL AND "value" = trunc("value"))
    );
