type State = "closed" | "open" | "half_open";

export class CircuitBreaker {
  private state: State = "closed";
  private failureCount = 0;
  private nextAttemptAt = 0;

  constructor(
    public readonly name: string,
    private readonly threshold = 5,
    private readonly cooldownMs = 30_000,
  ) {}

  canAttempt(now = Date.now()): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open" && now >= this.nextAttemptAt) {
      this.state = "half_open";
      return true;
    }
    return this.state === "half_open";
  }

  onSuccess(): void {
    this.state = "closed";
    this.failureCount = 0;
  }

  onFailure(now = Date.now()): void {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = "open";
      this.nextAttemptAt = now + this.cooldownMs;
    }
  }

  status() {
    return { name: this.name, state: this.state, failureCount: this.failureCount };
  }
}
