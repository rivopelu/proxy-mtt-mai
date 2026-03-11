process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";

const TARGET = process.env.TARGET_URL || "http://localhost:8080";

const app = new Hono().basePath("/api");

app.use("*", cors());

app.all("/*", async (c) => {
  const url = new URL(c.req.url);
  // Remove /api prefix to get the real path
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const targetUrl = TARGET + path + url.search;

  try {
    const headers = new Headers(c.req.raw.headers);
    headers.delete("host");

    const requestInit: RequestInit = {
      method: c.req.method,
      headers,
      redirect: "follow",
    };

    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      requestInit.body = await c.req.raw.clone().arrayBuffer();
    }

    const response = await fetch(targetUrl, requestInit);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
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
