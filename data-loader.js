// v3.0.0 — proxy faz filtragem e paginação server-side
(function () {
  'use strict';

  var SUPABASE_PROXY = 'https://lqbmjmqrhcokimdtekyc.supabase.co/functions/v1/ploomes-proxy';
  var CUSTOM_FIELDS  = window.PLOOMES_CUSTOM_FIELDS || {};
  var STATUS_MAP     = { 1: 'Em aberto', 2: 'Ganha', 3: 'Perdida' };

  function isGitHubPages() {
    return window.location.hostname.indexOf('github.io') >= 0;
  }

  // URL do Ploomes — sempre a mesma
  var PLOOMES_URL = 'https://api2.ploomes.com/Deals'
    + '?$top=2000'
    + '&$expand=OtherProperties'
    + '&$orderby=FinishDate%20desc'
    + '&$select=Id,Title,Amount,StartAmount,FinishDate,CreateDate,StatusId,PersonName,ContactName,LossReasonSummary,OwnerId,StageId';

  function buildUrl() {
    // No GitHub Pages: passa URL como ?url= (padrão que funciona com o proxy Supabase)
    if (isGitHubPages()) {
      return SUPABASE_PROXY + '?url=' + encodeURIComponent(PLOOMES_URL);
    }
    // Em localhost: chama diretamente com a chave no header
    return PLOOMES_URL;
  }

  function getProp(deal, fieldId) {
    if (!fieldId || !deal.OtherProperties) return 'N/D';
    var prop = deal.OtherProperties.filter(function(p){ return p.FieldId === fieldId; })[0];
    if (!prop) return 'N/D';
    return prop.ObjectValueName || prop.StringValue || prop.BigStringValue || 'N/D';
  }

  function normalizeDeals(deals) {
    return deals.map(function(deal) {
      var status    = STATUS_MAP[deal.StatusId] || 'Em aberto';
      var closeDate = deal.FinishDate  ? new Date(deal.FinishDate)  : null;
      var createDate= deal.CreateDate  ? new Date(deal.CreateDate)  : null;
      var hoje      = new Date();

      var mes = 0;
      if (closeDate && (status === 'Ganha' || status === 'Perdida')) {
        mes = closeDate.getMonth() + 1;
      }

      var dias  = createDate ? Math.round(((closeDate || hoje) - createDate) / 86400000) : 0;
      var alerta= dias > 90 ? 'CRITICO' : dias > 40 ? 'ATENCAO' : 'OK';

      return {
        resp   : deal.PersonName  || deal.ContactName || 'N/D',
        emp    : getProp(deal, CUSTOM_FIELDS.empresa_vendedora)
              || getProp(deal, CUSTOM_FIELDS.empresa_fallback) || 'N/D',
        sit    : status,
        mes    : mes,
        val    : Math.round((deal.Amount      || 0) * 100) / 100,
        prop   : Math.round((deal.StartAmount || deal.Amount || 0) * 100) / 100,
        prod   : getProp(deal, CUSTOM_FIELDS.produto)    || 'N/D',
        orig   : getProp(deal, CUSTOM_FIELDS.origem)     || 'N/D',
        tv     : getProp(deal, CUSTOM_FIELDS.tipo_venda) || getProp(deal, CUSTOM_FIELDS.produto) || 'N/D',
        stage  : 'N/D',
        motivo : deal.LossReasonSummary || 'nan',
        dias   : dias,
        cliente: deal.ContactName || deal.PersonName || 'N/D',
        alerta : alerta,
        dataFim: deal.FinishDate || null
      };
    });
  }

  function setLoadingState(msg, isError) {
    ['header-data-atualizacao','loading-date-label'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = msg;
    });
    var badge = document.getElementById('header-date-badge');
    if (badge) badge.textContent = isError ? '⚠️ ' + msg : '⏳ ' + msg;
  }

  function loadFromPloomes() {
    setLoadingState('Atualizando...', false);

    var headers = { 'Content-Type': 'application/json' };
    // Em localhost envia a chave diretamente
    if (!isGitHubPages() && window.PLOOMES_USER_KEY) {
      headers['User-Key'] = window.PLOOMES_USER_KEY;
    }

    fetch(buildUrl(), { headers: headers })
      .then(function(res) {
        if (!res.ok) throw new Error('Erro ' + res.status + ': ' + res.statusText);
        return res.json();
      })
      .then(function(data) {
        var deals = data.value || [];
        console.log('[data-loader] ' + deals.length + ' deals recebidos');
        window.RAW_DATA = normalizeDeals(deals);
        if (typeof populateFilters === 'function') populateFilters();
        if (typeof refreshAll     === 'function') refreshAll();
        console.log('[data-loader] Dashboard atualizado — ' + window.RAW_DATA.length + ' deals');
      })
      .catch(function(err) {
        console.error('[data-loader] Erro:', err);
        setLoadingState('Erro ao carregar', true);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFromPloomes);
  } else {
    loadFromPloomes();
  }
  window.loadFromPloomes = loadFromPloomes;
})();
