#!/bin/bash
# =============================================================================
# CortexBuild Ultimate - COMPREHENSIVE Health Check Script
# =============================================================================
# Features:
#   - Multi-environment checks (Production, Local, VPS)
#   - Detailed service verification
#   - SSL certificate monitoring
#   - Database connectivity tests
#   - Docker container health
#   - Performance metrics
#   - JSON output for monitoring systems
#
# Usage: bash health-check.sh [--json] [--verbose]
# =============================================================================

set -euo pipefail

# Configuration
readonly VPS_HOST="root@72.62.132.43"
readonly PRODUCTION_URL="https://www.cortexbuildpro.com"
readonly LOCAL_API="http://localhost:3001"
readonly LOCAL_FRONTEND="http://localhost:5173"
readonly LOCAL_PROMETHEUS="http://localhost:9090"
readonly LOCAL_GRAFANA="http://localhost:3002"
readonly LOCAL_OLLAMA="http://localhost:11434"

# Output mode
JSON_OUTPUT=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --json) JSON_OUTPUT=true; shift ;;
        --verbose) VERBOSE=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Results storage
declare -A CHECKS
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging (only for non-JSON)
log() {
    local level="$1"
    local message="$2"
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${level} ${message}"
    fi
}
log_info()   { log "${BLUE}[INFO]${NC}" "$1"; }
log_ok()     { log "${GREEN}[OK]${NC}" "$1"; ((PASSED_CHECKS++)); }
log_fail()   { log "${RED}[FAIL]${NC}" "$1"; ((FAILED_CHECKS++)); }
log_warn()   { log "${YELLOW}[WARN]${NC}" "$1"; }
log_section(){ log "" ""; log "${BLUE}=== $1 ===${NC}" ""; }

record_check() {
    local name="$1"
    local status="$2"
    local details="${3:-}"
    CHECKS["$name"]="$status|$details"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    case "$status" in
        pass|warn) PASSED_CHECKS=$((PASSED_CHECKS + 1)) ;;
        fail) FAILED_CHECKS=$((FAILED_CHECKS + 1)) ;;
    esac
}

# HTTP check with details
check_http() {
    local name="$1"
    local url="$2"
    local expected_code="${3:-200}"
    local timeout="${4:-10}"
    
    local start_time
    start_time=$(date +%s%3N)
    
    local response
    response=$(curl -sf -o /dev/null -w "%{http_code}|%{time_total}" --connect-timeout 5 --max-time "$timeout" "$url" 2>/dev/null || echo "000|0")
    
    local http_code="${response%%|*}"
    local time_total="${response##*|}"
    
    if [ "$http_code" = "$expected_code" ]; then
        record_check "$name" "pass" "${http_code} (${time_total}s)"
        return 0
    else
        record_check "$name" "fail" "Expected $expected_code, got $http_code"
        return 1
    fi
}

# Health contract verification
check_health_contract() {
    local name="$1"
    local url="$2"
    
    local payload
    payload=$(curl -sf --connect-timeout 5 --max-time 10 "$url" 2>/dev/null || true)
    
    if [ -z "$payload" ]; then
        record_check "$name" "fail" "No response"
        return 1
    fi
    
    # Verify JSON structure and checks
    if python3 -c "
import json,sys
d=json.loads(sys.argv[1])
c=d.get('checks',{})
assert d.get('status')=='ok', f'Status: {d.get(\"status\")}'
assert c.get('postgres') is True, 'Postgres failed'
assert c.get('redis') is True, 'Redis failed'
print('OK')
" "$payload" 2>/dev/null; then
        record_check "$name" "pass" "Contract verified"
        return 0
    else
        record_check "$name" "fail" "Contract invalid"
        return 1
    fi
}

# Docker container check
check_container() {
    local name="$1"
    local expected_status="${2:-running}"
    
    local status
    status=$(docker ps --filter "name=$name" --format '{{.Status}}' 2>/dev/null || echo "not found")
    
    if echo "$status" | grep -qi "$expected_status"; then
        record_check "container:$name" "pass" "$status"
        return 0
    else
        record_check "container:$name" "fail" "$status"
        return 1
    fi
}

# Database connectivity
check_database() {
    local db_name="${1:-cortexbuild}"
    local db_user="${2:-cortexbuild}"
    
    if docker exec cortexbuild-db pg_isready -U "$db_user" -d "$db_name" >/dev/null 2>&1; then
        # Test query
        if docker exec cortexbuild-db psql -U "$db_user" -d "$db_name" -c "SELECT 1;" >/dev/null 2>&1; then
            record_check "database:$db_name" "pass" "Connected"
            return 0
        fi
    fi
    record_check "database:$db_name" "fail" "Connection failed"
    return 1
}

# Redis check
check_redis() {
    if docker exec cortexbuild-redis redis-cli ping 2>/dev/null | grep -qi PONG; then
        record_check "redis" "pass" "PONG"
        return 0
    fi
    record_check "redis" "fail" "No response"
    return 1
}

# SSL certificate check
check_ssl() {
    local domain="$1"
    local port="${2:-443}"
    
    local cert_info
    cert_info=$(echo | openssl s_client -connect "$domain:$port" -servername "$domain" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
    
    if [ -z "$cert_info" ]; then
        record_check "ssl:$domain" "fail" "No certificate"
        return 1
    fi
    
    local expiry
    expiry=$(echo "$cert_info" | grep "notAfter" | cut -d= -f2)
    record_check "ssl:$domain" "pass" "Expires: $expiry"
    return 0
}

# TLS handshake check
check_tls() {
    local domain="$1"
    
    if echo | openssl s_client -connect "$domain:443" -servername "$domain" -brief 2>/dev/null >/dev/null; then
        record_check "tls:$domain" "pass" "Handshake OK"
        return 0
    fi
    record_check "tls:$domain" "fail" "Handshake failed"
    return 1
}

# VPS connectivity
check_vps() {
    local ping_result
    ping_result=$(ping -c 1 -W 3 72.62.132.43 2>/dev/null && echo "ok" || echo "fail")
    
    if [ "$ping_result" = "ok" ]; then
        record_check "vps:ping" "pass" "Reply received"
        
        # SSH check
        if ssh -o ConnectTimeout=10 -o BatchMode=yes "$VPS_HOST" "echo ok" >/dev/null 2>&1; then
            record_check "vps:ssh" "pass" "Connected"
            return 0
        else
            record_check "vps:ssh" "fail" "Connection failed"
            return 1
        fi
    else
        record_check "vps:ping" "fail" "No reply"
        return 1
    fi
}

# Docker daemon check
check_docker() {
    if docker ps >/dev/null 2>&1; then
        local container_count
        container_count=$(docker ps --format '{{.Names}}' 2>/dev/null | wc -l)
        record_check "docker" "pass" "$container_count containers running"
        return 0
    fi
    record_check "docker" "fail" "Daemon not accessible"
    return 1
}

# Security headers check
check_security_headers() {
    local url="$1"
    local missing=()
    
    local headers
    headers=$(curl -sfI "$url" 2>/dev/null || true)
    
    # Check HSTS
    if ! echo "$headers" | grep -qi "strict-transport-security"; then
        missing+=("HSTS")
    fi
    # Check CSP
    if ! echo "$headers" | grep -qi "content-security-policy"; then
        missing+=("CSP")
    fi
    # Check X-Frame-Options
    if ! echo "$headers" | grep -qi "x-frame-options"; then
        missing+=("X-Frame-Options")
    fi
    
    if [ ${#missing[@]} -eq 0 ]; then
        record_check "security-headers" "pass" "All present"
        return 0
    else
        record_check "security-headers" "warn" "Missing: ${missing[*]}"
        return 0  # Warning, not failure
    fi
}

# Performance check
check_performance() {
    local url="$1"
    local max_time="${2:-3.0}"
    
    local time_total
    time_total=$(curl -sf -o /dev/null -w "%{time_total}" --max-time 30 "$url" 2>/dev/null || echo "99")
    
    local time_ms
    time_ms=$(echo "$time_total * 1000" | bc 2>/dev/null || echo "99999")
    
    if (( $(echo "$time_total < $max_time" | bc -l) )); then
        record_check "performance:$url" "pass" "${time_total}s"
        return 0
    else
        record_check "performance:$url" "fail" "Slow: ${time_total}s (max: ${max_time}s)"
        return 1
    fi
}

# Run all checks
run_checks() {
    log_section "PRODUCTION ENVIRONMENT"
    
    check_http "prod:frontend" "$PRODUCTION_URL" "200" "15"
    check_http "prod:api" "$PRODUCTION_URL/api/health" "200" "10"
    check_health_contract "prod:api-contract" "$PRODUCTION_URL/api/health"
    check_ssl "cortexbuildpro.com"
    check_ssl "www.cortexbuildpro.com"
    check_tls "cortexbuildpro.com"
    check_tls "www.cortexbuildpro.com"
    check_security_headers "$PRODUCTION_URL"
    check_performance "$PRODUCTION_URL" "3.0"
    
    log_section "LOCAL DEVELOPMENT"
    
    check_http "local:frontend" "$LOCAL_FRONTEND" "200" "10" || true
    check_http "local:api" "$LOCAL_API/api/health" "200" "10" || true
    check_health_contract "local:api-contract" "$LOCAL_API/api/health" || true
    
    log_section "MONITORING STACK"
    
    check_http "local:prometheus" "$LOCAL_PROMETHEUS" "200" "5" || true
    check_http "local:grafana" "$LOCAL_GRAFANA" "200" "5" || true
    check_http "local:ollama" "$LOCAL_OLLAMA/api/tags" "200" "5" || true
    
    log_section "DOCKER CONTAINERS"
    
    check_docker
    check_container "cortexbuild-db" "Up"
    check_container "cortexbuild-redis" "Up"
    check_container "cortexbuild-ollama" "Up"
    check_container "cortexbuild-api" "Up" || true
    
    log_section "DATABASES"
    
    check_database || true
    check_redis || true
    
    log_section "VPS CONNECTIVITY"
    
    check_vps || true
}

# Output results
output_results() {
    if [ "$JSON_OUTPUT" = true ]; then
        # JSON output for monitoring systems
        cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "summary": {
    "total": $TOTAL_CHECKS,
    "passed": $PASSED_CHECKS,
    "failed": $FAILED_CHECKS,
    "status": "$([ $FAILED_CHECKS -eq 0 ] && echo "healthy" || echo "unhealthy")"
  },
  "checks": {
EOF
        local first=true
        for name in "${!CHECKS[@]}"; do
            local value="${CHECKS[$name]}"
            local status="${value%%|*}"
            local details="${value##*|}"
            if [ "$first" = true ]; then
                first=false
            else
                echo ","
            fi
            printf '    "%s": {"status": "%s", "details": "%s"}' "$name" "$status" "$details"
        done
        echo ""
        echo "  }"
        echo "}"
    else
        # Human-readable output
        echo ""
        echo "╔═══════════════════════════════════════════════════════════════╗"
        echo "║              CortexBuild Health Check Results                   ║"
        echo "╚═══════════════════════════════════════════════════════════════╝"
        echo ""
        
        for name in "${!CHECKS[@]}"; do
            local value="${CHECKS[$name]}"
            local status="${value%%|*}"
            local details="${value##*|}"
            
            case "$status" in
                pass) echo -e "  ${GREEN}✓${NC} $name: $details" ;;
                fail) echo -e "  ${RED}✗${NC} $name: $details" ;;
                warn) echo -e "  ${YELLOW}⚠${NC} $name: $details" ;;
            esac
        done
        
        echo ""
        echo "───────────────────────────────────────────────────────────────"
        echo "  Total: $TOTAL_CHECKS  |  Passed: $PASSED_CHECKS  |  Failed: $FAILED_CHECKS"
        echo "───────────────────────────────────────────────────────────────"
        echo ""
        
        if [ $FAILED_CHECKS -eq 0 ]; then
            echo -e "${GREEN}✓ ALL SYSTEMS HEALTHY${NC}"
            exit 0
        else
            echo -e "${RED}✗ ISSUES DETECTED${NC}"
            exit 1
        fi
    fi
}

# Main
main() {
    run_checks
    output_results
}

main
