export function applyTranslations(parent: Phaser.Scene | Phaser.GameObjects.Container, i18n: Record<string, string>): void {
    Object.entries(i18n).forEach(([key, value]) => {
        const obj = parent instanceof Phaser.Scene ? parent.children.getByName?.(key) : parent.list.find(child => child.name === key);
        if (obj && typeof (obj as Phaser.GameObjects.Text).setText === "function") {
            (obj as Phaser.GameObjects.Text).setText(value);
        }
    });
}

export function showElements(elements: Array<Phaser.GameObjects.GameObject>, show: boolean) {
	elements.forEach(obj => {
		if ("alpha" in obj) obj.alpha = show ? 1 : 0;
	});
}

export function fadeElements(SceneObject: Array<Phaser.GameObjects.GameObject>, show: boolean, duration: number = 1000, onComplete?: () => void) {
	SceneObject.forEach(obj => {
		obj.scene.tweens.add({
			targets: obj,
			alpha: show ? 1 : 0,
			duration: duration,
			ease: 'Quad.easeInOut',
			onComplete: onComplete
		});
	});
}