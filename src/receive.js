import { decrypt } from "./crypto.js";
import { writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import pc from "picocolors";
import { createSpinner } from "nanospinner";
import boxen from "boxen";

/**
 * Receive and decrypt a secret from a URL
 * @param {string} url - The full URL including key fragment
 * @param {string} [outputPath] - Optional path to save file
 */
export async function receiveSecret(url, outputPath) {
  console.log();

  if (!url) {
    console.log(`${pc.red("✖")} ${pc.red("Error:")} URL required`);
    console.log(pc.dim("  Usage: send-secret receive <url>"));
    process.exit(1);
  }

  const spinner = createSpinner("Fetching secret...").start();

  try {
    // Parse URL
    const parsed = new URL(url);
    const key = new URLSearchParams(parsed.hash.slice(1)).get("key");

    if (!key) {
      throw new Error("Missing decryption key in URL");
    }

    // Validate key format (must be 64 hex characters = 256 bits)
    if (!/^[a-fA-F0-9]{64}$/.test(key)) {
      throw new Error("Invalid decryption key format");
    }

    // Build URLs (without fragment)
    const baseUrl = `${parsed.origin}${parsed.pathname}`;
    const metaUrl = `${baseUrl}/meta`;
    const blobUrl = `${baseUrl}/blob`;

    // Fetch metadata first to get filename
    const metaResponse = await fetch(metaUrl);
    let filename = null;
    if (metaResponse.ok) {
      const meta = await metaResponse.json();
      // Sanitize filename to prevent path traversal attacks
      filename = meta.filename ? basename(meta.filename) : null;
    }

    const response = await fetch(blobUrl);

    if (!response.ok) {
      if (response.status === 410) {
        throw new Error("This secret has already been viewed");
      }
      throw new Error(
        `Failed to fetch: ${response.status} ${response.statusText}`
      );
    }

    const encryptedData = Buffer.from(await response.arrayBuffer());

    // Decrypt
    spinner.update({ text: "Decrypting..." });
    const decrypted = decrypt(encryptedData, key);

    spinner.success({ text: "Secret retrieved" });

    // Output - determine save path
    if (filename) {
      // File mode: save to temp folder or specified path
      let savePath = outputPath;
      if (!savePath) {
        const receivedDir = join(homedir(), ".send-secret", "received");
        mkdirSync(receivedDir, { recursive: true });
        // Add timestamp to prevent overwriting
        const ext = filename.includes(".")
          ? filename.slice(filename.lastIndexOf("."))
          : "";
        const base = filename.includes(".")
          ? filename.slice(0, filename.lastIndexOf("."))
          : filename;
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19);
        savePath = join(receivedDir, `${base}_${timestamp}${ext}`);
      } else {
        // If outputPath is a directory (or ends with /), append the original filename
        const isDir =
          outputPath.endsWith("/") ||
          (existsSync(outputPath) && statSync(outputPath).isDirectory());
        if (isDir) {
          mkdirSync(outputPath, { recursive: true });
          savePath = join(outputPath, filename);
        }
      }

      writeFileSync(savePath, decrypted);
      console.log(`\n${pc.green("✔")} File saved. View with:`);
      console.log(`  ${pc.cyan(`cat "${savePath}"`)}\n`);
    } else {
      // Text mode: display in terminal or save to file
      if (outputPath) {
        writeFileSync(outputPath, decrypted);
        console.log(`\n${pc.green("✔")} Saved to ${pc.bold(outputPath)}`);
      } else {
        console.log(
          boxen(decrypted.toString(), {
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            margin: { top: 1, bottom: 1, left: 0, right: 0 },
            borderStyle: "round",
            borderColor: "green",
            dimBorder: true,
          })
        );
      }
    }

    // CTA
    console.log(pc.dim("  Start sending secrets securely:"));
    console.log(`  ${pc.green("npx send-secret")}\n`);
  } catch (err) {
    spinner.error({ text: "Failed" });
    console.log(`\n${pc.red("✖")} ${pc.red("Error:")} ${err.message}`);
    process.exit(1);
  }
}
