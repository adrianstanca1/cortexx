#!/bin/bash
#
# CortexBuild Ultimate - Comprehensive Health Check
# Checks: API, Database, Redis, Ollama, Disk, Memory, CPU
#

set -e

# Configuration
API_URL="${APP_URL:-http://localhost:3001}"
API_HEALTH_URL="${API_HEALTH_URL:-${API_URL}/api/health}"
MAX_RETRIES="${MAX_RETRIES:-30}"
RETRY_INTERVAL="${RETRY_INTERVAL:-2}"
TIMEOUT="${TIMEOUT:-5}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Timestamps
START_TIME=$(date +%s)

#######################################
# Utility Functions
#######################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "       $1"
    fi
}

print_header() {
    echo ""
    echo "========================================"
    echo " $1"
    echo "========================================"
}

print_summary() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))

    echo ""
    echo "========================================"
    echo " Health Check Summary"
    echo "========================================"
    echo " Duration: ${duration}s"
    echo ""
    echo -e " ${GREEN}Passed:${NC}   $PASSED"
    echo -e " ${YELLOW}Warnings:${NC} $WARNINGS"
    echo -e " ${RED}Failed:${NC}   $FAILED"
    echo ""

    if [[ $FAILED -gt 0 ]]; then
        echo -e "${RED}OVERALL: UNHEALTHY${NC}"
        return 1
    elif [[ $WARNINGS -gt 0 ]]; then
        echo -e "${YELLOW}OVERALL: DEGRADED${NC}"
        return 2
    else
        echo -e "${GREEN}OVERALL: HEALTHY${NC}"
        return 0
    fi
}

#######################################
# HTTP Health Check
#######################################

check_http_endpoint() {
    local url=$1
    local name=$2
    local expected_code=${3:-200}

    log_info "Checking $name at $url"

    local http_code
    local response_time
    local response

    response_time=$(date +%s%N)

    response=$(curl -s -w "\n%{http_code}" \
        --max-time "$TIMEOUT" \
        -o /dev/null \
        "$url" 2>/dev/null) || true

    http_code=$(echo "$response" | tail -n1)
    response_time=$(($(date +%s%N) - response_time))
    response_time_ms=$((response_time / 1000000))

    log_verbose "HTTP Code: $http_code, Response Time: ${response_time_ms}ms"

    if [[ "$http_code" == "$expected_code" ]]; then
        log_success "$name is responding (HTTP $http_code in ${response_time_ms}ms)"
        return 0
    elif [[ "$http_code" =~ ^5 ]]; then
        log_error "$name returned server error (HTTP $http_code)"
        return 1
    elif [[ "$http_code" =~ ^4 ]]; then
        log_warning "$name returned client error (HTTP $http_code)"
        return 2
    else
        log_error "$name is not responding (HTTP $http_code or timeout)"
        return 1
    fi
}

#######################################
# API Health Endpoint Check
#######################################

check_api_health() {
    print_header "API Health Endpoint"

    log_info "Checking ${API_HEALTH_URL}"

    local response
    local http_code
    local start_time=$(date +%s%N)

    response=$(curl -s -w "\n%{http_code}" \
        --max-time "$TIMEOUT" \
        "$API_HEALTH_URL" 2>/dev/null) || true

    http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    local response_time=$(($(date +%s%N) - start_time))
    local response_time_ms=$((response_time / 1000000))

    if [[ "$http_code" != "200" ]]; then
        log_error "API health endpoint returned HTTP $http_code"
        return 1
    fi

    # Parse JSON response
    local status=$(echo "$body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

    log_verbose "Status: $status"

    if [[ "$status" == "healthy" ]]; then
        log_success "API is healthy (${response_time_ms}ms)"

        # Check individual components if verbose
        if [[ "$VERBOSE" == "true" ]]; then
            check_api_component "$body" "database"
            check_api_component "$body" "redis"
            check_api_component "$body" "ollama"
        fi

        return 0
    elif [[ "$status" == "degraded" ]]; then
        log_warning "API is degraded"
        check_api_component "$body" "database" || true
        check_api_component "$body" "redis" || true
        check_api_component "$body" "ollama" || true
        return 2
    else
        log_error "API is unhealthy (status: $status)"
        return 1
    fi
}

check_api_component() {
    local body=$1
    local component=$2

    local component_data=$(echo "$body" | grep -o "\"$component\":{[^}]*}" || echo "")

    if [[ -n "$component_data" ]]; then
        local component_status=$(echo "$component_data" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        local component_latency=$(echo "$component_data" | grep -o '"latency":[0-9]*' | cut -d':' -f2 || echo "N/A")

        log_verbose "  $component: $component_status (${component_latency}ms)"

        if [[ "$component_status" == "healthy" ]]; then
            return 0
        elif [[ "$component_status" == "degraded" ]]; then
            log_warning "  $component is degraded"
            return 2
        else
            log_error "  $component is unhealthy"
            return 1
        fi
    fi

    return 0
}

#######################################
# Database Check
#######################################

check_database() {
    print_header "Database Connectivity"

    # Check if we can connect to the database
    log_info "Checking PostgreSQL connection..."

    # Try using pg_isready if available, otherwise curl the API's DB check
    if command -v pg_isready &> /dev/null; then
        if pg_isready -h localhost -p 5432 -U postgres &> /dev/null; then
            log_success "PostgreSQL is accepting connections"
        else
            log_error "PostgreSQL is not accepting connections"
            return 1
        fi
    else
        # Fall back to API check
        local db_status=$(curl -s "${API_HEALTH_URL}" 2>/dev/null | grep -o '"database":{[^}]*}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

        if [[ "$db_status" == "healthy" ]]; then
            log_success "Database connection is healthy"
            return 0
        else
            log_warning "Database connection status: $db_status"
            return 2
        fi
    fi

    # Check replication lag if possible
    if command -v psql &> /dev/null; then
        log_verbose "Checking replication lag..."
        local lag=$(psql -h localhost -U postgres -d postgres -t -c "SELECT EXTRACT(SECONDS FROM NOW() - pg_last_xact_replay_timestamp());" 2>/dev/null | xargs || echo "N/A")

        if [[ "$lag" != "N/A" && "$lag" != "" ]]; then
            local lag_seconds=$(echo "$lag" | bc 2>/dev/null || echo "0")

            if (( $(echo "$lag_seconds < 5" | bc -l) )); then
                log_success "Replication lag is healthy (${lag_seconds}s)"
            elif (( $(echo "$lag_seconds < 30" | bc -l) )); then
                log_warning "Replication lag is elevated (${lag_seconds}s)"
            else
                log_error "Replication lag is critical (${lag_seconds}s)"
            fi
        fi
    fi

    return 0
}

#######################################
# Redis Check
#######################################

check_redis() {
    print_header "Redis Connectivity"

    log_info "Checking Redis connection..."

    # Check via API first
    local redis_status=$(curl -s "${API_HEALTH_URL}" 2>/dev/null | grep -o '"redis":{[^}]*}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

    if [[ "$redis_status" == "healthy" ]]; then
        log_success "Redis connection is healthy"

        # Get more details if verbose
        if [[ "$VERBOSE" == "true" ]]; then
            local redis_details=$(curl -s "${API_HEALTH_URL}" 2>/dev/null | grep -o '"redis":{[^}]*}')
            log_verbose "Details: $redis_details"
        fi

        return 0
    elif [[ "$redis_status" == "degraded" ]]; then
        log_warning "Redis connection is degraded"
        return 2
    else
        log_error "Redis connection is unhealthy"
        return 1
    fi
}

#######################################
# Ollama Check
#######################################

check_ollama() {
    print_header "Ollama AI Service"

    local ollama_url="${OLLAMA_URL:-http://localhost:11434}"

    log_info "Checking Ollama at $ollama_url"

    # Check if Ollama is responding
    local http_code
    local start_time=$(date +%s%N)

    http_code=$(curl -s -w "%{http_code}" \
        --max-time "$TIMEOUT" \
        -o /dev/null \
        "${ollama_url}/api/tags" 2>/dev/null) || http_code="000"

    local response_time=$(($(date +%s%N) - start_time))
    local response_time_ms=$((response_time / 1000000))

    if [[ "$http_code" == "200" ]]; then
        log_success "Ollama is responding (${response_time_ms}ms)"

        # Check available models
        if [[ "$VERBOSE" == "true" ]]; then
            local models=$(curl -s "${ollama_url}/api/tags" 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | tr '\n' ', ' || echo "none")
            log_verbose "Available models: $models"
        fi

        return 0
    elif [[ "$http_code" == "000" ]]; then
        log_error "Ollama is not responding (connection timeout)"
        return 1
    else
        log_warning "Ollama returned HTTP $http_code"
        return 2
    fi
}

#######################################
# System Resource Checks
#######################################

check_disk_space() {
    print_header "Disk Space"

    local threshold=${DISK_THRESHOLD:-90}

    log_info "Checking disk space (threshold: ${threshold}%)..."

    # Check root filesystem
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    local disk_available=$(df -h / | awk 'NR==2 {print $4}')

    log_verbose "Root filesystem usage: ${disk_usage}% (${disk_available} available)"

    if [[ $disk_usage -ge 95 ]]; then
        log_error "Disk space critical: ${disk_usage}% used"
        return 1
    elif [[ $disk_usage -ge $threshold ]]; then
        log_warning "Disk space low: ${disk_usage}% used (${disk_available} available)"
        return 2
    else
        log_success "Disk space is healthy: ${disk_usage}% used"
        return 0
    fi
}

check_memory() {
    print_header "Memory Usage"

    local threshold=${MEMORY_THRESHOLD:-85}

    log_info "Checking memory usage (threshold: ${threshold}%)..."

    # macOS compatibility
    if [[ "$(uname)" == "Darwin" ]]; then
        local mem_info=$(vm_stat | grep "Pages active" | awk '{print $3}' | sed 's/\.//')
        local page_size=$(sysctl -n hw.pagesize)
        local total_mem=$(sysctl -n hw.memsize)
        local active_mem=$((mem_info * page_size))
        local usage_percent=$((active_mem * 100 / total_mem))

        log_verbose "Memory usage: ${usage_percent}%"

        if [[ $usage_percent -ge $threshold ]]; then
            log_warning "Memory usage is high: ${usage_percent}%"
            return 2
        else
            log_success "Memory usage is healthy: ${usage_percent}%"
            return 0
        fi
    else
        # Linux
        local mem_info=$(free | grep Mem)
        local total=$(echo "$mem_info" | awk '{print $2}')
        local available=$(echo "$mem_info" | awk '{print $7}')
        local used=$((total - available))
        local usage_percent=$((used * 100 / total))

        log_verbose "Memory usage: ${usage_percent}% (${available}KB available)"

        if [[ $usage_percent -ge $threshold ]]; then
            log_warning "Memory usage is high: ${usage_percent}%"
            return 2
        else
            log_success "Memory usage is healthy: ${usage_percent}%"
            return 0
        fi
    fi

    return 0
}

check_cpu() {
    print_header "CPU Usage"

    local threshold=${CPU_THRESHOLD:-80}

    log_info "Checking CPU usage (threshold: ${threshold}%)..."

    # macOS compatibility
    if [[ "$(uname)" == "Darwin" ]]; then
        local cpu_usage=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')

        log_verbose "CPU usage: ${cpu_usage}%"

        if (( $(echo "$cpu_usage > $threshold" | bc -l) )); then
            log_warning "CPU usage is high: ${cpu_usage}%"
            return 2
        else
            log_success "CPU usage is healthy: ${cpu_usage}%"
            return 0
        fi
    else
        # Linux
        local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')

        log_verbose "CPU usage: ${cpu_usage}%"

        if (( $(echo "$cpu_usage > $threshold" | bc -l) )); then
            log_warning "CPU usage is high: ${cpu_usage}%"
            return 2
        else
            log_success "CPU usage is healthy: ${cpu_usage}%"
            return 0
        fi
    fi

    return 0
}

#######################################
# Network Checks
#######################################

check_network_connectivity() {
    print_header "Network Connectivity"

    local targets=(
        "8.8.8.8:53|DNS (Google)"
        "1.1.1.1:53|DNS (Cloudflare)"
    )

    for target in "${targets[@]}"; do
        IFS='|' read -r host_port name <<< "$target"
        IFS=':' read -r host port <<< "$host_port"

        log_info "Checking $name ($host_port)..."

        if nc -z -w "$TIMEOUT" "$host" "$port" 2>/dev/null; then
            log_success "$name is reachable"
        else
            log_warning "$name is not reachable"
        fi
    done
}

check_ssl_cert() {
    print_header "SSL Certificate"

    local domain=${SSL_DOMAIN:-cortexbuildpro.com}
    local port=${SSL_PORT:-443}

    log_info "Checking SSL certificate for $domain..."

    # Check expiry date
    local cert_expiry=$(echo | openssl s_client -servername "$domain" -connect "$domain:$port" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep notAfter | cut -d= -f2)

    if [[ -z "$cert_expiry" ]]; then
        log_warning "Could not retrieve SSL certificate"
        return 2
    fi

    # Calculate days until expiry
    local expiry_seconds=$(date -d "$cert_expiry" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$cert_expiry" +%s 2>/dev/null)
    local now_seconds=$(date +%s)
    local days_until_expiry=$(( (expiry_seconds - now_seconds) / 86400 ))

    log_verbose "Certificate expires: $cert_expiry (in $days_until_expiry days)"

    if [[ $days_until_expiry -lt 0 ]]; then
        log_error "SSL certificate has expired!"
        return 1
    elif [[ $days_until_expiry -lt 7 ]]; then
        log_error "SSL certificate expires in $days_until_expiry days!"
        return 1
    elif [[ $days_until_expiry -lt 30 ]]; then
        log_warning "SSL certificate expires in $days_until_expiry days"
        return 2
    else
        log_success "SSL certificate is valid ($days_until_expiry days remaining)"
        return 0
    fi
}

#######################################
# Service-Specific Checks
#######################################

check_docker_containers() {
    print_header "Docker Containers"

    if ! command -v docker &> /dev/null; then
        log_warning "Docker is not installed"
        return 0
    fi

    log_info "Checking Docker containers..."

    local containers=$(docker ps --format "{{.Names}}\t{{.Status}}" 2>/dev/null | wc -l)

    if [[ $containers -eq 0 ]]; then
        log_warning "No Docker containers are running"
        return 2
    fi

    log_success "$containers container(s) running"

    if [[ "$VERBOSE" == "true" ]]; then
        echo ""
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null
    fi

    # Check for unhealthy containers
    local unhealthy=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" 2>/dev/null | wc -l)

    if [[ $unhealthy -gt 0 ]]; then
        log_error "$unhealthy unhealthy container(s)"
        return 1
    fi

    return 0
}

check_process_count() {
    print_header "Process Count"

    local max_procs=${MAX_PROCESSES:-1000}

    log_info "Checking process count (threshold: $max_procs)..."

    local proc_count=$(ps aux | wc -l)

    log_verbose "Current process count: $proc_count"

    if [[ $proc_count -gt $max_procs ]]; then
        log_warning "Process count is high: $proc_count"
        return 2
    else
        log_success "Process count is healthy: $proc_count"
        return 0
    fi
}

#######################################
# Main Execution
#######################################

main() {
    echo ""
    echo "========================================"
    echo " CortexBuild Ultimate Health Check"
    echo " $(date)"
    echo "========================================"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE="true"
                shift
                ;;
            -vv)
                VERBOSE="true"
                set -x
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  -v, --verbose     Verbose output"
                echo "  -vv               Very verbose (debug)"
                echo "  -h, --help        Show this help"
                echo ""
                echo "Environment Variables:"
                echo "  APP_URL           Application URL (default: http://localhost:3001)"
                echo "  API_HEALTH_URL    Health endpoint URL"
                echo "  OLLAMA_URL        Ollama URL (default: http://localhost:11434)"
                echo "  MAX_RETRIES       Max retries for API check (default: 30)"
                echo "  RETRY_INTERVAL    Retry interval in seconds (default: 2)"
                echo "  TIMEOUT           Request timeout in seconds (default: 5)"
                echo "  DISK_THRESHOLD    Disk usage warning threshold % (default: 90)"
                echo "  MEMORY_THRESHOLD  Memory usage warning threshold % (default: 85)"
                echo "  CPU_THRESHOLD    CPU usage warning threshold % (default: 80)"
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done

    # Run health checks
    check_http_endpoint "$API_URL" "Application Root" || true

    check_api_health || true

    check_database || true

    check_redis || true

    check_ollama || true

    check_disk_space || true

    check_memory || true

    check_cpu || true

    check_docker_containers || true

    check_process_count || true

    # Optional network checks (uncomment if needed)
    # check_network_connectivity || true
    # check_ssl_cert || true

    # Print summary
    print_summary
}

# Run main function
main "$@"
