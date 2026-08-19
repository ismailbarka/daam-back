-- Normalize existing lesson orders per subject before enforcing uniqueness.
WITH ranked_lessons AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "subjectId" ORDER BY "order", "id")::INTEGER AS "newOrder"
  FROM "Lesson"
)
UPDATE "Lesson" AS lesson
SET "order" = ranked."newOrder"
FROM ranked_lessons AS ranked
WHERE lesson."id" = ranked."id";

CREATE UNIQUE INDEX "Lesson_subjectId_order_key" ON "Lesson"("subjectId", "order");
