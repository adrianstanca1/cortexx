# Agents Registry

| Agent Name | Description | Heartbeat Interval | Log File Path |
|------------|-------------|-------------------|---------------|
| Orchestrator | Monitors the agents registry for changes and logs heartbeat messages. | 60 seconds | /workspace/.brain/orchestrator.log |
| Code Manager | Runs flake8 linting and pytest unit tests, capturing combined output to a log file. | N/A | /workspace/.brain/code_manager.log |
| Deployment Agent | Checks health of Node server and Ollama model server, restarts them if needed. | N/A | /workspace/.brain/deployment_agent.log |
| Monitoring Agent | Sends HTTP GET request to health endpoint every 30 seconds and logs status. | 30 seconds | /workspace/.brain/monitoring.log |
