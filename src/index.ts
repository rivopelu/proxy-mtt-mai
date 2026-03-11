process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { Hono } from "hono";
import { cors } from "hono/cors";

const TARGET = process.env.TARGET_URL || "http://localhost:8080";
const PORT = Number(process.env.PORT) || 3000;

const app = new Hono();

app.use("*", cors());

app.all("/*", async (c) => {
  const url = new URL(c.req.url);
  const targetUrl = TARGET + url.pathname + url.search;

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

export default {
  port: PORT,
  fetch: app.fetch,
};
