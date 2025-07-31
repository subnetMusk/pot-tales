-- container_name.lua
-- Enhanced container identification and metadata enrichment
-- Extracts container information from Docker log paths and content

function extract_container_info(tag, timestamp, record)
    local new_record = record
    local container_id = ""
    local service_name = "unknown"
    
    -- Enhanced container service mapping
    local container_services = {
        ["nginx-proxy-manager"] = {name = "proxy", category = "infrastructure"},
        ["elasticsearch"] = {name = "elasticsearch", category = "logging"}, 
        ["kibana"] = {name = "kibana", category = "logging"},
        ["apm-server"] = {name = "apm-server", category = "monitoring"},
        ["elastic-agent"] = {name = "elastic-agent", category = "monitoring"},
        ["fluent-bit"] = {name = "fluent-bit", category = "logging"},
        ["db"] = {name = "mongodb", category = "database"},
        ["redis"] = {name = "redis", category = "cache"},
        ["frontend"] = {name = "frontend", category = "application"},
        ["server"] = {name = "server", category = "application"},
        ["sandbox"] = {name = "sandbox", category = "development"},
        ["mongo-express"] = {name = "mongo-ui", category = "management"},
        ["redis-commander"] = {name = "redis-ui", category = "management"}
    }
    
    -- Extract container ID from file path
    if new_record["_FILENAME"] then
        container_id = string.match(new_record["_FILENAME"], "/var/lib/docker/containers/([^/]+)/")
        if container_id then
            container_id = string.sub(container_id, 1, 12)  -- Standard Docker short ID
            new_record["container_id"] = container_id
        end
    end
    
    -- Enhanced service detection from log content
    if new_record["log"] then
        local log_content = new_record["log"]
        
        -- Elasticsearch patterns
        if string.find(log_content, "elasticsearch") or 
           string.find(log_content, "ES_JAVA_OPTS") or
           string.find(log_content, "cluster%.name") or
           string.find(log_content, "node%.name") then
            service_name = "elasticsearch"
            
        -- Kibana patterns  
        elseif string.find(log_content, "kibana") or
               string.find(log_content, "Kibana") then
            service_name = "kibana"
            
        -- APM Server patterns
        elseif string.find(log_content, "apm%-server") or 
               string.find(log_content, "APM Server") or
               string.find(log_content, "apm%.enabled") then
            service_name = "apm-server"
            
        -- NGINX Proxy Manager patterns
        elseif string.find(log_content, "nginx") or 
               string.find(log_content, "proxy%-manager") or
               string.find(log_content, "certbot") then
            service_name = "proxy"
            
        -- MongoDB patterns
        elseif string.find(log_content, "mongod") or 
               string.find(log_content, "MongoDB") or
               string.find(log_content, "database") or
               string.find(log_content, "mongo%-express") then
            service_name = "mongodb"
            
        -- Redis patterns
        elseif string.find(log_content, "redis%-server") or
               string.find(log_content, "Redis") or
               string.find(log_content, "redis%-commander") then
            service_name = "redis"
            
        -- Frontend patterns (Vite, game frontend)
        elseif string.find(log_content, "vite") or
               string.find(log_content, "Local:%s+http") or
               string.find(log_content, "ready in") then
            service_name = "frontend"
            
        -- Backend Go server patterns
        elseif string.find(log_content, "gin%.Mode") or
               string.find(log_content, "Listening and serving") or
               string.find(log_content, "main%.go") then
            service_name = "server"
            
        -- Sandbox patterns
        elseif string.find(log_content, "sandbox") then
            service_name = "sandbox"
            
        -- Fluent Bit patterns
        elseif string.find(log_content, "fluent%-bit") or
               string.find(log_content, "Fluent Bit") then
            service_name = "fluent-bit"
            
        -- Elastic Agent patterns
        elseif string.find(log_content, "elastic%-agent") or
               string.find(log_content, "Elastic Agent") then
            service_name = "elastic-agent"
        end
    end
    
    -- Get service metadata
    local service_info = container_services[service_name] or {name = service_name, category = "unknown"}
    
    -- Set enriched metadata
    new_record["container_name"] = service_name
    new_record["service_name"] = service_info.name
    new_record["service_category"] = service_info.category
    new_record["container_short_id"] = container_id or "unknown"
    
    -- Add environment context
    new_record["environment"] = "development"  -- Could be made configurable
    new_record["log_processor"] = "fluent-bit"
    new_record["processed_at"] = os.date("!%Y-%m-%dT%H:%M:%SZ")
    
    -- Add log level detection
    if new_record["log"] then
        new_record["detected_level"] = detect_log_level(new_record["log"])
    end
    
    return 1, timestamp, new_record
end

function detect_log_level(log_content)
    local content_lower = string.lower(log_content)
    
    if string.find(content_lower, "error") or 
       string.find(content_lower, "failed") or
       string.find(content_lower, "exception") then
        return "error"
    elseif string.find(content_lower, "warn") or
           string.find(content_lower, "warning") then
        return "warning"
    elseif string.find(content_lower, "debug") then
        return "debug"
    elseif string.find(content_lower, "info") or
           string.find(content_lower, "starting") or
           string.find(content_lower, "ready") then
        return "info"
    else
        return "unknown"
    end
end
