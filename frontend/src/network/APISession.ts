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
}).strict();
export type ValidateSessionResponse = z.infer<typeof ValidateSessionResponseSchema>;
// ------------------



export class APISession {
    private baseUrl: string;

    constructor() {
        this.baseUrl = "/auth";
    }

    // INVIA LA RICHIESTA PER LA CREAZIONE DI UNA NUOVA SESSIONE
    public async createSession(requestData: CreateSessionRequest): Promise<CreateSessionResponse> {
        console.log('Creazione sessione con i dati:', requestData);

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}/session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(requestData),
            });

        } catch (networkError) {
            console.error('Errore di rete:', networkError);
            throw new Error('Errore di rete durante la richiesta.');
        }

        if (!response.ok) {
            // Gestisce errori HTTP (es. 404, 500)
            console.error(`Errore HTTP: ${response.status} ${response.statusText}`);
            throw new Error(`Errore server: ${response.status}`);
        }

        const responseData = await response.json();

        // --- Validazione della Risposta ---
        try {

            // --- Validazione dello schema
            const validatedResponse = CreateSessionResponseSchema.parse(responseData);

            console.log('Risposta del server valida:', validatedResponse);

            // --- Operazioni ---
            this.saveSessionCookie(
                validatedResponse.token,
                new Date(validatedResponse.expires)
            );

            return validatedResponse;

        } catch (validationError) {
            // Gestione dell'eccezione di validazione
            console.error('Risposta del server non valida:', validationError);
            console.error('Dati ricevuti:', responseData);
            throw new Error('Formato della risposta del server non valido.');
        }
    }

    // VERIFICA SE LA SESSIONE SALVATA NEI COOKIES è:
    // ATTIVA -> salvata in redis
    // INATTIVA -> salvata in mongo (e verrà spostata ora in redis)
    // INESISTENTE -> uuid non valido, da rimandare al menu principale
    public async validateSession(): Promise<ValidateSessionResponse> {
        console.log('Validazione sessione in corso...');

        const requestData: ValidateSessionRequest = {};

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}/validate`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                }
            });

        } catch (networkError) {
            console.error('Errore di rete (validate):', networkError);
            throw new Error('Errore di rete durante la validazione.');
        }

        if (!response.ok) {
            if (response.status === 401) {
                console.log("COD 401");
            }
            console.error(`Errore HTTP (validate): ${response.status} ${response.statusText}`);
            throw new Error(`Errore server: ${response.status}`);
        }

        const responseData = await response.json();

        try {
            const validatedResponse = ValidateSessionResponseSchema.parse(responseData);

            console.log(`Stato sessione: ${validatedResponse.state}`);
            return validatedResponse;

        } catch (validationError) {
            console.error('Risposta di validazione non valida:', validationError);
            console.error('Dati ricevuti:', responseData);
            throw new Error('Formato della risposta di validazione non valido.');
        }
    }


    private saveSessionCookie(token: string, expires: Date): void {
        document.cookie = `session_token=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Strict; Secure`;
    }

}