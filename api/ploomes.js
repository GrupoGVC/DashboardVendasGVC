// api/ploomes.js
const BASE = ‘https://api2.ploomes.com’;
const ANO  = 2026;

const SELLER_CONFIG = {
‘MARIANE ALMEIDA’:      { empresa: ‘Retec Oeste’,    id: ‘mariane’,    meta: { RSS: 2000,  Gerenciamento: 22400, Consultoria: 600,  total: 25000 } },
‘Jefferson Ferreira’:   { empresa: ‘Retec Resíduos’, id: ‘jefferson’,  meta: { RSS: 20000, Gerenciamento: 32000, Consultoria: 3000, total: 55000 } },
‘ELIS ADRIELE’:         { empresa: ‘Retec Oeste’,    id: ‘elis’,       meta: { RSS: 9400,  Gerenciamento: 25000, Consultoria: 600,  total: 35000 } },
‘Laila Nunes’:          { empresa: ‘Retec Resíduos’, id: ‘laila’,      meta: { RSS: 18000, Gerenciamento: 24000, Consultoria: 3000, total: 45000 } },
‘Jacqueline Bastos’:    { empresa: ‘Retec Resíduos’, id: ‘jacqueline’, meta: { RSS: 18000, Gerenciamento: 24000, Consultoria: 3000, total: 45000 } },
‘Daniel Leles’:         { empresa: ‘Retec Oeste’,    id: ‘daniel’,     meta: { RSS: 9400,  Gerenciamento: 25000, Consultoria: 600,  total: 35000 } },
‘Luciane Cruz Santana’: { empresa: ‘Retec Resíduos’, id: ‘luciane’,    meta: { RSS: 7600,  Gerenciamento: 34400, Consultoria: 3000, total: 45000 } },
‘Ivson Cavalcanti’:     { empresa: ‘Retec Resíduos’, id: ‘ivson’,      meta: { RSS: 10000, Gerenciamento: 20000, Consultoria: 0,    total: 30000 } },
‘Leonilton Oliveira’:   { empresa: ‘Retec Sul’,      id: ‘leonilton’,  meta: { RSS: 5000,  Gerenciamento: 10000, Consultoria: 0,    total: 15000 } },
‘Silvio Leal’:          { empresa: ‘Retec Centro’,   id: ‘silvio’,     meta: { RSS: 5000,  Gerenciamento: 10000, Consultoria: 0,    total: 15000 } },
};

const META_TOTAL = 335000;

async function ploomesGet(url, key) {
const r = await fetch(url, {
headers: { ‘User-Key’: key, ‘Content-Type’: ‘application/json’ }
});
if (!r.ok) {
const txt = await r.text().catch(() => ‘’);
throw new Error(`Ploomes ${r.status}: ${txt.slice(0, 200)}`);
}
return r.json();
}

const getMonth  = d => d ? new Date(d).getMonth() + 1 : null;
const daysSince = d => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : 0;

function extractProduct(deal) {
const t = (deal.Title || ‘’).toUpperCase();
if (t.includes(‘RSS’) || t.includes(‘RESIDUO’) || t.includes(‘RESÍDUO’)) return ‘RSS’;
if (t.includes(‘CONSULTORIA’)) return ‘Consultoria’;
return ‘Gerenciamento’;
}

function alertLevel(deal) {
const v = deal.TotalValue || 0, d = daysSince(deal.CreateDate);
if (d > 60 || v > 50000) return ‘CRITICO’;
if (d > 20 || v > 10000) return ‘ATENCAO’;
return ‘OK’;
}

const SEL = ‘$select=Id,Title,TotalValue,DealStageName,ResponsibleUserName,WonDate,LostDate,CreateDate,LossReasonName,OriginName’;

module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’,  ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘GET, OPTIONS’);
if (req.method === ‘OPTIONS’) return res.status(200).end();

const key = process.env.PLOOMES_KEY;
if (!key) return res.status(500).json({ error: ‘PLOOMES_KEY não configurada.’ });

try {
const ANO_STR = `${ANO}-01-01T00:00:00`;

```
// Uma única requisição por status — sem paginação, máximo 500 por chamada
const [rWon, rLost, rOpen] = await Promise.all([
  ploomesGet(`${BASE}/Deals?${SEL}&$filter=StatusId eq 2 and WonDate ge datetime'${ANO_STR}'&$top=500&$orderby=WonDate desc`, key),
  ploomesGet(`${BASE}/Deals?${SEL}&$filter=StatusId eq 3 and LostDate ge datetime'${ANO_STR}'&$top=500&$orderby=LostDate desc`, key),
  ploomesGet(`${BASE}/Deals?${SEL}&$filter=StatusId eq 1&$top=500&$orderby=CreateDate desc`, key),
]);

const wonDeals  = rWon.value  || [];
const lostDeals = rLost.value || [];
const openDeals = rOpen.value || [];

const sd = {}, origMap = {}, lossMap = {};

// Ganhos
for (const deal of wonDeals) {
  const name = deal.ResponsibleUserName; if (!name) continue;
  const month = getMonth(deal.WonDate);  if (!month) continue;
  const val = deal.TotalValue || 0;
  const origin  = deal.OriginName || 'Não informado';
  const product = extractProduct(deal);

  if (!sd[name]) sd[name] = {jan:0,feb:0,mar:0,janW:0,febW:0,marW:0,janL:0,febL:0,marL:0,totalWon:0,totalLost:0,marRss:0,marGer:0,marCon:0};
  if (month===1){sd[name].jan+=val;sd[name].janW++;}
  if (month===2){sd[name].feb+=val;sd[name].febW++;}
  if (month===3){
    sd[name].mar+=val;sd[name].marW++;
    if (product==='RSS')sd[name].marRss+=val;
    else if (product==='Consultoria')sd[name].marCon+=val;
    else sd[name].marGer+=val;
  }
  sd[name].totalWon++;
  if (!origMap[origin])origMap[origin]={o:origin,q:0,r:0,p:0,marQ:0,marR:0};
  origMap[origin].q++;origMap[origin].r+=val;
  if(month===3){origMap[origin].marQ++;origMap[origin].marR+=val;}
}

// Perdidos
for (const deal of lostDeals) {
  const name = deal.ResponsibleUserName; if (!name) continue;
  const month = getMonth(deal.LostDate); if (!month) continue;
  if (!sd[name]) sd[name]={jan:0,feb:0,mar:0,janW:0,febW:0,marW:0,janL:0,febL:0,marL:0,totalWon:0,totalLost:0,marRss:0,marGer:0,marCon:0};
  if(month===1)sd[name].janL++;
  if(month===2)sd[name].febL++;
  if(month===3)sd[name].marL++;
  sd[name].totalLost++;
  const reason = deal.LossReasonName||'Não informado';
  if(!lossMap[reason])lossMap[reason]={reason,count:0,value:0};
  lossMap[reason].count++;lossMap[reason].value+=deal.TotalValue||0;
  const origin = deal.OriginName||'Não informado';
  if(origMap[origin])origMap[origin].p++;
}

// Abertos
const funnelCount={},funnelVal={},openBySel={};let fcTotal=0;
for (const deal of openDeals) {
  const stage=deal.DealStageName||'Outros',val=deal.TotalValue||0;
  funnelCount[stage]=(funnelCount[stage]||0)+1;
  funnelVal[stage]=(funnelVal[stage]||0)+val;
  const name=deal.ResponsibleUserName;
  if(name){
    if(!openBySel[name])openBySel[name]={count:0,forecast:0,deals:[]};
    openBySel[name].count++;openBySel[name].deals.push(deal);
    if(['forcast','forecast'].includes(stage.toLowerCase())){openBySel[name].forecast+=val;fcTotal+=val;}
  }
}

// Sellers
const sellers = Object.keys(SELLER_CONFIG).map(name => {
  const s=sd[name]||{jan:0,feb:0,mar:0,janW:0,febW:0,marW:0,janL:0,febL:0,marL:0,totalWon:0,totalLost:0,marRss:0,marGer:0,marCon:0};
  const ob=openBySel[name]||{count:0,forecast:0,deals:[]};
  const conf=SELLER_CONFIG[name];
  const totalRev=s.jan+s.feb+s.mar;
  const conv=s.totalWon+s.totalLost>0?Math.round(s.totalWon/(s.totalWon+s.totalLost)*1000)/10:0;
  const ticket=s.totalWon>0?Math.round(totalRev/s.totalWon):0;
  const pct=conf.meta.total>0?Math.round(s.mar/conf.meta.total*100):0;
  const trend=pct>=80?'green':pct>=40?'gold':'red';
  const tl=pct>=80?'Alta Probabilidade':pct>=40?'Possível — Ação Necessária':pct>0?'Não Atingirá — Ação Urgente':'Risco — Requer Ação';
  const topDeals=ob.deals.sort((a,b)=>(b.TotalValue||0)-(a.TotalValue||0)).slice(0,7)
    .map(d=>[(d.Title||'Sem título').substring(0,40).toUpperCase(),d.DealStageName||'Pipeline',d.TotalValue||0,daysSince(d.CreateDate),extractProduct(d),alertLevel(d)]);
  return {
    id:conf.id,name,empresa:conf.empresa,jan:s.jan,feb:s.feb,mar:s.mar,
    total_rev:totalRev,total_won:s.totalWon,total_lost:s.totalLost,
    conv,ticket,forecast:ob.forecast,open:ob.count,cycle:28,
    mar_meta:conf.meta,mar_act:{rss:s.marRss,ger:s.marGer,con:s.marCon,total:s.mar},
    comp:{
      conv:parseFloat(Math.min(10,Math.max(1,conv/10)).toFixed(1)),
      ticket:parseFloat(Math.min(10,Math.max(1,ticket/1500)).toFixed(1)),
      volume:parseFloat(Math.min(10,Math.max(1,(s.totalWon+s.totalLost)/30*10)).toFixed(1)),
      consist:parseFloat(((s.jan>0?3.3:0)+(s.feb>0?3.3:0)+(s.mar>0?3.4:0)).toFixed(1)),
      funil:parseFloat(Math.min(10,Math.max(2,ob.count>0?7:3)).toFixed(1)),
    },
    trend,tl,pct,deals:topDeals,
  };
});

const mbs={};
[1,2,3].forEach(m=>{
  const rK=m===1?'jan':m===2?'feb':'mar',wK=m===1?'janW':m===2?'febW':'marW',lK=m===1?'janL':m===2?'febL':'marL';
  mbs[m]=sellers.map(s=>{
    const d=sd[s.name]||{},r=d[rK]||0,w=d[wK]||0,l=d[lK]||0;
    return{n:s.name,r,m:s.mar_meta.total,emp:s.empresa,p:s.mar_meta.total>0?Math.round(r/s.mar_meta.total*100):0,w,l,c:w+l>0?Math.round(w/(w+l)*1000)/10:0};
  }).sort((a,b)=>b.r-a.r);
});

const allWon=sellers.reduce((a,s)=>a+s.total_won,0),allLost=sellers.reduce((a,s)=>a+s.total_lost,0);
const mrev={1:sellers.reduce((a,s)=>a+s.jan,0),2:sellers.reduce((a,s)=>a+s.feb,0),3:sellers.reduce((a,s)=>a+s.mar,0)};
const mwon={},mlost={},mconv={};
[1,2,3].forEach(m=>{
  const wK=m===1?'janW':m===2?'febW':'marW',lK=m===1?'janL':m===2?'febL':'marL';
mwon[m]=sellers.reduce((a,s)=>a+((sd[s.name]&&sd[s.name][wK])||0),0);
mlost[m]=sellers.reduce((a,s)=>a+((sd[s.name]&&sd[s.name][lK])||0),0);
  mconv[m]=mwon[m]+mlost[m]>0?Math.round(mwon[m]/(mwon[m]+mlost[m])*1000)/10:0;
});

const G={
  total_rev:mrev[1]+mrev[2]+mrev[3],total_won:allWon,total_lost:allLost,
  conv_geral:allWon+allLost>0?Math.round(allWon/(allWon+allLost)*1000)/10:0,
  ticket_medio:allWon>0?Math.round((mrev[1]+mrev[2]+mrev[3])/allWon):0,
  fc_total:fcTotal,meta_total:META_TOTAL,mrev,mwon,mlost,mconv,
  motivos:Object.values(lossMap).sort((a,b)=>b.count-a.count).slice(0,10).map(r=>[r.reason,r.count,r.value]),
  pmix:{Gerenciamento:sellers.reduce((a,s)=>a+s.mar_act.ger,0),RSS:sellers.reduce((a,s)=>a+s.mar_act.rss,0),Consultoria:sellers.reduce((a,s)=>a+s.mar_act.con,0)},
  funnel:funnelCount,fvals:funnelVal,
};

const origAnual=Object.values(origMap).sort((a,b)=>b.r-a.r).map(o=>({o:o.o,q:o.q,r:o.r,p:o.p,t:o.q>0?Math.round(o.r/o.q):0,c:o.q+o.p>0?Math.round(o.q/(o.q+o.p)*1000)/10:0}));
const origMarco=Object.values(origMap).filter(o=>o.marQ>0).sort((a,b)=>b.marR-a.marR).map(o=>({o:o.o,q:o.marQ,r:o.marR,t:o.marQ>0?Math.round(o.marR/o.marQ):0}));

const now=new Date();
const today=`${String(now.getDate()).padStart(2,'0')} / ${String(now.getMonth()+1).padStart(2,'0')} / ${now.getFullYear()}`;

return res.status(200).json({sellers,G,mbs,OR:{anual:origAnual,marco:origMarco},today});
```

} catch(e) {
console.error(’[ploomes-api]’,e.message);
return res.status(500).json({error:e.message});
}
};
