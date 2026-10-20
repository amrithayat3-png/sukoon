import type { Logger } from '../../core/logger.js';
import type { SessionService } from './service.js';

/** Periodically erases expired sessions so patient answers do not outlive their purpose. */
export class RetentionSweeper {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly sessions: SessionService,
    private readonly intervalMs: number,
    private readonly log: Logger,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.sweepOnce(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async sweepOnce(): Promise<number> {
    try {
      return await this.sessions.purgeExpired();
    } catch (error) {
      this.log.error({ err: error }, 'Retention sweep failed');
      return 0;
    }
  }
}
