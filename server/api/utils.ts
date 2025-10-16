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
  
  // Add random component for even more uniqueness
  const random = Math.floor(Math.random() * 1000000).toString(36);
  
  return `${hash}${timestamp}${random}`;
}

/**
 * Initialize Turso database client
 * @returns Turso database client or null if not configured
 */
export function initTursoClient() {
  const url = Deno.env.get("TURSO_DATABASE_URL");
  const authToken = Deno.env.get("TURSO_AUTH_TOKEN");
  
  // If not configured, return null instead of throwing an error
  if (!url || !authToken || url === "your_turso_database_url_here") {
    return null;
  }
  
  return createClient({
    url,
    authToken,
  });
}

/**
 * Initialize the database schema
 * @returns Promise that resolves when the database is initialized
 */
export async function initializeDatabase() {
  try {
    const turso = initTursoClient();
    
    // If turso is null, the database is not configured
    if (!turso) {
      console.warn("Turso database not configured, skipping initialization");
      return false;
    }
    
    // Create table with unique constraints
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS order_hashes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT UNIQUE NOT NULL,
        order_hash TEXT UNIQUE NOT NULL,
        saleor_api_url TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log("Database initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing database:", error);
    return false;
  }
}

/**
 * Update the database schema to ensure it has the required columns
 * @returns Promise that resolves when the database is updated
 */
export async function updateDatabaseSchema() {
  try {
    const turso = initTursoClient();
    
    // If turso is null, the database is not configured
    if (!turso) {
      console.warn("Turso database not configured, skipping schema update");
      return false;
    }
    
    // Check if saleor_api_url column exists
    try {
      await turso.execute(`
        ALTER TABLE order_hashes 
        ADD COLUMN saleor_api_url TEXT NOT NULL DEFAULT ''
      `);
      console.log("Added saleor_api_url column to order_hashes table");
    } catch (error) {
      // Column might already exist, which is fine
      if (!(error as Error).message.includes("duplicate column name")) {
        console.warn("Warning while adding saleor_api_url column:", error);
      }
    }
    
    console.log("Database schema updated successfully");
    return true;
  } catch (error) {
    console.error("Error updating database schema:", error);
    return false;
  }
}