import{mkdir,readFile,writeFile}from"node:fs/promises";
import{dirname,resolve}from"node:path";
import{fileURLToPath}from"node:url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),".."),OUTPUT=resolve(ROOT,"data","kma-warnings.json"),API="https://apihub.kma.go.kr/api/typ01/url/wrn_now_data_new.php";
async function localKey(){try{const text=await readFile(resolve(ROOT,".env"),"utf8");return text.split(/\r?\n/).find(x=>x.startsWith("KMA_API_KEY="))?.slice(12).trim()}catch{return undefined}}
function clean(value){const text=String(value||"").replace(/=$/,"").trim();return !text||text==="----"?null:text}
function parse(line){const f=line.split(",").map(clean);if(f.length<9||!/^L\d+/.test(f[0]||""))return null;return{upperRegionCode:f[0],upperRegionName:f[1],regionCode:f[2],regionName:f[3],announcedAt:f[4],effectiveAt:f[5],type:f[6],level:f[7],command:f[8],endedAt:f[9]}}
const key=process.env.KMA_API_KEY||await localKey();if(!key)throw Error("KMA_API_KEY is not configured.");
const params=new URLSearchParams({fe:"f",tm:"",disp:"1",help:"1",authKey:key}),response=await fetch(`${API}?${params}`,{headers:{"User-Agent":"disaster-radar/0.6"}});if(!response.ok)throw Error(`KMA warning API failed: HTTP ${response.status}`);
const text=new TextDecoder("euc-kr").decode(await response.arrayBuffer()),warnings=text.split(/\r?\n/).map(parse).filter(Boolean).filter(x=>x.command!=="해제");
const payload={generatedAt:new Date().toISOString(),source:"기상청 API허브 현재 기상특보",refreshIntervalMinutes:10,count:warnings.length,warnings};
await mkdir(dirname(OUTPUT),{recursive:true});await writeFile(OUTPUT,`${JSON.stringify(payload,null,2)}\n`,"utf8");console.log(`Saved ${warnings.length} active KMA warning-region rows.`);
