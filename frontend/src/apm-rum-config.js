// Il pacchetto RUM viene caricato soltanto dopo "Accetta tutti". Un import
// statico lo eseguirebbe prima della scelta anche se poi non inviasse eventi.

/** @type {any} */
const noopTransaction = {
  addLabels() {},
  end() {},
  mark() {}
}

/** @type {any} */
const noopApm = {
  addLabels() {},
  captureError() {},
  getCurrentTransaction() { return undefined },
  setCustomContext() {},
  setUserContext() {},
  startTransaction() { return noopTransaction }
}

/** @type {any} */
let currentApm = noopApm
let initialization

function numberBetweenZeroAndOne(value, fallback) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback
}

export async function enableApm() {
  if (currentApm !== noopApm) return currentApm
  if (initialization) return initialization

  initialization = import('@elastic/apm-rum').then((rumModule) => {
    const configuredActive = import.meta.env.VITE_ELASTIC_APM_RUM_ACTIVE
    if (configuredActive === 'false') return noopApm

    // La libreria espone `init` sia come named export sia come default export.
    // Accettare entrambe le forme rende il bootstrap stabile anche quando il
    // bundler normalizza in modo diverso il modulo CommonJS/ESM.
    const init = rumModule.init || rumModule.default
    if (typeof init !== 'function') {
      throw new TypeError('Elastic APM RUM non espone una funzione init')
    }

    currentApm = init({
      serviceName: import.meta.env.VITE_ELASTIC_APM_RUM_SERVICE_NAME || 'frontend-app',
      serverUrl: import.meta.env.VITE_ELASTIC_APM_RUM_SERVER_URL || '/telemetria',
      environment: import.meta.env.VITE_ELASTIC_APM_ENVIRONMENT || (import.meta.env.DEV ? 'development' : 'production'),
      serviceVersion: '1.0.0',
      transactionSampleRate: numberBetweenZeroAndOne(import.meta.env.VITE_ELASTIC_APM_RUM_SAMPLE_RATE, 0.2),
      distributedTracingOrigins: [window.location.origin],
      logLevel: import.meta.env.DEV ? 'debug' : 'warn'
    })
    return currentApm
  }).catch(error => {
    initialization = undefined
    console.warn('[APM] inizializzazione non riuscita; il gioco continua senza telemetria.', error)
    return noopApm
  })

  return initialization
}

// Proxy stabile: i moduli che lo importano vedono l'agente attivato in seguito.
/** @type {any} */
const apm = new Proxy(noopApm, {
  get(_target, property) {
    const value = currentApm[property]
    return typeof value === 'function' ? value.bind(currentApm) : value
  }
})

export default apm
