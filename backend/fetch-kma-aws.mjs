import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = resolve(ROOT_DIR, "data", "aws-current.json");
const API_URL = "https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min";
const STATION_API_URL = "https://apihub.kma.go.kr/api/typ01/url/stn_inf.php";

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

function parseStationRow(line) {
  const fields = line.trim().split(/\s+/);
  if (fields.length < 14 || !/^\d+$/.test(fields[0])) return null;
  const longitude = Number.parseFloat(fields[1]);
  const latitude = Number.parseFloat(fields[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    stationCode: fields[0],
    longitude,
    latitude,
    stationType: fields[3],
    altitude: validNumber(fields[4]),
    anemometerHeight: validNumber(fields[5]),
    stationName: fields[8] === "----" ? null : fields[8],
    forecastCode: fields[10] === "----" ? null : fields[10],
    legalDistrictCode: fields[11] === "----" ? null : fields[11],
    basinCode: fields[12] === "----" ? null : fields[12],
    address: fields.slice(13).join(" ") || null,
  };
}

async function fetchEucKrText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "disaster-radar/0.5" } });
  if (!response.ok) throw new Error(`KMA API request failed: HTTP ${response.status}`);
  return new TextDecoder("euc-kr").decode(await response.arrayBuffer());
}

const apiKey = process.env.KMA_API_KEY || await readLocalApiKey();
if (!apiKey) throw new Error("KMA_API_KEY is not configured.");

const requestedAt = formatKst(new Date(Date.now() - 5 * 60 * 1000));
const params = new URLSearchParams({ tm2: requestedAt, stn: "0", disp: "0", help: "1", authKey: apiKey });
const stationParams = new URLSearchParams({ inf: "AWS", stn: "", tm: requestedAt, help: "1", authKey: apiKey });
const [observationText, stationText] = await Promise.all([
  fetchEucKrText(`${API_URL}?${params}`),
  fetchEucKrText(`${STATION_API_URL}?${stationParams}`),
]);
const stationMetadata = stationText.split(/\r?\n/).map(parseStationRow).filter(Boolean);
const metadataByCode = new Map(stationMetadata.map(station => [station.stationCode, station]));
const stations = observationText.split(/\r?\n/).map(parseAwsRow).filter(Boolean).map(observation => ({
  ...observation,
  ...(metadataByCode.get(observation.stationCode) || {}),
}));
if (!stations.length) throw new Error("KMA AWS API returned no observation rows.");

const locatedStationCount = stations.filter(station => Number.isFinite(station.latitude) && Number.isFinite(station.longitude)).length;

const payload = {
  generatedAt: new Date().toISOString(),
  requestedAt,
  observedAt: stations[0].observedAt,
  source: "기상청 API허브 AWS 매분자료·지상관측 지점정보",
  refreshIntervalMinutes: 10,
  stationCount: stations.length,
  locatedStationCount,
  locationMetadataReady: locatedStationCount > 0,
  stations,
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Saved ${stations.length} KMA AWS observations at ${payload.observedAt}.`);
