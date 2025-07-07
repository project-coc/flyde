import * as vscode from 'vscode';
import { refreshAnalyticsConfiguration } from './analytics';

interface PrivacyNoticeResult {
  enabled: boolean;
  level: 'off' | 'basic' | 'full';
}

export async function showFirstRunPrivacyNotice(): Promise<PrivacyNoticeResult> {
  const config = vscode.workspace.getConfiguration('flyde.telemetry');
  const hasShownNotice = config.get<boolean>('hasShownPrivacyNotice', false);
  
  if (hasShownNotice) {
    return {
      enabled: config.get<boolean>('enabled', false),
      level: config.get<'off' | 'basic' | 'full'>('level', 'off')
    };
  }

  const choice = await vscode.window.showInformationMessage(
    'Flyde collects anonymous usage data to help improve the extension. No personal information is collected. You can disable this in the extension settings at any time.',
    'Open Settings',
    'Got it'
  );

  if (choice === 'Open Settings') {
    vscode.commands.executeCommand('workbench.action.openSettings', 'flyde.telemetry');
  }

  // Mark that we've shown the notice
  await config.update('hasShownPrivacyNotice', true, vscode.ConfigurationTarget.Global);
  
  return {
    enabled: config.get<boolean>('enabled', false),
    level: config.get<'off' | 'basic' | 'full'>('level', 'off')
  };
}

async function updateTelemetrySettings(settings: PrivacyNoticeResult): Promise<void> {
  const config = vscode.workspace.getConfiguration('flyde.telemetry');
  await config.update('enabled', settings.enabled, vscode.ConfigurationTarget.Global);
  await config.update('level', settings.level, vscode.ConfigurationTarget.Global);
  
  // Refresh analytics configuration to apply changes immediately
  refreshAnalyticsConfiguration();
}

async function showDetailedPrivacyInfo(): Promise<void> {
  const selection = await vscode.window.showInformationMessage(
    'Flyde Privacy & Analytics Information',
    {
      modal: true,
      detail: `What we collect:

BASIC ANALYTICS:
• Extension activation/deactivation
• Flow creation and execution counts
• Error types (without personal data)
• Feature usage patterns

FULL ANALYTICS:
• All basic analytics data
• Detailed interaction patterns
• Performance metrics
• Error stack traces (sanitized)

What we DON'T collect:
• Personal information or identifiers
• File contents or code
• File paths or project names
• API keys or secrets
• Any sensitive data

How we protect your privacy:
• All data is anonymous
• Random user IDs (not linked to you)
• Data is sanitized before sending
• Respects VS Code's telemetry settings
• You can opt out anytime

Why we collect this:
• Understand which features are most useful
• Identify and fix bugs faster
• Improve performance and user experience
• Guide future development priorities

Data is processed by PostHog and used solely for improving Flyde.`
    },
    'Got it',
    'Open Privacy Settings'
  );

  if (selection === 'Open Privacy Settings') {
    vscode.commands.executeCommand('workbench.action.openSettings', 'flyde.telemetry');
  }
}

export async function showPrivacySettings(): Promise<void> {
  const config = vscode.workspace.getConfiguration('flyde.telemetry');
  const currentEnabled = config.get<boolean>('enabled', false);
  const currentLevel = config.get<string>('level', 'off');
  
  const status = currentEnabled ? 
    `Currently: ${currentLevel === 'basic' ? 'Basic' : 'Full'} Analytics Enabled` :
    'Currently: Analytics Disabled';

  const choice = await vscode.window.showQuickPick([
    {
      label: '$(circle-slash) Disable Analytics',
      description: 'No data collection',
      detail: 'Turn off all analytics collection',
      value: { enabled: false, level: 'off' }
    },
    {
      label: '$(pulse) Enable Basic Analytics',
      description: 'Core events only',
      detail: 'Activation, flow creation, basic usage patterns',
      value: { enabled: true, level: 'basic' }
    },
    {
      label: '$(graph) Enable Full Analytics', 
      description: 'Detailed insights',
      detail: 'All basic data plus detailed interactions and performance metrics',
      value: { enabled: true, level: 'full' }
    }
  ], {
    placeHolder: `${status} - Choose your privacy preference`,
    ignoreFocusOut: true
  });

  if (choice) {
    await updateTelemetrySettings(choice.value as PrivacyNoticeResult);
    const newStatus = choice.value.enabled ? 
      `${choice.value.level === 'basic' ? 'Basic' : 'Full'} analytics enabled` :
      'Analytics disabled';
    vscode.window.showInformationMessage(`✓ ${newStatus}`);
  }
}