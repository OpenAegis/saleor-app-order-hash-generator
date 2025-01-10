import { SaleorApp } from "@saleor/app-sdk/saleor-app";
import { APL, UpstashAPL } from "@saleor/app-sdk/APL";
import { DenoAPL } from "./deno-kv-apl.ts";

/**
 * By default auth data are stored in the `.auth-data.json` (FileAPL).
 * For multi-tenant applications and deployments please use UpstashAPL.
 *
 * To read more about storing auth data, read the
 * [APL documentation](https://github.com/saleor/saleor-app-sdk/blob/main/docs/apl.md)
 */
let apl: APL;

switch (Deno.env.get("APL")) {
  case "deno":
    apl = new DenoAPL();
    break;
  case "upstash":
    // Require `UPSTASH_URL` and `UPSTASH_TOKEN` environment variables
    apl = new UpstashAPL();
    break;
  default:
    throw new Error("Cannot find valid APL");
}

export const saleorApp = new SaleorApp({ apl });
