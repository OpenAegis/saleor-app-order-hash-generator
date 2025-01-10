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
  unpackHonoRequest(createManifestHandler({
    manifestFactory({ appBaseUrl, request }) {
      const host = request.headers.get("host");
      const xForwardedProto = request.headers.get("x-forwarded-proto") ||
        "http";

      const protocols = xForwardedProto.split(",").map((value) =>
        value.trimStart()
      );
      const protocol = protocols.find((el) => el === "https") || protocols[0];

      const baseUrlRaw = `${protocol}://${host}`;

      console.log(
        {
          host,
          xForwardedProto,
          protocols,
          protocol,
          baseUrlRaw,
        },
      );

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

app.route("/webhooks", webhookRotues);

export default app;
