"""
Cortexx API Tool — Universal interface for CrewAI agents to interact with Cortexx.
All agents use this to read/write data, run analytics, and control the system.
"""
import os
import json
import requests
from typing import Optional, Dict, Any
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

CORTEXX_BASE = os.getenv("CORTEXX_API_BASE", "http://localhost:3000")
CORTEXX_KEY = os.getenv("CORTEXX_API_KEY", "")


class CortexxQueryInput(BaseModel):
    endpoint: str = Field(description="API endpoint path, e.g. /api/projects")
    method: str = Field(default="GET", description="HTTP method: GET, POST, PUT, DELETE")
    body: Optional[str] = Field(default=None, description="JSON body for POST/PUT")
    params: Optional[str] = Field(default=None, description="Query params as JSON string")


class CortexxQueryTool(BaseTool):
    name: str = "cortexx_query"
    description: str = (
        "Query any Cortexx API endpoint. Use for reading data, checking status, "
        "or retrieving records. Examples: /api/projects, /api/tasks, /api/llm/health"
    )
    args_schema: type[BaseModel] = CortexxQueryInput

    def _run(self, endpoint: str, method: str = "GET", body: Optional[str] = None, params: Optional[str] = None) -> str:
        url = f"{CORTEXX_BASE}{endpoint}"
        headers = {"Content-Type": "application/json"}
        if CORTEXX_KEY:
            headers["Authorization"] = f"Bearer {CORTEXX_KEY}"

        kwargs: Dict[str, Any] = {"headers": headers, "timeout": 30}
        if params:
            kwargs["params"] = json.loads(params)
        if body and method in ("POST", "PUT", "PATCH"):
            kwargs["json"] = json.loads(body)

        try:
            resp = requests.request(method.upper(), url, **kwargs)
            resp.raise_for_status()
            return json.dumps(resp.json(), indent=2)
        except requests.exceptions.ConnectionError:
            return json.dumps({"error": "Cortexx API unreachable. Is the server running?"})
        except requests.exceptions.HTTPError as e:
            return json.dumps({"error": f"HTTP {resp.status_code}", "detail": resp.text[:500]})
        except Exception as e:
            return json.dumps({"error": str(e)})


class CortexxMutateInput(BaseModel):
    endpoint: str = Field(description="API endpoint path, e.g. /api/projects")
    body: str = Field(description="JSON body as string")
    method: str = Field(default="POST", description="HTTP method: POST, PUT, DELETE")


class CortexxMutateTool(BaseTool):
    name: str = "cortexx_mutate"
    description: str = (
        "Create, update, or delete Cortexx records. Use for mutations only. "
        "Requires careful validation — always confirm before destructive ops."
    )
    args_schema: type[BaseModel] = CortexxMutateInput

    def _run(self, endpoint: str, body: str, method: str = "POST") -> str:
        url = f"{CORTEXX_BASE}{endpoint}"
        headers = {"Content-Type": "application/json"}
        if CORTEXX_KEY:
            headers["Authorization"] = f"Bearer {CORTEXX_KEY}"

        try:
            resp = requests.request(method.upper(), url, headers=headers, json=json.loads(body), timeout=30)
            resp.raise_for_status()
            return json.dumps(resp.json(), indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})


class CortexxAnalyzeInput(BaseModel):
    report_type: str = Field(description="Type of report: project_health, cash_flow, safety_audit, material_forecast")
    project_id: Optional[int] = Field(default=None, description="Optional project ID to scope the analysis")
    period: str = Field(default="30d", description="Time period: 7d, 30d, 90d, 1y")


class CortexxAnalyzeTool(BaseTool):
    name: str = "cortexx_analyze"
    description: str = (
        "Run analytics and generate reports on Cortexx data. "
        "Returns structured insights for decision-making."
    )
    args_schema: type[BaseModel] = CortexxAnalyzeInput

    def _run(self, report_type: str, project_id: Optional[int] = None, period: str = "30d") -> str:
        endpoint = "/api/analytics/report"
        body = {"type": report_type, "period": period}
        if project_id:
            body["projectId"] = project_id

        url = f"{CORTEXX_BASE}{endpoint}"
        headers = {"Content-Type": "application/json"}
        if CORTEXX_KEY:
            headers["Authorization"] = f"Bearer {CORTEXX_KEY}"

        try:
            resp = requests.post(url, headers=headers, json=body, timeout=60)
            resp.raise_for_status()
            return json.dumps(resp.json(), indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})


class CortexxNotifyInput(BaseModel):
    channel: str = Field(description="Channel: email, sms, push, in-app")
    recipient: str = Field(description="User ID, email, or phone number")
    subject: str = Field(description="Notification subject")
    message: str = Field(description="Notification body")
    priority: str = Field(default="normal", description="Priority: low, normal, high, urgent")


class CortexxNotifyTool(BaseTool):
    name: str = "cortexx_notify"
    description: str = "Send notifications to users or channels via Cortexx."
    args_schema: type[BaseModel] = CortexxNotifyInput

    def _run(self, channel: str, recipient: str, subject: str, message: str, priority: str = "normal") -> str:
        url = f"{CORTEXX_BASE}/api/notifications/send"
        headers = {"Content-Type": "application/json"}
        if CORTEXX_KEY:
            headers["Authorization"] = f"Bearer {CORTEXX_KEY}"

        try:
            resp = requests.post(url, headers=headers, json={
                "channel": channel,
                "recipient": recipient,
                "subject": subject,
                "message": message,
                "priority": priority,
            }, timeout=15)
            resp.raise_for_status()
            return json.dumps({"status": "sent", "id": resp.json().get("id")})
        except Exception as e:
            return json.dumps({"error": str(e)})


class CortexxVisionInput(BaseModel):
    image_url: str = Field(description="URL or base64 data URI of the image")
    prompt: str = Field(default="Describe what you see in this construction site photo.", description="Vision prompt")


class CortexxVisionTool(BaseTool):
    name: str = "cortexx_vision"
    description: str = (
        "Analyze construction site photos using Ollama vision models. "
        "Detects snags, safety issues, progress, and materials."
    )
    args_schema: type[BaseModel] = CortexxVisionInput

    def _run(self, image_url: str, prompt: str = "Describe what you see in this construction site photo.") -> str:
        url = f"{CORTEXX_BASE}/api/llm/vision"
        headers = {"Content-Type": "application/json"}
        if CORTEXX_KEY:
            headers["Authorization"] = f"Bearer {CORTEXX_KEY}"

        try:
            resp = requests.post(url, headers=headers, json={
                "image": image_url,
                "prompt": prompt,
            }, timeout=60)
            resp.raise_for_status()
            return json.dumps(resp.json(), indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})


class CortexxForecastInput(BaseModel):
    forecast_type: str = Field(description="Type: materials, cash_flow, delays, labour")
    project_id: Optional[int] = Field(default=None, description="Optional project ID")
    horizon_days: int = Field(default=30, description="Forecast horizon in days")


class CortexxForecastTool(BaseTool):
    name: str = "cortexx_forecast"
    description: str = (
        "Predict future needs: material shortages, cash flow gaps, "
        "schedule delays, or labour requirements."
    )
    args_schema: type[BaseModel] = CortexxForecastInput

    def _run(self, forecast_type: str, project_id: Optional[int] = None, horizon_days: int = 30) -> str:
        url = f"{CORTEXX_BASE}/api/analytics/forecast"
        headers = {"Content-Type": "application/json"}
        if CORTEXX_KEY:
            headers["Authorization"] = f"Bearer {CORTEXX_KEY}"

        try:
            resp = requests.post(url, headers=headers, json={
                "type": forecast_type,
                "projectId": project_id,
                "horizonDays": horizon_days,
            }, timeout=60)
            resp.raise_for_status()
            return json.dumps(resp.json(), indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})
