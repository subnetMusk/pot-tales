import express, { Router, Request, Response } from 'express';  // ← aggiunto express
import path from 'path';
import { v4 as uuid } from 'uuid';

interface SceneData {
  objects: any[];
  createdAt: Date;
}
const sceneStore = new Map<string, SceneData>();

const router = Router();

// 1) Dashboard dev UI
router.get('/dashboard', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../../public/sandbox/dashboard.html'));
});

// 2) Crea scena personalizzata
router.post(
  '/customscene',
  express.json(),  // ora express è definito
  (req: Request, res: Response) => {
    const { objects } = req.body;
    const sceneId = uuid();
    sceneStore.set(sceneId, { objects, createdAt: new Date() });
    res.json({ sceneId });
  }
);

// 3) Recupera scena
router.get('/customscene/:id', (req: Request, res: Response) => {
  const scene = sceneStore.get(req.params.id);
  if (!scene) return res.sendStatus(404);
  res.json(scene);
});

export default router;
