import {
  createAppRegisterHandler,
  createManifestHandler,
} from "@saleor/app-sdk/handlers/fetch-api";
import { Hono } from "hono";
import { saleorApp } from "../saleor-app.ts";
import webhookRotues from "./webhooks/index.ts";
import { orderCreatedWebhook } from "./webhooks/order-created.ts";
import { unpackHonoRequest, initTursoClient, initializeDatabase, updateDatabaseSchema } from "./utils.ts";

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

// Add endpoint to manually update database schema
app.post("/admin/update-database-schema", async (c) => {
  try {
    const success = await updateDatabaseSchema();
    if (success) {
      return c.json({ message: "Database schema updated successfully" });
    } else {
      return c.json({ error: "Failed to update database schema" }, 500);
    }
  } catch (error) {
    console.error("Error updating database schema:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Add endpoint to test database connection
app.get("/admin/test-database", async (c) => {
  try {
    const turso = initTursoClient();
    
    // If turso is null, the database is not configured
    if (!turso) {
      return c.json({ 
        error: "Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env file" 
      }, 500);
    }
    
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
  
  // Check if database is configured
  const turso = initTursoClient();
  if (!turso) {
    return c.json({ 
      error: "Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env file" 
    }, 500);
  }
  
  try {
    // Get order ID and Saleor API URL from Turso database using the hash
    let dbResult;
    try {
      dbResult = await turso.execute({
        sql: "SELECT order_id, saleor_api_url FROM order_hashes WHERE order_hash = ?",
        args: [hash]
      });
    } catch (error) {
      // If the column doesn't exist, try without it
      if ((error as Error).message.includes("no such column")) {
        console.warn("saleor_api_url column not found, trying without it");
        dbResult = await turso.execute({
          sql: "SELECT order_id FROM order_hashes WHERE order_hash = ?",
          args: [hash]
        });
        
        // If we found a result, we need to handle it differently
        if (dbResult.rows && dbResult.rows.length > 0) {
          const orderId = dbResult.rows[0][0] as string;
          return c.json({
            hash,
            orderId,
            status: "found"
          });
        }
      } else {
        throw error;
      }
    }
    
    if (!dbResult.rows || dbResult.rows.length === 0) {
      return c.json({ error: "Order not found for the provided hash" }, 404);
    }
    
    const orderId = dbResult.rows[0][0] as string;
    const saleorApiUrl = dbResult.rows[0][1] as string;
    
    // If we don't have the Saleor API URL, we can't fetch status
    if (!saleorApiUrl) {
      return c.json({ 
        error: "Saleor API URL not found in database", 
        hash,
        orderId
      }, 400);
    }
    
    // Try to get auth data for this Saleor instance
    let authToken = null;
    try {
      const authData = await saleorApp.apl.get(saleorApiUrl);
      authToken = authData?.token;
    } catch (authError) {
      console.warn("Could not retrieve auth data for Saleor API URL:", saleorApiUrl);
    }
    
    // If we don't have an auth token, we can't fetch status
    if (!authToken) {
      return c.json({ 
        error: "Authentication token not available for this Saleor instance", 
        hash,
        orderId
      }, 401);
    }
    
    // Fetch order status from Saleor
    try {
      const response = await fetch(saleorApiUrl as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          query: `
            query GetOrderStatus($id: ID!) {
              order(id: $id) {
                id
                status
                number
              }
            }
          `,
          variables: {
            id: orderId
          }
        })
      });
      
      const result = await response.json();
      
      if (result.errors) {
        console.error("GraphQL errors:", result.errors);
        return c.json({ 
          error: "Failed to fetch order status", 
          graphqlErrors: result.errors,
          hash,
          orderId
        }, 500);
      }
      
      if (!result.data?.order) {
        return c.json({ 
          error: "Order not found in Saleor", 
          hash,
          orderId
        }, 404);
      }
      
      // Return order status
      return c.json({
        hash,
        orderId,
        status: result.data.order.status,
        orderNumber: result.data.order.number
      });
    } catch (fetchError) {
      console.error("Error fetching order status from Saleor:", fetchError);
      return c.json({ 
        error: "Failed to connect to Saleor API", 
        details: (fetchError as Error).message,
        hash,
        orderId
      }, 500);
    }
  } catch (error) {
    console.error("Error querying order status:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Add endpoint to query order status with full metadata by hash
app.get("/order-status/:hash/metadata", async (c) => {
  const hash = c.req.param("hash");
  
  if (!hash) {
    return c.json({ error: "Hash parameter is required" }, 400);
  }
  
  // Check if database is configured
  const turso = initTursoClient();
  if (!turso) {
    return c.json({ 
      error: "Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env file" 
    }, 500);
  }
  
  try {
    // Get order ID and Saleor API URL from Turso database using the hash
    const dbResult = await turso.execute({
      sql: "SELECT order_id, saleor_api_url FROM order_hashes WHERE order_hash = ?",
      args: [hash]
    });
    
    if (!dbResult.rows || dbResult.rows.length === 0) {
      return c.json({ error: "Order not found for the provided hash" }, 404);
    }
    
    const orderId = dbResult.rows[0][0] as string;
    const saleorApiUrl = dbResult.rows[0][1] as string;
    
    // If we don't have the Saleor API URL, we can't fetch metadata
    if (!saleorApiUrl) {
      return c.json({ 
        error: "Saleor API URL not found in database", 
        hash,
        orderId
      }, 400);
    }
    
    // Try to get auth data for this Saleor instance
    let authToken = null;
    try {
      const authData = await saleorApp.apl.get(saleorApiUrl);
      authToken = authData?.token;
    } catch (authError) {
      console.warn("Could not retrieve auth data for Saleor API URL:", saleorApiUrl);
    }
    
    // If we don't have an auth token, we can't fetch metadata
    if (!authToken) {
      return c.json({ 
        error: "Authentication token not available for this Saleor instance", 
        hash,
        orderId
      }, 401);
    }
    
    // Fetch full order metadata from Saleor
    try {
      const response = await fetch(saleorApiUrl as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          query: `
            query GetOrderMetadata($id: ID!) {
              order(id: $id) {
                id
                number
                status
                metadata {
                  key
                  value
                }
                privateMetadata {
                  key
                  value
                }
                created
                updated
                userEmail
              }
            }
          `,
          variables: {
            id: orderId
          }
        })
      });
      
      const result = await response.json();
      
      if (result.errors) {
        console.error("GraphQL errors:", result.errors);
        return c.json({ 
          error: "Failed to fetch order metadata", 
          graphqlErrors: result.errors,
          hash,
          orderId
        }, 500);
      }
      
      if (!result.data?.order) {
        return c.json({ 
          error: "Order not found in Saleor", 
          hash,
          orderId
        }, 404);
      }
      
      // Return order with full metadata (without Saleor API URL)
      return c.json({
        hash,
        orderId,
        order: result.data.order,
        status: "found",
        message: "Order with metadata found successfully"
      });
    } catch (fetchError) {
      console.error("Error fetching order metadata from Saleor:", fetchError);
      return c.json({ 
        error: "Failed to connect to Saleor API", 
        details: (fetchError as Error).message,
        hash,
        orderId
      }, 500);
    }
  } catch (error) {
    console.error("Error querying order status with metadata:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Add endpoint to get all stored hashes (diagnostic tool)
app.get("/diagnostics/all-hashes", async (c) => {
  try {
    const turso = initTursoClient();
    
    // If turso is null, the database is not configured
    if (!turso) {
      return c.json({ 
        error: "Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env file" 
      }, 500);
    }
    
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

// Add endpoint to check for duplicate hashes (diagnostic tool)
app.get("/diagnostics/duplicate-hashes", async (c) => {
  try {
    const turso = initTursoClient();
    
    // If turso is null, the database is not configured
    if (!turso) {
      return c.json({ 
        error: "Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env file" 
      }, 500);
    }
    
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

// Add endpoint to clean up duplicate hashes (admin tool)
app.post("/admin/cleanup-duplicates", async (c) => {
  try {
    const turso = initTursoClient();
    
    // If turso is null, the database is not configured
    if (!turso) {
      return c.json({ 
        error: "Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env file" 
      }, 500);
    }
    
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