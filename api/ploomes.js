// ─────────────────────────────────────────────────────────────────────
//  Ploomes API Integration
// ─────────────────────────────────────────────────────────────────────

const BASE = 'https://api2.ploomes.com';
const ANO  = 2026;

// ── Configuração de Consultores ──────────────────────────────────────
// Metas são definidas aqui (não vêm do CRM).
const SELLER_CONFIG = {
  'MARIANE ALMEIDA': { empresa: 'Retec Oeste', id: 'mariane', meta: { RSS: 2000, Gerenciamento: 22400, Consultoria: 600, total: 25000 } },
  'Jefferson Ferreira': { empresa: 'Retec Resíduos', id: 'jefferson', meta: { RSS: 20000, Gerenciamento: 32000, Consultoria: 3000, total: 55000 } },
  // outros vendedores omitidos por brevidade
};

const META_TOTAL = 335000;

// ── Helpers e Funções de Cálculo ─────────────────────────────────────

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

/** Processamento de deals e classificação em categorias */
function extractProduct(deal) {
  const title = (deal.Title || '').toUpperCase();
  if (title.includes('RSS') || title.includes('RESÍDUO')) return 'RSS';
  if (title.includes('CONSULTORIA')) return 'Consultoria';
  return 'Gerenciamento';
}

/** Handler principal da API Ploomes */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.PLOOMES_KEY;
  if (!key) return res.status(500).json({ error: 'Variável PLOOMES_KEY não configurada no Vercel.' });

  try {
    const sel = '$expand=OtherProperties';

    // Busca dados das vendas: ganhos, perdidos, e em aberto
    const [wonDeals, lostDeals, openDeals] = await Promise.all([
      ploomesFetch(`/Deals?$filter=IsWon eq true and WonDate ge datetime'${ANO}-01-01T00:00:00'&${sel}`, key),
      ploomesFetch(`/Deals?$filter=IsLost eq true and LostDate ge datetime'${ANO}-01-01T00:00:00'&${sel}`, key),
      ploomesFetch(`/Deals?$filter=IsWon eq false and IsLost eq false&${sel}`, key),
    ]);

    // Processamento de Deals (ganhos, perdidos, abertos)
    const sd = {}; // Dados dos vendedores
    for (const deal of wonDeals) {
      const name = deal.ResponsibleUserName;
      const month = getMonth(deal.WonDate);
      const year  = getYear(deal.WonDate);
      if (!month || year !== ANO) continue;

      const val = deal.TotalValue || 0;
      const product = extractProduct(deal);

      if (!sd[name]) sd[name] = {
        jan: 0, feb: 0, mar: 0, totalWon: 0,
      };

      if (month === 1) { sd[name].jan += val; }
      if (month === 2) { sd[name].feb += val; }
      if (month === 3) { sd[name].mar += val; }
      sd[name].totalWon++;
    }

    const sellers = Object.keys(SELLER_CONFIG).map(name => {
      const s = sd[name] || { jan: 0, feb: 0, mar: 0, totalWon: 0 };
      const totalRev = s.jan + s.feb + s.mar;
      return {
        name,
        total_rev: totalRev,
        total_won: s.totalWon,
        // outros dados omitidos por brevidade
      };
    });

    // Prepare data para enviar ao frontend
    const G = { total_rev: sellers.reduce((acc, s) => acc + s.total_rev, 0) };

    return res.status(200).json({ sellers, G });
  } catch (e) {
    console.error('[ploomes-api]', e.message);
    return res.status(500).json({ error: e.message });
  }
}
