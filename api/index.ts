import 'reflect-metadata';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Express } from 'express';
import { createExpressApp } from '../src/bootstrap';

let cachedApp: Express;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!cachedApp) {
    cachedApp = await createExpressApp();
  }

  return cachedApp(req, res);
}
