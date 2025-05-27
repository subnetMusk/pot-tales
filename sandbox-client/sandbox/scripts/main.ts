import Phaser from 'phaser'
import SandboxScene from './SandboxScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#121212',
  parent: 'body',
  scene: [SandboxScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
}

const game = new Phaser.Game(config)

// opzionale: aggiorna manualmente su resize (in più rispetto a RESIZE mode)
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight)
})