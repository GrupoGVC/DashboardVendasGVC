/**
 * config.js — Configurações do Dashboard GVC
 *
 * ⚠️  ATENÇÃO: Este arquivo contém a chave de API do Ploomes.
 *     O repositório deve ser PRIVADO no GitHub.
 */

// ── Autenticação Ploomes ────────────────────────────────────────────────
window.PLOOMES_USER_KEY = '480EF01B900976FE403FE780BFAD96489713C26EEE4619D68039480202851E2AC92E3BCDBD02EAD208D62E808C73CB34A94AEABB63002379AF00336BCC1D35A4';
// Onde encontrar: Ploomes > avatar > Configurações de Conta > API

// ── Ano de início dos dados ─────────────────────────────────────────────
window.PLOOMES_ANO_INICIO = 2026;

// ── Meta mensal do time (R$) ────────────────────────────────────────────
window.DASHBOARD_META_TEAM = 335000;

// ── Metas individuais por consultor ────────────────────────────────────
// Nome exato como aparece no campo "Responsável" do Ploomes
window.METAS_INDIVIDUAIS = {
  'Jefferson Ferreira'   : { total: 55000, rss: 0,     ger: 55000, con: 0 },
  'MARIANE ALMEIDA'      : { total: 25000, rss: 0,     ger: 25000, con: 0 },
  'Laila Nunes'          : { total: 45000, rss: 25000, ger: 20000, con: 0 },
  'ELIS ADRIELE'         : { total: 35000, rss: 0,     ger: 35000, con: 0 },
  'Luciane Cruz Santana' : { total: 45000, rss: 0,     ger: 45000, con: 0 },
  'Jacqueline Bastos'    : { total: 45000, rss: 25000, ger: 20000, con: 0 },
  'Daniel Leles'         : { total: 35000, rss: 0,     ger: 35000, con: 0 },
  'Ivson Cavalcanti'     : { total: 30000, rss: 0,     ger: 30000, con: 0 },
  // Adicione novos consultores aqui conforme necessário
};

// ── IDs dos campos customizados no Ploomes ─────────────────────────────
// Identificados via GET /Deals?$expand=OtherProperties em 06/04/2026
//
// Como foram identificados:
//   FieldId 325257 → ObjectValueName: "Retec Oeste"  → Empresa Vendedora
//   FieldId 347280 → ObjectValueName: "RSS"           → Produto (RSS/Gerenciamento/Consultoria)
//   FieldId 327549 → ObjectValueName: "Chat Bot"      → Origem do Lead
//   FieldId 347460 → ObjectValueName: "Retec Oeste"   → Empresa (funil alternativo — fallback)
//
window.PLOOMES_CUSTOM_FIELDS = {
  empresa_vendedora : 325257,  // campo "Empresa Vendedora"
  produto           : 347280,  // campo "Produto" (RSS / Gerenciamento / Consultoria)
  tipo_venda        : 347280,  // mesmo campo que produto (valores idênticos)
  origem            : 327549,  // campo "Origem do Lead"
  empresa_fallback  : 347460,  // campo "Empresa" — usado se empresa_vendedora estiver vazio
};

// ── Dados históricos (anos anteriores — estáticos) ─────────────────────
// Fonte: exportação do Ploomes. Atualizar manualmente ao fechar cada ano.
window.EVOL_DATA_HISTORICO = {
  '2023': [0, 0, 0, 0, 0, 0, 0, 305126, 133790, 209224, 101040, 105405],
  '2024': [220053, 131542, 79952, 95538, 143341, 75427, 157144, 391906, 151670, 248898, 516162, 1049090],
  '2025': [238208, 363018, 206782, 190421, 245743, 116329, 197732, 461266, 239105, 580994, 228119, 298728]
};
window.EVOL_CNT_HISTORICO = {
  '2023': [0, 0, 0, 0, 0, 0, 0, 56, 76, 112, 49, 51],
  '2024': [95, 72, 80, 82, 91, 64, 109, 76, 91, 111, 71, 100],
  '2025': [104, 182, 149, 157, 112, 107, 134, 124, 134, 157, 136, 98]
};
window.EVOL_PROD_HISTORICO = {
  '2023': { rss: 1630,    ger: 0,       con: 0     },
  '2024': { rss: 969,     ger: 113998,  con: 1250  },
  '2025': { rss: 1282127, ger: 2001844, con: 82474 }
};
