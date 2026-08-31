import apm from '../apm-rum-config.js';

/**
 * Tassonomia unificata per i log.
 * Specchiare le costanti del backend per consistenza.
 */
export type LogCategory = 
  | 'authentication'
  | 'gameplay'
  | 'system'
  | 'security'
  | 'navigation'
  | 'ui_interaction';

export interface LogDetails {
  [key: string]: any;
}

class LoggerService {
  private static instance: LoggerService;
  private readonly apiUrl = '/log';

  private constructor() {
    // APM è già inizializzato nell'import
    console.log('[Logger] Service initialized');
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * Registra un evento di Business (azioni utente rilevanti).
   * Invia sia a APM (come custom transaction/span) che al Backend (per logging strutturato).
   */
  public business(category: LogCategory, action: string, details: LogDetails = {}) {
    // 1. Console Dev (solo in dev)
    if (import.meta.env.DEV) {
      console.info(`[Business] ${category}:${action}`, details);
    }

    // 2. Elastic APM (Span corrente o Transaction)
    // Aggiungiamo un evento "mark" alla timeline APM
    const currentTx = apm.getCurrentTransaction();
    if (currentTx) {
      currentTx.addLabels({ ...details, category, action });
      currentTx.mark(`${category}.${action}`);
    }

    // 3. Backend Ingestion (Log centralizzato)
    this.sendToBackend('info', category, action, details);
  }

  /**
   * Registra un evento di Sistema (debug, info tecniche).
   */
  public system(action: string, details: LogDetails = {}) {
    if (import.meta.env.DEV) {
      console.debug(`[System] ${action}`, details);
    }
    // I log di sistema frontend spesso non serve inviarli al backend per risparmiare banda,
    // a meno che non siano warning critici.
  }

  /**
   * Registra un errore.
   * Cattura automaticamente con APM e invia al backend.
   */
  public error(category: LogCategory, action: string, error: Error, details: LogDetails = {}) {
    console.error(`[Error] ${category}:${action}`, error);

    // 1. Elastic APM Error Capture
    //
    // L'agente RUM accetta come opzione soltanto `labels`, che sono indicizzate
    // e devono restare valori scalari: i dettagli, che hanno forma libera,
    // vanno nel contesto personalizzato. La versione precedente passava
    // `custom` e `tags`, che appartengono all'agente Node e non a questo: erano
    // ignorati, e gli errori arrivavano ad APM senza alcun dettaglio.
    apm.setCustomContext({ ...details, category, action });
    apm.captureError(error, {
      labels: { category, action }
    });

    // 2. Backend Ingestion
    this.sendToBackend('error', category, action, {
      ...details,
      message: error.message,
      stack: error.stack
    });
  }

  /**
   * Imposta l'utente corrente per la correlazione dei log.
   */
  public setUser(userId: string, username?: string, email?: string) {
    apm.setUserContext({
      id: userId,
      username: username,
      email: email
    });
  }

  private sendToBackend(level: string, category: string, action: string, details: any) {
    // Non blocchiamo l'esecuzione per il logging (fire and forget)
    fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        level,
        category,
        action,
        details
      }),
      keepalive: true // Importante per loggare eventi mentre la pagina si chiude
    }).catch(err => {
      // Fallback silenzioso se il backend è giù, per non spammare console.error
      if (import.meta.env.DEV) console.warn('[Logger] Failed to send to backend', err);
    });
  }
}

export const Logger = LoggerService.getInstance();
