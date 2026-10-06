import { handleWolvRequest, setWolvCors } from "../../server/_core/wolv-api";

export default async function handler(req: any, res: any) {
  if (!setWolvCors(req, res)) return res.status(403).json({ error: "Origin is not allowed for the WOLV API.", code: "ORIGIN_NOT_ALLOWED" });
  if (req.method === "OPTIONS") return res.status(204).end();
  const result = await handleWolvRequest(req.method, req.url, req.body);
  return res.status(result.status).json(result.body);
}
