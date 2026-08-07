/**
 * Reset Users Script
 * ==================
 * Deletes ALL users (and their cascaded data: Progress, PlacementTestResults)
 * from the database so you can sign up fresh with Google or any other provider.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/reset-users.ts
 *
 * The related tables (Progress, PlacementTestResult) are automatically
 * deleted via Prisma cascade (onDelete: Cascade in schema.prisma).
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load .env so the Prisma URL is available
dotenv.config();

const prisma = new PrismaClient();

async function resetUsers() {
  console.log('⚠️  WARNING: This will delete ALL users and their related data.');
  console.log('Starting reset...\n');

  // Delete cascading data first (safety — cascade handles it, but explicit is clearer)
  const deletedProgress = await prisma.progress.deleteMany({});
  console.log(`✅  Deleted ${deletedProgress.count} progress record(s).`);

  const deletedPlacementResults = await prisma.placementTestResult.deleteMany({});
  console.log(`✅  Deleted ${deletedPlacementResults.count} placement test result(s).`);

  const deletedUsers = await prisma.user.deleteMany({});
  console.log(`✅  Deleted ${deletedUsers.count} user(s).`);

  console.log('\n🎉  Database reset complete. You can now sign up fresh!');
}

resetUsers()
  .catch((err) => {
    console.error('❌  Reset failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
