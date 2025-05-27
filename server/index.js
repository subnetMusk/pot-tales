import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router = express.Router()

router.get('/:id', (req, res) => {
  const sceneId = req.params.id
  const scenePath = path.join(__dirname, '../scenes', `${sceneId}.scene.base.json`)

  if (!fs.existsSync(scenePath)) {
    return res.status(404).json({ error: 'Scene not found' })
  }

  const raw = fs.readFileSync(scenePath, 'utf-8')
  const sceneData = JSON.parse(raw)

  // Optional: filtro dinamico (mock)
  const filtered = {
    ...sceneData,
    assets: sceneData.assets.map(a => ({
      ...a,
      url: `/assets/${path.basename(a.url)}`
    }))
  }

  res.json(filtered)
})

export default router