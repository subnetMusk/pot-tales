#!/usr/bin/env node
/**
 * Script di test per APM RUM nel frontend
 * Simula attività utente per generare trace RUM
 */

const { exec } = require('child_process');
const path = require('path');

console.log('🚀 Test APM RUM - Simulazione attività utente');

// Script da iniettare nel browser per testare RUM
const rumTestScript = `
// Test RUM APM
console.log('🔍 Testing APM RUM...');

// Controlla se APM è inizializzato
if (window.apm || window.elasticApm) {
  console.log('✅ APM RUM Agent trovato!');
  
  const apm = window.apm || window.elasticApm;
  
  // Test 1: Transazione manuale
  console.log('📊 Test 1: Transazione manuale');
  const transaction = apm.startTransaction('rum-test-transaction', 'custom');
  
  // Simula un'operazione
  setTimeout(() => {
    transaction.end();
    console.log('✅ Transazione completata');
  }, 100);
  
  // Test 2: Errore custom
  console.log('📊 Test 2: Invio errore custom');
  apm.captureError(new Error('Test RUM Error - This is a test'));
  
  // Test 3: Aggiunta labels
  console.log('📊 Test 3: Labels personalizzate');
  apm.addLabels({ 
    testType: 'rum-verification',
    userId: 'test-user-123',
    feature: 'frontend-monitoring'
  });
  
  // Test 4: Custom span
  console.log('📊 Test 4: Span personalizzato');
  const span = apm.startSpan('custom-operation', 'app');
  if (span) {
    setTimeout(() => {
      span.end();
      console.log('✅ Span completato');
    }, 50);
  }
  
  console.log('🎯 Tutti i test RUM completati!');
  console.log('Controlla Kibana APM per vedere le trace');
  
} else {
  console.log('❌ APM RUM Agent non trovato');
  console.log('Controlla la configurazione RUM');
}

// Genera alcune interazioni simulate
console.log('🎭 Simulazione interazioni utente...');

// Simula click
document.body.click();

// Simula errori JavaScript
setTimeout(() => {
  console.log('🧪 Simulazione errore JavaScript...');
  // throw new Error('Test error for RUM');
}, 200);

// Simula fetch request
setTimeout(() => {
  console.log('🌐 Simulazione fetch request...');
  fetch('/health')
    .then(response => response.json())
    .then(data => console.log('✅ Fetch completato:', data))
    .catch(error => console.log('❌ Fetch error:', error));
}, 300);
`;

// Funzione per eseguire script nel browser
function testRUMInBrowser() {
  console.log('\n📱 Aprendo browser per test RUM...');
  
  // Apri il browser e inietta lo script
  const browserScript = `
    const script = document.createElement('script');
    script.textContent = \`${rumTestScript}\`;
    document.head.appendChild(script);
  `;
  
  console.log('\n🔧 Script di test RUM creato');
  console.log('💡 Per testare RUM:');
  console.log('   1. Apri http://localhost nel browser');
  console.log('   2. Apri Developer Tools (F12)');
  console.log('   3. Vai nella Console');
  console.log('   4. Incolla e esegui questo script:');
  console.log('\n' + '='.repeat(50));
  console.log(rumTestScript);
  console.log('='.repeat(50));
  
  return browserScript;
}

// Funzione per verificare trace in Elasticsearch
async function checkRUMTraces() {
  console.log('\n🔍 Verifica trace RUM in Elasticsearch...');
  
  exec('docker exec elasticsearch curl -s -u "elastic:m6OHmMuiqNrV1i25Jz3Z" "http://localhost:9200/traces-apm*/_search?q=service.name:frontend-app&size=5" 2>/dev/null', 
    (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Errore controllo Elasticsearch:', error.message);
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        const hits = result.hits?.total?.value || 0;
        
        console.log(`📊 Trace RUM trovate: ${hits}`);
        
        if (hits > 0) {
          console.log('✅ RUM sta funzionando!');
          console.log('   - Trace frontend rilevate in Elasticsearch');
          console.log('   - Verifica in Kibana: http://kibana.localhost/app/apm/services');
        } else {
          console.log('⚠️  Nessuna trace RUM trovata ancora');
          console.log('   - Potrebbero servire alcuni minuti per apparire');
          console.log('   - Assicurati di aver interagito con il frontend');
        }
      } catch (e) {
        console.log('❌ Errore parsing risposta Elasticsearch');
      }
    }
  );
}

// Esegui i test
console.log('🎯 Avvio test APM RUM...\n');

testRUMInBrowser();

// Aspetta un po' e poi controlla le trace
setTimeout(checkRUMTraces, 3000);

console.log('\n🔗 Link utili:');
console.log('   Frontend: http://localhost');
console.log('   Kibana APM: http://kibana.localhost/app/apm/services');
console.log('   Credenziali Kibana: elastic / m6OHmMuiqNrV1i25Jz3Z');
