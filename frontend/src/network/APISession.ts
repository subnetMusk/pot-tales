import {z} from 'zod';
import {risolviProvaDiLavoro} from './pow';

// --- Definizione Schemi e Tipi ---

// CREATE SESSION -----
const CreateSessionRequestSchema = z.object({
    device: z.string().max(1024),
    ipAddress: z.string().ip({ version: "v4" }).optional(),
    consentGiven: z.boolean(),
}).strict();
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

const CreateSessionResponseSchema = z.object({
    token: z.string().uuid(),
    expires: z.string().datetime(),
}).strict();
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;

// Corpo della risposta 429: la sfida e' anche nell'intestazione X-PoW-Challenge, ma
// il corpo e' leggibile anche quando le intestazioni non sono esposte.
const PowChallengeSchema = z.object({
    challenge: z.string().min(1),
    difficulty: z.number().int().nonnegative(),
});

// Sfide consecutive accettate per una creazione: una sfida scaduta o gia' usata
// ne produce un'altra, e oltre questo numero l'errore risale al chiamante.
const POW_TENTATIVI = 3;
// ------------------

// VALIDATE SESSION -----
const ValidateSessionRequestSchema = z.object({}).strict();
export type ValidateSessionRequest = z.infer<typeof ValidateSessionRequestSchema>;

const ValidateSessionResponseSchema = z.object({
    state: z.enum(["active", "inactive", "absent"]),
    session: z.string().uuid().optional(),
}).strict();
export type ValidateSessionResponse = z.infer<typeof ValidateSessionResponseSchema>;
// ------------------

// GET POSITION -----
// x e y mancano finche' il gioco non ha inviato il primo ping: la sessione nasce
// all'avvio di Stage1, che non invia ancora la posizione. In quel caso si usa lo
// spawn della scena, non lo zero.
const GetPositionResponseSchema = z.object({
    scene_id: z.string(),
    x: z.string().optional(),
    y: z.string().optional(),
    last_ping: z.string().datetime(),
    checkpoints: z.array(z.string()),
}).strict();
export type GetPositionResponse = z.infer<typeof GetPositionResponseSchema>;
// ------------------

// PING -----
const PingResponseSchema = z.object({
    scene_id: z.string(),
    x: z.string(),
    y: z.string(),
    last_ping: z.string().datetime(),
    action: z.enum(["accept", "rubberband", "kick", "ban"]),
}).strict();
export type PingResponse = z.infer<typeof PingResponseSchema>;
// ------------------

// CHECKPOINT / RESET -----
const StatusResponseSchema = z.object({
    status: z.literal("ok"),
}).strict();
export type StatusResponse = z.infer<typeof StatusResponseSchema>;
// ------------------


export class APISession {
    private baseUrl: string;
    private gameBaseUrl: string;

    constructor() {
        this.baseUrl = "/auth";
        this.gameBaseUrl = "/game";
    }

    // Factors out the fetch / HTTP-check / Zod-parse / logging skeleton shared by every
    // endpoint below. Per-call-site behavior (error text, HTTP short-circuits, success
    // side effects) is passed in via ctx so each endpoint keeps its own exact wording.
    private async request<TRes>(
        url: string,
        init: RequestInit,
        schema: z.ZodType<TRes>,
        ctx: {
            networkErrorLogPrefix: string;
            networkErrorMessage: string;
            httpErrorLogPrefix: string;
            onHttpError?: (response: Response) => TRes | undefined | Promise<TRes | undefined>;
            validationErrorLogPrefix: string;
            validationErrorMessage: string;
            onValidated: (data: TRes) => void;
        }
    ): Promise<TRes> {
        // Le intestazioni della singola chiamata si aggiungono a quelle comuni:
        // lasciate dentro `init` le sostituirebbero per intero.
        const {headers, ...resto} = init;
        let response: Response;
        try {
            response = await fetch(url, {
                ...resto,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(headers as Record<string, string> | undefined),
                },
            });

        } catch (networkError) {
            console.error(ctx.networkErrorLogPrefix, networkError);
            throw new Error(ctx.networkErrorMessage);
        }

        if (!response.ok) {
            const shortCircuit = await ctx.onHttpError?.(response);
            if (shortCircuit !== undefined) {
                return shortCircuit;
            }
            console.error(`${ctx.httpErrorLogPrefix} ${response.status} ${response.statusText}`);
            throw new Error(`Errore server: ${response.status}`);
        }

        const responseData = await response.json();

        try {
            const validatedResponse = schema.parse(responseData);
            ctx.onValidated(validatedResponse);
            return validatedResponse;

        } catch (validationError) {
            console.error(ctx.validationErrorLogPrefix, validationError);
            console.error('Dati ricevuti:', responseData);
            throw new Error(ctx.validationErrorMessage);
        }
    }

    // INVIA LA RICHIESTA PER LA CREAZIONE DI UNA NUOVA SESSIONE
    //
    // Oltre la soglia di sessioni create dallo stesso indirizzo, che dietro il NAT
    // di una conferenza e' condiviso da tutta la sala, il backend risponde 429 con
    // una sfida a prova di lavoro: la si risolve e si ripete la richiesta con la
    // soluzione.
    //
    // Il cookie di sessione lo imposta il backend nella stessa risposta, HttpOnly:
    // il client non lo scrive, e non puo' leggerlo.
    public async createSession(requestData: CreateSessionRequest): Promise<CreateSessionResponse> {
        console.log('Creazione sessione con i dati:', requestData);

        return this.inviaCreazione(requestData, {}, POW_TENTATIVI);
    }

    private async inviaCreazione(
        requestData: CreateSessionRequest,
        prova: Record<string, string>,
        tentativiRimasti: number,
    ): Promise<CreateSessionResponse> {
        return this.request(
            `${this.baseUrl}/session`,
            { method: 'POST', body: JSON.stringify(requestData), headers: prova },
            CreateSessionResponseSchema,
            {
                networkErrorLogPrefix: 'Errore di rete:',
                networkErrorMessage: 'Errore di rete durante la richiesta.',
                httpErrorLogPrefix: 'Errore HTTP:',
                onHttpError: async (response) => {
                    if (response.status !== 429 || tentativiRimasti === 0) {
                        return undefined;
                    }
                    const sfida = PowChallengeSchema.safeParse(await response.json().catch(() => null));
                    if (!sfida.success) {
                        return undefined;
                    }

                    console.log(`Prova di lavoro richiesta, difficolta' ${sfida.data.difficulty}`);
                    const soluzione = await risolviProvaDiLavoro(sfida.data.challenge, sfida.data.difficulty);
                    return this.inviaCreazione(requestData, {
                        'X-PoW-Challenge': sfida.data.challenge,
                        'X-PoW-Solution': soluzione,
                    }, tentativiRimasti - 1);
                },
                validationErrorLogPrefix: 'Risposta del server non valida:',
                validationErrorMessage: 'Formato della risposta del server non valido.',
                onValidated: (validatedResponse) => console.log('Risposta del server valida:', validatedResponse),
            }
        );
    }

    // VERIFICA SE LA SESSIONE SALVATA NEI COOKIES è:
    // ATTIVA -> salvata in redis
    // INATTIVA -> salvata in mongo (e verrà spostata ora in redis)
    // INESISTENTE -> uuid non valido, da rimandare al menu principale
    public async validateSession(): Promise<ValidateSessionResponse> {
        console.log('Validazione sessione in corso...');

        const requestData: ValidateSessionRequest = {};

        return this.request(
            `${this.baseUrl}/validate`,
            { method: 'GET' },
            ValidateSessionResponseSchema,
            {
                networkErrorLogPrefix: 'Errore di rete (validate):',
                networkErrorMessage: 'Errore di rete durante la validazione.',
                httpErrorLogPrefix: 'Errore HTTP (validate):',
                onHttpError: (response) => response.status === 401 ? { state: "absent" } as ValidateSessionResponse : undefined,
                validationErrorLogPrefix: 'Risposta di validazione non valida:',
                validationErrorMessage: 'Formato della risposta di validazione non valido.',
                onValidated: (validatedResponse) => console.log(`Stato sessione: ${validatedResponse.state}`),
            }
        );
    }


    // LEGGE LA POSIZIONE/SCENA/CHECKPOINT SALVATI PER QUESTA SESSIONE (usato dal Menu per il Resume)
    public async getPosition(): Promise<GetPositionResponse> {
        return this.request(
            `${this.gameBaseUrl}/position`,
            { method: 'GET' },
            GetPositionResponseSchema,
            {
                networkErrorLogPrefix: 'Errore di rete (position):',
                networkErrorMessage: 'Errore di rete durante il recupero della posizione.',
                httpErrorLogPrefix: 'Errore HTTP (position):',
                validationErrorLogPrefix: 'Risposta posizione non valida:',
                validationErrorMessage: 'Formato della risposta posizione non valido.',
                onValidated: () => {},
            }
        );
    }

    // INVIA LA POSIZIONE CORRENTE (chiamata periodica ogni 5-10s) E RICEVE LO STATO AUTORITATIVO
    public async ping(sceneId: string, x: number, y: number): Promise<PingResponse> {
        return this.request(
            `${this.gameBaseUrl}/ping`,
            { method: 'POST', body: JSON.stringify({ scene_id: sceneId, x, y }) },
            PingResponseSchema,
            {
                networkErrorLogPrefix: 'Errore di rete (ping):',
                networkErrorMessage: 'Errore di rete durante il ping.',
                httpErrorLogPrefix: 'Errore HTTP (ping):',
                validationErrorLogPrefix: 'Risposta ping non valida:',
                validationErrorMessage: 'Formato della risposta ping non valido.',
                onValidated: () => {},
            }
        );
    }

    // REGISTRA UN TRAGUARDO RAGGIUNTO (evento discreto, es. turret risolta, stage completato)
    public async saveCheckpoint(checkpointId: string): Promise<StatusResponse> {
        return this.request(
            `${this.gameBaseUrl}/checkpoint`,
            { method: 'POST', body: JSON.stringify({ checkpoint_id: checkpointId }) },
            StatusResponseSchema,
            {
                networkErrorLogPrefix: 'Errore di rete (checkpoint):',
                networkErrorMessage: 'Errore di rete durante il salvataggio del checkpoint.',
                httpErrorLogPrefix: 'Errore HTTP (checkpoint):',
                validationErrorLogPrefix: 'Risposta checkpoint non valida:',
                validationErrorMessage: 'Formato della risposta checkpoint non valido.',
                onValidated: () => {},
            }
        );
    }

    // CANCELLA I PROGRESSI SALVATI (usato dal bottone "Play" per ripartire da zero)
    public async resetProgress(): Promise<StatusResponse> {
        return this.request(
            `${this.gameBaseUrl}/reset`,
            { method: 'POST', body: JSON.stringify({}) },
            StatusResponseSchema,
            {
                networkErrorLogPrefix: 'Errore di rete (reset):',
                networkErrorMessage: 'Errore di rete durante il reset dei progressi.',
                httpErrorLogPrefix: 'Errore HTTP (reset):',
                validationErrorLogPrefix: 'Risposta reset non valida:',
                validationErrorMessage: 'Formato della risposta reset non valido.',
                onValidated: () => {},
            }
        );
    }

}
