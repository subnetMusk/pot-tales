export function applyTranslations(scene: Phaser.Scene, i18n: Record<string, string>) {
    Object.entries(i18n).forEach(([key, value]) => {
        const obj = scene.children.getByName(key);
        if (obj && typeof (obj as Phaser.GameObjects.Text).setText === "function") {
            (obj as Phaser.GameObjects.Text).setText(value);
        }
    });
}