---
name: receive-secret
version: 0.0.2
description: This skill should be used when the user asks to "receive a secret", "get a shared secret", "download encrypted file", "fetch secret from link", "retrieve secret URL", "save this secret", "grab this secret", "get this file from URL", "download from trycloudflare", "get credentials from URL", "receive encrypted", "save secret to file", "fetch from this link", or provides a send-secret URL (URLs containing trycloudflare.com/s/ and #key= fragment). Receives P2P encrypted secrets and saves them to files without exposing content to the agent.
allowed-tools: Bash(npx send-secret*), Bash(mkdir *)
---

# Receive Secret

Receive P2P encrypted secrets from send-secret links. Secrets are decrypted and saved directly to files, keeping sensitive content out of the agent's context.

## Security Model for Agentic Use

**Critical constraint**: The agent must NEVER display or read received secret content.

| Action | Safe | Reason |
|--------|------|--------|
| `send-secret -r "url" -o ./file.txt` | Yes | Saves to file, agent sees only path |
| `send-secret -r "url"` | NO | Text secrets display in terminal |
| `Read` on saved file | NO | Would load secret into context |
| `cat` saved file | NO | Would display secret to agent |

**Key insight**: Without `-o`, text secrets display in terminal. The `-o` flag requires a **specific filename**, not a directory path.

## URL Recognition

send-secret URLs have this pattern:
```
https://<random>.trycloudflare.com/s/<id>#key=<64-hex-chars>
```

Example:
```
https://abc-xyz-123.trycloudflare.com/s/k7m2p#key=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
```

The `#key=...` fragment is essential - it contains the 256-bit decryption key.

## Command Reference

```bash
# Save to specific file (REQUIRED - must be a filename, not directory)
npx send-secret -r "<url>" -o ./received-secret.txt

# Save with descriptive filename
npx send-secret -r "<url>" -o ./credentials.json

# Save to subdirectory (create dir first, then specify full path)
mkdir -p ./secrets && npx send-secret -r "<url>" -o ./secrets/received.txt

# Alternative syntax
npx send-secret receive "<url>" -o ./secret.txt
```

**Important**: The `-o` flag requires a **specific filename**. Using a directory path like `-o ./` or `-o ./secrets/` will fail with "EISDIR: illegal operation on a directory".

**Always quote the URL** - it contains special characters (`#`, `=`).

## Workflow

1. **Recognize URL** in user message (trycloudflare.com + #key=)
2. **Determine save location**:
   - If user specifies a path, use it (ensure it's a filename, not directory)
   - Otherwise, default to `./received-secret.txt`
3. **Create parent directory** if needed: `mkdir -p ./secrets/`
4. **Run receive command** with `-o <filename>` (must be a file path, not directory)
5. **Report file location** from CLI output
6. **Do not read or display** the saved file - task is complete

## Output Parsing

Successful receive shows:
```
◐ Fetching secret...
✔ Secret retrieved

✔ File saved. View with:
  cat "/Users/you/project/credentials.json"
```

Extract the file path from the output. Report this path to the user. **Never execute the suggested `cat` command.**

For text secrets (no filename):
```
◐ Fetching secret...
✔ Secret retrieved

✔ Saved to ./received-secret.txt
```

## Default Behavior Without -o

| Secret Type | Without -o | With -o |
|-------------|------------|---------|
| File | Saves to `~/.send-secret/received/` with timestamp | Saves to specified path |
| Text | **Displays in terminal** (UNSAFE) | Saves to specified file |

**Always use -o** to maintain control and prevent accidental exposure.

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "EISDIR: illegal operation on a directory" | `-o` path is a directory, not file | Use specific filename like `-o ./secret.txt` |
| "This secret has already been viewed" | Single-use link consumed | Request new link from sender |
| "Failed to fetch: 530" | Sender closed terminal/tunnel expired | Ask sender to reshare |
| "Missing decryption key in URL" | URL truncated, missing #key= | Get complete URL |
| "Invalid decryption key format" | Key corrupted or incomplete | Verify full 64 hex chars |
| Connection refused/timeout | Sender closed terminal | Ask sender to reshare |
| "Failed to fetch: 404" | Invalid secret ID | Verify URL is correct |

## Example Interactions

### Basic receive
User: "Can you get this secret? https://abc.trycloudflare.com/s/xyz#key=abc123..."

```bash
npx send-secret -r "https://abc.trycloudflare.com/s/xyz#key=abc123..." -o ./received-secret.txt
```

Response: "Secret received and saved to ./received-secret.txt"

### Receive to specific file
User: "Download this to credentials.json: [url]"

```bash
npx send-secret -r "[url]" -o ./credentials.json
```

Response: "Secret received and saved to ./credentials.json"

### Receive to subdirectory
User: "Download this to my secrets folder: [url]"

```bash
mkdir -p ./secrets && npx send-secret -r "[url]" -o ./secrets/received.txt
```

Response: "Secret received and saved to ./secrets/received.txt"

## What NOT To Do

```bash
# NEVER use a directory path with -o (causes EISDIR error)
npx send-secret -r "url" -o ./           # WRONG: ./ is a directory
npx send-secret -r "url" -o ./secrets/   # WRONG: ./secrets/ is a directory

# NEVER omit -o for text secrets
npx send-secret -r "url"  # WRONG: may display in terminal

# NEVER read the saved file
cat ./received-secret.json  # WRONG: exposes content
Read ./received-secret.json  # WRONG: loads into context

# NEVER store URL in variable then expand
url="https://..." && npx send-secret -r $url  # May break on special chars

# NEVER commit received secret files to git
git add ./received-secret.txt  # WRONG: exposes secret in repo history
git add .                       # WRONG: may include secret files
```

## After Receiving

**Do not commit secret files.** After receiving, remind the user:
- Add the file to `.gitignore` if it should stay in the project
- Move it outside the repo if it's temporary
- Never use `git add .` which may accidentally include secrets

## Related Skills

- **send-secret-file** - For sending files securely
- **send-secret-clipboard** - For sharing clipboard contents (macOS)
