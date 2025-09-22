-- container_name.lua
-- Enhanced container identification and metadata enrichment
-- Extracts container information from Docker log paths and content

-- This function gives us the possibility of reading the log messages and defining a log level 
local function detect_log_level(log_content)
    local content_lower = string.lower(log_content or "")
    if content_lower:find("error") or content_lower:find("failed") or content_lower:find("exception") then 
        return "error"
    elseif content_lower:find("warn") or content_lower:find("warning") then
        return "warning"
    elseif content_lower:find("debug") then
        return "debug"
    elseif content_lower:find("info") or content_lower:find("starting") or content_lower:find("ready") then
        return "info"
    else
        return "unknown"
    end
end

-- This function remove the intial slash to normalize the container name
local function strip_leading_slash(s)
  if s == nil then
    return ""
  else
    return string.gsub(s, "^/", "")
  end
end

-- 
function extract_container_info(tag, timestamp, record)
    local new_record = record
    local container_id = ""
    local service_name= "unknown"
    
    local original_cn = new_record["container_name"] or new_record["CONTAINER_NAME"] or ""      -- copy the container name 
    new_record["container_name_original"] = original_cn          -- save the origina container name in a new record
    local normalized_cn = strip_leading_slash(original_cn)      -- normalize the container_name with the previous function 

    local container_services = {
        ["nginx-proxy-manager"] = { name = "proxy",          category = "infrastructure" },
        ["es01"]                = { name = "es01",           category = "logging" },
        ["kibana"]              = { name = "kibana",         category = "logging" },
        ["fleet-server"]        = { name = "fleet-server",   category = "monitoring" },
        ["apm-agent"]           = { name = "apm-agent",      category = "monitoring" },
        ["infra-agent"]         = { name = "infra-agent",    category = "monitoring" },
        ["fluent-bit"]          = { name = "fluent-bit",     category = "logging" },
        ["db"]                  = { name = "mongodb",        category = "database" },
        ["redis"]               = { name = "redis",          category = "cache" },
        ["frontend"]            = { name = "frontend",       category = "application" },
        ["server"]              = { name = "server",         category = "application" },
        ["sandbox"]             = { name = "sandbox",        category = "development" },
        ["mongo-express"]       = { name = "mongo-ui",       category = "management" },
        ["redis-commander"]     = { name = "redis-ui",       category = "management" },
    }

    service_name = (normalized_cn ~= "" and normalized_cn) or "unknown"

    local log_content = new_record["log"] or ""

    if service_name == "unknown" or container_services[service_name] == nil then
        if log_content:find("elasticsearch") or log_content:find("ES_JAVA_OPTS") then
            service_name = "es01"
        elseif log_content:find("kibana") then
            service_name = "kibana"
        elseif log_content:find("fleet%-server") or log_content:find("Fleet Server") then
            service_name = "fleet-server"
        elseif log_content:find("apm%-server") or log_content:find("APM Server") then
            service_name = "apm-agent"
        elseif log_content:find("elastic%-agent") or log_content:find("enrolling") then
            service_name = "infra-agent"
        elseif log_content:find("fluent%-bit") then
            service_name = "fluent-bit"
        elseif log_content:find("nginx") or log_content:find("proxy%-manager") then
            service_name = "proxy"
        elseif log_content:find("mongod") or log_content:find("mongo%-express") then
            service_name = "mongodb"
        elseif log_content:find("redis%-server") or log_content:find("redis%-commander") then
            service_name = "redis"
        elseif log_content:find("vite") or log_content:find("Local:%s+http") then
            service_name = "frontend"
        elseif log_content:find("gin%.Mode") or log_content:find("Listening and serving") then
            service_name = "server"
        elseif log_content:find("sandbox") then
            service_name = "sandbox"
        end
    end

    local svc_info = container_services[service_name] or { name = service_name, category = "unknown" }
    new_record["service_name"]     = svc_info.name
    new_record["service_category"] = svc_info.category

    -- short ID dal path dei log docker
    if new_record["_FILENAME"] then
        container_id = string.match(new_record["_FILENAME"], "/var/lib/docker/containers/([^/]+)/") or ""
        if container_id ~= "" then container_id = string.sub(container_id, 1, 12) end
    end
    new_record["container_short_id"] = (container_id ~= "" and container_id) or "unknown"

    new_record["environment"]   = "development"
    new_record["log_processor"] = "fluent-bit"
    new_record["processed_at"]  = os.date("!%Y-%m-%dT%H:%M:%SZ")

    if log_content ~= "" then
        new_record["detected_level"] = detect_log_level(log_content)
    end

    return 1, timestamp, new_record
end