import fs from 'fs'
import path from 'path'

export function getScene(req, res) {
  const sceneId = req.params.id
  const session = req.session || { user: 'dev', inventory: [], flags: [] }

  const scenePath = path.join('server', 'scenes', `${sceneId}.scene.base.json`)
  if (!fs.existsSync(scenePath)) {
    return res.status(404).json({ error: 'Scene not found' })
  }

  const raw = fs.readFileSync(scenePath, 'utf-8')
  const sceneData = JSON.parse(raw)

  // Mock filtering (in futuro: filtra in base allo stato sessione)
  const filtered = {
    ...sceneData,
    assets: sceneData.assets.map(asset => ({
      ...asset,
      url: `/assets/${path.basename(asset.url)}`
    }))
  }

  return res.json(filtered)
}