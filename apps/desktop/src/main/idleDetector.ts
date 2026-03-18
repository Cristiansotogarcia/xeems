import log from 'electron-log';
import { v4 as uuidv4 } from 'uuid';

export interface IdleEvent {
  id: string;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number;
}

export class IdleDetector {
  private callback: (idleTime: IdleEvent) => void;
  private checkInterval: number = 5000; // Check every 5 seconds
  private idleThreshold: number = 120000; // 2 minutes of inactivity = idle
  private intervalId: NodeJS.Timeout | null = null;
  private isIdle: boolean = false;
  private idleStartTime: Date | null = null;
  private isRunning: boolean = false;

  constructor(callback: (idleTime: IdleEvent) => void) {
    this.callback = callback;
  }

  start(): void {
    if (this.isRunning) {
      log.warn('Idle detector already running');
      return;
    }

    log.info('Starting idle detector...');
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      this.checkIdleState();
    }, this.checkInterval);
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    log.info('Stopping idle detector...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // End any ongoing idle period
    if (this.isIdle && this.idleStartTime) {
      this.endIdlePeriod();
    }
  }

  private checkIdleState(): void {
    try {
      // Use powerMonitor on Windows/Linux or getSystemIdleTime
      const { powerMonitor } = require('electron');
      
      const idleTime = powerMonitor.getSystemIdleTime();
      const idleTimeMs = idleTime * 1000; // powerMonitor returns seconds

      if (idleTimeMs >= this.idleThreshold && !this.isIdle) {
        // User just became idle
        this.startIdlePeriod();
      } else if (idleTimeMs < this.idleThreshold && this.isIdle) {
        // User is no longer idle
        this.endIdlePeriod();
      }
    } catch (error) {
      log.error('Error checking idle state:', error);
    }
  }

  private startIdlePeriod(): void {
    log.info('User became idle');
    this.isIdle = true;
    this.idleStartTime = new Date();
  }

  private endIdlePeriod(): void {
    if (!this.idleStartTime) return;

    const endTime = new Date();
    const durationMs = endTime.getTime() - this.idleStartTime.getTime();
    const durationSeconds = Math.floor(durationMs / 1000);

    const idleEvent: IdleEvent = {
      id: uuidv4(),
      startTime: this.idleStartTime,
      endTime,
      durationSeconds,
    };

    log.info('User no longer idle. Duration:', durationSeconds, 'seconds');
    
    this.callback(idleEvent);
    
    this.isIdle = false;
    this.idleStartTime = null;
  }

  setIdleThreshold(ms: number): void {
    this.idleThreshold = ms;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getIsIdle(): boolean {
    return this.isIdle;
  }
}
