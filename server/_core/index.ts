import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { handleWolvRequest, setWolvCors } from "./wolv-api";

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.use("/api/wolv", async (req, res) => {
    if (!setWolvCors(req as any, res)) {
      return res.status(403).json({ error: "Origin is not allowed for the WOLV API.", code: "ORIGIN_NOT_ALLOWED" });
    }
    if (req.method === "OPTIONS") return res.status(204).end();
    try {
      const result = await handleWolvRequest(req.method, req.originalUrl, req.body);
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error("[wolv-api] request failed", error instanceof Error ? error.message : "unknown error");
      return res.status(500).json({ error: "The WOLV API request failed.", code: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  const server = createServer(app);
  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => console.log(`[wolv-api] preview server listening on ${port}`));
}

startServer().catch((error) => {
  console.error("[wolv-api] server failed to start", error instanceof Error ? error.message : "unknown error");
});
