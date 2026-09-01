import {z} from 'zod';

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
const GetPositionResponseSchema = z.object({
    scene_id: z.string(),
    x: z.string(),
    y: z.string(),
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
            onHttpError?: (response: Response) => TRes | undefined;
            validationErrorLogPrefix: string;
            validationErrorMessage: string;
            onValidated: (data: TRes) => void;
        }
    ): Promise<TRes> {
        let response: Response;
        try {
            response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                ...init,
            });

        } catch (networkError) {
            console.error(ctx.networkErrorLogPrefix, networkError);
            throw new Error(ctx.networkErrorMessage);
        }

        if (!response.ok) {
            const shortCircuit = ctx.onHttpError?.(response);
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
    public async createSession(requestData: CreateSessionRequest): Promise<CreateSessionResponse> {
        console.log('Creazione sessione con i dati:', requestData);

        return this.request(
            `${this.baseUrl}/session`,
            { method: 'POST', body: JSON.stringify(requestData) },
            CreateSessionResponseSchema,
            {
                networkErrorLogPrefix: 'Errore di rete:',
                networkErrorMessage: 'Errore di rete durante la richiesta.',
                httpErrorLogPrefix: 'Errore HTTP:',
                validationErrorLogPrefix: 'Risposta del server non valida:',
                validationErrorMessage: 'Formato della risposta del server non valido.',
                onValidated: (validatedResponse) => {
                    console.log('Risposta del server valida:', validatedResponse);
                    this.saveSessionCookie(
                        validatedResponse.token,
                        new Date(validatedResponse.expires)
                    );
                },
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

    private saveSessionCookie(token: string, expires: Date): void {
        document.cookie = `session_token=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Strict; Secure`;
    }

}
