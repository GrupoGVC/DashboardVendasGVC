const BASE = 'https://api2.ploomes.com';

async function ploomesFetch(path, key) {
  const url = BASE + path;
  const res = await fetch(url, {
    headers: {
      'User-Key': key,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Ploomes ' + res.status + ': ' + text.substring(0, 200));
  }
  return res.json();
}

function getMonth(dateStr) {
  if (!dateStr) return 0;
  return new Date(dateStr).getMonth() + 1;
}

function getYear(dateStr) {
  if (!dateStr) return 0;
  return new Date(dateStr).getFullYear();
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const key = process.env.PLOOMES_KEY;
  if (!key) {
    return res.status(500).json({ error: 'PLOOMES_KEY nao configurada' });
  }

  try {
    const [wonData, lostData, openData] = await Promise.all([
      ploomesFetch('/Deals?$filter=StatusId eq 2&$top=500', key),
      ploomesFetch('/Deals?$filter=StatusId eq 3&$top=500', key),
      ploomesFetch('/Deals?$filter=StatusId eq 1&$top=500', key)
    ]);

    const won = wonData.value || [];
    const lost = lostData.value || [];
    const open = openData.value || [];

    const won26 = won.filter(d => getYear(d.FinishDate || d.UpdateDate || d.CreateDate) === 2026);
    const lost26 = lost.filter(d => getYear(d.FinishDate || d.UpdateDate || d.CreateDate) === 2026);

    const now = new Date();
    const today = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const currentMonth = now.getMonth() + 1;

    const sellerMap = {};

    function ensureSeller(deal) {
      const name = deal.OwnerName || deal.ContactName || 'Sem Responsavel';
      const id = name.toLowerCase().replace(/\s+/g, '_');
      const empresa = deal.TeamName || '';
      if (!sellerMap[id]) {
        sellerMap[id] = {
          id, name, empresa,
          jan: 0, feb: 0, mar: 0,
          won1: 0, won2: 0, won3: 0,
          lost1: 0, lost2: 0, lost3: 0,
          openDeals: [],
          forecast: 0,
          totalLost: 0
        };
      }
      return sellerMap[id];
    }

    won26.forEach(d => {
      const s = ensureSeller(d);
      const m = getMonth(d.FinishDate || d.UpdateDate || d.CreateDate);
      const v = d.Amount || d.TotalAmount || 0;
      if (m === 1) { s.jan += v; s.won1++; }
      if (m === 2) { s.feb += v; s.won2++; }
      if (m === 3) { s.mar += v; s.won3++; }
    });

    lost26.forEach(d => {
      const s = ensureSeller(d);
      const m = getMonth(d.FinishDate || d.UpdateDate || d.CreateDate);
      if (m === 1) s.lost1++;
      if (m === 2) s.lost2++;
      if (m === 3) s.lost3++;
      s.totalLost++;
    });

    open.forEach(d => {
      const s = ensureSeller(d);
      const v = d.Amount || d.TotalAmount || 0;
      const stage = d.StageName || d.Stage || '';
      const days = daysSince(d.CreateDate);
      const client = d.ContactName || d.Name || '';
      const prod = d.ProductName || d.Category || '';
      const alert = days > 30 ? 'CRITICO' : days > 20 ? 'ATENCAO' : 'OK';
      if (['forcast', 'forecast', 'Forcast', 'Forecast'].includes(stage)) {
        s.forecast += v;
      }
      s.openDeals.push([client, stage, v, days, prod, alert]);
    });

    const META_SELLER = 50000;

    const sellers = Object.values(sellerMap).map(s => {
      const totalWon = s.won1 + s.won2 + s.won3;
      const totalRev = s.jan + s.feb + s.mar;
      const totalL = s.lost1 + s.lost2 + s.lost3;
      const conv = totalWon + totalL > 0 ? Math.round(totalWon / (totalWon + totalL) * 1000) / 10 : 0;
      const ticket = totalWon > 0 ? Math.round(totalRev / totalWon) : 0;
      const marAct = s.mar;
      const pct = META_SELLER > 0 ? Math.round(marAct / META_SELLER * 100) : 0;
      const trend = pct >= 80 ? 'green' : pct >= 40 ? 'gold' : 'red';
      const tl = pct >= 80 ? 'Meta atingida' : pct >= 40 ? 'Em progresso' : 'Abaixo da meta';
      const openDays = s.openDeals.map(d => d[3]);
      const cycle = openDays.length > 0 ? Math.round(openDays.reduce((a, b) => a + b, 0) / openDays.length) : 25;

      return {
        id: s.id,
        name: s.name,
        empresa: s.empresa,
        jan: s.jan,
        feb: s.feb,
        mar: s.mar,
        won1: s.won1,
        won2: s.won2,
        won3: s.won3,
        lost1: s.lost1,
        lost2: s.lost2,
        lost3: s.lost3,
        total_rev: totalRev,
        total_won: totalWon,
        total_lost: totalL,
        conv,
        ticket,
        pct,
        trend,
        tl,
        cycle,
        forecast: s.forecast,
        open: s.openDeals.length,
        mar_act: { total: marAct, rss: 0, ger: marAct, con: 0 },
        mar_meta: { total: META_SELLER, RSS: 0, Gerenciamento: META_SELLER, Consultoria: 0 },
        deals: s.openDeals.slice(0, 10),
        comp: {
          conv: Math.min(10, conv / 10),
          ticket: Math.min(10, ticket / 10000),
          volume: Math.min(10, totalWon / 3),
          consist: Math.min(10, (s.jan > 0 ? 3 : 0) + (s.feb > 0 ? 3 : 0) + (s.mar > 0 ? 4 : 0)),
          funil: Math.min(10, s.openDeals.length / 3)
        }
      };
    });

    const totalRevAll = sellers.reduce((s, x) => s + x.total_rev, 0);
    const totalWonAll = sellers.reduce((s, x) => s + x.total_won, 0);
    const totalLostAll = sellers.reduce((s, x) => s + x.total_lost, 0);
    const mrev1 = sellers.reduce((s, x) => s + x.jan, 0);
    const mrev2 = sellers.reduce((s, x) => s + x.feb, 0);
    const mrev3 = sellers.reduce((s, x) => s + x.mar, 0);
    const mwon1 = sellers.reduce((s, x) => s + (x.won1 || 0), 0);
    const mwon2 = sellers.reduce((s, x) => s + (x.won2 || 0), 0);
    const mwon3 = sellers.reduce((s, x) => s + (x.won3 || 0), 0);
    const mlost1 = sellers.reduce((s, x) => s + (x.lost1 || 0), 0);
    const mlost2 = sellers.reduce((s, x) => s + (x.lost2 || 0), 0);
    const mlost3 = sellers.reduce((s, x) => s + (x.lost3 || 0), 0);
    const convGeral = totalWonAll + totalLostAll > 0 ? Math.round(totalWonAll / (totalWonAll + totalLostAll) * 1000) / 10 : 0;
    const ticketMedio = totalWonAll > 0 ? Math.round(totalRevAll / totalWonAll) : 0;
    const fcTotal = sellers.reduce((s, x) => s + x.forecast, 0);
    const META_TOTAL = 335000;

    const funnel = {};
    const fvals = {};
    open.forEach(d => {
      const stage = d.StageName || d.Stage || 'Sem Etapa';
      const v = d.Amount || d.TotalAmount || 0;
      funnel[stage] = (funnel[stage] || 0) + 1;
      fvals[stage] = (fvals[stage] || 0) + v;
    });

    const motivoMap = {};
    lost26.forEach(d => {
      const m = d.LossReason || d.LossReasonName || 'Nao informado';
      const v = d.Amount || d.TotalAmount || 0;
      if (!motivoMap[m]) motivoMap[m] = { c: 0, v: 0 };
      motivoMap[m].c++;
      motivoMap[m].v += v;
    });
    const motivos = Object.entries(motivoMap)
      .sort((a, b) => b[1].c - a[1].c)
      .slice(0, 5)
      .map(([m, x]) => [m, x.c, x.v]);

    const pmix = { Gerenciamento: 0, RSS: 0, Consultoria: 0 };
    won26.forEach(d => {
      const cat = (d.ProductName || d.Category || '').toLowerCase();
      const v = d.Amount || d.TotalAmount || 0;
      if (cat.includes('rss')) pmix.RSS += v;
      else if (cat.includes('consul')) pmix.Consultoria += v;
      else pmix.Gerenciamento += v;
    });
    if (pmix.Gerenciamento === 0 && pmix.RSS === 0 && pmix.Consultoria === 0) {
      pmix.Gerenciamento = totalRevAll;
    }

    const origemMapAnual = {};
    const origemMapMarco = {};
    const lostOrigemMap = {};

    won26.forEach(d => {
      const o = d.ContactSourceName || d.LeadSource || 'Nao informado';
      const v = d.Amount || d.TotalAmount || 0;
      const m = getMonth(d.FinishDate || d.UpdateDate || d.CreateDate);
      if (!origemMapAnual[o]) origemMapAnual[o] = { q: 0, r: 0 };
      origemMapAnual[o].q++;
      origemMapAnual[o].r += v;
      if (m === currentMonth) {
        if (!origemMapMarco[o]) origemMapMarco[o] = { q: 0, r: 0 };
        origemMapMarco[o].q++;
        origemMapMarco[o].r += v;
      }
    });

    lost26.forEach(d => {
      const o = d.ContactSourceName || d.LeadSource || 'Nao informado';
      lostOrigemMap[o] = (lostOrigemMap[o] || 0) + 1;
    });

    const ORanual = Object.entries(origemMapAnual).map(([o, x]) => {
      const lq = lostOrigemMap[o] || 0;
      const c = x.q + lq > 0 ? Math.round(x.q / (x.q + lq) * 100) : 0;
      const t = x.q > 0 ? Math.round(x.r / x.q) : 0;
      return { o, q: x.q, r: x.r, c, t };
    }).sort((a, b) => b.r - a.r);

    const ORmarco = Object.entries(origemMapMarco).map(([o, x]) => {
      const t = x.q > 0 ? Math.round(x.r / x.q) : 0;
      return { o, q: x.q, r: x.r, t };
    }).sort((a, b) => b.r - a.r);

    const mbs = { 1: [], 2: [], 3: [] };
    sellers.forEach(s => {
      mbs[1].push({ n: s.name, emp: s.empresa, r: s.jan, m: META_SELLER, p: META_SELLER > 0 ? Math.round(s.jan / META_SELLER * 100) : 0, w: s.won1 || 0, l: s.lost1 || 0, c: (s.won1 || 0) + (s.lost1 || 0) > 0 ? Math.round((s.won1 || 0) / ((s.won1 || 0) + (s.lost1 || 0)) * 100) : 0 });
      mbs[2].push({ n: s.name, emp: s.empresa, r: s.feb, m: META_SELLER, p: META_SELLER > 0 ? Math.round(s.feb / META_SELLER * 100) : 0, w: s.won2 || 0, l: s.lost2 || 0, c: (s.won2 || 0) + (s.lost2 || 0) > 0 ? Math.round((s.won2 || 0) / ((s.won2 || 0) + (s.lost2 || 0)) * 100) : 0 });
      mbs[3].push({ n: s.name, emp: s.empresa, r: s.mar, m: META_SELLER, p: META_SELLER > 0 ? Math.round(s.mar / META_SELLER * 100) : 0, w: s.won3 || 0, l: s.lost3 || 0, c: (s.won3 || 0) + (s.lost3 || 0) > 0 ? Math.round((s.won3 || 0) / ((s.won3 || 0) + (s.lost3 || 0)) * 100) : 0 });
    });

    return res.status(200).json({
      today,
      sellers,
      G: {
        total_rev: totalRevAll,
        total_won: totalWonAll,
        total_lost: totalLostAll,
        conv_geral: convGeral,
        ticket_medio: ticketMedio,
        fc_total: fcTotal,
        meta_total: META_TOTAL,
        mrev: { 1: mrev1, 2: mrev2, 3: mrev3 },
        mwon: { 1: mwon1, 2: mwon2, 3: mwon3 },
        mlost: { 1: mlost1, 2: mlost2, 3: mlost3 },
        mconv: {
          1: mwon1 + mlost1 > 0 ? Math.round(mwon1 / (mwon1 + mlost1) * 1000) / 10 : 0,
          2: mwon2 + mlost2 > 0 ? Math.round(mwon2 / (mwon2 + mlost2) * 1000) / 10 : 0,
          3: mwon3 + mlost3 > 0 ? Math.round(mwon3 / (mwon3 + mlost3) * 1000) / 10 : 0
        },
        motivos,
        pmix,
        funnel,
        fvals
      },
      mbs,
      OR: {
        anual: ORanual,
        marco: ORmarco
      }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
