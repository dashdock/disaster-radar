import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = resolve(ROOT_DIR, "data", "water-levels.json");
const API_BASE_URL = "https://api.hrfco.go.kr";

const REGION_PREFIXES = [
  ["서울", "seoul"], ["부산", "busan"], ["대구", "daegu"], ["인천", "incheon"],
  ["광주", "gwangju"], ["대전", "daejeon"], ["울산", "ulsan"], ["세종", "sejong"],
  ["경기", "gyeonggi"], ["강원", "gangwon"], ["충북", "chungbuk"], ["충청북도", "chungbuk"],
  ["충남", "chungnam"], ["충청남도", "chungnam"], ["전북", "jeonbuk"], ["전라북도", "jeonbuk"],
  ["전북특별자치도", "jeonbuk"], ["전남", "jeonnam"], ["전라남도", "jeonnam"],
  ["경북", "gyeongbuk"], ["경상북도", "gyeongbuk"], ["경남", "gyeongnam"],
  ["경상남도", "gyeongnam"], ["제주", "jeju"], ["제주특별자치도", "jeju"],
];

async function readLocalApiKey() {
  try {
    const envFile = await readFile(resolve(ROOT_DIR, ".env"), "utf8");
    const entry = envFile.split(/\r?\n/).find(line => line.startsWith("HRFCO_API_KEY="));
    return entry?.slice("HRFCO_API_KEY=".length).trim();
  } catch {
    return undefined;
  }
}

function dmsToDecimal(value) {
  const [degrees, minutes, seconds] = String(value ?? "").trim().split("-").map(Number);
  if (![degrees, minutes, seconds].every(Number.isFinite)) return null;
  return Number((degrees + minutes / 60 + seconds / 3600).toFixed(6));
}

function numberOrNull(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function thresholdOrNull(value) {
  const number = numberOrNull(value);
  return number != null && number > 0 ? number : null;
}

function resolveRegionId(address) {
  const normalized = String(address ?? "").trim();
  return REGION_PREFIXES.find(([prefix]) => normalized.startsWith(prefix))?.[1] ?? null;
}

function resolveStatus(level, info) {
  if (level == null) return "통신두절";
  const thresholds = [
    [thresholdOrNull(info.srswl), "심각"],
    [thresholdOrNull(info.almwl), "경계"],
    [thresholdOrNull(info.wrnwl), "주의"],
    [thresholdOrNull(info.attwl), "관심"],
  ];
  return thresholds.find(([threshold]) => threshold != null && level >= threshold)?.[1] ?? "정상";
}

async function requestJson(apiKey, path) {
  const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(apiKey)}/${path}`, {
    headers: { "User-Agent": "disaster-radar/0.1" },
  });
  if (!response.ok) throw new Error(`HRFCO API request failed: HTTP ${response.status}`);
  return response.json();
}

const apiKey = process.env.HRFCO_API_KEY || await readLocalApiKey();
if (!apiKey) throw new Error("HRFCO_API_KEY is not configured.");

const [infoResponse, levelResponse] = await Promise.all([
  requestJson(apiKey, "waterlevel/info.json"),
  requestJson(apiKey, "waterlevel/list/10M.json"),
]);

const levelsByCode = new Map(levelResponse.content.map(item => [item.wlobscd, item]));
const stations = infoResponse.content
  .map(info => {
    const measurement = levelsByCode.get(info.wlobscd);
    const waterLevel = numberOrNull(measurement?.wl);
    return {
      code: info.wlobscd,
      name: info.obsnm,
      agency: info.agcnm,
      address: [info.addr, info.etcaddr].filter(Boolean).join(" ").trim(),
      regionId: resolveRegionId(info.addr),
      lat: dmsToDecimal(info.lat),
      lng: dmsToDecimal(info.lon),
      observedAt: measurement?.ymdhm ?? null,
      waterLevel,
      flow: numberOrNull(measurement?.fw),
      thresholds: {
        관심: thresholdOrNull(info.attwl),
        주의: thresholdOrNull(info.wrnwl),
        경계: thresholdOrNull(info.almwl),
        심각: thresholdOrNull(info.srswl),
      },
      status: resolveStatus(waterLevel, info),
    };
  })
  .filter(station => station.lat != null && station.lng != null && station.regionId != null);

const payload = {
  generatedAt: new Date().toISOString(),
  source: "한강홍수통제소 OpenAPI",
  refreshIntervalMinutes: 10,
  stationCount: stations.length,
  stations,
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Saved ${stations.length} water-level stations.`);
