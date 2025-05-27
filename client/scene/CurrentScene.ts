import Phaser from 'phaser'
import { fetchScene } from '../scripts/ApiClient'
import { loadSceneFromData } from './SceneLoader'

export default class CurrentScene extends Phaser.Scene {
  constructor() {
    super('CurrentScene')
  }

  async preload() {
    const sceneData = await fetchScene('iniziale')
    await loadSceneFromData(this, sceneData)

    // Dispone gli oggetti
    for (const obj of sceneData.objects || []) {
      this.add.image(obj.x, obj.y, obj.sprite)
    }
  }

  create() {
    this.add.text(this.scale.width / 2, 30, 'Client Reale con Dati dal Server', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5, 0)
  }
}