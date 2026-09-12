package helpers

import "testing"

func TestEnv(t *testing.T) {
	casi := []struct {
		nome    string
		imposta bool
		valore  string
		ripiego string
		atteso  string
	}{
		{nome: "variabile assente", imposta: false, ripiego: "predefinito", atteso: "predefinito"},
		{nome: "variabile valorizzata", imposta: true, valore: "esplicito", ripiego: "predefinito", atteso: "esplicito"},
		// Una variabile impostata a stringa vuota equivale ad assente: e' il caso
		// che si presenta quando un file di ambiente dichiara la chiave senza
		// valore, e trattarla come valore valido propagherebbe il vuoto ovunque.
		{nome: "variabile vuota", imposta: true, valore: "", ripiego: "predefinito", atteso: "predefinito"},
	}

	for _, c := range casi {
		t.Run(c.nome, func(t *testing.T) {
			const chiave = "PI_TEST_ENV"
			if c.imposta {
				t.Setenv(chiave, c.valore)
			}
			if got := Env(chiave, c.ripiego); got != c.atteso {
				t.Fatalf("Env() = %q, atteso %q", got, c.atteso)
			}
		})
	}
}

func TestEnvInt(t *testing.T) {
	casi := []struct {
		nome    string
		imposta bool
		valore  string
		ripiego int
		atteso  int
	}{
		{nome: "assente", imposta: false, ripiego: 42, atteso: 42},
		{nome: "numero valido", imposta: true, valore: "7", ripiego: 42, atteso: 7},
		{nome: "zero esplicito", imposta: true, valore: "0", ripiego: 42, atteso: 0},
		{nome: "negativo", imposta: true, valore: "-3", ripiego: 42, atteso: -3},
		// Un valore non numerico non deve essere interpretato come zero: uno zero
		// silenzioso su una soglia significa disattivarla senza che nulla lo dica.
		{nome: "non numerico", imposta: true, valore: "molti", ripiego: 42, atteso: 42},
		{nome: "vuoto", imposta: true, valore: "", ripiego: 42, atteso: 42},
	}

	for _, c := range casi {
		t.Run(c.nome, func(t *testing.T) {
			const chiave = "PI_TEST_ENV_INT"
			if c.imposta {
				t.Setenv(chiave, c.valore)
			}
			if got := EnvInt(chiave, c.ripiego); got != c.atteso {
				t.Fatalf("EnvInt() = %d, atteso %d", got, c.atteso)
			}
		})
	}
}
