process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";

export const config = {
  runtime: "edge",
};

const TARGET = process.env.TARGET_URL || "http://localhost:8080";
const TIMEOUT_MS = 30_000;

const app = new Hono();

app.use("*", cors());

app.all("/*", async (c) => {
  const url = new URL(c.req.url);
  // Strip /api prefix yang ditambah Vercel routing
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const targetUrl = TARGET + path + url.search;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers = new Headers(c.req.raw.headers);
    headers.delete("host");

    const requestInit: RequestInit = {
      method: c.req.method,
      headers,
      redirect: "follow",
      signal: controller.signal,
    };

    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      requestInit.body = await c.req.raw.clone().arrayBuffer();
    }

    const response = await fetch(targetUrl, requestInit);

    clearTimeout(timeoutId);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      return c.json(
        {
          error: "Proxy request timeout",
          message: `Request to target timed out after ${TIMEOUT_MS / 1000}s`,
          targetUrl,
        },
        504,
      );
    }

    return c.json(
      {
        error: "Proxy request failed",
        message: error.message,
        targetUrl,
      },
      502,
    );
  }
});

export default handle(app);
