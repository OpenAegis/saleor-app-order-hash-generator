import {
  createAppRegisterHandler,
  createManifestHandler,
} from "@saleor/app-sdk/handlers/fetch-api";
import { Hono } from "hono";
import { saleorApp } from "../saleor-app.ts";
import webhookRotues from "./webhooks/index.ts";
import { orderCreatedWebhook } from "./webhooks/order-created.ts";
import { unpackHonoRequest, initTursoClient } from "./utils.ts";

const app = new Hono();

app.get(
  "/manifest",
  unpackHonoRequest(createManifestHandler({
    async manifestFactory({ appBaseUrl }) {
      return {
        name: "Saleor App Template",
        tokenTargetUrl: `${appBaseUrl}/api/register`,
        appUrl: `${appBaseUrl}/app`,
        permissions: [
          "MANAGE_ORDERS",
        ],
        id: "saleor.app.hono-deno",
        version: "0.0.1",
        webhooks: [
          orderCreatedWebhook.getWebhookManifest(appBaseUrl),
        ],
        extensions: [],
        author: "Jonatan Witoszek",
      };
    },
  })),
);

app.post(
  "/register",
  unpackHonoRequest(createAppRegisterHandler({
    apl: saleorApp.apl,
  })),
);

// Add endpoint to query order status by hash
app.get("/order-status/:hash", async (c) => {
  const hash = c.req.param("hash");
  
  if (!hash) {
    return c.json({ error: "Hash parameter is required" }, 400);
  }
  
  try {
    // Get order ID from Turso database using the hash
    const turso = initTursoClient();
    
    const result = await turso.execute({
      sql: "SELECT order_id FROM order_hashes WHERE order_hash = ?",
      args: [hash]
    });
    
    if (!result.rows || result.rows.length === 0) {
      return c.json({ error: "Order not found for the provided hash" }, 404);
    }
    
    const orderId = result.rows[0][0]; // order_id is the first column
    
    // Return order status information
    return c.json({
      hash,
      orderId,
      status: "found",
      message: "Order found successfully"
    });
  } catch (error) {
    console.error("Error querying order status:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.route("/webhooks", webhookRotues);

export default app;