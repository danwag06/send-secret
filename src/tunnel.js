import { tunnel } from "cloudflared";

/**
 * Start a Cloudflare tunnel to expose a local port
 * @param {number} port - Local port to expose
 * @returns {Promise<{url: string, stop: () => void}>}
 */
export async function startTunnel(port) {
  const result = tunnel({ "--url": `localhost:${port}` });

  // The URL is a promise that resolves when the tunnel is ready
  const url = await result.url;

  return {
    url,
    stop: result.stop,
  };
}
