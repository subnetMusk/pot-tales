import { Router, Request, Response } from 'express';
import path from 'path';
import { generateSession, validateSession as check } from '@services/session.service';

const router = Router();

const cookieOptions = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path:     '/'
};

// 1) Servizio consenso cookie
router.get('/consent', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../../public/consent.html'));
});

// 2) Verifica sessione
router.get('/validate', async (req: Request, res: Response) => {
  const sessionId = req.cookies?.sessionId as string | undefined;
  try {
    if (sessionId && await check(sessionId)) {
      return res.sendStatus(200);
    }
    res.clearCookie('sessionId', cookieOptions);
    return res.sendStatus(401);
  } catch (err) {
    console.error('Validate error:', err);
    return res.sendStatus(500);
  }
});

// 3) Creazione nuova sessione
router.post('/session', async (_req: Request, res: Response) => {
  try {
    const sid = await generateSession();
    res.cookie('sessionId', sid, cookieOptions);
    return res.json({ sid });
  } catch (err) {
    console.error('Session creation error:', err);
    return res.sendStatus(500);
  }
});

export default router;
