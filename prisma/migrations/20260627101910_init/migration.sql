DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'OperationalEvent'
      AND column_name = 'idempotencyKey'
  ) THEN
    ALTER TABLE "OperationalEvent" ALTER COLUMN "idempotencyKey" DROP DEFAULT;
  END IF;
END $$;
