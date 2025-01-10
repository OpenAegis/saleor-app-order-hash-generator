import { Context } from "hono";

export function unpackHonoRequest(
  handlerFn: (req: Request) => Promise<Response> | Response,
) {
  return (context: Context) => {
    return handlerFn(context.req.raw);
  };
}
