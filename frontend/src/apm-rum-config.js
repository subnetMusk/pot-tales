// ===================================================
// frontend/src/apm-rum-config.js
// ===================================================
// Elastic APM Real User Monitoring (RUM) configuration
// for frontend JavaScript application.
// =====================================================

import { init as initApm } from '@elastic/apm-rum'

// Initialize APM RUM agent with environment variables
const apm = initApm({
  // Service name for frontend application (from environment)
  serviceName: import.meta.env.VITE_ELASTIC_APM_RUM_SERVICE_NAME || 'frontend-app',
  
  // APM Server URL for data ingestion (from environment)
  serverUrl: import.meta.env.VITE_ELASTIC_APM_RUM_SERVER_URL || 'http://apm.localhost',
  
  // RUM Secret token (DIFFERENT from backend - from environment)
  // NOTE: This is specifically for RUM and different from the backend APM secret token
  secretToken: import.meta.env.VITE_ELASTIC_APM_RUM_SECRET_TOKEN || 'rum-secret-token-456',
  
  // Environment identifier (from environment)
  environment: import.meta.env.VITE_ELASTIC_APM_ENVIRONMENT || 'development',
  
  // Service version (optional)
  serviceVersion: '1.0.0',
  
  // Page load tracing configuration
  pageLoadTraceId: true,
  pageLoadSampled: true,
  pageLoadSpanId: true,
  
  // Transaction sample rate (1.0 = 100%, 0.1 = 10%)
  transactionSampleRate: 1.0,
  
  // Error logging configuration
  capturePageLoad: true,
  disableInstrumentations: [],
  
  // Optional: Custom configuration
  distributedTracingOrigins: ['http://localhost', 'http://server:3000'],
  
  // Debug mode for development
  logLevel: import.meta.env.DEV ? 'debug' : 'warn'
})

export default apm

// ================================================================
// SECRET TOKEN CONFIGURATION GUIDE
// ================================================================
//
// 1. BACKEND (Go Server) APM Agent:
//    - Uses: ELASTIC_APM_SECRET_TOKEN=apm-secret-token-123
//    - For: Server-side traces, database queries, HTTP requests
//
// 2. FRONTEND (RUM) APM Agent:
//    - Uses: ELASTIC_APM_RUM_SECRET_TOKEN=rum-secret-token-456
//    - For: Browser-side traces, user interactions, page loads
//
// 3. Configuration in .env file:
//    APM_SECRET_TOKEN=apm-secret-token-123               # Main APM token
//    ELASTIC_APM_SECRET_TOKEN=${APM_SECRET_TOKEN}        # Backend uses this
//    ELASTIC_APM_RUM_SECRET_TOKEN=rum-secret-token-456   # Frontend uses this
//
// 4. Docker Compose passes these to containers:
//    - server container gets ELASTIC_APM_SECRET_TOKEN
//    - frontend container gets VITE_ELASTIC_APM_RUM_SECRET_TOKEN
//
// 5. APM Server accepts both tokens for different agent types
// ================================================================

// Example usage in your main application:
// 
// import apm from './apm-rum-config.js'
// 
// // Manual transaction tracking
// const transaction = apm.startTransaction('page-load', 'page-load')
// // ... your code
// transaction.end()
// 
// // Manual error reporting
// apm.captureError(new Error('Something went wrong'))
// 
// // Add custom labels
// apm.addLabels({ userId: '123', feature: 'checkout' })
