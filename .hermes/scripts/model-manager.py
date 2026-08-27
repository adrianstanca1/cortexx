#!/usr/bin/env python3
"""
Hermes Agent Model Manager with Health Checking and Automatic Failover
Monitors model health and automatically switches to fallback models on failure
"""

import asyncio
import json
import time
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CONFIG_PATH = Path("/root/.hermes/config.yaml")
METRICS_PATH = Path("/root/.hermes/model_metrics.json")
HEALTH_CHECK_INTERVAL = 300  # 5 minutes


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


@dataclass
class ModelMetrics:
    model_id: str
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_latency_ms: float = 0.0
    last_error: str = ""
    last_check: str = ""
    status: ModelStatus = ModelStatus.UNKNOWN
    consecutive_failures: int = 0
    
    @property
    def success_rate(self) -> float:
        if self.total_requests == 0:
            return 1.0
        return self.successful_requests / self.total_requests
    
    @property
    def avg_latency_ms(self) -> float:
        if self.successful_requests == 0:
            return 0.0
        return self.total_latency_ms / self.successful_requests


class ModelManager:
    def __init__(self, config_path: Path = CONFIG_PATH):
        self.config_path = config_path
        self.metrics_path = METRICS_PATH
        self.config = self._load_config()
        self.metrics: Dict[str, ModelMetrics] = self._load_metrics()
        self.model_health: Dict[str, ModelStatus] = {}
        self._running = False
        
    def _load_config(self) -> Dict:
        with open(self.config_path) as f:
            return yaml.safe_load(f)
    
    def _load_metrics(self) -> Dict[str, ModelMetrics]:
        if self.metrics_path.exists():
            with open(self.metrics_path) as f:
                data = json.load(f)
                metrics = {}
                for model_id, m in data.items():
                    metrics[model_id] = ModelMetrics(
                        model_id=m['model_id'],
                        total_requests=m.get('total_requests', 0),
                        successful_requests=m.get('successful_requests', 0),
                        failed_requests=m.get('failed_requests', 0),
                        total_latency_ms=m.get('total_latency_ms', 0.0),
                        last_error=m.get('last_error', ''),
                        last_check=m.get('last_check', ''),
                        status=ModelStatus(m.get('status', 'unknown')),
                        consecutive_failures=m.get('consecutive_failures', 0)
                    )
                return metrics
        return {}
    
    def _save_metrics(self):
        data = {}
        for model_id, m in self.metrics.items():
            data[model_id] = {
                'model_id': m.model_id,
                'total_requests': m.total_requests,
                'successful_requests': m.successful_requests,
                'failed_requests': m.failed_requests,
                'total_latency_ms': m.total_latency_ms,
                'last_error': m.last_error,
                'last_check': m.last_check,
                'status': m.status.value,
                'consecutive_failures': m.consecutive_failures
            }
        with open(self.metrics_path, 'w') as f:
            json.dump(data, f, indent=2)
    
    def get_model_id(self, provider: str, model: str) -> str:
        return f"{provider}/{model}"
    
    def get_provider_config(self, provider: str) -> Dict:
        return self.config.get('providers', {}).get(provider, {})
    
    def get_model_base_url(self, provider: str, model: str) -> str:
        provider_config = self.get_provider_config(provider)
        base_url = provider_config.get('api', '')
        if not base_url and 'fallback_model' in self.config:
            fallback = self.config['fallback_model']
            if fallback.get('provider') == provider:
                base_url = fallback.get('base_url', '')
        return base_url
    
    def _record_health(self, model_id: str, ok: bool, latency_ms: float, error: str = ""):
        if model_id not in self.metrics:
            self.metrics[model_id] = ModelMetrics(model_id=model_id)
        m = self.metrics[model_id]
        m.total_requests += 1
        if ok:
            m.successful_requests += 1
            m.total_latency_ms += latency_ms
            m.consecutive_failures = 0
            m.status = ModelStatus.HEALTHY
        else:
            m.failed_requests += 1
            m.last_error = error
            m.consecutive_failures += 1
            thr = self.config.get('model_health_check', {}).get('failure_threshold', 3)
            m.status = ModelStatus.UNHEALTHY if m.consecutive_failures >= thr else ModelStatus.DEGRADED
        m.last_check = datetime.now().isoformat()
        self.model_health[model_id] = m.status
        self._save_metrics()

    async def health_check_model(self, provider: str, model: str) -> Optional[bool]:
        """Check if a model is healthy by making a test request"""
        m = model if '/' in model.split(':')[0] else f"{provider}/{model}"
        model_id = m.split(':', 1)[0] if provider != 'openrouter' else model
        base_url = self.get_model_base_url(provider, model)
        
        if not base_url:
            logger.warning(f"No base URL for {model_id}")
            return False
        
        # Get API key from environment / .env
        import os
        key_names = {
            'nvidia': 'NVIDIA_API_KEY',
            'openrouter': 'OPENROUTER_API_KEY',
            'groq': 'GROQ_API_KEY',
            'together': 'TOGETHER_API_KEY',
            'fireworks': 'FIREWORKS_API_KEY',
            'novita': 'NOVITA_API_KEY',
            'google': 'GOOGLE_API_KEY',
        }
        api_key = None
        if provider in key_names:
            api_key = os.environ.get(key_names[provider])
            if not api_key:
                # try .env file
                env_path = Path('/root/.hermes/.env')
                if env_path.exists():
                    for line in env_path.read_text().splitlines():
                        if line.startswith(key_names[provider] + '=') and not line.startswith('#'):
                            api_key = line.split('=', 1)[1].strip()
                            os.environ[key_names[provider]] = api_key
                            break
            if not api_key:
                logger.info(f"Skipping {model_id}: no API key configured for {provider}")
                return None  # unknown, not a failure
        
        # Local ollama models: check availability via ollama list instead of inference
        if provider.startswith('ollama'):
            try:
                proc = await asyncio.create_subprocess_exec(
                    'ollama', 'list',
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                out, _ = await proc.communicate()
                installed = out.decode()
                found = model.split(':')[0] in installed or any(
                    line.split() and line.split()[0] == model for line in installed.splitlines()[1:])
                self._record_health(model_id, found, 0.0,
                                    "" if found else "not installed locally")
                return found
            except Exception as e:
                self._record_health(model_id, False, 0.0, str(e))
                return False
        
        try:
            import aiohttp
            
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            
            test_prompt = self.config.get('model_health_check', {}).get('test_prompt', "Hello, respond with 'OK' if you can process this request.")
            timeout = self.config.get('model_health_check', {}).get('timeout', 10)
            
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": test_prompt}],
                "max_tokens": 10,
                "temperature": 0
            }
            
            start_time = time.time()
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=timeout)
                ) as response:
                    latency_ms = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        data = await response.json()
                        content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                        if 'OK' in content.upper() or len(content) > 0:
                            # Update metrics
                            if model_id not in self.metrics:
                                self.metrics[model_id] = ModelMetrics(model_id=model_id)
                            m = self.metrics[model_id]
                            m.total_requests += 1
                            m.successful_requests += 1
                            m.total_latency_ms += latency_ms
                            m.last_check = datetime.now().isoformat()
                            m.consecutive_failures = 0
                            m.status = ModelStatus.HEALTHY
                            self.model_health[model_id] = ModelStatus.HEALTHY
                            self._save_metrics()
                            logger.info(f"Health check passed for {model_id} ({latency_ms:.0f}ms)")
                            return True
                    
                    # Failed
                    error_text = await response.text()
                    raise Exception(f"HTTP {response.status}: {error_text}")
                    
        except Exception as e:
            # Update metrics
            if model_id not in self.metrics:
                self.metrics[model_id] = ModelMetrics(model_id=model_id)
            m = self.metrics[model_id]
            m.total_requests += 1
            m.failed_requests += 1
            m.last_error = str(e)
            m.last_check = datetime.now().isoformat()
            m.consecutive_failures += 1
            
            failure_threshold = self.config.get('model_health_check', {}).get('failure_threshold', 3)
            if m.consecutive_failures >= failure_threshold:
                m.status = ModelStatus.UNHEALTHY
            elif m.consecutive_failures > 0:
                m.status = ModelStatus.DEGRADED
            
            self.model_health[model_id] = m.status
            self._save_metrics()
            logger.warning(f"Health check failed for {model_id}: {e}")
            return False
    
    async def health_check_all(self):
        """Run health checks on all configured models"""
        logger.info("Starting health check for all models...")
        
        # Check primary models from model_routing
        tasks = []
        for category, routing in self.config.get('model_routing', {}).items():
            primary = routing.get('primary', {})
            if primary:
                tasks.append(self.health_check_model(primary['provider'], primary['model']))
            
            for fallback in routing.get('fallbacks', []):
                tasks.append(self.health_check_model(fallback['provider'], fallback['model']))
        
        # Check agent team models
        for agent, config in self.config.get('agent_team_models', {}).items():
            primary = config.get('primary', {})
            if primary:
                tasks.append(self.health_check_model(primary['provider'], primary['model']))
            
            for fallback in config.get('fallbacks', []):
                tasks.append(self.health_check_model(fallback['provider'], fallback['model']))
        
        # Check fallback chain
        for fallback in self.config.get('fallback_chain', []):
            tasks.append(self.health_check_model(fallback['provider'], fallback['model']))
        
        # Run all checks concurrently with limit
        semaphore = asyncio.Semaphore(5)
        
        async def limited_check(coro):
            async with semaphore:
                return await coro
        
        await asyncio.gather(*[limited_check(t) for t in tasks], return_exceptions=True)
        
        logger.info("Health check completed")
        self.print_health_summary()
    
    def print_health_summary(self):
        """Print a summary of model health"""
        print("\n" + "="*60)
        print("MODEL HEALTH SUMMARY")
        print("="*60)
        
        for model_id, status in sorted(self.model_health.items()):
            m = self.metrics.get(model_id)
            if m:
                print(f"  {model_id}: {status.value.upper()} "
                      f"(success: {m.success_rate:.1%}, "
                      f"avg latency: {m.avg_latency_ms:.0f}ms, "
                      f"failures: {m.consecutive_failures})")
            else:
                print(f"  {model_id}: {status.value.upper()}")
    
    def get_best_model(self, category: str = 'reasoning') -> Optional[ModelConfig]:
        """Get the best available model for a category, considering health"""
        routing = self.config.get('model_routing', {}).get(category, {})
        if not routing:
            return None
        
        # Check primary
        primary = routing.get('primary', {})
        if primary:
            model_id = self.get_model_id(primary['provider'], primary['model'])
            status = self.model_health.get(model_id, ModelStatus.UNKNOWN)
            if status in [ModelStatus.HEALTHY, ModelStatus.UNKNOWN]:
                return ModelConfig(
                    provider=primary['provider'],
                    model=primary['model'],
                    base_url=self.get_model_base_url(primary['provider'], primary['model'])
                )
        
        # Check fallbacks
        for fallback in routing.get('fallbacks', []):
            model_id = self.get_model_id(fallback['provider'], fallback['model'])
            status = self.model_health.get(model_id, ModelStatus.UNKNOWN)
            if status in [ModelStatus.HEALTHY, ModelStatus.UNKNOWN]:
                return ModelConfig(
                    provider=fallback['provider'],
                    model=fallback['model'],
                    base_url=self.get_model_base_url(fallback['provider'], fallback['model'])
                )
        
        # If all fail, return primary anyway
        if primary:
            return ModelConfig(
                provider=primary['provider'],
                model=primary['model'],
                base_url=self.get_model_base_url(primary['provider'], primary['model'])
            )
        
        return None
    
    def get_agent_model(self, agent_role: str) -> Optional[ModelConfig]:
        """Get the best model for a specific agent role"""
        agent_config = self.config.get('agent_team_models', {}).get(agent_role, {})
        if not agent_config:
            return None
        
        primary = agent_config.get('primary', {})
        if primary:
            model_id = self.get_model_id(primary['provider'], primary['model'])
            status = self.model_health.get(model_id, ModelStatus.UNKNOWN)
            if status in [ModelStatus.HEALTHY, ModelStatus.UNKNOWN]:
                return ModelConfig(
                    provider=primary['provider'],
                    model=primary['model'],
                    base_url=self.get_model_base_url(primary['provider'], primary['model'])
                )
        
        for fallback in agent_config.get('fallbacks', []):
            model_id = self.get_model_id(fallback['provider'], fallback['model'])
            status = self.model_health.get(model_id, ModelStatus.UNKNOWN)
            if status in [ModelStatus.HEALTHY, ModelStatus.UNKNOWN]:
                return ModelConfig(
                    provider=fallback['provider'],
                    model=fallback['model'],
                    base_url=self.get_model_base_url(fallback['provider'], fallback['model'])
                )
        
        if primary:
            return ModelConfig(
                provider=primary['provider'],
                model=primary['model'],
                base_url=self.get_model_base_url(primary['provider'], primary['model'])
            )
        
        return None
    
    def get_fallback_chain(self) -> List[ModelConfig]:
        """Get the full fallback chain"""
        chain = []
        for fb in self.config.get('fallback_chain', []):
            chain.append(ModelConfig(
                provider=fb['provider'],
                model=fb['model'],
                base_url=self.get_model_base_url(fb['provider'], fb['model']),
                max_retries=fb.get('max_retries', 2),
                timeout=fb.get('timeout', 60)
            ))
        return chain
    
    async def start_monitoring(self):
        """Start continuous health monitoring"""
        self._running = True
        interval = self.config.get('model_health_check', {}).get('interval_minutes', 5) * 60
        
        while self._running:
            await self.health_check_all()
            await asyncio.sleep(interval)
    
    def stop_monitoring(self):
        """Stop continuous health monitoring"""
        self._running = False
    
    def record_request(self, provider: str, model: str, success: bool, latency_ms: float, error: str = ""):
        """Record a request outcome for metrics"""
        model_id = self.get_model_id(provider, model)
        if model_id not in self.metrics:
            self.metrics[model_id] = ModelMetrics(model_id=model_id)
        
        m = self.metrics[model_id]
        m.total_requests += 1
        if success:
            m.successful_requests += 1
            m.total_latency_ms += latency_ms
            m.consecutive_failures = 0
            if m.status == ModelStatus.DEGRADED:
                m.status = ModelStatus.HEALTHY
        else:
            m.failed_requests += 1
            m.last_error = error
            m.consecutive_failures += 1
            
            failure_threshold = self.config.get('model_health_check', {}).get('failure_threshold', 3)
            if m.consecutive_failures >= failure_threshold:
                m.status = ModelStatus.UNHEALTHY
            elif m.consecutive_failures > 0:
                m.status = ModelStatus.DEGRADED
        
        m.last_check = datetime.now().isoformat()
        self.model_health[model_id] = m.status
        self._save_metrics()
    
    def get_model_recommendation(self, task_type: str) -> Dict[str, Any]:
        """Get model recommendation for a task type"""
        best = self.get_best_model(task_type)
        if not best:
            return {"error": f"No model configured for task type: {task_type}"}
        
        model_id = self.get_model_id(best.provider, best.model)
        m = self.metrics.get(model_id)
        
        return {
            "recommended": {
                "provider": best.provider,
                "model": best.model,
                "base_url": best.base_url
            },
            "metrics": {
                "status": self.model_health.get(model_id, ModelStatus.UNKNOWN).value,
                "success_rate": m.success_rate if m else 1.0,
                "avg_latency_ms": m.avg_latency_ms if m else 0,
                "total_requests": m.total_requests if m else 0
            } if m else {"status": "unknown"}
        }


# CLI interface
async def main():
    import sys
    
    manager = ModelManager()
    
    if len(sys.argv) < 2:
        print("Usage: model-manager.py <command> [args...]")
        print("Commands: check, check-all, recommend, monitor, status")
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == "check" and len(sys.argv) >= 4:
        provider = sys.argv[2]
        model = sys.argv[3]
        result = await manager.health_check_model(provider, model)
        print(f"Health check for {provider}/{model}: {'PASS' if result else 'FAIL'}")
    
    elif cmd == "check-all":
        await manager.health_check_all()
    
    elif cmd == "recommend" and len(sys.argv) >= 3:
        task_type = sys.argv[2]
        rec = manager.get_model_recommendation(task_type)
        print(json.dumps(rec, indent=2))
    
    elif cmd == "status":
        manager.print_health_summary()
    
    elif cmd == "monitor":
        print("Starting continuous monitoring (Ctrl+C to stop)...")
        try:
            await manager.start_monitoring()
        except KeyboardInterrupt:
            manager.stop_monitoring()
            print("\nMonitoring stopped")
    
    elif cmd == "agent-model" and len(sys.argv) >= 3:
        agent = sys.argv[2]
        model = manager.get_agent_model(agent)
        if model:
            print(json.dumps({
                "provider": model.provider,
                "model": model.model,
                "base_url": model.base_url
            }, indent=2))
        else:
            print(f"No model configured for agent: {agent}")
    
    elif cmd == "fallback-chain":
        chain = manager.get_fallback_chain()
        for i, m in enumerate(chain):
            model_id = manager.get_model_id(m.provider, m.model)
            status = manager.model_health.get(model_id, ModelStatus.UNKNOWN).value
            print(f"  {i+1}. {m.provider}/{m.model} - {status}")
    
    else:
        print(f"Unknown command: {cmd}")


if __name__ == "__main__":
    asyncio.run(main())