-- proxy_enrichment.lua
-- Enhanced proxy log enrichment for NGINX Proxy Manager
-- Extracts host info, classifies HTTP events, and adds domain intelligence

function extract_proxy_host(tag, timestamp, record)
    local new_record = record
    local file_path = record["file"] or ""
    
    -- Extract proxy host from filename pattern: proxy-host-N_type.log
    local proxy_host_id = string.match(file_path, "proxy%-host%-(%d+)_")
    local log_type = string.match(file_path, "proxy%-host%-%d+_(%w+)%.log")
    
    -- Extract default host or fallback patterns
    if not proxy_host_id then
        if string.match(file_path, "default%-host") then
            proxy_host_id = "default"
            log_type = string.match(file_path, "default%-host_(%w+)%.log")
        elseif string.match(file_path, "fallback") then
            proxy_host_id = "fallback"
            log_type = string.match(file_path, "fallback_(%w+)%.log")
        end
    end
    
    -- Add structured metadata
    if proxy_host_id then
        new_record["proxy_host_id"] = proxy_host_id
        new_record["proxy_host_type"] = determine_host_type(proxy_host_id)
        
        -- Add domain mapping based on proxy host ID
        new_record["domain_category"] = map_proxy_to_domain(proxy_host_id)
    end
    
    if log_type then
        new_record["nginx_log_type"] = log_type
        new_record["log_category"] = log_type  -- access, error
        new_record["log_severity"] = determine_severity(log_type)
    end
    
    -- Add enrichment metadata
    new_record["enriched_by"] = "fluent-bit-proxy-enrichment"
    new_record["enriched_at"] = os.date("!%Y-%m-%dT%H:%M:%SZ")
    
    return 1, timestamp, new_record
end

function classify_http_status(tag, timestamp, record)
    local new_record = record
    local status = record["status"]
    
    if status then
        local status_code = tonumber(status)
        if status_code then
            -- HTTP status classification
            if status_code >= 200 and status_code < 300 then
                new_record["status_class"] = "success"
                new_record["alert_level"] = "info"
            elseif status_code >= 300 and status_code < 400 then
                new_record["status_class"] = "redirect"
                new_record["alert_level"] = "info"
            elseif status_code >= 400 and status_code < 500 then
                new_record["status_class"] = "client_error"
                new_record["alert_level"] = "warning"
                if status_code == 404 then
                    new_record["error_type"] = "not_found"
                elseif status_code == 403 then
                    new_record["error_type"] = "forbidden"
                elseif status_code == 401 then
                    new_record["error_type"] = "unauthorized"
                end
            elseif status_code >= 500 then
                new_record["status_class"] = "server_error"
                new_record["alert_level"] = "error"
                if status_code == 502 then
                    new_record["error_type"] = "bad_gateway"
                elseif status_code == 503 then
                    new_record["error_type"] = "service_unavailable"
                elseif status_code == 504 then
                    new_record["error_type"] = "gateway_timeout"
                end
            end
        end
    end
    
    return 1, timestamp, new_record
end

function extract_domain_info(tag, timestamp, record)
    local new_record = record
    local path = record["path"] or ""
    local user_agent = record["http_user_agent"] or ""
    
    -- Extract API endpoints
    if string.match(path, "^/api/") then
        new_record["request_type"] = "api"
        new_record["api_endpoint"] = string.match(path, "^/api/([^/?]+)")
    elseif string.match(path, "^/health") then
        new_record["request_type"] = "health_check"
    elseif string.match(path, "^/auth/") then
        new_record["request_type"] = "authentication"
    elseif string.match(path, "%.js$") or string.match(path, "%.css$") or string.match(path, "%.png$") or string.match(path, "%.jpg$") then
        new_record["request_type"] = "static_asset"
    else
        new_record["request_type"] = "page_request"
    end
    
    -- Bot detection
    if string.match(user_agent, "[bB]ot") or string.match(user_agent, "[sS]pider") or string.match(user_agent, "[cC]rawler") then
        new_record["client_type"] = "bot"
    else
        new_record["client_type"] = "user"
    end
    
    return 1, timestamp, new_record
end

function determine_host_type(proxy_host_id)
    if proxy_host_id == "default" then
        return "default_backend"
    elseif proxy_host_id == "fallback" then
        return "fallback_handler"
    elseif tonumber(proxy_host_id) then
        -- Numeric proxy host IDs
        local id = tonumber(proxy_host_id)
        if id >= 1 and id <= 3 then
            return "core_service"  -- Main services (kibana, redis-ui, etc)
        elseif id >= 4 and id <= 6 then
            return "game_service"  -- Game-related services
        elseif id >= 7 and id <= 10 then
            return "admin_service" -- Admin/management services
        else
            return "custom_service"
        end
    else
        return "unknown"
    end
end

function determine_severity(log_type)
    if log_type == "error" then
        return "high"
    elseif log_type == "access" then
        return "info"
    else
        return "medium"
    end
end

function map_proxy_to_domain(proxy_host_id)
    -- Map proxy host IDs to domain categories based on common setup
    local domain_map = {
        ["1"] = "kibana",           -- kibana.localhost
        ["2"] = "redis_ui",         -- redis-ui.localhost  
        ["4"] = "mongo_ui",         -- mongo-ui.localhost
        ["5"] = "apm",              -- apm.localhost
        ["6"] = "game_frontend",    -- localhost (main game)
        ["7"] = "admin_proxy",      -- admin/management
        ["8"] = "api_gateway",      -- API services
        ["default"] = "default_route",
        ["fallback"] = "fallback_handler"
    }
    
    return domain_map[tostring(proxy_host_id)] or "unknown_domain"
end
