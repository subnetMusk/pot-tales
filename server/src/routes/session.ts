import { Router, Request, Response } from 'express';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import Session from '../models/session';

const router = Router();

// restituisci la pagina di consenso
router.get('/auth', (_req, res: Response) => {
  res.sendFile(path.resolve(__dirname, '../../public/consent.html'));
});

// genera un nuovo SID, salva e rimanda il cookie
router.post('/api/session', async (_req: Request, res: Response) => {
  const sid = uuid();
  await Session.create({ sessionId: sid });
  res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax' });
  res.json({ sid });
});

export default router;
