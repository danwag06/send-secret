import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface ActiveShare {
  url: string;
  filename: string;
  process: ChildProcess;
  views: { current: number; max: number };
}

let statusBarItem: vscode.StatusBarItem;
let activeShares: Map<string, ActiveShare> = new Map();

export function activate(context: vscode.ExtensionContext) {
  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'send-secret.showActive';
  updateStatusBar();
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('send-secret.send', (uri?: vscode.Uri) => sendSecret(uri)),
    vscode.commands.registerCommand('send-secret.send3', (uri?: vscode.Uri) => sendSecret(uri, 3)),
    vscode.commands.registerCommand('send-secret.send5', (uri?: vscode.Uri) => sendSecret(uri, 5)),
    vscode.commands.registerCommand('send-secret.sendCustom', (uri?: vscode.Uri) => sendSecretCustom(uri)),
    vscode.commands.registerCommand('send-secret.showActive', showActiveShares)
  );
}

function updateStatusBar() {
  const count = activeShares.size;
  if (count > 0) {
    statusBarItem.text = `$(lock) ${count} active`;
    statusBarItem.tooltip = `${count} secret${count > 1 ? 's' : ''} waiting for receivers`;
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

async function showActiveShares() {
  if (activeShares.size === 0) {
    vscode.window.showInformationMessage('No active shares');
    return;
  }

  const items = Array.from(activeShares.entries()).map(([id, share]) => ({
    label: share.filename || 'Text',
    description: `${share.views.current}/${share.views.max} views`,
    detail: share.url,
    id
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Active shares (select to copy link or cancel)'
  });

  if (selected) {
    const actions = await vscode.window.showQuickPick(['Copy Link', 'Cancel Share'], {
      placeHolder: `${selected.label}`
    });

    if (actions === 'Copy Link') {
      vscode.env.clipboard.writeText(selected.detail!);
      vscode.window.showInformationMessage('Link copied to clipboard');
    } else if (actions === 'Cancel Share') {
      const share = activeShares.get(selected.id);
      if (share) {
        share.process.kill();
        activeShares.delete(selected.id);
        updateStatusBar();
        vscode.window.showInformationMessage('Share cancelled');
      }
    }
  }
}

async function sendSecretCustom(uri?: vscode.Uri) {
  // Prompt for views
  const viewsInput = await vscode.window.showInputBox({
    prompt: 'Number of views allowed',
    value: '1',
    validateInput: (v) => {
      const n = parseInt(v);
      if (isNaN(n) || n < 1 || n > 100) { return 'Enter a number between 1 and 100'; }
      return null;
    }
  });
  if (!viewsInput) { return; }

  // Prompt for timeout
  const timeoutInput = await vscode.window.showInputBox({
    prompt: 'Timeout in seconds (0 for no timeout)',
    value: '0',
    validateInput: (v) => {
      const n = parseInt(v);
      if (isNaN(n) || n < 0) { return 'Enter a number >= 0'; }
      return null;
    }
  });
  if (timeoutInput === undefined) { return; }

  const views = parseInt(viewsInput);
  const timeout = parseInt(timeoutInput);

  await sendSecret(uri, views, timeout);
}

async function sendSecret(uri?: vscode.Uri, viewsOverride?: number, timeoutOverride?: number) {
  const config = vscode.workspace.getConfiguration('send-secret');
  const defaultViews = config.get<number>('defaultViews') || 1;
  const defaultTimeout = config.get<number>('defaultTimeout') || 0;
  const views = viewsOverride ?? defaultViews;
  const timeout = timeoutOverride ?? defaultTimeout;

  const editor = vscode.window.activeTextEditor;
  const selection = editor?.selection;
  const hasSelection = selection && !selection.isEmpty;

  let args: string[] = [];
  let stdin: string | undefined;
  let filename = '';

  // Check for text selection first (highest priority)
  if (hasSelection && editor) {
    stdin = editor.document.getText(selection);
    filename = 'Selection';
  } else if (uri) {
    // Right-clicked a file in explorer (no selection)
    args = [uri.fsPath];
    filename = path.basename(uri.fsPath);

    // Check if it's a .env file
    if (filename.includes('.env')) {
      const confirm = await vscode.window.showWarningMessage(
        `Share ${filename} securely? This file may contain sensitive data.`,
        'Share', 'Cancel'
      );
      if (confirm !== 'Share') { return; }
    }
  } else if (editor) {
    // No selection, no uri - send current file
    args = [editor.document.uri.fsPath];
    filename = path.basename(editor.document.uri.fsPath);
  } else {
    vscode.window.showErrorMessage('No file or selection to send');
    return;
  }

  // Add view count and timeout args
  if (views > 1) { args.push('-n', String(views)); }
  if (timeout > 0) { args.push('-t', String(timeout)); }

  const proc = spawn('npx', ['send-secret', ...args], {
    shell: true,
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  });

  if (stdin) {
    proc.stdin.write(stdin);
    proc.stdin.end();
  }

  const shareId = Date.now().toString();
  let url: string | null = null;
  let outputBuffer = '';
  const retrievedIPs: string[] = [];
  let countdownInterval: NodeJS.Timeout | null = null;
  let remainingSeconds = timeout;

  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'send-secret',
    cancellable: true
  }, async (progress, token) => {
    token.onCancellationRequested(() => {
      if (countdownInterval) { clearInterval(countdownInterval); }
      proc.kill();
      activeShares.delete(shareId);
      updateStatusBar();
    });

    progress.report({ message: 'Starting tunnel...' });

    return new Promise<void>((resolve) => {
      // Helper to format the two-line notification
      const formatMessage = (status: string) => {
        return `✔ Link copied — share with receiver\n${status}`;
      };

      // Helper to format waiting status
      const formatWaitingStatus = () => {
        let msg = 'Waiting for receiver';
        if (views > 1) {
          msg = `Waiting (${retrievedIPs.length}/${views})`;
        }
        if (timeout > 0 && remainingSeconds > 0) {
          const mins = Math.floor(remainingSeconds / 60);
          const secs = remainingSeconds % 60;
          const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
          msg += ` — expires in ${timeStr}`;
        }
        return msg;
      };

      proc.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        outputBuffer += chunk;
        console.log('[send-secret stdout]', chunk);

        // Remove box drawing characters and newlines to find URL
        const cleaned = outputBuffer.replace(/[│╭╮╯╰─\n\r\s]/g, '');
        const urlMatch = cleaned.match(/https:\/\/[^#]+#key=[a-f0-9]+/);
        if (urlMatch && !url) {
          url = urlMatch[0];
          vscode.env.clipboard.writeText(url);
          progress.report({ message: formatMessage(formatWaitingStatus()) });

          activeShares.set(shareId, {
            url,
            filename,
            process: proc,
            views: { current: 0, max: views }
          });
          updateStatusBar();

          // Start countdown timer if timeout is set
          if (timeout > 0) {
            countdownInterval = setInterval(() => {
              remainingSeconds--;
              if (remainingSeconds <= 0) {
                if (countdownInterval) { clearInterval(countdownInterval); }
              }
              progress.report({ message: formatMessage(formatWaitingStatus()) });
            }, 1000);
          }
        }

        // Check for retrieval with view count - match all occurrences
        const allRetrievals = outputBuffer.matchAll(/Retrieved(?: \((\d+)\/(\d+)\))? from ([\d.]+)/g);
        for (const match of allRetrievals) {
          const [, , , ip] = match;
          if (ip && !retrievedIPs.includes(ip)) {
            retrievedIPs.push(ip);
          }
        }

        const share = activeShares.get(shareId);
        if (share) {
          share.views.current = retrievedIPs.length;
        }

        if (outputBuffer.includes('All delivered') || (retrievedIPs.length > 0 && views === 1)) {
          if (countdownInterval) { clearInterval(countdownInterval); }
          const ipList = retrievedIPs.join(', ');
          const msg = views > 1
            ? `Secret retrieved (${retrievedIPs.length}/${views}) from: ${ipList}`
            : `Secret retrieved from ${ipList}`;
          vscode.window.showInformationMessage(msg);
          activeShares.delete(shareId);
          updateStatusBar();
          resolve();
        } else if (retrievedIPs.length > 0 && views > 1) {
          // Multi-view: show progress
          progress.report({ message: formatMessage(`Retrieved (${retrievedIPs.length}/${views}). ${formatWaitingStatus()}`) });
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        console.log('[send-secret stderr]', data.toString());
      });

      proc.on('close', (code) => {
        console.log('[send-secret] process exited with code', code);
        if (countdownInterval) { clearInterval(countdownInterval); }
        activeShares.delete(shareId);
        updateStatusBar();
        resolve();
      });
    });
  });
}

export function deactivate() {
  // Kill all active processes
  for (const share of activeShares.values()) {
    share.process.kill();
  }
}
