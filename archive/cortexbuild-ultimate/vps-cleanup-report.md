# VPS Cleanup Report - April 12, 2026

The VPS at **72.62.132.43** has undergone a thorough cleanup to reclaim disk space and remove redundant files. This operation focused on removing unused Docker resources, old logs, temporary files, and obsolete software installations while ensuring that all active services remained stable and functional throughout the process.

## 1. Disk Space Summary

The following table summarizes the disk usage on the root partition before and after the cleanup operations. A total of approximately **9 GB** of disk space was reclaimed, reducing the overall disk utilization from 24% to 22%.

| Metric | Before Cleanup | After Cleanup | Space Reclaimed |
| :--- | :--- | :--- | :--- |
| **Used Space** | 91 GB | 82 GB | **~9 GB** |
| **Available Space** | 296 GB | 305 GB | +9 GB |
| **Disk Usage %** | 24% | 22% | -2% |

## 2. Detailed Cleanup Actions

### Docker and Container Management
The Docker environment was optimized by pruning all build cache layers, which reclaimed **142.4 MB**. Additionally, unused Docker images, specifically `alpine:latest` and `cortexbuild-ultimate-api:latest`, were removed as they were not associated with any running containers. All active containers, including the database, cache, and monitoring services, were preserved without interruption.

### Log Rotation and Journal Maintenance
System and application logs were significantly reduced to prevent unnecessary disk consumption. The system journal was vacuumed to a maximum size of 50 MB, freeing **146.2 MB**. In the `/var/log/nginx/` directory, all old compressed rotated logs were deleted. Furthermore, obsolete PM2 logs associated with the former process name `cortexbuild-api` were removed, and the logs for the active `cortex-api` process were flushed to ensure a clean state.

### Software and Temporary File Removal
Several obsolete software components and temporary files were identified and removed. The `llama.cpp` directory and its associated `llama-b8766` binaries were deleted, as Ollama has become the primary LLM manager. A standalone 5.3 GB GGUF model file was also removed from `/root/models/`. Other significant removals included old project backups from early April and the `/root/cortexbuild-work/` directory, which served as an old workspace for the project now running from `/var/www/`.

### Package and Cache Optimization
The system's package management and development caches were also addressed. The APT package cache was cleared, and an autoremove was performed to purge the old `linux-image-6.8.0-90-generic` kernel and its dependencies. The global npm and npx caches were thoroughly cleaned, reclaiming approximately **1.0 GB** of space. Finally, redundant `.env.bak` files within the active project directory were removed to maintain a clean environment.

## 3. Service Verification and Stability

Following the cleanup, a final verification was conducted to ensure the stability of the VPS environment. All critical services remain in an active and healthy state, as detailed in the table below.

| Service Category | Status | Details |
| :--- | :--- | :--- |
| **Docker Containers** | **Up / Healthy** | All 6 containers (`ollama`, `grafana`, `redis`, `db`, etc.) are running. |
| **PM2 Processes** | **Online** | The `cortex-api` process is active and stable. |
| **Web Server** | **Active** | Nginx is successfully serving requests. |
| **SSH Access** | **Stable** | Remote access remains fully functional. |

> **Note on Ollama Storage:** It was observed that Ollama models are currently stored in both `/root/.ollama` and `/usr/share/ollama`. In accordance with the project constraints and to avoid any risk of service disruption, these storage locations were left intact and were not deduplicated.
