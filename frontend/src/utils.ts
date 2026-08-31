import PopupManager from "./items/UI/PopupManager";
import PixelPanel, { PixelPanelState } from "./items/UI/PixelPanel";

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

export function fadeElements(SceneObject: Array<Phaser.GameObjects.GameObject>, show: boolean, duration: number = 1000, onComplete?: () => void, targetAlpha: number = 1) {
	SceneObject.forEach(obj => {
		obj.scene.tweens.add({
			targets: obj,
			alpha: show ? targetAlpha : 0,
			duration: duration,
			ease: 'Quad.easeInOut',
			onComplete: onComplete
		});
	});
}

// Pauses parentScene, launches childSceneKey on top of it, and resolves onComplete once
// the child reports completionEvent. Stopping the child scene (if needed) is the caller's
// responsibility, since some minigames stop themselves.
export function launchSubScene(
	parentScene: Phaser.Scene,
	childSceneKey: string,
	options: {
		launchData?: object;
		completionEvent: string;
		listenOn?: 'child' | 'parent';
	},
	onComplete: (payload?: any) => void
): void {
	parentScene.scene.pause();
	parentScene.scene.launch(childSceneKey, options.launchData);
	parentScene.scene.bringToTop(childSceneKey);

	const emitter = options.listenOn === 'parent'
		? parentScene.events
		: parentScene.scene.get(childSceneKey)?.events;

	emitter?.once(options.completionEvent, onComplete);
}

export interface PixelButtonHandles {
	graphics: Phaser.GameObjects.Graphics;
	panel: PixelPanel;
	// Blocca il pannello nello stato "hover" (usato per marcare l'opzione attualmente
	// selezionata, es. la lingua attiva) invece che tornare a "idle" col pointerout.
	setActive: (active: boolean) => void;
}

// Sostituisce il bordo piatto di un Rectangle editor-generato con un pannello "8-bit"
// (bordo spesso + ombra + highlight, stesso linguaggio visivo del box-shadow stack di
// style.css) e aggiunge feedback hover/press con tween di scala su pannello + testo/icona
// (se forniti), così si muovono in sincrono. Il rettangolo diventa una hit-area invisibile;
// `moveBelow` lo mantiene sotto a testo/icona (che vanno aggiunti al display list *dopo*
// di esso da chi chiama, come fa il codice generato da Phaser Editor) senza doverli riordinare.
export function setupPixelButton(
	scene: Phaser.Scene,
	rect: Phaser.GameObjects.Rectangle,
	options: {
		fillColor: number;
		hoverColor: number;
		borderColor?: number;
		borderThickness?: number;
		shadowOffset?: number;
		// Il pannello (bordo+ombra) sporge oltre ai bordi del Rectangle: se più bottoni sono
		// vicini tra loro (es. affiancati), quella sporgenza può farli sembrare sovrapposti
		// anche se i rispettivi rect non si toccano. `inset` rimpicciolisce solo il pannello
		// disegnato, lasciando invariata l'area cliccabile (il rect resta a grandezza piena).
		inset?: number;
		text?: Phaser.GameObjects.Text | null;
		icon?: Phaser.GameObjects.Image | null;
	}
): PixelButtonHandles {
	rect.isStroked = false;

	const inset = options.inset ?? 0;
	const panelWidth = rect.width - inset * 2;
	const panelHeight = rect.height - inset * 2;

	const graphics = scene.add.graphics();
	graphics.setPosition(rect.x, rect.y);
	const panel = new PixelPanel(graphics, -panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, {
		fillColor: options.fillColor,
		hoverColor: options.hoverColor,
		borderColor: options.borderColor ?? 0x000000,
		borderThickness: options.borderThickness ?? 3,
		shadowOffset: options.shadowOffset ?? 5,
	});
	scene.children.moveBelow(graphics, rect);

	const { text, icon } = options;
	// L'icona può avere già uno scale base (es. 2x) impostato in editorCreate: il fattore
	// va applicato relativo a quello, non sovrascritto (altrimenti si rimpicciolisce).
	const iconBaseScale = icon?.scaleX ?? 1;
	let restState: PixelPanelState = 'idle';

	const tweenScale = (factor: number, duration: number) => {
		const flatTargets: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text> = text ? [graphics, text] : [graphics];
		scene.tweens.add({ targets: flatTargets, scale: factor, duration, ease: 'Sine.easeOut' });
		if (icon) {
			scene.tweens.add({ targets: icon, scale: iconBaseScale * factor, duration, ease: 'Sine.easeOut' });
		}
	};

	rect.on('pointerover', () => { panel.redraw('hover'); tweenScale(1.05, 100); });
	rect.on('pointerout', () => { panel.redraw(restState); tweenScale(restState === 'hover' ? 1.05 : 1, 100); });
	rect.on('pointerdown', () => { panel.redraw('press'); tweenScale(0.95, 80); });
	rect.on('pointerup', () => { panel.redraw('hover'); tweenScale(1.05, 80); });

	const setActive = (active: boolean) => {
		restState = active ? 'hover' : 'idle';
		panel.redraw(restState);
	};

	return { graphics, panel, setActive };
}

// Queues `lines` on popupManager, shows them, and resolves once the queue drains.
// Only use this for chains that are pure dialogue: if the original code interleaved a
// side effect (camera move, sound, a concurrent recursive call) between showing the
// popups and the queue emptying, keep that section imperative instead of using this.
export function playSequence(
	popupManager: PopupManager,
	lines: Array<string | { message: string; preset?: string }>,
	autoCloseDelay: number | 'infinite' = 'infinite'
): Promise<void> {
	lines.forEach(line => {
		if (typeof line === 'string') popupManager.queuePopup(line);
		else popupManager.queuePopup(line.message, line.preset);
	});
	popupManager.showNextPopup(autoCloseDelay);
	return new Promise<void>(resolve => popupManager.on('queueEmpty', resolve));
}