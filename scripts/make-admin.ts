/**
 * Make Admin Script
 * =================
 * Promotes a user to ADMIN by matching either email or username.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/make-admin.ts <email-or-username>
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function makeAdmin(identifier?: string) {
  const input = identifier?.trim();

  if (!input) {
    throw new Error('Please provide an email or username.');
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: input }, { username: input }],
    },
  });

  if (!user) {
    throw new Error(`No user found for "${input}".`);
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN' },
  });

  console.log(`✅ ${updatedUser.email} is now an ADMIN.`);
  if (updatedUser.username) {
    console.log(`   Username: ${updatedUser.username}`);
  }
}

makeAdmin(process.argv[2])
  .catch((err) => {
    console.error('❌  Promote failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
