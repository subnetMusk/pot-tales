//go:build integration

package router

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"go.elastic.co/apm/v2"
	"go.elastic.co/apm/v2/apmtest"
)

// La richiesta viene respinta dal validator, ma deve già avere la transazione
// con la rotta corretta. Un traceparent RUM non campionato non deve spegnere
// il campionamento del backend quando lo stack configura restart.
func TestAPMRottaECampionamentoIndipendente(t *testing.T) {
	t.Setenv("ELASTIC_APM_TRACE_CONTINUATION_STRATEGY", "restart")
	t.Setenv("ELASTIC_APM_TRANSACTION_SAMPLE_RATE", "1")
	previous := apm.DefaultTracer()
	recorder := apmtest.NewRecordingTracer()
	apm.SetDefaultTracer(recorder.Tracer)
	t.Cleanup(func() { apm.SetDefaultTracer(previous); recorder.Close() })
	b := nuovoBanco(t)
	req, _ := http.NewRequest(http.MethodPost, b.server.URL+"/auth/session", strings.NewReader(`{}`))
	const incoming = "0123456789abcdef0123456789abcdef"
	req.Header.Set("traceparent", "00-"+incoming+"-0123456789abcdef-00")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("validator: %d", res.StatusCode)
	}
	recorder.Flush(nil)
	transactions := recorder.Payloads().Transactions
	if len(transactions) != 1 {
		t.Fatalf("transazioni: %d", len(transactions))
	}
	tx := transactions[0]
	if tx.Name != "POST /auth/session" {
		t.Errorf("nome: %q", tx.Name)
	}
	encoded, err := json.Marshal(tx)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]any
	if err := json.Unmarshal(encoded, &fields); err != nil {
		t.Fatal(err)
	}
	// Il protocollo APM omette sampled quando vale true; false e' esplicito.
	if tx.Sampled != nil && !*tx.Sampled {
		t.Errorf("campionamento: %v", fields["sampled"])
	}
	if fields["trace_id"] == incoming {
		t.Error("trace del browser continuata invece di restart")
	}
	links, ok := fields["links"].([]any)
	if !ok || len(links) != 1 {
		t.Errorf("collegamento RUM: %v", fields["links"])
	}
}
