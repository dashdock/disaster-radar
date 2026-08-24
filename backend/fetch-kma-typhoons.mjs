import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "data", "kma-typhoons.json");
const API_ROOT = "https://apihub.kma.go.kr/api/typ01/url";

async function readLocalKey() {
  try {
    const env = await readFile(resolve(ROOT, ".env"), "utf8");
    return env.split(/\r?\n/).find(line => line.startsWith("KMA_API_KEY="))?.slice(12).trim();
  } catch {
    return undefined;
  }
}

function value(raw) {
  const cleaned = String(raw ?? "").replace(/=$/, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "-9" || cleaned === "----") return null;
  return cleaned;
}

function number(raw) {
  const cleaned = value(raw);
  if (cleaned == null) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

async function request(path, params, key) {
  const query = new URLSearchParams({ ...params, disp: "1", help: "1", authKey: key });
  const response = await fetch(`${API_ROOT}/${path}?${query}`, {
    headers: { "User-Agent": "disaster-radar/1.0" },
  });
  if (!response.ok) throw new Error(`KMA typhoon API failed: HTTP ${response.status}`);
  const text = new TextDecoder("euc-kr").decode(await response.arrayBuffer());
  return text.split(/\r?\n/).filter(line => line && !line.startsWith("#"));
}

function parseList(line) {
  const fields = line.split(",").map(value);
  if (!/^\d{4}$/.test(fields[0] || "") || !number(fields[1])) return null;
  return {
    year: number(fields[0]),
    number: number(fields[1]),
    activeCode: number(fields[2]),
    effectCode: number(fields[3]),
    startedAtUtc: fields[4],
    endedAtUtc: fields[5],
    nameKo: fields[6],
    nameEn: fields[7],
    note: fields[8],
  };
}

function parsePoint(line) {
  const fields = line.split(",").map(value);
  if (![0, 1].includes(number(fields[0])) || !number(fields[2])) return null;
  return {
    kind: number(fields[0]) === 0 ? "analysis" : "forecast",
    year: number(fields[1]),
    typhoonNumber: number(fields[2]),
    bulletinNumber: number(fields[3]),
    forecastHour: number(fields[4]),
    analyzedAtUtc: fields[5],
    validAtUtc: fields[6],
    latitude: number(fields[7]),
    longitude: number(fields[8]),
    direction: fields[9],
    speedKmh: number(fields[10]),
    centralPressureHpa: number(fields[11]),
    maxWindSpeedMs: number(fields[12]),
    radius15msKm: number(fields[13]),
    radius25msKm: number(fields[14]),
    probabilityRadiusKm: number(fields[15]),
    exceptionalDirection15ms: fields[16],
    exceptionalRadius15msKm: number(fields[17]),
    location: fields[18],
    exceptionalDirection25ms: fields[19],
    exceptionalRadius25msKm: number(fields[20]),
  };
}

const apiKey = process.env.KMA_API_KEY || await readLocalKey();
if (!apiKey) throw new Error("KMA_API_KEY is not configured.");

const year = String(new Date().getUTCFullYear());
const list = (await request("typ_lst.php", { YY: year }, apiKey)).map(parseList).filter(Boolean);
const currentPoints = (await request("typ_now.php", { tm: "", mode: "1" }, apiKey)).map(parsePoint).filter(Boolean);
const activeNumbers = new Set(currentPoints.map(point => point.typhoonNumber));
const typhoons = [...activeNumbers].map(typhoonNumber => {
  const metadata = list.find(item => item.number === typhoonNumber) || {};
  const points = currentPoints.filter(point => point.typhoonNumber === typhoonNumber);
  return {
    year: number(metadata.year) ?? number(year),
    number: typhoonNumber,
    nameKo: metadata.nameKo || null,
    nameEn: metadata.nameEn || null,
    effectCode: metadata.effectCode ?? null,
    startedAtUtc: metadata.startedAtUtc || null,
    latestBulletinNumber: Math.max(...points.map(point => point.bulletinNumber || 0)),
    analysis: points.filter(point => point.kind === "analysis"),
    forecast: points.filter(point => point.kind === "forecast"),
  };
});

const payload = {
  generatedAt: new Date().toISOString(),
  source: "기상청 API허브 태풍정보 및 예측",
  sourceTimeZone: "UTC",
  refreshSchedule: "기상청 정규 발표(04·10·16·22 KST) 이후 및 수시",
  activeCount: typhoons.length,
  typhoons,
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Saved ${typhoons.length} active KMA typhoon(s), ${currentPoints.length} track point(s).`);
