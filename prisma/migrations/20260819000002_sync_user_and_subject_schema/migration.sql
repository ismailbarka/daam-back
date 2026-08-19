-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: User (make legacy fields optional and add new auth columns)
ALTER TABLE "User" ALTER COLUMN "username" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyExpires" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "schoolLevel" INTEGER;

-- Backfill email for any legacy users where email is null
UPDATE "User" SET "email" = COALESCE("email", "username" || '@example.com', 'user_' || "id" || '@example.com') WHERE "email" IS NULL;

ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_emailVerifyToken_key" ON "User"("emailVerifyToken");

-- AlterTable: Subject
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "schoolLevel" INTEGER NOT NULL DEFAULT 1;

DO $$ BEGIN
    DROP INDEX IF EXISTS "Subject_name_key";
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Subject_name_schoolLevel_key" ON "Subject"("name", "schoolLevel");
