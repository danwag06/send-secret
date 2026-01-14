import http from "node:http";
import { generateId } from "./utils.js";
import { getReceiverPage } from "./template.js";

/**
 * Create an HTTP server that serves the encrypted secret
 * @param {Object} options
 * @param {Buffer} options.encryptedBlob - The encrypted data
 * @param {string} options.filename - Original filename (for file downloads)
 * @param {function} options.onDelivered - Callback when secret is retrieved
 * @returns {{server: http.Server, id: string}}
 */
export function createServer({ encryptedBlob, filename, onDelivered }) {
  const id = generateId();
  let delivered = false;

  const server = http.createServer((req, res) => {
    // Parse URL
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Security headers applied to all responses
    const securityHeaders = {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "X-XSS-Protection": "1; mode=block",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    };

    // Serve decryption page
    if (url.pathname === `/s/${id}`) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Connection": "close",
        ...securityHeaders,
      });
      res.end(getReceiverPage({ id, filename }));
      return;
    }

    // Serve metadata (filename info for CLI receive)
    if (url.pathname === `/s/${id}/meta`) {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        ...securityHeaders,
      });
      res.end(JSON.stringify({ filename: filename || null }));
      return;
    }

    // Serve encrypted blob (once)
    if (url.pathname === `/s/${id}/blob`) {
      if (delivered) {
        res.writeHead(410, { "Content-Type": "text/plain", ...securityHeaders });
        res.end("Secret already retrieved");
        return;
      }

      delivered = true;
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": encryptedBlob.length,
        "Cache-Control": "no-store",
        ...securityHeaders,
      });
      res.end(encryptedBlob);

      // Notify and cleanup after a short delay
      setTimeout(() => onDelivered(), 100);
      return;
    }

    // 404 for everything else
    res.writeHead(404, { "Content-Type": "text/plain", ...securityHeaders });
    res.end("Not found");
  });

  return { server, id };
}
