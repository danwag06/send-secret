---
name: send-secret
version: 0.0.1
description: This skill should be used when the user asks to "share a secret", "send secret", "share credentials", "share password", "share securely", "encrypted sharing", "one-time secret link", "self-destructing message", "secure file transfer", or mentions "send-secret" without specifying file/clipboard/receive. Routes to the appropriate specialized skill based on context.
allowed-tools: Bash(npx send-secret*)
---

# Send Secret - Secure P2P Sharing

send-secret enables zero-trust, one-time encrypted sharing. Secrets are encrypted locally with AES-256-GCM and served via temporary Cloudflare tunnels. The decryption key stays in the URL fragment (never sent to servers).

## Quick Reference

| Scenario | Skill to Use |
|----------|--------------|
| User has a **file path** | **send-secret-file** |
| User has content in **clipboard** | **send-secret-clipboard** (macOS) |
| User has a **trycloudflare URL** | **receive-secret** |
| User just says "share a secret" | Ask what they want to share |

## Routing Logic

### 1. User provides a file path
→ Use **send-secret-file** skill

Example triggers:
- "Send my .env file securely"
- "Share credentials.json with teammate"
- "Encrypt and send this config file"

### 2. User mentions clipboard
→ Use **send-secret-clipboard** skill (macOS only)

Example triggers:
- "Share what I copied"
- "Send my clipboard securely"
- "I copied a password, share it"

### 3. User provides a trycloudflare URL
→ Use **receive-secret** skill

URL pattern: `https://*.trycloudflare.com/s/*#key=*`

Example triggers:
- "Get this secret: https://xyz.trycloudflare.com/s/abc#key=..."
- "Download from this link"
- "Receive this encrypted file"

### 4. User is vague
→ Ask for clarification

Example response:
"I can help you share secrets securely. What would you like to share?
- A **file** (I'll need the file path)
- Something in your **clipboard** (copy it first, then I'll send it)
- Or do you have a **link** to receive a secret from?"

## Security Principles

**Critical for all send-secret operations:**

1. **Never read secret content** - Agent handles paths/URLs only
2. **Never display received secrets** - Always save to file with `-o`
3. **Never commit secrets** - Remind users about `.gitignore`
4. **Never pipe content through agent** - Use direct file paths or `pbpaste |`

## CLI Quick Reference

```bash
# Send a file
npx send-secret <filepath>

# Send clipboard (macOS)
pbpaste | npx send-secret

# Receive to file
npx send-secret -r "<url>" -o ./filename.txt

# Options
-n <count>    # Allow multiple views
-t <seconds>  # Auto-expire timeout
-o <file>     # Output path for receiving
```

## Common Workflows

### Onboarding new team member
1. User: "I need to share our API keys with the new dev"
2. Clarify: File or clipboard?
3. If file: `npx send-secret ./api-keys.env`
4. Share URL, remind to keep terminal open

### Receiving shared credentials
1. User provides trycloudflare URL
2. Use receive-secret skill
3. `npx send-secret -r "<url>" -o ./credentials.txt`
4. Remind about `.gitignore`

### Quick password share
1. User: "Share my copied password"
2. Confirm they've copied it
3. `pbpaste | npx send-secret -t 120`
4. Share URL with timeout info
