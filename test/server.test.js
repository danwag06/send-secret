import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "../src/server.js";
import { encrypt, generateKey } from "../src/crypto.js";

describe("server", () => {
  let server;
  let port;

  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
  });

  async function startTestServer(options) {
    const result = createServer(options);
    server = result.server;

    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    port = server.address().port;

    return result;
  }

  it("serves HTML page at /s/{id}", async () => {
    const key = generateKey();
    const encrypted = encrypt(Buffer.from("secret"), key);

    const { id } = await startTestServer({
      encryptedBlob: encrypted,
      onView: () => {},
    });

    const response = await fetch(`http://127.0.0.1:${port}/s/${id}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("send-secret");
  });

  it("serves encrypted blob once at /s/{id}/blob", async () => {
    const key = generateKey();
    const encrypted = encrypt(Buffer.from("secret"), key);

    let viewData = null;
    const { id } = await startTestServer({
      encryptedBlob: encrypted,
      onView: (data) => {
        viewData = data;
      },
    });

    // First request succeeds
    const res1 = await fetch(`http://127.0.0.1:${port}/s/${id}/blob`);
    expect(res1.status).toBe(200);
    expect(res1.headers.get("content-type")).toBe("application/octet-stream");

    const blob = Buffer.from(await res1.arrayBuffer());
    expect(blob).toEqual(encrypted);

    // Wait for onView callback
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(viewData).not.toBeNull();
    expect(viewData.current).toBe(1);
    expect(viewData.max).toBe(1);
    expect(viewData.done).toBe(true);
    expect(viewData.ip).toBeDefined();

    // Second request fails with 410 Gone
    const res2 = await fetch(`http://127.0.0.1:${port}/s/${id}/blob`);
    expect(res2.status).toBe(410);
  });

  it("supports multiple views with maxViews option", async () => {
    const key = generateKey();
    const encrypted = encrypt(Buffer.from("secret"), key);

    const views = [];
    const { id } = await startTestServer({
      encryptedBlob: encrypted,
      maxViews: 3,
      onView: (data) => {
        views.push(data);
      },
    });

    // First two requests succeed and don't mark as done
    const res1 = await fetch(`http://127.0.0.1:${port}/s/${id}/blob`);
    expect(res1.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const res2 = await fetch(`http://127.0.0.1:${port}/s/${id}/blob`);
    expect(res2.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Third request succeeds and marks as done
    const res3 = await fetch(`http://127.0.0.1:${port}/s/${id}/blob`);
    expect(res3.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Fourth request fails
    const res4 = await fetch(`http://127.0.0.1:${port}/s/${id}/blob`);
    expect(res4.status).toBe(410);

    // Check view data
    expect(views.length).toBe(3);
    expect(views[0]).toEqual({ current: 1, max: 3, done: false, ip: expect.any(String) });
    expect(views[1]).toEqual({ current: 2, max: 3, done: false, ip: expect.any(String) });
    expect(views[2]).toEqual({ current: 3, max: 3, done: true, ip: expect.any(String) });
  });

  it("returns 404 for unknown paths", async () => {
    const key = generateKey();
    const encrypted = encrypt(Buffer.from("secret"), key);

    await startTestServer({
      encryptedBlob: encrypted,
      onView: () => {},
    });

    const res = await fetch(`http://127.0.0.1:${port}/unknown`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for wrong secret ID", async () => {
    const key = generateKey();
    const encrypted = encrypt(Buffer.from("secret"), key);

    await startTestServer({
      encryptedBlob: encrypted,
      onView: () => {},
    });

    const res = await fetch(`http://127.0.0.1:${port}/s/wrongid/blob`);
    expect(res.status).toBe(404);
  });

  it("includes filename in HTML when provided", async () => {
    const key = generateKey();
    const encrypted = encrypt(Buffer.from("file content"), key);

    const { id } = await startTestServer({
      encryptedBlob: encrypted,
      filename: "test.txt",
      onView: () => {},
    });

    const response = await fetch(`http://127.0.0.1:${port}/s/${id}`);
    const html = await response.text();

    expect(html).toContain("test.txt");
    expect(html).toContain("isFile = true");
  });

  it("handles text mode when no filename provided", async () => {
    const key = generateKey();
    const encrypted = encrypt(Buffer.from("text secret"), key);

    const { id } = await startTestServer({
      encryptedBlob: encrypted,
      onView: () => {},
    });

    const response = await fetch(`http://127.0.0.1:${port}/s/${id}`);
    const html = await response.text();

    expect(html).toContain("isFile = false");
  });
});
