import{escapeHtml,formatObservedAt}from"./common.js";
export function installMapLayers(map,root="."){
  const street=L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",{maxZoom:20,subdomains:"abcd",attribution:'&copy; OpenStreetMap &copy; CARTO'}).addTo(map);
  const light=L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{maxZoom:20,subdomains:"abcd",attribution:'&copy; OpenStreetMap &copy; CARTO'});
  const satellite=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Tiles &copy; Esri"});
  const radar=L.layerGroup(),wind=L.layerGroup();
  L.control.layers({"도로 지도":street,"밝은 지도":light,"위성 지도":satellite},{"강수 레이더":radar,"AWS 바람 관측":wind},{collapsed:false,position:"topright"}).addTo(map);
  loadRadar(radar);loadWind(wind,root);
  return{street,light,satellite,radar,wind};
}
async function loadRadar(layer){try{const response=await fetch("https://api.rainviewer.com/public/weather-maps.json",{cache:"no-store"});if(!response.ok)throw Error(response.status);const data=await response.json(),frame=data.radar?.past?.at(-1);if(!frame)return;L.tileLayer(`${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,{opacity:.68,maxNativeZoom:7,maxZoom:20,attribution:"Radar © RainViewer"}).addTo(layer)}catch(error){console.error("Radar layer failed",error)}}
async function loadWind(layer,root){try{const response=await fetch(`${root}/data/aws-current.json?t=${Date.now()}`,{cache:"no-store"});if(!response.ok)throw Error(response.status);const data=await response.json(),stations=(data.stations||[]).filter(s=>Number.isFinite(s.latitude)&&Number.isFinite(s.longitude)&&s.windDirection1m!=null&&s.windSpeed1m!=null);stations.forEach((s,index)=>{if(index%2&&stations.length>500)return;const direction=Number(s.windDirection1m),speed=Number(s.windSpeed1m),icon=L.divIcon({className:"weather-wind-icon",html:`<span style="transform:rotate(${direction+180}deg)">↑</span><small>${speed.toFixed(1)}</small>`,iconSize:[30,34],iconAnchor:[15,17]});L.marker([s.latitude,s.longitude],{icon}).bindTooltip(`<strong>${escapeHtml(s.stationName||s.stationCode)}</strong><br>풍향 ${direction.toFixed(0)}° · 풍속 ${speed.toFixed(1)}m/s<br>${escapeHtml(formatObservedAt(s.observedAt))}`).addTo(layer)})}catch(error){console.error("AWS wind layer failed",error)}}
