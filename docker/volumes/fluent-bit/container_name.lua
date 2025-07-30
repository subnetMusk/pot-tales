function extract_container_info(tag, timestamp, record)
    -- Map common container IDs to service names
    local container_services = {
        ["nginx-proxy-manager"] = "proxy",
        ["elasticsearch"] = "elasticsearch", 
        ["kibana"] = "kibana",
        ["apm-server"] = "apm-server",
        ["elastic-agent"] = "elastic-agent",
        ["fluent-bit"] = "fluent-bit",
        ["db"] = "mongodb",
        ["redis"] = "redis",
        ["frontend"] = "frontend",
        ["server"] = "server",
        ["sandbox"] = "sandbox",
        ["mongo-express"] = "mongo-ui",
        ["redis-commander"] = "redis-ui"
    }
    
    -- Extract container ID from log file path
    local container_id = ""
    if record["_FILENAME"] then
        container_id = string.match(record["_FILENAME"], "/var/lib/docker/containers/([^/]+)/")
        if container_id then
            -- Truncate to 12 chars like Docker does
            container_id = string.sub(container_id, 1, 12)
            record["container_id"] = container_id
        end
    end
    
    -- Get container name from tag (docker.var.lib.docker.containers.CONTAINERID.CONTAINERID-json.log)
    local service_name = "unknown"
    if tag then
        -- Try to extract from tag pattern
        local tag_parts = {}
        for part in string.gmatch(tag, "[^.]+") do
            table.insert(tag_parts, part)
        end
        
        -- Look for container ID in tag
        if #tag_parts >= 6 then
            local potential_id = tag_parts[6]
            if potential_id and #potential_id >= 12 then
                container_id = string.sub(potential_id, 1, 12)
                record["container_id"] = container_id
            end
        end
    end
    
    -- Try to guess service from log content
    if record["log"] then
        local log_content = record["log"]
        
        -- Check for specific service patterns in logs
        if string.find(log_content, "elasticsearch") or string.find(log_content, "ES_JAVA_OPTS") then
            service_name = "elasticsearch"
        elseif string.find(log_content, "kibana") then
            service_name = "kibana"
        elseif string.find(log_content, "apm%-server") or string.find(log_content, "APM Server") then
            service_name = "apm-server"
        elseif string.find(log_content, "nginx") or string.find(log_content, "proxy") then
            service_name = "proxy"
        elseif string.find(log_content, "mongo") or string.find(log_content, "database") then
            service_name = "mongodb"
        elseif string.find(log_content, "redis") then
            service_name = "redis"
        elseif string.find(log_content, "frontend") or string.find(log_content, "vite") then
            service_name = "frontend"
        elseif string.find(log_content, "server") or string.find(log_content, "gin") or string.find(log_content, "go") then
            service_name = "server"
        elseif string.find(log_content, "sandbox") then
            service_name = "sandbox"
        elseif string.find(log_content, "fluent%-bit") then
            service_name = "fluent-bit"
        elseif string.find(log_content, "elastic%-agent") then
            service_name = "elastic-agent"
        end
    end
    
    -- Set the extracted information
    record["container_name"] = service_name
    record["service_name"] = service_name
    record["container_short_id"] = container_id or "unknown"
    
    return 1, timestamp, record
end
