/**
 * Make Admin Script
 * =================
 * Promotes a user to ADMIN by matching either email or username.
 * Supports both local database and live production backend.
 *
 * Usage:
 *   npm run make:admin <email-or-username>
 *   npm run make:admin <email-or-username> --prod
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const PROD_API_URL = process.env.PROD_API_URL || 'https://edu-platform-backend-one.vercel.app';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production';

async function promoteViaApi(identifier: string) {
  const response = await fetch(`${PROD_API_URL}/auth/make-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, secret: JWT_SECRET.trim() }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || 'Production API promotion failed');
  }

  console.log(`✅ [Production] ${data.message || 'User promoted to ADMIN successfully.'}`);
}

async function makeAdmin() {
  const args = process.argv.slice(2);
  const isProdFlag = args.includes('--prod');
  const identifier = args.find((a) => !a.startsWith('--'))?.trim();

  if (!identifier) {
    throw new Error('Please provide an email or username. Example: npm run make:admin yassine');
  }

  if (isProdFlag) {
    await promoteViaApi(identifier);
    return;
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (user) {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
      console.log(`✅ [Local DB] ${updatedUser.email} is now an ADMIN.`);
      if (updatedUser.username) {
        console.log(`   Username: ${updatedUser.username}`);
      }
      return;
    }
  } catch {
    // If local DB fails or is unreachable, fallback to production API
  } finally {
    await prisma.$disconnect().catch(() => null);
  }

  // Fallback to Production API
  console.log(`ℹ️  User "${identifier}" not found in local DB. Checking production...`);
  await promoteViaApi(identifier);
}

makeAdmin().catch((err) => {
  console.error('❌  Promote failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
