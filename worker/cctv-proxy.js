const ITS_API = "https://openapi.its.go.kr:9443/cctvInfo";
const ALLOWED_ORIGINS = new Set(["https://dashdock.github.io", "http://localhost:8000", "http://127.0.0.1:8000"]);

function cors(origin) {
  return { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://dashdock.github.io", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
}
function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function distance(camera, lat, lng) { return (Number(camera.coordy) - lat) ** 2 + (Number(String(camera.coordx).replace(/;+$/, "")) - lng) ** 2; }

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "", url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === "/health") return json({ ok: true }, 200, origin);
    if (request.method !== "GET" || url.pathname !== "/api/cctv/stream") return json({ error: "Not found" }, 404, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);
    if (!env.ITS_API_KEY) return json({ error: "ITS_API_KEY is not configured" }, 503, origin);
    const lat = Number(url.searchParams.get("lat")), lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32 || lat > 40 || lng < 124 || lng > 132) return json({ error: "Invalid coordinates" }, 400, origin);
    const delta = .006, params = new URLSearchParams({ apiKey: env.ITS_API_KEY, type: "all", cctvType: "1", minX: String(lng-delta), maxX: String(lng+delta), minY: String(lat-delta), maxY: String(lat+delta), getType: "json" });
    const upstream = await fetch(`${ITS_API}?${params}`, { cf: { cacheTtl: 0 } });
    if (!upstream.ok) return json({ error: `ITS API HTTP ${upstream.status}` }, 502, origin);
    const payload = await upstream.json(), rows = payload.response?.data, cameras = (Array.isArray(rows) ? rows : rows ? [rows] : []).filter(c => c.cctvurl && Number.isFinite(Number(String(c.coordx).replace(/;+$/, ""))) && Number.isFinite(Number(c.coordy))).sort((a,b) => distance(a,lat,lng)-distance(b,lat,lng)), camera = cameras[0];
    if (!camera) return json({ error: "CCTV stream not found" }, 404, origin);
    return json({ name: String(camera.cctvname || "CCTV").replace(/;+$/, ""), format: camera.cctvformat || "HLS", streamUrl: String(camera.cctvurl).replace(/^http:/,"https:"), latitude: Number(camera.coordy), longitude: Number(String(camera.coordx).replace(/;+$/,"")) }, 200, origin);
  },
};
