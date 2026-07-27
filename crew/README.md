# Cortexx CrewAI — Multi-Agent Orchestration

## Organizations

### Soul (Governance Layer)
The **Soul** organization ensures ethical, safe, and aligned AI operations. It monitors all agent actions, enforces guardrails, and maintains system integrity.

**Agents:**
- **Ethics Guardian** — Reviews decisions for ethical compliance
- **Safety Warden** — Monitors safety protocols and risk thresholds
- **Alignment Auditor** — Ensures agent behavior matches business goals
- **Memory Keeper** — Maintains long-term organizational memory and knowledge

### Paperclip (Operations Layer)
The **Paperclip** organization executes construction management tasks with maximum efficiency. It handles day-to-day operations, project management, and site coordination.

**Agents:**
- **Project Commander** — Manages project timelines, resources, and milestones
- **Site Scout** — Captures and analyzes site conditions, snags, and progress
- **Compliance Officer** — Handles CIS, HMRC, RAMS, and safety compliance
- **Finance Tracker** — Manages invoices, payments, budgets, and forecasting
- **Client Liaison** — Communicates with clients, generates reports, handles portals

## Quick Start

```bash
cd crew
source ../.venv/bin/activate

# Set environment
export OLLAMA_BASE_URL=http://localhost:11434
export CORTEXX_API_BASE=http://localhost:3000

# Run Soul governance check
python -m soul.governance_crew

# Run Paperclip operations
python -m paperclip.operations_crew

# Run full orchestration
python -m cortexx_orchestrator
```

## Architecture

```
Cortexx Orchestrator
├── Soul (Governance)
│   ├── Ethics Guardian
│   ├── Safety Warden
│   ├── Alignment Auditor
│   └── Memory Keeper
├── Paperclip (Operations)
│   ├── Project Commander
│   ├── Site Scout
│   ├── Compliance Officer
│   ├── Finance Tracker
│   └── Client Liaison
└── Shared Tools
    ├── cortexx_api.py
    ├── database.py
    ├── llm_router.py
    └── memory.py
```

## Tools

All agents share access to Cortexx system tools:

- `cortexx_query` — Query any Cortexx API endpoint
- `cortexx_mutate` — Create/update/delete Cortexx records
- `cortexx_analyze` — Run analytics and generate reports
- `cortexx_notify` — Send notifications to users/channels
- `cortexx_vision` — Analyze images via Ollama vision models
- `cortexx_forecast` — Predict material needs, cash flow, delays
