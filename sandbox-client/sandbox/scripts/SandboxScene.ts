import Phaser from 'phaser'

export default class SandboxScene extends Phaser.Scene {
  constructor() {
    super('SandboxScene')
  }

  create() {
    const message = 'Benvenuto nel Sandbox Client!'
    const text = this.add.text(this.scale.width / 2, this.scale.height / 2, message, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff'
    })

    text.setOrigin(0.5)
  }
}