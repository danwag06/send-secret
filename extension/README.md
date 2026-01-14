# send-secret for VS Code

Share secrets via self-destructing encrypted links, directly from VS Code.

## Features

- **Right-click to share** - Send any file or selected text as an encrypted, one-time link
- **Selection priority** - If text is selected, sends just the selection; otherwise sends the whole file
- **Custom options** - Set view count and timeout on-the-fly
- **Countdown timer** - See time remaining in the notification when using timeouts
- **Multi-view tracking** - See all IPs that retrieved your secret
- **Status bar** - Track active shares at a glance
- **.env detection** - Warning prompt when sharing potentially sensitive files

## Usage

### Send a file

1. Right-click any file in the explorer
2. Select **"Send Secret"** or **"Send Secret (Custom...)"**
3. Link is copied to clipboard
4. Share the link - recipient opens it once, then it self-destructs

### Send selected text

1. Select text in the editor
2. Right-click and select **"Send Secret"**
3. Or use keyboard shortcut: `Cmd+Shift+.` (Mac) / `Ctrl+Shift+.` (Windows/Linux)

Selection always takes priority - if you have text selected, only the selection is sent.

### Custom views and timeout

Use **"Send Secret (Custom...)"** from the right-click menu or command palette to:
- Set a custom number of views (1-100)
- Set a timeout in seconds (auto-destructs if not retrieved)

Quick presets are also available:
- **"Send Secret (3 views)"**
- **"Send Secret (5 views)"**

### Notifications

The notification shows real-time status:
- `Waiting for receiver — expires in 2m 30s` (with countdown)
- `Retrieved (1/3). Waiting (1/3) — expires in 2m 15s` (multi-view progress)
- Final message shows all IPs: `Secret retrieved (3/3) from: 47.x.x.x, 192.x.x.x`

### Manage active shares

Click the lock icon in the status bar to see all active shares. From there you can:
- Copy the link again
- Cancel a share early

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `send-secret.defaultViews` | 1 | Default number of views allowed |
| `send-secret.defaultTimeout` | 0 | Auto-destruct timeout in seconds (0 = no timeout) |

## Commands

| Command | Description |
|---------|-------------|
| Send Secret | Share with default settings |
| Send Secret (3 views) | Share allowing 3 views |
| Send Secret (5 views) | Share allowing 5 views |
| Send Secret (Custom...) | Prompt for views and timeout |
| Send Secret: Show Active Shares | View/manage active shares |

## Keyboard Shortcut

- **Mac:** `Cmd+Shift+.`
- **Windows/Linux:** `Ctrl+Shift+.`

Customizable in VS Code keyboard shortcuts settings.

## Requirements

- Node.js 18+
- Internet connection (uses Cloudflare tunnels)

## How It Works

1. Your machine encrypts the secret with AES-256-GCM
2. A temporary tunnel opens through Cloudflare
3. You get a URL with the decryption key in the fragment (never sent to any server)
4. Recipient opens the link - their browser decrypts locally
5. Your machine deletes the secret and closes the tunnel

No third party ever has both the encrypted data AND the key.

## Links

- [CLI on npm](https://www.npmjs.com/package/send-secret)
- [GitHub](https://github.com/danwag06/send-secret)
