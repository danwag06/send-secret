import { parseArgs } from "node:util";
import { readFileSync, existsSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import boxen from "boxen";
import { encrypt, generateKey } from "./crypto.js";
import { createServer } from "./server.js";
import { startTunnel } from "./tunnel.js";
import { receiveSecret } from "./receive.js";
import { formatBytes } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));
const VERSION = pkg.version;
const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

// Styled help text
const HELP_TEXT = `
${pc.bold("send-secret")} ${pc.dim(`v${VERSION}`)}
${pc.dim("P2P encrypted secret sharing")}

${pc.cyan("USAGE")}
  ${pc.green("send-secret")}                      Send a secret (interactive)
  ${pc.green("send-secret")} ${pc.yellow("<file>")}               Send a file
  ${pc.green("cat secret |")} ${pc.green(
  "send-secret"
)}         Send piped input
  ${pc.green("send-secret receive")} ${pc.yellow(
  "<url>"
)}        Receive via CLI
  ${pc.green("send-secret receive")} ${pc.yellow("<url>")} ${pc.dim(
  "-o f"
)}   Save to file

${pc.cyan("OPTIONS")}
  ${pc.yellow("-h, --help")}       Show this help
  ${pc.yellow("-v, --version")}    Show version
  ${pc.yellow("-r, --receive")}    Receive a secret from URL
  ${pc.yellow("-o, --output")}     Output file (receive mode)
  ${pc.yellow("-t, --timeout")}    Auto-destruct after N seconds (send mode)

${pc.cyan("EXAMPLES")}
  ${pc.dim("$")} send-secret
  ${pc.dim("$")} send-secret ./credentials.json
  ${pc.dim("$")} send-secret -t 300 ./secret.txt  ${pc.dim("# expires in 5 min")}
  ${pc.dim("$")} echo "secret" | send-secret
  ${pc.dim("$")} pbpaste | send-secret
  ${pc.dim("$")} send-secret -r https://...#key=abc  ${pc.dim("# receive shortcut")}
  ${pc.dim("$")} send-secret receive https://abc.trycloudflare.com/s/xyz#key=abc

${pc.cyan("MORE INFO")}
  ${pc.underline("https://github.com/danwagner/send-secret")}
`;

export async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      output: { type: "string", short: "o" },
      timeout: { type: "string", short: "t" },
      receive: { type: "string", short: "r" },
    },
  });

  if (values.help) {
    console.log(HELP_TEXT);
    return;
  }

  if (values.version) {
    console.log(`${pc.bold("send-secret")} ${pc.dim(`v${VERSION}`)}`);
    return;
  }

  // Receive mode (via -r flag or "receive" command)
  if (values.receive) {
    await receiveSecret(values.receive, values.output);
    return;
  }
  if (positionals[0] === "receive") {
    await receiveSecret(positionals[1], values.output);
    return;
  }

  // Send mode
  const timeout = values.timeout ? parseInt(values.timeout, 10) : null;
  if (values.timeout && (isNaN(timeout) || timeout <= 0)) {
    console.log(`\n${pc.red("✖")} ${pc.red("Error:")} Invalid timeout value`);
    process.exit(1);
  }
  await sendSecret(positionals[0], timeout);
}

async function sendSecret(filePath, timeoutSeconds = null) {
  let data;
  let filename = null;

  console.log();

  if (filePath && existsSync(filePath)) {
    // Send a file
    const stats = statSync(filePath);
    // Check file size before reading
    if (stats.size > MAX_SIZE) {
      console.log(
        `${pc.red("✖")} ${pc.red("Error:")} File too large (max ${formatBytes(MAX_SIZE)})`
      );
      process.exit(1);
    }
    data = readFileSync(filePath);
    filename = basename(filePath);
    console.log(
      `${pc.cyan("○")} Encrypting ${pc.bold(filename)} ${pc.dim(
        `(${formatBytes(stats.size)})`
      )}`
    );
  } else if (!process.stdin.isTTY) {
    // Piped input
    data = await readStdin();
    console.log(
      `${pc.cyan("○")} Encrypting piped input ${pc.dim(
        `(${formatBytes(data.length)})`
      )}`
    );
  } else {
    // Interactive input
    console.log(`${pc.dim("Enter secret, press Enter, then Ctrl+D:")}`);
    data = await readInteractiveInput();
    console.log(
      `${pc.cyan("○")} Encrypting ${pc.dim(`(${formatBytes(data.length)})`)}`
    );
  }

  if (data.length === 0) {
    console.log(`\n${pc.red("✖")} ${pc.red("Error:")} No data to send`);
    process.exit(1);
  }

  // Check size for piped/interactive input
  if (data.length > MAX_SIZE) {
    console.log(
      `${pc.red("✖")} ${pc.red("Error:")} Data too large (max ${formatBytes(MAX_SIZE)})`
    );
    process.exit(1);
  }

  // Encrypt
  const key = generateKey();
  const encryptedBlob = encrypt(data, key);

  // Start server
  let stopTunnel = () => {};
  let waitingSpinner = null;

  const { server, id } = createServer({
    encryptedBlob,
    filename,
    onDelivered: () => {
      if (waitingSpinner) {
        waitingSpinner.success({
          text: pc.green("Secret delivered and deleted"),
        });
      } else {
        console.log(
          `\n${pc.green("✔")} ${pc.green("Secret delivered and deleted")}`
        );
      }
      server.close();
      stopTunnel();
      printDonation();
      process.exit(0);
    },
  });

  // Handle Ctrl+C at any point
  process.on("SIGINT", () => {
    if (waitingSpinner) {
      waitingSpinner.stop();
    }
    console.log(`\n${pc.yellow("○")} Cancelled. Secret was never delivered.`);
    server.close();
    stopTunnel();
    process.exit(0);
  });

  // Find available port and start server
  const port = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });

  // Start tunnel with spinner
  const tunnelSpinner = createSpinner("Starting tunnel...").start();

  try {
    const tunnel = await startTunnel(port);
    stopTunnel = tunnel.stop;
    tunnelSpinner.success({ text: "Tunnel ready" });

    // Build full URL with key in fragment
    const fullUrl = `${tunnel.url}/s/${id}#key=${key}`;

    // Display URL in a nice box
    console.log(
      boxen(fullUrl, {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 1, bottom: 0, left: 0, right: 0 },
        borderStyle: "round",
        borderColor: "cyan",
        title: "Share this link",
        titleAlignment: "left",
      })
    );

    if (!timeoutSeconds) {
      console.log(pc.dim("  Keep terminal open until received\n"));
    } else {
      console.log(); // Just add spacing
    }

    // Start waiting spinner
    if (timeoutSeconds) {
      // Show countdown timer
      let remaining = timeoutSeconds;
      const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
      };
      waitingSpinner = createSpinner(
        `Waiting for receiver... ${pc.dim(`(expires in ${formatTime(remaining)})`)}`
      ).start();

      const countdownInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(countdownInterval);
          if (waitingSpinner) {
            waitingSpinner.error({ text: pc.yellow("Timeout - secret expired") });
          }
          console.log(
            `\n${pc.yellow("○")} Secret auto-destructed after ${timeoutSeconds}s`
          );
          server.close();
          stopTunnel();
          process.exit(0);
        } else {
          waitingSpinner.update({
            text: `Waiting for receiver... ${pc.dim(`(expires in ${formatTime(remaining)})`)}`,
          });
        }
      }, 1000);
    } else {
      waitingSpinner = createSpinner("Waiting for receiver...").start();
    }
  } catch (err) {
    tunnelSpinner.error({ text: "Tunnel failed" });
    console.log(`\n${pc.red("✖")} ${pc.red("Error:")} ${err.message}`);
    console.log(pc.dim("  Make sure you have an internet connection."));
    server.close();
    process.exit(1);
  }

}

async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readInteractiveInput() {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: stdin,
      output: stdout,
      terminal: true,
      historySize: 0,
      prompt: "",
    });

    const lines = [];

    // Handle Ctrl+C during input
    rl.on("SIGINT", () => {
      rl.close();
      console.log(`\n${pc.yellow("○")} Cancelled.`);
      process.exit(0);
    });

    rl.on("line", (line) => {
      lines.push(line);
    });

    rl.on("close", () => {
      const content = lines.join("\n");
      resolve(Buffer.from(content));
    });
  });
}

function printDonation() {
  console.log();
  console.log(
    boxen(
      `${pc.bold("send-secret")} is free and open source.\n\n` +
        `If it saved you time, consider contributing:\n` +
        `${pc.cyan("https://donate.stripe.com/3cI00jgSx2gvdd82Sk9Ve0f")}\n\n` +
        `${pc.dim("BTC:")}  ${pc.dim(
          "bc1qgel38lkck8vk4hpqjlzhjwg8rv39auahqxz7mg"
        )}\n` +
        `${pc.dim("ETH:")}  ${pc.dim(
          "0x8e9CeeaeF8beC7dfCa6D02B1c83f341217AA82F5"
        )}\n` +
        `${pc.dim("SOL:")}  ${pc.dim(
          "FsT8cZ6naBc7vAmqt3bEzKreLgAHT9HaWrmC32wvii15"
        )}\n` +
        `${pc.dim("BCH:")}  ${pc.dim(
          "qpykcppaaazfkt5dd3n6stswnxn4ehyxxc8m0z43v3"
        )}\n` +
        `${pc.dim("BSV:")}  ${pc.dim("1QFxtdewusnJsgyWWLviiZKEsDSsb77HPN")}`,
      {
        padding: 1,
        margin: { top: 0, bottom: 1, left: 0, right: 0 },
        borderStyle: "round",
        borderColor: "dim",
        dimBorder: true,
      }
    )
  );
}
