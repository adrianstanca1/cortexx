#!/bin/bash
# Master Orchestration Script - Enhanced with parallel execution and delegation support
# Usage: ./orchestrate-team.sh "task description" [workflow-type]

TASK_DESCRIPTION="$1"
WORKFLOW_TYPE="${2:-standard}"

echo "=== Hermes Agent Team Orchestration ==="
echo "Task: $TASK_DESCRIPTION"
echo "Workflow: $WORKFLOW_TYPE"
echo ""

# Pre-flight: verify optimized models are available
verify_models() {
    local models=("gemma4:12b-optimized-fixed" "gemma4:26b-optimized-fixed" "llama3.2:3b-optimized-fixed" "mistral:7b-optimized-fixed" "phi3:mini-optimized-fixed" "llava:latest")
    for model in "${models[@]}"; do
        if ! ollama list | grep -q "$model"; then
            echo "WARNING: Model $model not found. Some agents may fail."
        fi
    done
}

verify_models

case $WORKFLOW_TYPE in
  "research")
    echo "Phase 1: Research"
    /root/.hermes/scripts/launch-research-agent.sh -q "Research: $TASK_DESCRIPTION"
    ;;
  "analysis")
    echo "Phase 1: Research"
    /root/.hermes/scripts/launch-research-agent.sh -q "Research: $TASK_DESCRIPTION"
    echo "Phase 2: Analysis"
    /root/.hermes/scripts/launch-analysis-agent.sh -q "Analyze research results for: $TASK_DESCRIPTION"
    ;;
  "planning")
    echo "Phase 1: Research"
    /root/.hermes/scripts/launch-research-agent.sh -q "Research: $TASK_DESCRIPTION"
    echo "Phase 2: Analysis"
    /root/.hermes/scripts/launch-analysis-agent.sh -q "Analyze research results for: $TASK_DESCRIPTION"
    echo "Phase 3: Planning"
    /root/.hermes/scripts/launch-planning-agent.sh -q "Create plan for: $TASK_DESCRIPTION based on research and analysis"
    ;;
  "full")
    echo "Phase 1: Research"
    /root/.hermes/scripts/launch-research-agent.sh -q "Research: $TASK_DESCRIPTION"
    echo "Phase 2: Analysis"
    /root/.hermes/scripts/launch-analysis-agent.sh -q "Analyze research results for: $TASK_DESCRIPTION"
    echo "Phase 3: Planning"
    /root/.hermes/scripts/launch-planning-agent.sh -q "Create plan for: $TASK_DESCRIPTION based on research and analysis"
    echo "Phase 4: Execution"
    /root/.hermes/scripts/launch-execution-agent.sh -q "Execute plan for: $TASK_DESCRIPTION"
    echo "Phase 5: Review"
    /root/.hermes/scripts/launch-review-agent.sh -q "Review execution results for: $TASK_DESCRIPTION"
    ;;
  "parallel")
    echo "Running Research, Analysis, and Planning in parallel via tmux..."
    tmux new-session -d -s research_agent -x 120 -y 40 "hermes chat --model llama3.2:3b-optimized-fixed --provider ollama-launch --toolsets web,browser,file,memory,session_search,skills --skills web-scraper,blogwatcher,competitor-news-monitor --max-turns 100 -q 'Research: $TASK_DESCRIPTION'"
    tmux new-session -d -s analysis_agent -x 120 -y 40 "hermes chat --model mistral:7b-optimized-fixed --provider ollama-launch --toolsets execute_code,file,terminal,memory,skills --skills data-analysis,usage-analytics,evaluating-llms-harness --max-turns 150 -q 'Analyze: $TASK_DESCRIPTION'"
    tmux new-session -d -s planning_agent -x 120 -y 40 "hermes chat --model gemma4:12b-optimized-fixed --provider ollama-launch --toolsets plan,workflow-orchestrator,cronjob,delegation,todo,file,memory,skills --skills plan,workflow-orchestrator,enhancement-guide --max-turns 200 -q 'Plan: $TASK_DESCRIPTION'"
    echo "Agents started in background tmux sessions. Use 'tmux attach -t research_agent' etc to monitor."
    echo "Waiting for completion..."
    wait
    echo "Phase 4: Execution"
    /root/.hermes/scripts/launch-execution-agent.sh -q "Execute: $TASK_DESCRIPTION"
    echo "Phase 5: Review"
    /root/.hermes/scripts/launch-review-agent.sh -q "Review: $TASK_DESCRIPTION"
    ;;
  "delegated")
    echo "Using Hermes delegation system for parallel agent execution..."
    # This uses the resilient-team.py for automatic failover
    python3 /root/.hermes/scripts/resilient-team.py full "$TASK_DESCRIPTION"
    ;;
  "resilient")
    echo "Running resilient workflow with automatic failover..."
    python3 /root/.hermes/scripts/resilient-team.py standard "$TASK_DESCRIPTION"
    ;;
  "code")
    echo "Code Development Workflow"
    python3 /root/.hermes/scripts/resilient-team.py code_development "$TASK_DESCRIPTION"
    ;;
  "deep")
    echo "Deep Analysis Workflow"
    python3 /root/.hermes/scripts/resilient-team.py deep_analysis "$TASK_DESCRIPTION"
    ;;
  *)
    echo "Standard workflow: Research -> Analysis -> Planning"
    /root/.hermes/scripts/launch-research-agent.sh -q "Research: $TASK_DESCRIPTION"
    /root/.hermes/scripts/launch-analysis-agent.sh -q "Analyze: $TASK_DESCRIPTION"
    /root/.hermes/scripts/launch-planning-agent.sh -q "Plan: $TASK_DESCRIPTION"
    ;;
esac

echo ""
echo "=== Orchestration Complete ==="
echo "Available workflows: research, analysis, planning, full, parallel, delegated, resilient, code, deep"
