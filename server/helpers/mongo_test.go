package helpers

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"

	"github.com/subnetMusk/progetti_innovativi/server/models"
)

// L'indice TTL deve agire sul campo di ritenzione e non sulla scadenza della
// sessione, che ha un ordine di grandezza diverso.
func TestTTLNonUsaLaScadenzaSessione(t *testing.T) {
	if ttlField != "created_at" {
		t.Fatalf("campo TTL inatteso: %q", ttlField)
	}

	for _, s := range indexSpecs(45 * 24 * time.Hour) {
		keys, ok := s.model.Keys.(bson.D)
		if !ok || len(keys) == 0 {
			t.Fatalf("chiavi non riconosciute per %s", s.collection)
		}

		haTTL := s.model.Options != nil && s.model.Options.ExpireAfterSeconds != nil
		if haTTL && keys[0].Key == "expires_at" {
			t.Fatalf("indice TTL su expires_at nella collection %s", s.collection)
		}
	}
}

func TestTTLCopreEntrambeLeCollection(t *testing.T) {
	conTTL := map[string]bool{}
	for _, s := range indexSpecs(45 * 24 * time.Hour) {
		if s.model.Options != nil && s.model.Options.ExpireAfterSeconds != nil {
			conTTL[s.collection] = true
		}
	}

	for _, c := range []string{SessionsCollection, GameStatesCollection} {
		if !conTTL[c] {
			t.Errorf("la collection %s non ha un indice TTL", c)
		}
	}
}

// L'indirizzo dichiarato dal client non è verificabile e non va persistito.
func TestSessionDocNonPersisteIPDichiarato(t *testing.T) {
	raw, err := bson.Marshal(models.SessionDoc{})
	if err != nil {
		t.Fatalf("marshal fallito: %v", err)
	}

	var doc bson.M
	if err := bson.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("unmarshal fallito: %v", err)
	}

	if _, ok := doc["reported_ip"]; ok {
		t.Error("SessionDoc contiene un campo reported_ip")
	}
	if _, ok := doc["client_ip"]; !ok {
		t.Error("client_ip mancante")
	}
	if _, ok := doc["created_at"]; !ok {
		t.Error("created_at mancante: l'indice TTL non avrebbe un campo su cui agire")
	}
}

// Le collection di sessioni e stato di gioco vanno ottenute tramite
// JournaledCollection. Il driver non espone il write concern di una collection
// già costruita, quindi il controllo è sul sorgente.
func TestScrittureSempreTramiteJournaledCollection(t *testing.T) {
	vietato := regexp.MustCompile(`\.Collection\(\s*(?:"sessions"|"game_states"|(?:helpers\.)?SessionsCollection|(?:helpers\.)?GameStatesCollection)`)

	var violazioni []string

	err := filepath.Walk("..", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			if info.Name() == "node_modules" || info.Name() == "tmp" {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		if filepath.Base(path) == "mongo.go" {
			return nil
		}

		contenuto, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if vietato.Match(contenuto) {
			violazioni = append(violazioni, path)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("scansione dei sorgenti fallita: %v", err)
	}

	if len(violazioni) > 0 {
		t.Fatalf("collection ottenute senza write concern journaled in: %s\n"+
			"usare helpers.JournaledCollection(db, nome)", strings.Join(violazioni, ", "))
	}
}
