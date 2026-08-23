import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = resolve(ROOT_DIR, "data", "aws-current.json");
const API_URL = "https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min";

async function readLocalApiKey() {
  try {
    const envFile = await readFile(resolve(ROOT_DIR, ".env"), "utf8");
    const entry = envFile.split(/\r?\n/).find(line => line.startsWith("KMA_API_KEY="));
    return entry?.slice("KMA_API_KEY=".length).trim();
  } catch {
    return undefined;
  }
}

function formatKst(date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const pad = value => String(value).padStart(2, "0");
  return `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}${pad(kst.getUTCHours())}${pad(kst.getUTCMinutes())}`;
}

function validNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > -50 ? number : null;
}

function parseAwsRow(line) {
  const fields = line.trim().split(/\s+/);
  if (fields.length < 18 || !/^\d{12}$/.test(fields[0])) return null;
  return {
    observedAt: fields[0],
    stationCode: fields[1],
    windDirection1m: validNumber(fields[2]),
    windSpeed1m: validNumber(fields[3]),
    windDirectionInstant: validNumber(fields[4]),
    windSpeedInstant: validNumber(fields[5]),
    windDirection10m: validNumber(fields[6]),
    windSpeed10m: validNumber(fields[7]),
    temperature: validNumber(fields[8]),
    precipitationDetected: validNumber(fields[9]),
    rainfall15m: validNumber(fields[10]),
    rainfall60m: validNumber(fields[11]),
    rainfall12h: validNumber(fields[12]),
    rainfallDay: validNumber(fields[13]),
    humidity: validNumber(fields[14]),
    pressureLocal: validNumber(fields[15]),
    pressureSea: validNumber(fields[16]),
    dewPoint: validNumber(fields[17]),
  };
}

const apiKey = process.env.KMA_API_KEY || await readLocalApiKey();
if (!apiKey) throw new Error("KMA_API_KEY is not configured.");

const requestedAt = formatKst(new Date(Date.now() - 5 * 60 * 1000));
const params = new URLSearchParams({ tm2: requestedAt, stn: "0", disp: "0", help: "1", authKey: apiKey });
const response = await fetch(`${API_URL}?${params}`, { headers: { "User-Agent": "disaster-radar/0.4" } });
if (!response.ok) throw new Error(`KMA AWS API request failed: HTTP ${response.status}`);

const bytes = await response.arrayBuffer();
const text = new TextDecoder("euc-kr").decode(bytes);
const stations = text.split(/\r?\n/).map(parseAwsRow).filter(Boolean);
if (!stations.length) throw new Error("KMA AWS API returned no observation rows.");

const payload = {
  generatedAt: new Date().toISOString(),
  requestedAt,
  observedAt: stations[0].observedAt,
  source: "기상청 API허브 AWS 매분자료",
  refreshIntervalMinutes: 10,
  stationCount: stations.length,
  locationMetadataReady: false,
  stations,
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Saved ${stations.length} KMA AWS observations at ${payload.observedAt}.`);

