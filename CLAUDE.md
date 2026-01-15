# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test          # Run all tests with vitest
npm run test:watch # Run tests in watch mode

# VS Code Extension (in extension/ directory)
cd extension && npm run compile   # Build extension
cd extension && npm run package   # Package .vsix
cd extension && npm run publish   # Publish to marketplace
```

## Architecture

**send-secret** is a P2P encrypted secret sharing CLI tool and VS Code extension. Secrets are encrypted locally, served via a temporary Cloudflare tunnel, and self-destruct after viewing.

### Core Flow

1. **Sender** encrypts data locally with AES-256-GCM
2. Local HTTP server starts, Cloudflare tunnel exposes it
3. URL generated with decryption key in fragment (`#key=...`) - key never sent to any server
4. **Receiver** fetches encrypted blob, decrypts in browser/CLI
5. Server deletes blob from memory, closes tunnel

### Source Structure

```
src/
├── cli.js       # Main CLI entry, argument parsing, send/receive orchestration
├── crypto.js    # AES-256-GCM encrypt/decrypt with 256-bit keys
├── server.js    # HTTP server serving encrypted blobs (with view counting)
├── tunnel.js    # Cloudflare tunnel wrapper
├── receive.js   # CLI receive mode (fetches and decrypts)
├── template.js  # Browser decryption page HTML
├── utils.js     # ID generation, byte formatting
└── index.js     # Public API exports for programmatic use

bin/
└── send-secret.js  # CLI entrypoint

extension/
└── src/extension.ts  # VS Code extension (spawns CLI process)
```

### Key Design Decisions

- **No Buffer in browser**: The template.js browser code uses Web Crypto API, not Node.js Buffer
- **Fragment-based key**: The `#key=...` fragment is never sent to servers (browser security feature)
- **Single-use by default**: `maxViews` defaults to 1, blob deleted after first fetch
- **100MB limit**: MAX_SIZE enforced to prevent memory issues

### Server Endpoints

- `GET /s/{id}` - Decryption HTML page
- `GET /s/{id}/meta` - JSON metadata (filename)
- `GET /s/{id}/blob` - Encrypted blob (single-use, returns 410 after maxViews)

## Testing

Tests use vitest. The crypto module has comprehensive tests for encrypt/decrypt, key generation, and tamper detection. Server tests verify the HTTP endpoints and view counting.

Run a single test file:
```bash
npx vitest run test/crypto.test.js
```

## VS Code Extension

The extension (`extension/`) spawns `npx send-secret` as a child process and parses stdout to extract the URL. It manages active shares via a status bar item and tracks view counts by parsing retrieval messages from the CLI output.
