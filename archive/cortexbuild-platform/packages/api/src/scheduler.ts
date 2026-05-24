import cron from 'node-cron';
import { logger } from './lib/logger';

export const scheduler = {
  start() {
    // Daily report reminders at 09:00
    cron.schedule('0 9 * * *', () => logger.info('[Scheduler] Daily report reminder'));
    // Weekly safety summary on Monday 08:00
    cron.schedule('0 8 * * 1', () => logger.info('[Scheduler] Weekly safety summary'));
    // Monthly billing 1st at 00:00
    cron.schedule('0 0 1 * *', () => logger.info('[Scheduler] Monthly billing'));
  }
};
