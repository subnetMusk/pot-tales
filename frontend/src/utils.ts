export function applyTranslations(parent: Phaser.Scene | Phaser.GameObjects.Container, i18n: Record<string, string>): void {
    Object.entries(i18n).forEach(([key, value]) => {
        const obj = parent instanceof Phaser.Scene ? parent.children.getByName?.(key) : parent.list.find(child => child.name === key);
        if (obj && typeof (obj as Phaser.GameObjects.Text).setText === "function") {
            (obj as Phaser.GameObjects.Text).setText(value);
        }
    });
}