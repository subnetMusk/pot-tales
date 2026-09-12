// Soluzione della prova di lavoro che il backend chiede oltre la soglia di
// creazione delle sessioni (server/helpers/pow.go): una stringa tale che
// SHA-256(sfida + soluzione) inizi con `difficolta` bit nulli.
//
// SHA-256 e' implementata qui invece di passare da crypto.subtle, che restituisce
// ogni digest attraverso una promessa: su centinaia di migliaia di tentativi il
// costo della promessa supera quello dell'hash.
//
// L'inizio della sfida non cambia fra un tentativo e l'altro: i suoi blocchi
// completi si comprimono una volta sola, e ogni tentativo elabora solo la coda.

const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const STATO_INIZIALE = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const W = new Uint32Array(64);

// Comprime il blocco di 64 byte che parte da `inizio` dentro `stato`.
function comprimi(stato: Uint32Array, dati: Uint8Array, inizio: number): void {
    for (let i = 0; i < 16; i++) {
        const j = inizio + i * 4;
        W[i] = (dati[j] << 24) | (dati[j + 1] << 16) | (dati[j + 2] << 8) | dati[j + 3];
    }
    for (let i = 16; i < 64; i++) {
        const x = W[i - 15];
        const y = W[i - 2];
        const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }

    let a = stato[0], b = stato[1], c = stato[2], d = stato[3];
    let e = stato[4], f = stato[5], g = stato[6], h = stato[7];
    for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
    }

    stato[0] += a; stato[1] += b; stato[2] += c; stato[3] += d;
    stato[4] += e; stato[5] += f; stato[6] += g; stato[7] += h;
}

// Stato dopo i primi `blocchi` blocchi completi di `dati`.
function statoIntermedio(dati: Uint8Array, blocchi: number): Uint32Array {
    const stato = STATO_INIZIALE.slice();
    for (let b = 0; b < blocchi * 64; b += 64) {
        comprimi(stato, dati, b);
    }
    return stato;
}

// Completa il digest a partire dallo stato intermedio: `buffer` contiene nei
// primi `coda` byte la parte del messaggio non ancora compressa, `totale` e' la
// lunghezza dell'intero messaggio. Il risultato finisce in `stato`.
function completa(intermedio: Uint32Array, buffer: Uint8Array, coda: number, totale: number, stato: Uint32Array): void {
    const fine = Math.ceil((coda + 9) / 64) * 64;
    buffer[coda] = 0x80;
    buffer.fill(0, coda + 1, fine - 4);
    const bit = totale * 8;
    buffer[fine - 4] = bit >>> 24;
    buffer[fine - 3] = bit >>> 16;
    buffer[fine - 2] = bit >>> 8;
    buffer[fine - 1] = bit;

    stato.set(intermedio);
    for (let b = 0; b < fine; b += 64) {
        comprimi(stato, buffer, b);
    }
}

// Digest SHA-256 di `dati`.
export function sha256(dati: Uint8Array): Uint8Array {
    const completi = Math.floor(dati.length / 64);
    const buffer = new Uint8Array(128);
    buffer.set(dati.subarray(completi * 64));
    const stato = new Uint32Array(8);
    completa(statoIntermedio(dati, completi), buffer, dati.length - completi * 64, dati.length, stato);

    const risultato = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
        risultato[i * 4] = stato[i] >>> 24;
        risultato[i * 4 + 1] = stato[i] >>> 16;
        risultato[i * 4 + 2] = stato[i] >>> 8;
        risultato[i * 4 + 3] = stato[i];
    }
    return risultato;
}

// Vero se i primi `bit` bit del digest sono nulli, con la stessa regola del
// backend: parole lette in ordine big-endian.
function zeriIniziali(stato: Uint32Array, bit: number): boolean {
    let i = 0;
    for (; bit >= 32; bit -= 32, i++) {
        if (stato[i] !== 0) {
            return false;
        }
    }
    return bit === 0 || (stato[i] >>> (32 - bit)) === 0;
}

// Oltre questa difficolta' la ricerca non si chiuderebbe in tempi compatibili con
// una partita: la sfida viene rifiutata invece di bloccare il gioco.
export const DIFFICOLTA_MASSIMA = 32;

export interface OpzioniRicerca {
    // Tempo oltre il quale la ricerca si arrende con un errore.
    tempoMassimoMs?: number;
    // Tentativi fra una cessione del controllo e la successiva: la scena continua
    // ad aggiornarsi mentre la ricerca prosegue.
    tentativiPerBlocco?: number;
}

// Cerca una soluzione per la sfida. Le soluzioni sono numeri decimali crescenti,
// quindi la ricerca e' deterministica per una data sfida.
export async function risolviProvaDiLavoro(
    sfida: string,
    difficolta: number,
    {tempoMassimoMs = 20_000, tentativiPerBlocco = 20_000}: OpzioniRicerca = {},
): Promise<string> {
    if (!Number.isInteger(difficolta) || difficolta < 0 || difficolta > DIFFICOLTA_MASSIMA) {
        throw new Error(`Difficolta' della prova di lavoro non gestita: ${difficolta}`);
    }

    const prefisso = new TextEncoder().encode(sfida);
    const completi = Math.floor(prefisso.length / 64);
    const intermedio = statoIntermedio(prefisso, completi);
    const coda = prefisso.length - completi * 64;
    const buffer = new Uint8Array(128);
    buffer.set(prefisso.subarray(completi * 64));
    const stato = new Uint32Array(8);
    const scadenza = Date.now() + tempoMassimoMs;

    for (let n = 0; ; n++) {
        const candidato = String(n);
        for (let i = 0; i < candidato.length; i++) {
            buffer[coda + i] = candidato.charCodeAt(i);
        }
        completa(intermedio, buffer, coda + candidato.length, prefisso.length + candidato.length, stato);
        if (zeriIniziali(stato, difficolta)) {
            return candidato;
        }

        if ((n + 1) % tentativiPerBlocco === 0) {
            if (Date.now() > scadenza) {
                throw new Error(`Prova di lavoro non risolta entro ${tempoMassimoMs} ms`);
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
    }
}
