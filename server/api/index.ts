import {
  createAppRegisterHandler,
  createManifestHandler,
} from "@saleor/app-sdk/handlers/fetch-api";
import { Hono } from "hono";
import { saleorApp } from "../saleor-app.ts";
import webhookRotues from "./webhooks/index.ts";
import { orderCreatedWebhook } from "./webhooks/order-created.ts";
import { unpackHonoRequest } from "./utils.ts";

const app = new Hono();

app.get(
  "/manifest",
  (c) => {
    const host2 = c.req.header("host");
    const request = c.req.raw;
    const host = request.headers.get("host");
    const xForwardedProto = request.headers.get("x-forwarded-proto") ||
      "http";
    const forwarded = request.headers.get("forwarded");

    const protocols = xForwardedProto.split(",").map((value) =>
      value.trimStart()
    );
    const protocol = protocols.find((el) => el === "https") || protocols[0];

    const baseUrlRaw = `${protocol}://${host}`;

    console.warn(
      {
        host,
        host2,
        xForwardedProto,
        protocols,
        protocol,
        baseUrlRaw,
        forwarded,
        url: c.req.url,
      },
    );

    request.headers.entries().forEach(([key, value]) => {
      console.log("header", key, value);
    });

    return c.json({
      host,
      host2,
      xForwardedProto,
      protocols,
      protocol,
      baseUrlRaw,
      forwarded,
      headers: request.headers.entries(),
      url: c.req.url,
    });

    // createManifestHandler({
    //   manifestFactory({ appBaseUrl, request }) {
    //     return {
    //       name: "Saleor App Template",
    //       tokenTargetUrl: `${appBaseUrl}/api/register`,
    //       appUrl: `${appBaseUrl}/app`,
    //       permissions: [
    //         "MANAGE_ORDERS",
    //       ],
    //       id: "saleor.app.hono-deno",
    //       version: "0.0.1",
    //       webhooks: [
    //         orderCreatedWebhook.getWebhookManifest(appBaseUrl),
    //       ],
    //       extensions: [],
    //       author: "Jonatan Witoszek",
    //     };
    //   },
    // })(c.req.raw);
  },
);

app.post(
  "/register",
  unpackHonoRequest(createAppRegisterHandler({
    apl: saleorApp.apl,
  })),
);

app.route("/webhooks", webhookRotues);

export default app;
