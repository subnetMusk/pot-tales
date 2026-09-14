// Listener su emitter che vivono più a lungo di chi li registra.
//
// Gli eventi di una scena Phaser (scene.events) sopravvivono allo shutdown: li svuota solo la
// distruzione della scena, che nel gioco non avviene mai. Un oggetto che vi registra un
// listener e muore con la scena lo lascia attaccato, e al successivo avvio della stessa scena
// nella stessa pagina quel listener scatta su un oggetto distrutto (this.scene undefined):
// l'eccezione interrompe l'emissione e con lei i listener della partita nuova.
//
// Il modulo non importa Phaser, così lo si può testare con il runner di Node (vedi
// frontend/test/sceneListeners.test.ts).

type Listener = (...args: any[]) => void;

export interface ListenerTarget {
	on(event: string, fn: Listener): unknown;
	off(event: string, fn: Listener): unknown;
}

// Un Game Object di Phaser emette "destroy" (Phaser.GameObjects.Events.DESTROY) in destroy(),
// prima di rimuovere i propri listener e di azzerare this.scene.
export interface DestroyNotifier {
	once(event: "destroy", fn: () => void): unknown;
}

// Registra fn su target finché owner non viene distrutto.
export function listenUntilDestroyed(target: ListenerTarget, event: string, fn: Listener, owner: DestroyNotifier): void {
	target.on(event, fn);
	owner.once("destroy", () => target.off(event, fn));
}
