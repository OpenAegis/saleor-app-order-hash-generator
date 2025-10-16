import {
  createAppRegisterHandler,
  createManifestHandler,
} from "@saleor/app-sdk/handlers/fetch-api";
import { Hono } from "hono";
import { saleorApp } from "../saleor-app.ts";
import webhookRotues from "./webhooks/index.ts";
import { orderCreatedWebhook } from "./webhooks/order-created.ts";
import { unpackHonoRequest, initTursoClient, initializeDatabase } from "./utils.ts";

const app = new Hono();

app.get(
  "/manifest",
  unpackHonoRequest(createManifestHandler({
    async manifestFactory({ appBaseUrl }) {
      return {
        name: "Saleor Order Hash Generator",
        tokenTargetUrl: `${appBaseUrl}/api/register`,
        appUrl: `${appBaseUrl}/app`,
        permissions: [
          "MANAGE_ORDERS",
        ],
        id: "saleor.app.order-hash-generator",
        version: "1.0.0",
        webhooks: [
          orderCreatedWebhook.getWebhookManifest(appBaseUrl),
        ],
        extensions: [],
        author: "OpenAegis",
        about: "Generates unique hash values for Saleor orders and provides API to query order status by hash",
        dataPrivacy: "This app generates and stores unique hash identifiers for orders. No personal data is stored.",
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

// Add endpoint to manually initialize database
app.post("/admin/init-database", async (c) => {
  try {
    const success = await initializeDatabase();
    if (success) {
      return c.json({ message: "Database initialized successfully" });
    } else {
      return c.json({ error: "Failed to initialize database" }, 500);
    }
  } catch (error) {
    console.error("Error initializing database:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Add endpoint to test database connection
app.get("/admin/test-database", async (c) => {
  try {
    const turso = initTursoClient();
    
    // Test the connection by querying the database
    const result = await turso.execute("SELECT 1 as test");
    
    return c.json({
      message: "Database connection successful",
      result: result.rows
    });
  } catch (error) {
    console.error("Database connection test failed:", error);
    return c.json({ 
      error: "Database connection failed",
      details: (error as Error).message
    }, 500);
  }
});

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
    
    // Handle potential duplicate hashes (should not happen with our constraints, but just in case)
    if (result.rows.length > 1) {
      console.warn(`Multiple orders found for hash: ${hash}`);
      // Return the first one, but log the issue
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

// Add endpoint to check for duplicate hashes (diagnostic tool)
app.get("/diagnostics/duplicate-hashes", async (c) => {
  try {
    const turso = initTursoClient();
    
    // Check for duplicate hashes
    const duplicates = await turso.execute(`
      SELECT order_hash, COUNT(*) as count 
      FROM order_hashes 
      GROUP BY order_hash 
      HAVING COUNT(*) > 1
    `);
    
    // Check for duplicate order IDs
    const duplicateOrders = await turso.execute(`
      SELECT order_id, COUNT(*) as count 
      FROM order_hashes 
      GROUP BY order_id 
      HAVING COUNT(*) > 1
    `);
    
    // Get total count
    const total = await turso.execute(`
      SELECT COUNT(*) as total FROM order_hashes
    `);
    
    return c.json({
      total: total.rows?.[0]?.[0] || 0,
      duplicateHashes: duplicates.rows,
      duplicateOrders: duplicateOrders.rows,
      status: "success"
    });
  } catch (error) {
    console.error("Error running diagnostics:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Add endpoint to get all stored hashes (diagnostic tool)
app.get("/diagnostics/all-hashes", async (c) => {
  try {
    const turso = initTursoClient();
    
    // Get all stored hashes
    const result = await turso.execute(`
      SELECT order_id, order_hash, saleor_api_url, created_at
      FROM order_hashes
      ORDER BY created_at DESC
      LIMIT 100
    `);
    
    return c.json({
      hashes: result.rows,
      status: "success"
    });
  } catch (error) {
    console.error("Error fetching hashes:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Add endpoint to clean up duplicate hashes (admin tool)
app.post("/admin/cleanup-duplicates", async (c) => {
  try {
    const turso = initTursoClient();
    
    // Find and remove duplicate hashes, keeping only the first one
    const duplicates = await turso.execute(`
      DELETE FROM order_hashes 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM order_hashes 
        GROUP BY order_hash
      )
    `);
    
    return c.json({
      message: "Duplicate hashes cleaned up",
      rowsAffected: duplicates.rowsAffected
    });
  } catch (error) {
    console.error("Error cleaning up duplicates:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.route("/webhooks", webhookRotues);

export default app;