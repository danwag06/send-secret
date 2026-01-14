import http from "node:http";
import { generateId } from "./utils.js";
import { getReceiverPage } from "./template.js";

/**
 * Create an HTTP server that serves the encrypted secret
 * @param {Object} options
 * @param {Buffer} options.encryptedBlob - The encrypted data
 * @param {string} options.filename - Original filename (for file downloads)
 * @param {number} options.maxViews - Maximum number of views allowed (default: 1)
 * @param {function} options.onView - Callback when secret is retrieved
 * @returns {{server: http.Server, id: string}}
 */
export function createServer({ encryptedBlob, filename, maxViews = 1, onView }) {
  const id = generateId();
  let viewCount = 0;

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
        "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
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

    // Serve encrypted blob (up to maxViews times)
    if (url.pathname === `/s/${id}/blob`) {
      if (viewCount >= maxViews) {
        res.writeHead(410, { "Content-Type": "text/plain", ...securityHeaders });
        res.end("Secret already retrieved");
        return;
      }

      // Get real IP (Cloudflare tunnel passes it in headers)
      const ip = req.headers["cf-connecting-ip"]
        || req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
        || req.socket.remoteAddress;

      viewCount++;
      const done = viewCount >= maxViews;

      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": encryptedBlob.length,
        "Cache-Control": "no-store",
        ...securityHeaders,
      });
      res.end(encryptedBlob);

      // Notify after a short delay
      setTimeout(() => onView({ current: viewCount, max: maxViews, done, ip }), 100);
      return;
    }

    // 404 for everything else
    res.writeHead(404, { "Content-Type": "text/plain", ...securityHeaders });
    res.end("Not found");
  });

  return { server, id };
}
