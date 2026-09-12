# Architecture

`packages/core` is the provider-neutral Agent OS kernel. `apps/api` exposes it over HTTP. `apps/web` is the first Mission Control client.

The kernel is intentionally independent from UI and model vendors. Model routing currently expresses the local-first policy without making external model calls. Tool permissions, durable storage, approvals and workers are the next platform layer.
