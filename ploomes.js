// ─────────────────────────────────────────────────────────────────────────────
//  api/ploomes.js  —  Vercel Serverless Function
//  Busca dados do CRM Ploomes e retorna JSON processado para o Dashboard GVC
// ─────────────────────────────────────────────────────────────────────────────

const BASE = 'https://api2.ploomes.com';
const ANO  = 2026;

// ── Configuração de Consultores ───────────────────────────────────────────────
// Metas são definidas aqui (não vêm do CRM).
// Ajuste os nomes para bater EXATAMENTE com ResponsibleUserName no Ploomes.
const SELLER_CONFIG = {
  'MARIANE ALMEIDA':      { empresa: 'Retec Oeste',    id: 'mariane',    meta: { RSS: 2000,  Gerenciamento: 22400, Consultoria: 600,  total: 25000 } },
  'Jefferson Ferreira':   { empresa: 'Retec Resíduos', id: 'jefferson',  meta: { RSS: 20000, Gerenciamento: 32000, Consultoria: 3000, total: 55000 } },
  'ELIS ADRIELE':         { empresa: 'Retec Oeste',    id: 'elis',       meta: { RSS: 9400,  Gerenciamento: 25000, Consultoria: 600,  total: 35000 } },
  'Laila Nunes':          { empresa: 'Retec Resíduos', id: 'laila',      meta: { RSS: 18000, Gerenciamento: 24000, Consultoria: 3000, total: 45000 } },
  'Jacqueline Bastos':    { empresa: 'Retec Resíduos', id: 'jacqueline', meta: { RSS: 18000, Gerenciamento: 24000, Consultoria: 3000, total: 45000 } },
  'Daniel Leles':         { empresa: 'Retec Oeste',    id: 'daniel',     meta: { RSS: 9400,  Gerenciamento: 25000, Consultoria: 600,  total: 35000 } },
  'Luciane Cruz Santana': { empresa: 'Retec Resíduos', id: 'luciane',    meta: { RSS: 7600,  Gerenciamento: 34400, Consultoria: 3000, total: 45000 } },
  'Ivson Cavalcanti':     { empresa: 'Retec Resíduos', id: 'ivson',      meta: { RSS: 10000, Gerenciamento: 20000, Consultoria: 0,    total: 30000 } },
  'Leonilton Oliveira':   { empresa: 'Retec Sul',      id: 'leonilton',  meta: { RSS: 5000,  Gerenciamento: 10000, Consultoria: 0,    total: 15000 } },
  'Silvio Leal':          { empresa: 'Retec Centro',   id: 'silvio',     meta: { RSS: 5000,  Gerenciamento: 10000, Consultoria: 0,    total: 15000 } },
};

const META_TOTAL = 335000;

// ── Campo personalizado para Produto (RSS / Gerenciamento / Consultoria) ──────
// Ajuste para o nome exato do campo customizado no seu Ploomes.
// Ex: 'Produto', 'Tipo de Serviço', 'Linha'
const CAMPO_PRODUTO = 'Produto';

// ── Campo personalizado para Origem (se não usar OriginName nativo) ───────────
const CAMPO_ORIGEM = 'Origem';

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function ploomesFetch(path, key) {
  let all  = [];
  let skip = 0;
  const top = 200;

  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${BASE}${path}${sep}$top=${top}&$skip=${skip}`;

    const r = await fetch(url, {
      headers: { 'User-Key': key, 'Content-Type': 'application/json' },
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`Ploomes ${r.status}: ${txt.slice(0, 300)}`);
    }

    const json  = await r.json();
    const items = json.value || [];
    all = [...all, ...items];
    if (items.length < top) break;
    skip += top;
  }
  return all;
}

function getMonth(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).getMonth() + 1; // 1–12
}

function getYear(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).getFullYear();
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr)) / 86_400_000);
}

/** Tenta extrair o valor de um campo customizado (OtherProperties) */
function getOtherProp(deal, fieldName) {
  const props = deal.OtherProperties || [];
  for (const p of props) {
    const name = (p.FieldName || p.FieldKey || '').trim();
    if (name.toLowerCase() === fieldName.toLowerCase()) {
      return p.StringValue || p.IntegerValue || p.DecimalValue || p.Value || null;
    }
  }
  return null;
}

/** Classifica o deal em RSS / Gerenciamento / Consultoria */
function extractProduct(deal) {
  const fromProp = getOtherProp(deal, CAMPO_PRODUTO);
  if (fromProp) return fromProp;

  // Fallback heurístico pelo título
  const title = (deal.Title || '').toUpperCase();
  if (title.includes('RSS') || title.includes('RESÍDUO') || title.includes('RESIDUO')) return 'RSS';
  if (title.includes('CONSULTORIA') || title.includes('CONSUL')) return 'Consultoria';
  return 'Gerenciamento';
}

/** Extrai a origem do deal */
function extractOrigin(deal) {
  if (deal.OriginName) return deal.OriginName;
  const fromProp = getOtherProp(deal, CAMPO_ORIGEM);
  if (fromProp) return fromProp;
  return 'Não informado';
}

/** Extrai o motivo de perda */
function extractLossReason(deal) {
  if (deal.LossReasonName)  return deal.LossReasonName;
  if (deal.LossReason)      return deal.LossReason;
  const fromProp = getOtherProp(deal, 'Motivo de Perda');
  if (fromProp) return fromProp;
  return 'Não informado';
}

/** Nível de alerta de um deal em aberto */
function alertLevel(deal) {
  const val  = deal.TotalValue || 0;
  const days = daysSince(deal.CreateDate);
  if (days > 60 || val > 50_000) return 'CRITICO';
  if (days > 20 || val > 10_000) return 'ATENCAO';
  return 'OK';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Handler principal
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.PLOOMES_KEY;
  if (!key) return res.status(500).json({ error: 'Variável PLOOMES_KEY não configurada no Vercel.' });

  try {
    const sel = '$expand=OtherProperties';

    // Busca paralela: ganhos 2026, perdidos 2026, em aberto
    const [wonDeals, lostDeals, openDeals] = await Promise.all([
      ploomesFetch(`/Deals?$filter=IsWon eq true and WonDate ge datetime'${ANO}-01-01T00:00:00'&${sel}`),
      ploomesFetch(`/Deals?$filter=IsLost eq true and LostDate ge datetime'${ANO}-01-01T00:00:00'&${sel}`),
      ploomesFetch(`/Deals?$filter=IsWon eq false and IsLost eq false&${sel}`),
    ]);

    // ── Processar deals GANHOS ──────────────────────────────────────────────
    const sd      = {}; // sellerData keyed by name
    const origMap = {}; // origin aggregation

    for (const deal of wonDeals) {
      const name = deal.ResponsibleUserName;
      if (!name) continue;
      const month = getMonth(deal.WonDate);
      const year  = getYear(deal.WonDate);
      if (!month || year !== ANO) continue;

      const val     = deal.TotalValue || 0;
      const origin  = extractOrigin(deal);
      const product = extractProduct(deal);

      if (!sd[name]) sd[name] = {
        jan: 0, feb: 0, mar: 0,
        janW: 0, febW: 0, marW: 0,
        janL: 0, febL: 0, marL: 0,
        totalWon: 0, totalLost: 0,
        marRss: 0, marGer: 0, marCon: 0,
      };

      if (month === 1) { sd[name].jan += val; sd[name].janW++; }
      if (month === 2) { sd[name].feb += val; sd[name].febW++; }
      if (month === 3) {
        sd[name].mar += val; sd[name].marW++;
        if      (product === 'RSS')         sd[name].marRss += val;
        else if (product === 'Consultoria') sd[name].marCon += val;
        else                                sd[name].marGer += val;
      }
      sd[name].totalWon++;

      // Origem
      if (!origMap[origin]) origMap[origin] = { o: origin, q: 0, r: 0, p: 0, marQ: 0, marR: 0 };
      origMap[origin].q++;
      origMap[origin].r += val;
      if (month === 3) { origMap[origin].marQ++; origMap[origin].marR += val; }
    }

    // ── Processar deals PERDIDOS ────────────────────────────────────────────
    const lossMap = {};

    for (const deal of lostDeals) {
      const name  = deal.ResponsibleUserName;
      if (!name) continue;
      const month = getMonth(deal.LostDate);
      if (!month) continue;

      if (!sd[name]) sd[name] = {
        jan: 0, feb: 0, mar: 0,
        janW: 0, febW: 0, marW: 0,
        janL: 0, febL: 0, marL: 0,
        totalWon: 0, totalLost: 0,
        marRss: 0, marGer: 0, marCon: 0,
      };

      if (month === 1) sd[name].janL++;
      if (month === 2) sd[name].febL++;
      if (month === 3) sd[name].marL++;
      sd[name].totalLost++;

      // Motivos de perda
      const reason = extractLossReason(deal);
      if (!lossMap[reason]) lossMap[reason] = { reason, count: 0, value: 0 };
      lossMap[reason].count++;
      lossMap[reason].value += deal.TotalValue || 0;

      // Origem perdida
      const origin = extractOrigin(deal);
      if (origMap[origin]) origMap[origin].p++;
    }

    // ── Processar deals EM ABERTO ───────────────────────────────────────────
    const funnelCount = {};
    const funnelVal   = {};
    const openBySel   = {};
    let   fcTotal     = 0;

    for (const deal of openDeals) {
      const stage = deal.DealStageName || 'Outros';
      const val   = deal.TotalValue || 0;
      funnelCount[stage] = (funnelCount[stage] || 0) + 1;
      funnelVal[stage]   = (funnelVal[stage]   || 0) + val;

      const name = deal.ResponsibleUserName;
      if (name) {
        if (!openBySel[name]) openBySel[name] = { count: 0, forecast: 0, deals: [] };
        openBySel[name].count++;
        openBySel[name].deals.push(deal);
        if (['forcast','forecast'].includes(stage.toLowerCase())) {
          openBySel[name].forecast += val;
          fcTotal += val;
        }
      }
    }

    // ── Montar array de SELLERS ─────────────────────────────────────────────
    const sellers = Object.keys(SELLER_CONFIG).map(name => {
      const s    = sd[name]       || { jan:0,feb:0,mar:0,janW:0,febW:0,marW:0,janL:0,febL:0,marL:0,totalWon:0,totalLost:0,marRss:0,marGer:0,marCon:0 };
      const ob   = openBySel[name]|| { count: 0, forecast: 0, deals: [] };
      const conf = SELLER_CONFIG[name];

      const totalRev = s.jan + s.feb + s.mar;
      const conv     = s.totalWon + s.totalLost > 0 ? Math.round(s.totalWon / (s.totalWon + s.totalLost) * 1000) / 10 : 0;
      const ticket   = s.totalWon > 0 ? Math.round(totalRev / s.totalWon) : 0;
      const pct      = conf.meta.total > 0 ? Math.round(s.mar / conf.meta.total * 100) : 0;
      const trend    = pct >= 80 ? 'green' : pct >= 40 ? 'gold' : 'red';
      const tl       = pct >= 80 ? 'Alta Probabilidade' : pct >= 40 ? 'Possível — Ação Necessária' : pct > 0 ? 'Não Atingirá — Ação Urgente' : 'Risco — Requer Ação';

      // Comp scores baseados em métricas reais
      const compConv    = Math.min(10, Math.max(1, conv / 10));
      const compTicket  = Math.min(10, Math.max(1, ticket / 1500));
      const compVol     = Math.min(10, Math.max(1, (s.totalWon + s.totalLost) / 30 * 10));
      const compConsist = (s.jan > 0 ? 3.3 : 0) + (s.feb > 0 ? 3.3 : 0) + (s.mar > 0 ? 3.4 : 0);
      const compFunil   = Math.min(10, Math.max(2, ob.count > 0 ? 7 : 3));

      // Top deals em aberto (por valor)
      const topDeals = ob.deals
        .sort((a, b) => (b.TotalValue || 0) - (a.TotalValue || 0))
        .slice(0, 7)
        .map(d => [
          (d.Title || 'Sem título').substring(0, 40).toUpperCase(),
          d.DealStageName || 'Pipeline',
          d.TotalValue || 0,
          daysSince(d.CreateDate),
          extractProduct(d),
          alertLevel(d),
        ]);

      return {
        id:        conf.id,
        name,
        empresa:   conf.empresa,
        jan:       s.jan,
        feb:       s.feb,
        mar:       s.mar,
        total_rev: totalRev,
        total_won: s.totalWon,
        total_lost:s.totalLost,
        conv, ticket,
        forecast:  ob.forecast,
        open:      ob.count,
        cycle:     28, // TODO: calcular médio quando CreateDate + WonDate disponíveis
        mar_meta:  conf.meta,
        mar_act:   { rss: s.marRss, ger: s.marGer, con: s.marCon, total: s.mar },
        comp: {
          conv:    parseFloat(compConv.toFixed(1)),
          ticket:  parseFloat(compTicket.toFixed(1)),
          volume:  parseFloat(compVol.toFixed(1)),
          consist: parseFloat(compConsist.toFixed(1)),
          funil:   parseFloat(compFunil.toFixed(1)),
        },
        trend, tl, pct,
        deals: topDeals,
      };
    });

    // ── Mensal por seller (mbs) ─────────────────────────────────────────────
    const mbs = {};
    [1, 2, 3].forEach(m => {
      const rK = m === 1 ? 'jan'  : m === 2 ? 'feb'  : 'mar';
      const wK = m === 1 ? 'janW' : m === 2 ? 'febW' : 'marW';
      const lK = m === 1 ? 'janL' : m === 2 ? 'febL' : 'marL';
      mbs[m] = sellers
        .map(s => {
          const sdata = sd[s.name] || {};
          const r = sdata[rK] || 0;
          const w = sdata[wK] || 0;
          const l = sdata[lK] || 0;
          return {
            n: s.name,
            r,
            m: s.mar_meta.total,
            emp: s.empresa,
            p: s.mar_meta.total > 0 ? Math.round(r / s.mar_meta.total * 100) : 0,
            w, l,
            c: w + l > 0 ? Math.round(w / (w + l) * 1000) / 10 : 0,
          };
        })
        .sort((a, b) => b.r - a.r);
    });

    // ── Stats globais ───────────────────────────────────────────────────────
    const allWon  = sellers.reduce((acc, s) => acc + s.total_won,  0);
    const allLost = sellers.reduce((acc, s) => acc + s.total_lost, 0);
    const mrev    = {
      1: sellers.reduce((acc, s) => acc + s.jan, 0),
      2: sellers.reduce((acc, s) => acc + s.feb, 0),
      3: sellers.reduce((acc, s) => acc + s.mar, 0),
    };
    const totalRev = mrev[1] + mrev[2] + mrev[3];

    const mwon = {}, mlost = {}, mconv = {};
    [1, 2, 3].forEach(m => {
      const wK = m === 1 ? 'janW' : m === 2 ? 'febW' : 'marW';
      const lK = m === 1 ? 'janL' : m === 2 ? 'febL' : 'marL';
      mwon[m]  = sellers.reduce((acc, s) => acc + (sd[s.name]?.[wK] || 0), 0);
      mlost[m] = sellers.reduce((acc, s) => acc + (sd[s.name]?.[lK] || 0), 0);
      mconv[m] = mwon[m] + mlost[m] > 0 ? Math.round(mwon[m] / (mwon[m] + mlost[m]) * 1000) / 10 : 0;
    });

    // Pmix (apenas março — para acumulado anual precisaria de campo produto em todos)
    const pmix = {
      Gerenciamento: sellers.reduce((acc, s) => acc + s.mar_act.ger, 0),
      RSS:           sellers.reduce((acc, s) => acc + s.mar_act.rss, 0),
      Consultoria:   sellers.reduce((acc, s) => acc + s.mar_act.con, 0),
    };

    const G = {
      total_rev:   totalRev,
      total_won:   allWon,
      total_lost:  allLost,
      conv_geral:  allWon + allLost > 0 ? Math.round(allWon / (allWon + allLost) * 1000) / 10 : 0,
      ticket_medio:allWon > 0 ? Math.round(totalRev / allWon) : 0,
      fc_total:    fcTotal,
      meta_total:  META_TOTAL,
      mrev, mwon, mlost, mconv,
      motivos: Object.values(lossMap).sort((a, b) => b.count - a.count).slice(0, 10).map(r => [r.reason, r.count, r.value]),
      pmix,
      funnel: funnelCount,
      fvals:  funnelVal,
    };

    // ── Origens ─────────────────────────────────────────────────────────────
    const origAnual = Object.values(origMap)
      .sort((a, b) => b.r - a.r)
      .map(o => ({
        o: o.o, q: o.q, r: o.r, p: o.p,
        t: o.q > 0 ? Math.round(o.r / o.q) : 0,
        c: o.q + o.p > 0 ? Math.round(o.q / (o.q + o.p) * 1000) / 10 : 0,
      }));

    const origMarco = Object.values(origMap)
      .filter(o => o.marQ > 0)
      .sort((a, b) => b.marR - a.marR)
      .map(o => ({
        o: o.o, q: o.marQ, r: o.marR,
        t: o.marQ > 0 ? Math.round(o.marR / o.marQ) : 0,
      }));

    const OR = { anual: origAnual, marco: origMarco };

    // Data atual formatada
    const now   = new Date();
    const today = `${String(now.getDate()).padStart(2,'0')} / ${String(now.getMonth()+1).padStart(2,'0')} / ${now.getFullYear()}`;

    return res.status(200).json({ sellers, G, mbs, OR, today });

  } catch (e) {
    console.error('[ploomes-api]', e.message);
    return res.status(500).json({ error: e.message });
  }
}
