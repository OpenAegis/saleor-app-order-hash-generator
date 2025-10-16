import { Context } from "hono";
import { createClient } from "@libsql/client";

/**
 * Hono handler signature is Context => Response
 * In order to use @saleor/app-sdk methods we need to unpack raw Web API Request object
 * and pass it to app-sdk handler function
 */
export function unpackHonoRequest(
  handlerFn: (req: Request) => Promise<Response> | Response,
) {
  return (context: Context) => {
    return handlerFn(context.req.raw);
  };
}

/**
 * Generate a cryptographically secure random hash
 * @returns A unique hash string
 */
export function generateOrderHash(): string {
  // Generate a random 32-byte array (256 bits)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  
  // Convert to hex string
  const hash = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  
  // Add timestamp for additional uniqueness
  const timestamp = Date.now().toString(36);
  
  return `${hash}${timestamp}`;
}

/**
 * Initialize Turso database client
 * @returns Turso database client
 */
export function initTursoClient() {
  const url = Deno.env.get("TURSO_DATABASE_URL");
  const authToken = Deno.env.get("TURSO_AUTH_TOKEN");
  
  if (!url || !authToken) {
    throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in environment variables");
  }
  
  return createClient({
    url,
    authToken,
  });
}