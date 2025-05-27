export async function loadSceneFromData(scene: Phaser.Scene, data: any): Promise<void> {
  for (const asset of data.assets || []) {
    if (asset.type === 'image') {
      scene.load.image(asset.key, 'http://localhost:3000' + asset.url)
    }
  }

  return new Promise((resolve) => {
    scene.load.once('complete', resolve)
    scene.load.start()
  })
}