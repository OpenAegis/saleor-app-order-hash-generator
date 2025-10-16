import { Hono } from "hono";
import { orderCreatedWebhook } from "./order-created.ts";
import { generateOrderHash } from "../utils.ts";
import { createClient } from "@libsql/client";
import { initTursoClient } from "../utils.ts";

const app = new Hono();

app.post("/order-created", async (c) => {
  return await orderCreatedWebhook.createHandler(async (request, ctx) => {
    const {
      /**
       * Access payload from Saleor - defined above
       */
      payload,
      /**
       * Saleor event that triggers the webhook (here - ORDER_CREATED)
       */
      event,
      /**
       * App's URL
       */
      baseUrl,
      /**
       * Auth data (from APL) - contains token and saleorApiUrl that can be used to construct graphQL client
       */
      authData,
    } = ctx;

    /**
     * Perform logic based on Saleor Event payload
     */
    console.log(`Order was created for customer: ${payload.order?.userEmail}`);

    // Check if order ID exists
    if (!payload.order?.id) {
      console.error("Order ID is missing from payload");
      return new Response("Order ID missing", { status: 400 });
    }

    // Generate a unique hash for the order
    const orderHash = generateOrderHash();
    console.log(`Generated hash for order ${payload.order.id}: ${orderHash}`);

    // Store the hash mapping in Turso database
    try {
      const turso = initTursoClient();
      
      // Create table if it doesn't exist
      await turso.execute(`
        CREATE TABLE IF NOT EXISTS order_hashes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id TEXT UNIQUE NOT NULL,
          order_hash TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Insert the order hash mapping
      await turso.execute({
        sql: "INSERT INTO order_hashes (order_id, order_hash) VALUES (?, ?)",
        args: [payload.order.id, orderHash]
      });
      
      console.log(`Stored hash mapping for order ${payload.order.id}`);
    } catch (error) {
      console.error("Error storing hash in database:", error);
      // We don't return an error here because we still want to update the order metadata
    }

    // Update the order metadata with the hash
    try {
      if (!authData) {
        throw new Error("Missing auth data");
      }

      const response = await fetch(authData.saleorApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`
        },
        body: JSON.stringify({
          query: `
            mutation UpdateOrderMetadata($id: ID!, $input: [MetadataInput!]!) {
              updateMetadata(id: $id, input: $input) {
                errors {
                  field
                  message
                  code
                }
                item {
                  id
                }
              }
            }
          `,
          variables: {
            id: payload.order.id,
            input: [{
              key: "order_hash",
              value: orderHash
            }]
          }
        })
      });

      const result = await response.json();
      
      if (result.errors) {
        console.error("GraphQL errors:", result.errors);
      } else if (result.data?.updateMetadata?.errors?.length > 0) {
        console.error("Metadata update errors:", result.data.updateMetadata.errors);
      } else {
        console.log(`Successfully updated order metadata with hash: ${orderHash}`);
      }
    } catch (error) {
      console.error("Error updating order metadata:", error);
    }

    return new Response("Accepted", { status: 200 });
  })(c.req.raw);
});

export default app;