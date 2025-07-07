import { PostHog } from 'posthog-node';
import * as vscode from 'vscode';

interface TelemetryEvent {
  name: string;
  properties?: Record<string, any>;
}

interface TelemetryException {
  error: Error;
  properties?: Record<string, any>;
}

type TelemetryLevel = 'off' | 'basic' | 'full';

class FlydeAnalytics {
  private posthog: PostHog | null = null;
  private userId: string | null = null;
  private isEnabled = false;
  private level: TelemetryLevel = 'off';

  constructor() {
    this.initializeUserId();
    this.updateConfiguration();
    
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('flyde.telemetry')) {
        this.updateConfiguration();
      }
    });
  }

  private initializeUserId(): void {
    const context = vscode.extensions.getExtension('flyde.flyde-vscode')?.exports?.context;
    if (context) {
      this.userId = context.globalState.get('userId');
      if (!this.userId) {
        this.userId = this.generateAnonymousId();
        context.globalState.update('userId', this.userId);
      }
    } else {
      this.userId = this.generateAnonymousId();
    }
  }

  private generateAnonymousId(): string {
    return 'user_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private updateConfiguration(): void {
    const config = vscode.workspace.getConfiguration('flyde.telemetry');
    const enabled = config.get<boolean>('enabled', false);
    const level = config.get<TelemetryLevel>('level', 'off');
    
    const vscodeEnabled = vscode.env.isTelemetryEnabled;
    
    this.isEnabled = enabled && vscodeEnabled && level !== 'off';
    this.level = level;

    if (this.isEnabled && !this.posthog) {
      const apiKey = 'phc_Sfg0m6OUVf32CH7J3tC0M9ikI3cWf1plqoPVO08OP82';
      this.posthog = new PostHog(apiKey, {
        host: 'https://app.posthog.com',
        flushAt: 1,
        flushInterval: 1000,
        personalApiKey: undefined,
        featureFlagsPollingInterval: 0,
        requestTimeout: 10000,
      });
    } else if (!this.isEnabled && this.posthog) {
      this.posthog.shutdown();
      this.posthog = null;
    }
  }

  public activate(): void {
    this.updateConfiguration();
    if (this.isEnabled) {
      this.reportEvent('activate', {
        version: vscode.extensions.getExtension('flyde.flyde-vscode')?.packageJSON.version,
        vscodeVersion: vscode.version,
        platform: process.platform,
        level: this.level
      });
    }
  }

  public refreshConfiguration(): void {
    this.updateConfiguration();
  }

  public reportEvent(eventName: string, properties?: Record<string, any>): void {
    if (!this.isEnabled || !this.posthog || !this.userId) {
      return;
    }

    const sanitizedProperties = this.sanitizeProperties(properties);
    const eventData: Record<string, any> = {
      ...sanitizedProperties,
      timestamp: new Date().toISOString(),
      level: this.level,
      version: vscode.extensions.getExtension('flyde.flyde-vscode')?.packageJSON.version,
    };

    if (this.shouldReportEvent(eventName)) {
      this.posthog.capture({
        distinctId: this.userId,
        event: `flyde_${eventName}`,
        properties: eventData,
      });
    }
  }

  public reportException(error: Error, properties?: Record<string, any>): void {
    if (!this.isEnabled || !this.posthog || !this.userId) {
      return;
    }

    const sanitizedProperties = this.sanitizeProperties(properties);
    const errorData: Record<string, any> = {
      ...sanitizedProperties,
      errorName: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString(),
      level: this.level,
      version: vscode.extensions.getExtension('flyde.flyde-vscode')?.packageJSON.version,
    };

    if (this.level === 'full') {
      errorData.stackTrace = error.stack;
    }

    this.posthog.capture({
      distinctId: this.userId,
      event: 'flyde_exception',
      properties: errorData,
    });
  }

  private shouldReportEvent(eventName: string): boolean {
    if (this.level === 'off') {
      return false;
    }

    const basicEvents = [
      'activate',
      'newVisualFlow',
      'openAsText',
      'devServerStart',
      'runFlow',
      'renderedWebview'
    ];

    if (this.level === 'basic') {
      return basicEvents.includes(eventName);
    }

    return true;
  }

  private sanitizeProperties(properties?: Record<string, any>): Record<string, any> {
    if (!properties) {
      return {};
    }

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(properties)) {
      if (this.isSafeProperty(key, value)) {
        sanitized[key] = this.sanitizeValue(value);
      }
    }

    return sanitized;
  }

  private isSafeProperty(key: string, value: any): boolean {
    const sensitiveKeys = [
      'token', 'password', 'secret', 'key', 'auth', 'credential',
      'email', 'username', 'user', 'name', 'id', 'uuid', 'path',
      'file', 'directory', 'folder', 'content', 'code', 'data'
    ];

    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      return false;
    }

    if (typeof value === 'string' && value.length > 100) {
      return false;
    }

    return true;
  }

  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      return value.length > 50 ? value.substring(0, 50) + '...' : value;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.length;
    }

    if (value && typeof value === 'object') {
      return '[Object]';
    }

    return value;
  }

  public dispose(): void {
    if (this.posthog) {
      this.posthog.shutdown();
    }
  }
}

export const analytics = new FlydeAnalytics();

export const reportEvent = (eventName: string, properties?: Record<string, any>): void => {
  analytics.reportEvent(eventName, properties);
};

export const reportException = (error: Error, properties?: Record<string, any>): void => {
  analytics.reportException(error, properties);
};

export const activateReporter = (): void => {
  analytics.activate();
};

export const refreshAnalyticsConfiguration = (): void => {
  analytics.refreshConfiguration();
};