import Phaser from 'phaser'
import CurrentScene from '../scene/CurrentScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#000000',
  parent: 'body',
  scene: [CurrentScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
}

const game = new Phaser.Game(config)

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight)
})