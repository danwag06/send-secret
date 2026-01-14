<p align="center">
  <img src="https://ordfs.network/content/25743fecc82a4512e35f213a3442b8f367f2bec57221ba11a3f662435fcf414f_0" alt="send-secret" width="600">
</p>

<p align="center">
  <strong>Stop sharing secrets through Slack, email, and text messages.</strong>
</p>

<p align="center">
  P2P encrypted secret sharing. No servers. No accounts. No trust required.
</p>

<p align="center">
  <a href="#install">Install</a> •
  <a href="#why">Why</a> •
  <a href="#usage">Usage</a> •
  <a href="#security">Security</a> •
  <a href="#support">Support</a>
</p>

---

## The Problem

Every day, developers share API keys, database credentials, and secrets through:

- **Slack DMs** — stored forever on Slack's servers
- **Email** — sitting in inboxes indefinitely
- **Text messages** — backed up to iCloud, Google, carrier logs
- **Notion/Docs** — accessible to anyone with the link
- **`.env` files in repos** — we've all seen it

These secrets persist. They get indexed. They get breached.

## The Solution

**send-secret** creates a one-time, encrypted link that self-destructs after viewing.

```bash
$ echo "sk_live_abc123" | npx send-secret
```

- **Zero trust** — Your machine encrypts the secret. The key never leaves the URL fragment.
- **Zero persistence** — Deleted from memory the moment it's viewed. Nothing stored anywhere.
- **Zero accounts** — No signups, no logins, no third-party services holding your secrets.
- **Zero install** — Works with `npx`. No dependencies to audit.

---

## Install

```bash
npm i -g send-secret
```

Or use without installing:

```bash
npx send-secret
```

---

## VS Code Extension

Share secrets directly from your editor:

```bash
ext install danwag06.send-secret
```

Or search **"send-secret"** in the VS Code extensions marketplace.

Right-click any file or selection → **Send Secret** → link copied to clipboard.

---

## Usage

### Send a text secret

```bash
$ send-secret
Enter secret, press Enter, then Ctrl+D:
sk_live_abc123xyz
^D
○ Encrypting (18 B)
✔ Tunnel ready

╭ Share this link ─────────────────────────────────────────────────────────────╮
│ https://abc123.trycloudflare.com/s/x7k2m#key=9f86d081884c7d659a2feaa0c       │
╰──────────────────────────────────────────────────────────────────────────────╯
  Keep terminal open until received
  Recipient can also run: npx send-secret -r <link>

◐ Waiting for receiver...
✔ Retrieved from 73.162.45.99
```

### Send a file

```bash
$ send-secret ./credentials.json

○ Encrypting credentials.json (4.2 KB)
✔ Tunnel ready

╭ Share this link ─────────────────────────────────────────────────────────────╮
│ https://abc123.trycloudflare.com/s/x7k2m#key=9f86d081884c7d659a2feaa0c       │
╰──────────────────────────────────────────────────────────────────────────────╯
  Keep terminal open until received
  Recipient can also run: npx send-secret -r <link>

◐ Waiting for receiver...
✔ Retrieved from 73.162.45.99
```

### Send via pipe

```bash
$ cat .env | send-secret

$ echo "secret_token" | send-secret

$ pbpaste | send-secret
```

### Auto-destruct timeout

Set an expiration time for undelivered secrets:

```bash
$ send-secret -t 300 ./secret.txt    # Expires in 5 minutes
$ send-secret --timeout 60           # Expires in 60 seconds

◐ Waiting for receiver... (expires in 4m 32s)
```

If the receiver doesn't retrieve the secret before the timeout, it's automatically deleted.

### Multiple recipients

Share with multiple people using a single link:

```bash
$ send-secret -n 3 ./credentials.json    # Allow 3 views
$ send-secret -n 5 -t 300 ./secret.txt   # 5 views OR 5 minutes

◐ Waiting for receivers... (0/3)
✔ Retrieved (1/3) from 73.162.45.99
✔ Retrieved (2/3) from 98.45.123.12
✔ Retrieved (3/3) from 73.162.45.99 — All delivered
```

The sender sees each retrieval with the IP address for visibility.

### Receive via CLI

Receivers can open the link in a browser, or use the CLI:

```bash
$ send-secret -r <url>
# or
$ send-secret receive <url>

◐ Fetching secret...
✔ Secret retrieved

╭─────────────────────╮
│ sk_live_abc123xyz   │
╰─────────────────────╯
```

Files are automatically saved with timestamps to prevent overwrites:

```bash
$ send-secret receive <url>

◐ Fetching secret...
✔ Secret retrieved

✔ File saved. View with:
  cat "/Users/you/.send-secret/received/credentials_2025-01-14T10-30-45.json"
```

Use `-o` to specify where to save:

```bash
$ send-secret -r <url> -o ./              # Save to current dir with original filename
$ send-secret -r <url> -o ./secrets/      # Save to specific directory
$ send-secret -r <url> -o ./myfile.json   # Save with custom filename
```

---

## How It Works

```
Sender                         Receiver
  │                               │
  ├─ Encrypt secret locally       │
  ├─ Start local server           │
  ├─ Open Cloudflare tunnel       │
  ├─ Generate URL with key        │
  │   in fragment                 │
  │                               │
  ├─────── Share URL ────────────▶│
  │                               │
  │◀─────── Receiver opens URL ───┤
  │                               │
  ├─ Serve HTML + encrypted blob  │
  │                               ├─ Decrypt in browser
  │                               ├─ Display secret
  ├─ Delete blob from memory      │
  ├─ Close tunnel                 │
  ├─ Exit                         │
  │                               │
  ▼                               ▼
Done                            Done
```

The decryption key lives in the URL fragment (`#key=...`), which is **never sent to any server** — not even Cloudflare. Only someone with the full URL can decrypt the secret.

---

## Security

| Threat             | Protected | How                                               |
| ------------------ | --------- | ------------------------------------------------- |
| Server sees secret | ✓         | Encrypted before leaving sender's machine         |
| Man-in-the-middle  | ✓         | Decryption key in URL fragment, never transmitted |
| Secret persists    | ✓         | Deleted from memory immediately after viewing     |
| Sender's disk      | ✓         | Never written to disk, only held in memory        |
| Brute force        | ✓         | AES-256-GCM with 256-bit key (2²⁵⁶ possibilities) |

### What's NOT Protected

- **Link interception** — If someone gets the full URL, they can view the secret
- **Receiver's machine** — Once decrypted, it's in their browser/terminal
- **Metadata** — Cloudflare sees IPs, timing, and payload size (but not content)

### Encryption Details

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key**: 256-bit cryptographically random
- **IV**: 96-bit random per encryption
- **Key transmission**: URL fragment only (never sent to server)

---

## Requirements

- Node.js 18+
- Internet connection (for Cloudflare tunnel)

---

## License

Apache-2.0

---

## Support

If send-secret saves you time, consider supporting development:

**[Donate via Stripe](https://donate.stripe.com/3cI00jgSx2gvdd82Sk9Ve0f)**

**Crypto:**

| Currency | Address                                        |
| -------- | ---------------------------------------------- |
| BTC      | `bc1qgel38lkck8vk4hpqjlzhjwg8rv39auahqxz7mg`   |
| ETH      | `0x8e9CeeaeF8beC7dfCa6D02B1c83f341217AA82F5`   |
| SOL      | `FsT8cZ6naBc7vAmqt3bEzKreLgAHT9HaWrmC32wvii15` |
| BCH      | `qpykcppaaazfkt5dd3n6stswnxn4ehyxxc8m0z43v3`   |
| BSV      | `1QFxtdewusnJsgyWWLviiZKEsDSsb77HPN`           |
