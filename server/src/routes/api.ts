import { Router, Request, Response } from 'express';

const router = Router();

// 1) Servizio di salute del server
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

export default router;
