// ===================================================
// server/go.mod
// ===================================================
// Module declaration and runtime dependencies.
// ---------------------------------------------------
module github.com/subnetMusk/progetti_innovativi/server

go 1.22

require (
	// UUID generator for session tokens
	github.com/google/uuid v1.5.0
	// HTTP router
	github.com/gorilla/mux v1.8.0

	// Redis client (context-aware, v9 API)
	github.com/redis/go-redis/v9 v9.11.0

	// JSON-Schema validator (Draft-07+)
	github.com/santhosh-tekuri/jsonschema/v5 v5.3.1
	go.elastic.co/apm/module/apmgorilla/v2 v2.4.8

	// Elastic APM Agent for Go
	go.elastic.co/apm/module/apmhttp/v2 v2.4.8 // indirect
	go.elastic.co/apm/module/apmmongo/v2 v2.4.8
	go.elastic.co/apm/v2 v2.4.8 // indirect

	// MongoDB driver
	go.mongodb.org/mongo-driver v1.13.1

)

require (
	github.com/armon/go-radix v1.0.0 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/elastic/go-sysinfo v1.7.1 // indirect
	github.com/elastic/go-windows v1.0.0 // indirect
	github.com/golang/snappy v0.0.1 // indirect
	github.com/joeshaw/multierror v0.0.0-20140124173710-69b34d4ec901 // indirect
	github.com/klauspost/compress v1.13.6 // indirect
	github.com/montanaflynn/stats v0.0.0-20171201202039-1bf9dbcd8cbe // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/prometheus/procfs v0.0.0-20190425082905-87a4384529e0 // indirect
	github.com/xdg-go/pbkdf2 v1.0.0 // indirect
	github.com/xdg-go/scram v1.1.2 // indirect
	github.com/xdg-go/stringprep v1.0.4 // indirect
	github.com/youmark/pkcs8 v0.0.0-20181117223130-1be2e3e5546d // indirect
	go.elastic.co/fastjson v1.1.0 // indirect
	golang.org/x/crypto v0.17.0 // indirect
	golang.org/x/sync v0.2.0 // indirect
	golang.org/x/sys v0.15.0 // indirect
	golang.org/x/text v0.14.0 // indirect
	howett.net/plist v0.0.0-20181124034731-591f970eefbb // indirect
)
