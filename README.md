<p align="center">
  <img src="./assets/banner.png" alt="send-secret" width="600">
</p>

<p align="center">
  P2P encrypted secret sharing. No servers. No accounts. No trust required.
</p>

---

Your machine hosts the secret via a temporary tunnel. The receiver opens a link, decrypts in their browser, and it's gone. Nothing is ever stored on a third party.

## Install

```bash
npm i -g send-secret
```

Or use without installing:

```bash
npx send-secret
```

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

◐ Waiting for receiver...
✔ Secret delivered and deleted
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

◐ Waiting for receiver...
✔ Secret delivered and deleted
```

### Send via pipe

```bash
$ cat .env | send-secret

$ echo "secret_token" | send-secret

$ pbpaste | send-secret
```

### Auto-destruct timeout

Set an expiration time for undelivered secrets with a live countdown:

```bash
$ send-secret -t 300 ./secret.txt    # Expires in 5 minutes
$ send-secret --timeout 60           # Expires in 60 seconds

◐ Waiting for receiver... (expires in 4m 32s)
```

If the receiver doesn't retrieve the secret before the timeout, it's automatically deleted.

### Receive via CLI (optional)

Receivers can open the link in a browser, or use the CLI:

```bash
$ send-secret -r https://abc123.trycloudflare.com/s/x7k2m#key=9f86d081884c7d659a2feaa0c
# or
$ send-secret receive <url>

◐ Fetching secret...
✔ Secret retrieved

╭─────────────────────╮
│ sk_live_abc123xyz   │
╰─────────────────────╯
```

Files are automatically saved to `~/.send-secret/received/` with timestamps to prevent overwrites:

```bash
$ send-secret receive https://abc123.trycloudflare.com/s/x7k2m#key=9f86d081884c7d659a2feaa0c

◐ Fetching secret...
✔ Secret retrieved

✔ File saved. View with:
  cat "/Users/you/.send-secret/received/credentials_2025-01-14T10-30-45.json"
```

Use `-o` to save to a custom path:

```bash
$ send-secret -r <url> -o ./credentials.json
```

## Security

| Threat             | Protected? | How                                                  |
| ------------------ | ---------- | ---------------------------------------------------- |
| Server sees secret | ✓          | Encrypted before leaving sender's machine            |
| Man-in-the-middle  | ✓          | Decryption key is in URL fragment, never transmitted |
| Secret persists    | ✓          | Deleted from memory immediately after viewing        |
| Sender's disk      | ✓          | Never written to disk, only in memory                |
| Brute force        | ✓          | 256-bit key = 2^256 possibilities                    |

### What's NOT Protected

- **Link interception**: If someone gets the full URL, they can view the secret
- **Receiver's machine**: Once decrypted, it's in their browser/terminal
- **Metadata**: Cloudflare can see IPs, timing, and payload size

## Requirements

- Node.js 18+
- Internet connection (for Cloudflare tunnel)

## License

Apache-2.0

## Support

If send-secret is useful to you, consider supporting development:

- [Donate via Stripe](https://donate.stripe.com/3cI00jgSx2gvdd82Sk9Ve0f)

**Crypto:**
| Currency | Address |
|----------|---------|
| BTC | `bc1qgel38lkck8vk4hpqjlzhjwg8rv39auahqxz7mg` |
| ETH | `0x8e9CeeaeF8beC7dfCa6D02B1c83f341217AA82F5` |
| SOL | `FsT8cZ6naBc7vAmqt3bEzKreLgAHT9HaWrmC32wvii15` |
| BCH | `qpykcppaaazfkt5dd3n6stswnxn4ehyxxc8m0z43v3` |
| BSV | `1QFxtdewusnJsgyWWLviiZKEsDSsb77HPN` |
