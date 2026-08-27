#!/usr/bin/env python3
"""
Hermes Agent Team with Automatic Failover
Integrates model health checking with agent team orchestration
"""

import asyncio
import json
import sys
import subprocess
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum
from pathlib import Path

# Import model manager
sys.path.insert(0, '/root/.hermes/scripts')
try:
    from model_manager import ModelManager, ModelConfig, ModelStatus
except ImportError:
    # If import fails, define minimal classes here
    from enum import Enum
    from dataclasses import dataclass
    
    class ModelStatus(Enum):
        HEALTHY = "healthy"
        DEGRADED = "degraded"
        UNHEALTHY = "unhealthy"
        UNKNOWN = "unknown"
    
    @dataclass
    class ModelConfig:
        provider: str
        model: str
        base_url: str = ""
        max_retries: int = 2
        timeout: int = 60
    
    class ModelManager:
        def __init__(self):
            self.config = {}
            self.model_health = {}
        
        def get_agent_model(self, agent_role: str):
            return None
        
        def record_request(self, provider, model, success, latency_ms, error=""):
            pass
        
        async def health_check_all(self):
            pass
        
        def get_model_base_url(self, provider, model):
            return ""


class AgentRole(Enum):
    ORCHESTRATOR = "orchestrator"
    RESEARCH = "research"
    ANALYSIS = "analysis"
    PLANNING = "planning"
    EXECUTION = "execution"
    REVIEW = "review"
    VISUAL = "visual"


@dataclass
class AgentConfig:
    role: AgentRole
    model_config: ModelConfig
    toolsets: List[str]
    skills: List[str]
    max_turns: int
    script_path: str


@dataclass
class Task:
    id: str
    description: str
    assigned_agent: AgentRole
    dependencies: List[str] = field(default_factory=list)
    status: str = "pending"
    result: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    model_used: Optional[str] = None


class ResilientAgentTeam:
    def __init__(self):
        self.model_manager = ModelManager()
        self.agents: Dict[AgentRole, AgentConfig] = {}
        self.tasks: Dict[str, Task] = {}
        self.results: Dict[str, str] = {}
        self._init_agents()
    
    def _init_agents(self):
        """Initialize agent configurations with failover support"""
        # Get model recommendations for each agent role
        for role in AgentRole:
            model_config = self.model_manager.get_agent_model(role.value)
            if not model_config:
                # Fallback to default
                model_config = ModelConfig(
                    provider='ollama-launch',
                    model='llama3.2:3b-optimized-fixed',
                    base_url='http://127.0.0.1:11434/v1'
                )
            
            # Define agent configs
            configs = {
                AgentRole.RESEARCH: {
                    'toolsets': ['web', 'browser', 'file', 'memory', 'session_search', 'skills'],
                    'skills': ['web-scraper', 'blogwatcher', 'competitor-news-monitor'],
                    'max_turns': 100,
                    'script': '/root/.hermes/scripts/launch-research-agent.sh'
                },
                AgentRole.ANALYSIS: {
                    'toolsets': ['execute_code', 'file', 'terminal', 'memory', 'skills'],
                    'skills': ['data-analysis', 'usage-analytics', 'evaluating-llms-harness'],
                    'max_turns': 150,
                    'script': '/root/.hermes/scripts/launch-analysis-agent.sh'
                },
                AgentRole.PLANNING: {
                    'toolsets': ['plan', 'workflow-orchestrator', 'cronjob', 'delegation', 'todo', 'file', 'memory', 'skills'],
                    'skills': ['plan', 'workflow-orchestrator', 'enhancement-guide'],
                    'max_turns': 200,
                    'script': '/root/.hermes/scripts/launch-planning-agent.sh'
                },
                AgentRole.EXECUTION: {
                    'toolsets': ['terminal', 'execute_code', 'file', 'patch', 'computer_use', 'coding', 'skills'],
                    'skills': ['systematic-debugging', 'test-driven-development', 'simplify-code'],
                    'max_turns': 300,
                    'script': '/root/.hermes/scripts/launch-execution-agent.sh'
                },
                AgentRole.REVIEW: {
                    'toolsets': ['file', 'skills', 'terminal', 'execute_code', 'web'],
                    'skills': ['requesting-code-review', 'github-code-review', 'systematic-debugging'],
                    'max_turns': 150,
                    'script': '/root/.hermes/scripts/launch-review-agent.sh'
                },
                AgentRole.VISUAL: {
                    'toolsets': ['vision_analyze', 'image_generate', 'computer_use', 'file', 'terminal', 'skills'],
                    'skills': ['architecture-diagram', 'ascii-art', 'design-md'],
                    'max_turns': 100,
                    'script': '/root/.hermes/scripts/launch-visual-agent.sh'
                }
            }
            
            if role in configs:
                c = configs[role]
                self.agents[role] = AgentConfig(
                    role=role,
                    model_config=model_config,
                    toolsets=c['toolsets'],
                    skills=c['skills'],
                    max_turns=c['max_turns'],
                    script_path=c['script']
                )
    
    def add_task(self, task: Task):
        self.tasks[task.id] = task
    
    def get_ready_tasks(self) -> List[Task]:
        ready = []
        for task in self.tasks.values():
            if task.status == "pending":
                deps_met = all(self.tasks[dep].status == "completed" for dep in task.dependencies)
                if deps_met:
                    ready.append(task)
        return ready
    
    def _build_launch_command(self, agent_config: AgentConfig, query: str) -> List[str]:
        """Build the hermes chat command with the agent's model config"""
        mc = agent_config.model_config
        cmd = [
            'hermes', 'chat',
            '--model', mc.model,
            '--provider', mc.provider,
            '--toolsets', ','.join(agent_config.toolsets),
            '--skills', ','.join(agent_config.skills),
            '--max-turns', str(agent_config.max_turns),
            '-q', query
        ]
        return cmd
    
    ADVANCED_TOOLS = ('browser', 'computer_use', 'vision_analyze')

    def _infer_capabilities(self, query: str) -> set:
        q = query.lower()
        caps = set()
        if any(w in q for w in ['website', 'browse', 'fill form', 'screenshot']):
            caps.add('browser')
        if any(w in q for w in ['image', 'picture', 'diagram', 'screenshot', 'photo']):
            caps.add('vision')
        if any(w in q for w in ['click', 'desktop', 'gui', 'window']):
            caps.add('computer_use')
        return caps

    def _strip_unsupported(self, toolsets: List[str], caps: set) -> List[str]:
        # if no capability hinted, drop advanced tools first
        ts = list(toolsets)
        if 'browser' not in caps:
            ts = [t for t in ts if t != 'browser']
        if 'vision' not in caps:
            ts = [t for t in ts if t != 'vision_analyze']
        if 'computer_use' not in caps:
            ts = [t for t in ts if t != 'computer_use']
        return ts

    async def _try_run(self, cmd: List[str], mc, attempts: int = 3):
        """Run command with retry for transient errors (429/503 EOF/timeouts)."""
        for a in range(attempts):
            try:
                start = time.time()
                p = await asyncio.create_subprocess_exec(
                    *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                out, err = await p.communicate()
                latency = (time.time() - start) * 1000
                res = out.decode() if out else ""
                err_txt = err.decode() if err else ""
                if err_txt:
                    res += f"\n[STDERR]: {err_txt}"
                transient = any(s in err_txt for s in ("EOF occurred", "timed out", "429", "503", "overloaded"))
                if p.returncode == 0 and res.strip():
                    return res, latency, None
                if not transient or a == attempts - 1:
                    return None, latency, f"rc={p.returncode}: {err_txt[:300]}"
                wait = 2 ** a
                print(f"  transient error, retrying in {wait}s...")
                await asyncio.sleep(wait)
            except Exception as e:
                if a == attempts - 1:
                    return None, 0, str(e)
                await asyncio.sleep(2 ** a)
        return None, 0, "exhausted retries"

    async def run_agent_with_failover(self, task: Task) -> str:
        """Run an agent task with automatic model failover"""
        agent_config = self.agents[task.assigned_agent]
        
        # Try primary model first
        max_attempts = 3
        last_error = ""
        
        for attempt in range(max_attempts):
            mc = agent_config.model_config
            model_id = f"{mc.provider}/{mc.model}"
            
            task.status = "running"
            task.started_at = datetime.now()
            task.model_used = model_id
            
            print(f"[{task.started_at}] Starting {task.assigned_agent.value} agent "
                  f"({model_id}) - attempt {attempt + 1}/{max_attempts}")
            print(f"  Task: {task.description[:100]}...")
            
            # Build context from dependencies
            context_parts = [f"Task: {task.description}"]
            for dep_id in task.dependencies:
                if dep_id in self.results:
                    context_parts.append(f"\n--- Dependency Result ({dep_id}) ---\n{self.results[dep_id]}")
            
            full_context = "\n".join(context_parts)
            
            try:
                cmd = self._build_launch_command(agent_config, full_context)
                
                start_time = time.time()
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await process.communicate()
                latency_ms = (time.time() - start_time) * 1000
                
                result = stdout.decode('utf-8') if stdout else ""
                if stderr:
                    stderr_text = stderr.decode('utf-8')
                    result += f"\n[STDERR]: {stderr_text}"
                
                if process.returncode == 0 and result.strip():
                    # Success!
                    task.result = result
                    task.status = "completed"
                    task.completed_at = datetime.now()
                    self.results[task.id] = result
                    
                    # Record success in model manager
                    self.model_manager.record_request(mc.provider, mc.model, True, latency_ms)
                    
                    print(f"[{task.completed_at}] Completed {task.assigned_agent.value} agent "
                          f"({model_id}) in {latency_ms:.0f}ms")
                    return result
                else:
                    # Failed
                    error = f"Return code {process.returncode}: {result}"
                    last_error = error
                    print(f"  Attempt {attempt + 1} failed: {error[:200]}")
                    
            except Exception as e:
                latency_ms = (time.time() - start_time) * 1000 if 'start_time' in locals() else 0
                last_error = str(e)
                print(f"  Attempt {attempt + 1} error: {e}")
            
            # Record failure
            self.model_manager.record_request(mc.provider, mc.model, False, latency_ms, last_error)
            
            # Try next fallback
            if attempt < max_attempts - 1:
                # Get next best model
                fallbacks = self.model_manager.config.get('agent_team_models', {}).get(task.assigned_agent.value, {}).get('fallbacks', [])
                if attempt < len(fallbacks):
                    fb = fallbacks[attempt]
                    agent_config.model_config = ModelConfig(
                        provider=fb['provider'],
                        model=fb['model'],
                        base_url=self.model_manager.get_model_base_url(fb['provider'], fb['model'])
                    )
                    print(f"  Failing over to: {agent_config.model_config.provider}/{agent_config.model_config.model}")
                else:
                    break
        
        # All attempts failed
        task.status = "failed"
        task.result = f"All {max_attempts} attempts failed. Last error: {last_error}"
        task.completed_at = datetime.now()
        self.results[task.id] = task.result
        print(f"[{task.completed_at}] FAILED {task.assigned_agent.value} agent after {max_attempts} attempts")
        return task.result
    
    async def run_workflow(self, workflow_name: str, task_definitions: List[Dict]):
        """Run a complete workflow with failover"""
        print(f"\n{'='*60}")
        print(f"Starting Resilient Workflow: {workflow_name}")
        print(f"{'='*60}\n")
        
        # Run initial health check
        print("Running pre-flight health checks...")
        await self.model_manager.health_check_all()
        
        # Create tasks
        for i, td in enumerate(task_definitions):
            task = Task(
                id=td.get("id", f"task_{i}"),
                description=td["description"],
                assigned_agent=AgentRole(td["agent"]),
                dependencies=td.get("dependencies", [])
            )
            self.add_task(task)
        
        # Execute tasks respecting dependencies
        while True:
            ready_tasks = self.get_ready_tasks()
            if not ready_tasks:
                pending = [t for t in self.tasks.values() if t.status in ("pending", "running")]
                if not pending:
                    break
                await asyncio.sleep(1)
                continue
            
            # Run ready tasks in parallel
            await asyncio.gather(*[self.run_agent_with_failover(task) for task in ready_tasks])
        
        print(f"\n{'='*60}")
        print(f"Workflow {workflow_name} Complete")
        print(f"{'='*60}\n")
        return self.results


# Predefined workflows
WORKFLOWS = {
    "standard": [
        {"id": "research", "description": "Research the topic thoroughly", "agent": "research"},
        {"id": "analysis", "description": "Analyze research findings", "agent": "analysis", "dependencies": ["research"]},
        {"id": "planning", "description": "Create execution plan", "agent": "planning", "dependencies": ["analysis"]},
    ],
    "full": [
        {"id": "research", "description": "Research the topic thoroughly", "agent": "research"},
        {"id": "analysis", "description": "Analyze research findings", "agent": "analysis", "dependencies": ["research"]},
        {"id": "planning", "description": "Create execution plan", "agent": "planning", "dependencies": ["analysis"]},
        {"id": "execution", "description": "Execute the plan", "agent": "execution", "dependencies": ["planning"]},
        {"id": "review", "description": "Review execution results", "agent": "review", "dependencies": ["execution"]},
    ],
    "parallel_research": [
        {"id": "research_1", "description": "Research aspect A", "agent": "research"},
        {"id": "research_2", "description": "Research aspect B", "agent": "research"},
        {"id": "research_3", "description": "Research aspect C", "agent": "research"},
        {"id": "synthesis", "description": "Synthesize all research", "agent": "analysis", "dependencies": ["research_1", "research_2", "research_3"]},
        {"id": "planning", "description": "Create plan from synthesis", "agent": "planning", "dependencies": ["synthesis"]},
    ],
    "code_development": [
        {"id": "requirements", "description": "Analyze requirements and research best practices", "agent": "research"},
        {"id": "design", "description": "Design architecture and data models", "agent": "planning", "dependencies": ["requirements"]},
        {"id": "implementation", "description": "Implement the solution", "agent": "execution", "dependencies": ["design"]},
        {"id": "testing", "description": "Write and run tests", "agent": "execution", "dependencies": ["implementation"]},
        {"id": "review", "description": "Code review and quality check", "agent": "review", "dependencies": ["testing"]},
    ],
    "deep_analysis": [
        {"id": "research", "description": "Comprehensive research on topic", "agent": "research"},
        {"id": "analysis_1", "description": "Statistical analysis of findings", "agent": "analysis", "dependencies": ["research"]},
        {"id": "analysis_2", "description": "Pattern recognition and insights", "agent": "analysis", "dependencies": ["research"]},
        {"id": "synthesis", "description": "Synthesize analyses", "agent": "analysis", "dependencies": ["analysis_1", "analysis_2"]},
        {"id": "planning", "description": "Strategic plan based on insights", "agent": "planning", "dependencies": ["synthesis"]},
        {"id": "review", "description": "Validate plan quality", "agent": "review", "dependencies": ["planning"]},
    ]
}


async def main():
    if len(sys.argv) < 3:
        print("Usage: python3 resilient-team.py <workflow_name> <task_description>")
        print(f"Available workflows: {list(WORKFLOWS.keys())}")
        sys.exit(1)
    
    workflow_name = sys.argv[1]
    task_description = " ".join(sys.argv[2:])
    
    if workflow_name not in WORKFLOWS:
        print(f"Unknown workflow: {workflow_name}")
        print(f"Available: {list(WORKFLOWS.keys())}")
        sys.exit(1)
    
    # Customize task descriptions
    task_defs = []
    for td in WORKFLOWS[workflow_name]:
        new_td = td.copy()
        new_td["description"] = f"{td['description']}: {task_description}"
        task_defs.append(new_td)
    
    team = ResilientAgentTeam()
    results = await team.run_workflow(workflow_name, task_defs)
    
    # Print summary
    print("\n=== RESULTS SUMMARY ===")
    for task_id, result in results.items():
        task = team.tasks[task_id]
        model_info = f" (model: {task.model_used})" if task.model_used else ""
        print(f"\n--- {task_id} [{task.assigned_agent.value}]{model_info} ---")
        print(result[:800] + ("..." if len(result) > 800 else ""))


if __name__ == "__main__":
    asyncio.run(main())