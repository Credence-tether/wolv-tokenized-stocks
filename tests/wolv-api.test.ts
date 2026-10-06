import { afterEach, describe, expect, it } from "vitest";
import { buildBinanceSignature, handleWolvRequest, setWolvCors } from "../server/_core/wolv-api";

const previous = {
  key: process.env.BINANCE_WEB3_API_KEY,
  secret: process.env.BINANCE_WEB3_API_SECRET,
  origin: process.env.PUBLIC_APP_ORIGIN,
  nodeEnv: process.env.NODE_ENV,
};

afterEach(() => {
  if (previous.key === undefined) delete process.env.BINANCE_WEB3_API_KEY;
  else process.env.BINANCE_WEB3_API_KEY = previous.key;
  if (previous.secret === undefined) delete process.env.BINANCE_WEB3_API_SECRET;
  else process.env.BINANCE_WEB3_API_SECRET = previous.secret;
  if (previous.origin === undefined) delete process.env.PUBLIC_APP_ORIGIN;
  else process.env.PUBLIC_APP_ORIGIN = previous.origin;
  if (previous.nodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else process.env.NODE_ENV = previous.nodeEnv;
});

describe("WOLV server API", () => {
  it("creates the documented HMAC-SHA256 Base64 signature for a fixed request vector", () => {
    expect(buildBinanceSignature(
      "2026-10-06T00:00:00.000Z",
      "GET",
      "/build/api/v1/dex/market/rwa/tokens?binanceChainId=56",
      "",
      "test-secret",
    )).toBe("PKkFUNTgagQ1LEx0xEUTdel+gp4JoOYJe4I8RnX0jhA=");
  });

  it("reports live API configuration without exposing credentials", async () => {
    delete process.env.BINANCE_WEB3_API_KEY;
    delete process.env.BINANCE_WEB3_API_SECRET;
    const result = await handleWolvRequest("GET", "/api/wolv/health", undefined);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, chainId: 56, liveApiConfigured: false });
  });

  it("returns an explicit configuration error instead of sample market data", async () => {
    delete process.env.BINANCE_WEB3_API_KEY;
    delete process.env.BINANCE_WEB3_API_SECRET;
    const result = await handleWolvRequest("GET", "/api/wolv/markets", undefined);
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ code: "BINANCE_API_NOT_CONFIGURED" });
    expect(result.body).not.toHaveProperty("data");
  });

  it("rejects incomplete trade input before making any upstream request", async () => {
    const result = await handleWolvRequest("POST", "/api/wolv/quote", {});
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ code: "INVALID_TRADE_INPUT" });
  });

  it("allows only configured production origins and permits originless native requests", () => {
    process.env.NODE_ENV = "production";
    process.env.PUBLIC_APP_ORIGIN = "https://wolv.example,https://preview.wolv.example";
    const headers: Record<string, string> = {};
    const response = { setHeader: (key: string, value: string) => { headers[key] = value; }, removeHeader: (key: string) => { delete headers[key]; } };
    expect(setWolvCors({ headers: { origin: "https://wolv.example" } }, response)).toBe(true);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://wolv.example");
    expect(setWolvCors({ headers: { origin: "https://attacker.example" } }, response)).toBe(false);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(setWolvCors({ headers: {} }, response)).toBe(true);
  });

  it("allows local and Manus preview origins in development without relaxing production", () => {
    process.env.NODE_ENV = "development";
    process.env.PUBLIC_APP_ORIGIN = "https://wolv.example";
    const headers: Record<string, string> = {};
    const response = { setHeader: (key: string, value: string) => { headers[key] = value; }, removeHeader: (key: string) => { delete headers[key]; } };
    expect(setWolvCors({ headers: { origin: "https://8081-preview.manus.computer" } }, response)).toBe(true);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://8081-preview.manus.computer");
    expect(setWolvCors({ headers: { origin: "http://127.0.0.1:8081" } }, response)).toBe(true);
  });
});
