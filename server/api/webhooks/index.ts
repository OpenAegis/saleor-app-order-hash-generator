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

    // Generate a unique hash for the order with collision prevention
    let orderHash: string | null = null;
    let attempts = 0;
    const maxAttempts = 10; // Increased from 5 to 10
    const turso = initTursoClient();
    const saleorApiUrl = authData?.saleorApiUrl || '';
    
    while (attempts < maxAttempts) {
      const newHash = generateOrderHash();
      console.log(`Generated hash for order ${payload.order.id}: ${newHash}`);
      
      try {
        // Check if hash already exists in database
        const existing = await turso.execute({
          sql: "SELECT COUNT(*) as count FROM order_hashes WHERE order_hash = ?",
          args: [newHash]
        });
        
        if (existing.rows?.[0]?.[0] === 0) {
          // Hash is unique, we can proceed
          orderHash = newHash;
          break;
        }
      } catch (error) {
        console.error("Error checking hash uniqueness:", error);
      }
      
      attempts++;
      console.log(`Hash collision detected, attempt ${attempts} of ${maxAttempts}`);
    }
    
    if (!orderHash) {
      console.error(`Failed to generate unique hash after ${maxAttempts} attempts for order ${payload.order.id}`);
      // Return success response to prevent webhook retries, but log the error
      return new Response("Accepted - Hash generation failed", { status: 200 });
    }

    // Store the hash mapping in Turso database
    try {
      // Insert the order hash mapping (table is already created at startup)
      console.log(`Attempting to store hash mapping for order ${payload.order.id} with hash ${orderHash}`);
      
      const result = await turso.execute({
        sql: "INSERT INTO order_hashes (order_id, order_hash, saleor_api_url) VALUES (?, ?, ?)",
        args: [payload.order.id, orderHash, saleorApiUrl]
      });
      
      console.log(`Successfully stored hash mapping for order ${payload.order.id}. Rows affected: ${result.rowsAffected}`);
    } catch (error) {
      console.error(`Error storing hash in database for order ${payload.order.id}:`, error);
      // We don't return an error here because we want to update the order metadata even if DB storage fails
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
                  ... on Node {
                    id
                  }
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
      console.log(`GraphQL response for order ${payload.order.id}:`, JSON.stringify(result, null, 2));
      
      if (result.errors) {
        console.error("GraphQL errors:", result.errors);
      } else if (result.data?.updateMetadata?.errors?.length > 0) {
        console.error("Metadata update errors:", result.data.updateMetadata.errors);
      } else if (result.data?.updateMetadata?.item) {
        console.log(`Successfully updated order metadata with hash: ${orderHash}`);
      } else {
        console.log(`Update metadata response received, hash: ${orderHash}`);
      }
    } catch (error) {
      console.error("Error updating order metadata:", error);
    }

    return new Response("Accepted", { status: 200 });
  })(c.req.raw);
});

export default app;