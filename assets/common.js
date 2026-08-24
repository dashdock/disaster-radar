export const categories = [
  {slug:"warnings",icon:"⚠️",title:"기상특보",description:"주의보·경보와 발효구역",status:"required",label:"API 필요"},
  {slug:"forecast",icon:"☔",title:"강수·기온 예보",description:"시간별 강수확률과 예상량",status:"connected",label:"연동됨"},
  {slug:"observations",icon:"🌡️",title:"AWS 실관측",description:"관측소별 기온·강수·바람",status:"connected",label:"연동됨"},
  {slug:"radar",icon:"📡",title:"기상레이더",description:"비구름 위치와 이동",status:"connected",label:"연동됨"},
  {slug:"rivers",icon:"🌊",title:"하천 수위",description:"수위와 공식 위험단계",status:"connected",label:"연동됨"},
  {slug:"dams",icon:"🏞️",title:"댐·보",description:"수위·유입량·방류량",status:"partial",label:"일부 연동"},
  {slug:"roads",icon:"📹",title:"도로·CCTV",description:"통제구간과 현장 영상",status:"required",label:"API 필요"},
  {slug:"land",icon:"⛰️",title:"산사태·산불",description:"산지 위험과 산불 현황",status:"required",label:"API 필요"},
  {slug:"air",icon:"😷",title:"대기질",description:"미세먼지·오존 등급",status:"required",label:"API 필요"},
  {slug:"health",icon:"🛡️",title:"감염병",description:"위기단계와 지역 주의정보",status:"mock",label:"정보 없음"},
  {slug:"drone",icon:"🚁",title:"드론 비행제한",description:"금지·제한 공역 확인",status:"required",label:"API 필요"},
  {slug:"alerts",icon:"🔔",title:"관심지역·알림",description:"관심지역과 알림 조건 관리",status:"partial",label:"일부 연동"}
];

export function rootPath(){return document.body.dataset.root || "."}
export function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c])}
export function distanceKm(a,b,c,d){const r=x=>x*Math.PI/180,dl=r(c-a),dn=r(d-b),v=Math.sin(dl/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dn/2)**2;return 6371*2*Math.atan2(Math.sqrt(v),Math.sqrt(1-v))}
export function formatObservedAt(value){return /^\d{12}$/.test(value||"")?`${value.slice(0,4)}.${value.slice(4,6)}.${value.slice(6,8)} ${value.slice(8,10)}:${value.slice(10,12)}`:"수신시각 없음"}
export function weatherMeta(code){if(code===0)return["☀️","맑음"];if([1,2,3].includes(code))return["☁️","구름 많음"];if([45,48].includes(code))return["🌫️","안개"];if(code>=51&&code<=67)return["🌧️","비"];if(code>=71&&code<=77)return["🌨️","눈"];if(code>=80&&code<=82)return["🌦️","소나기"];if(code>=95)return["⛈️","뇌우"];return["🌤️","관측 중"]}
export function renderShell(active="home"){
  const root=rootPath();document.getElementById("site-header").innerHTML=`<div class="site-header"><div class="header-inner"><a class="brand" href="${root}/"><span class="brand-mark">◎</span><span>재난레이더</span></a><nav class="header-nav"><a class="${active==="home"?"active":""}" href="${root}/">홈</a><a class="${active==="warnings"?"active":""}" href="${root}/warnings/">기상특보</a><a class="${active==="forecast"?"active":""}" href="${root}/forecast/">예보</a><a class="${active==="observations"?"active":""}" href="${root}/observations/">실관측</a><a class="${active==="roads"?"active":""}" href="${root}/roads/">CCTV</a><a class="${active==="alerts"?"active":""}" href="${root}/alerts/">알림</a></nav></div></div>`;document.getElementById("site-footer").innerHTML=`<div class="site-footer">재난레이더 · 데이터 출처와 연동상태를 투명하게 표시합니다. 긴급상황에서는 119 또는 공식 재난 안내를 따르세요.</div>`
}
export function renderCategoryGrid(target,root="."){target.innerHTML=categories.map(c=>`<a class="category-card" href="${root}/${c.slug}/"><span class="source-badge ${c.status}">${c.label}</span><span class="category-icon">${c.icon}</span><span class="category-title">${c.title}</span><span class="category-description">${c.description}</span></a>`).join("")}
