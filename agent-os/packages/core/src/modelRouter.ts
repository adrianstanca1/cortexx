export interface ModelDecision {
  provider: 'ollama' | 'cloud';
  model: string;
  reason: string;
}

export class ModelRouter {
  constructor(private readonly localModel = process.env.OLLAMA_MODEL || 'qwen2.5:7b') {}

  route(complexity: number): ModelDecision {
    if (complexity <= 6) {
      return { provider: 'ollama', model: this.localModel, reason: 'Local-first policy for routine work' };
    }
    return {
      provider: 'cloud',
      model: process.env.CLOUD_MODEL || 'configured-cloud-model',
      reason: 'Escalated because task complexity exceeds local threshold'
    };
  }
}
