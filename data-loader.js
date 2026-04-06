/**
 * data-loader.js — Integração Ploomes API → Dashboard GVC
 * 
 * Responsabilidade: buscar deals do Ploomes, normalizar para o
 * formato RAW_DATA esperado pelo dashboard, e acionar o refreshAll().
 *
 * Como usar:
 *   1. Defina sua USER_KEY do Ploomes em config.js
 *   2. Inclua config.js e data-loader.js no index.html ANTES do bloco de dados
 *   3. Remova o bloco RAW_DATA hardcoded do HTML
 *   4. O loader preenche RAW_DATA automaticamente ao carregar a página
 *
 * Endpoint: GET https://api2.ploomes.com/Deals
 * Docs: https://developers.ploomes.com
 */

(function () {
  'use strict';

  // ── Campos a solicitar à API Ploomes (reduz payload) ──────────────────
  var SELECT_FIELDS = [
    'Id',
    'Title',
    'Value',                    // Valor da última venda (RAW_DATA.val)
    'Proposal/Value',           // Valor da proposta (RAW_DATA.prop)
    'CloseDate',                // Data de fechamento
    'CreateDate',               // Data de criação (para calcular dias em aberto)
    'Stage/Name',               // Etapa do funil
    'Status',                   // 1=Em aberto, 2=Ganha, 3=Perdida
    'User/Name',                // Responsável (RAW_DATA.resp)
    'Company/Name',             // Cliente (RAW_DATA.cliente)
    'Contact/Name',
    'LostReasonSummary',        // Motivo de não conversão
    'Tags',                     // Origem (via campo customizado ou tag)
    'OtherProperties'           // Campos customizados: empresa vendedora, produto, tipo venda, origem
  ].join(',');

  // ── IDs dos campos customizados — AJUSTE CONFORME SEU PLOOMES ──────────
  // Para encontrar: Admin > Entidades > Negócios > Campos
  var CUSTOM_FIELDS = window.PLOOMES_CUSTOM_FIELDS || {
    empresa_vendedora : null,   // Ex: 123456  → campo "Empresa Vendedora"
    produto           : null,   // Ex: 123457  → campo "Produto" (RSS/Gerenciamento/Consultoria)
    tipo_venda        : null,   // Ex: 123458  → campo "Tipo de Venda"
    origem            : null,   // Ex: 123459  → campo "Origem do Lead"
    mes_venda         : null,   // Ex: 123460  → campo numérico "Mês" (se existir)
  };

  // ── Status map ──────────────────────────────────────────────────────────
  var STATUS_MAP = { 1: 'Em aberto', 2: 'Ganha', 3: 'Perdida' };

  // ── Busca paginada da API ───────────────────────────────────────────────
  function fetchPage(url, allDeals, callback) {
    fetch(url, {
      headers: {
        'User-Key' : window.PLOOMES_USER_KEY || '',
        'Content-Type': 'application/json'
      }
    })
    .then(function(res) {
      if (!res.ok) throw new Error('Ploomes API error: ' + res.status + ' ' + res.statusText);
      return res.json();
    })
    .then(function(data) {
      var page = data.value || [];
      allDeals = allDeals.concat(page);

      // Paginação: Ploomes usa @odata.nextLink
      if (data['@odata.nextLink']) {
        fetchPage(data['@odata.nextLink'], allDeals, callback);
      } else {
        callback(null, allDeals);
      }
    })
    .catch(function(err) {
      callback(err, allDeals);
    });
  }

  // ── Normaliza um deal Ploomes → formato RAW_DATA ────────────────────────
  function normalizeDeals(deals) {
    var hoje = new Date();

    return deals.map(function(deal) {
      var status = STATUS_MAP[deal.Status] || 'Em aberto';

      // Data de fechamento (para deals ganhos/perdidos)
      var closeDate = deal.CloseDate ? new Date(deal.CloseDate) : null;
      var createDate = deal.CreateDate ? new Date(deal.CreateDate) : null;

      // Mês (1-12) baseado na data de fechamento para ganhos/perdidos
      var mes = 0;
      if (closeDate && (status === 'Ganha' || status === 'Perdida')) {
        mes = closeDate.getMonth() + 1;
      }

      // Dias em aberto / idade do deal
      var refDate = closeDate || hoje;
      var dias = createDate ? Math.round((refDate - createDate) / 86400000) : 0;

      // Alerta por dias
      var alerta = dias > 90 ? 'CRITICO' : dias > 40 ? 'ATENCAO' : 'OK';

      // Campos customizados — extrai de OtherProperties
      function getProp(fieldId) {
        if (!fieldId || !deal.OtherProperties) return 'N/D';
        var prop = deal.OtherProperties.find(function(p) { return p.FieldId === fieldId; });
        if (!prop) return 'N/D';
        return prop.SelectedOptions
          ? (prop.SelectedOptions[0] ? prop.SelectedOptions[0].Title : 'N/D')
          : (prop.TextValue || prop.IntegerValue || prop.DecimalValue || 'N/D');
      }

      var empresa  = getProp(CUSTOM_FIELDS.empresa_vendedora) || getProp(CUSTOM_FIELDS.empresa_fallback) || 'N/D';
      var produto  = getProp(CUSTOM_FIELDS.produto)    || 'N/D';
      var tv       = getProp(CUSTOM_FIELDS.tipo_venda) || produto;
      var orig     = getProp(CUSTOM_FIELDS.origem)     || 'N/D';

      // Responsável
      var resp = (deal.User && deal.User.Name) ? deal.User.Name : 'N/D';

      // Cliente
      var cliente = (deal.Company && deal.Company.Name)
        ? deal.Company.Name
        : (deal.Contact && deal.Contact.Name ? deal.Contact.Name : 'N/D');

      // Valores
      var val  = deal.Value || 0;
      var prop = (deal.Proposal && deal.Proposal.Value) ? deal.Proposal.Value : val;

      // Etapa do funil
      var stage = (deal.Stage && deal.Stage.Name) ? deal.Stage.Name : 'N/D';

      // Motivo de perda
      var motivo = deal.LostReasonSummary || 'nan';

      // Data de fechamento para header
      var dataFim = deal.CloseDate || null;

      return {
        resp    : resp,
        emp     : empresa,
        sit     : status,
        mes     : mes,
        val     : Math.round(val * 100) / 100,
        prop    : Math.round(prop * 100) / 100,
        prod    : produto,
        orig    : orig,
        tv      : tv,
        stage   : stage,
        motivo  : motivo,
        dias    : dias,
        cliente : cliente,
        alerta  : alerta,
        dataFim : dataFim
      };
    });
  }

  // ── Monta URL base com filtros ──────────────────────────────────────────
  function buildUrl() {
    var base = 'https://api2.ploomes.com/Deals';

    // Filtrar apenas deals de 2026 em diante (ou Em aberto)
    // Ajuste o filtro conforme necessidade
    var anoInicio = (window.PLOOMES_ANO_INICIO || 2026);
    var dataFiltro = anoInicio + '-01-01T00:00:00';

    var filter = encodeURIComponent(
      "Status eq 1 or (CloseDate ge " + dataFiltro + ")"
    );

    var params = [
      '$select=' + encodeURIComponent(SELECT_FIELDS),
      '$filter=' + filter,
      '$top=500',
      '$expand=' + encodeURIComponent('Stage,User,Company,Contact,Proposal,OtherProperties($select=FieldId,TextValue,IntegerValue,DecimalValue,SelectedOptions)')
    ].join('&');

    return base + '?' + params;
  }

  // ── Mostra estado de carregamento ───────────────────────────────────────
  function setLoadingState(msg, isError) {
    var els = ['header-data-atualizacao','loading-date-label'];
    els.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = msg;
    });
    var badge = document.getElementById('header-date-badge');
    if (badge) badge.textContent = isError ? '⚠️ ' + msg : '⏳ ' + msg;
  }

  // ── Entry point ────────────────────────────────────────────────────────
  function loadFromPloomes() {
    if (!window.PLOOMES_USER_KEY) {
      console.warn('[data-loader] PLOOMES_USER_KEY não definida em config.js. Usando RAW_DATA existente.');
      return;
    }

    setLoadingState('Atualizando...', false);

    fetchPage(buildUrl(), [], function(err, deals) {
      if (err) {
        console.error('[data-loader] Erro ao buscar dados do Ploomes:', err);
        setLoadingState('Erro ao carregar', true);
        return;
      }

      console.log('[data-loader] ' + deals.length + ' deals recebidos do Ploomes');

      // Substitui RAW_DATA global
      window.RAW_DATA = normalizeDeals(deals);

      // Atualiza filtros de seleção
      if (typeof populateFilters === 'function') populateFilters();

      // Re-renderiza todo o dashboard
      if (typeof refreshAll === 'function') refreshAll();

      console.log('[data-loader] Dashboard atualizado com dados do Ploomes');
    });
  }

  // ── Executa quando o DOM estiver pronto ────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFromPloomes);
  } else {
    loadFromPloomes();
  }

  // Expõe para uso manual (ex: botão "Atualizar")
  window.loadFromPloomes = loadFromPloomes;

})();
