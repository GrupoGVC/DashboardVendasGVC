// v2.1.0 — 202604081524
/**
 * data-loader.js — Integração Ploomes API → Dashboard GVC
 * Usa proxy Supabase quando no GitHub Pages (evita CORS)
 */
(function () {
  'use strict';

  var SUPABASE_PROXY = 'https://lqbmjmqrhcokimdtekyc.supabase.co/functions/v1/ploomes-proxy';
  var PLOOMES_BASE   = 'https://api2.ploomes.com';

  var CUSTOM_FIELDS = window.PLOOMES_CUSTOM_FIELDS || {};

  var STATUS_MAP = { 1: 'Em aberto', 2: 'Ganha', 3: 'Perdida' };

  function isGitHubPages() {
    return window.location.hostname.indexOf('github.io') >= 0;
  }

  // Monta a URL do Ploomes (sempre a mesma, independente do proxy)
  function buildPloomesUrl() {
    return PLOOMES_BASE + '/Deals'
      + '?$top=2000'
      + '&$expand=Stage,User,Company,Contact,Proposal,OtherProperties';
  }

  // Monta URL de chamada — no GitHub Pages, passa a URL do Ploomes como parâmetro
  function buildUrl() {
    var ploomesUrl = buildPloomesUrl();
    if (isGitHubPages()) {
      // Passa URL inteira como parâmetro ?url= — evita que Supabase interprete $expand, vírgulas etc.
      return SUPABASE_PROXY + '?url=' + encodeURIComponent(ploomesUrl);
    }
    return ploomesUrl;
  }

  function fetchPage(url, allDeals, callback) {
    var headers = { 'Content-Type': 'application/json' };
    if (!isGitHubPages() && window.PLOOMES_USER_KEY) {
      headers['User-Key'] = window.PLOOMES_USER_KEY;
    }
    fetch(url, { headers: headers })
      .then(function(res) {
        if (!res.ok) throw new Error('Ploomes API error: ' + res.status + ' ' + res.statusText);
        return res.json();
      })
      .then(function(data) {
        var page = data.value || [];
        allDeals = allDeals.concat(page);
        if (data['@odata.nextLink']) {
          // Para nextLink, também passa pelo proxy
          var next = data['@odata.nextLink'];
          if (isGitHubPages()) {
            next = SUPABASE_PROXY + '?url=' + encodeURIComponent(next);
          }
          fetchPage(next, allDeals, callback);
        } else {
          callback(null, allDeals);
        }
      })
      .catch(function(err) { callback(err, allDeals); });
  }

  function getProp(deal, fieldId) {
    if (!fieldId || !deal.OtherProperties) return 'N/D';
    var prop = deal.OtherProperties.filter(function(p){ return p.FieldId === fieldId; })[0];
    if (!prop) return 'N/D';
    if (prop.ObjectValueName) return prop.ObjectValueName;
    return prop.StringValue || prop.BigStringValue || prop.TextValue || 'N/D';
  }

  function normalizeDeals(deals) {
    var hoje = new Date();
    var anoInicio = window.PLOOMES_ANO_INICIO || 2026;

    return deals
      .filter(function(deal) {
        // Filtra: Em aberto OU fechado a partir do ano configurado
        if (deal.StatusId === 1) return true;
        var closeDate = deal.FinishDate ? new Date(deal.FinishDate) : null;
        return closeDate && closeDate.getFullYear() >= anoInicio;
      })
      .map(function(deal) {
        var status   = STATUS_MAP[deal.StatusId] || 'Em aberto';
        var closeDate  = deal.FinishDate  ? new Date(deal.FinishDate)  : null;
        var createDate = deal.CreateDate  ? new Date(deal.CreateDate)  : null;
        var mes = 0;
        if (closeDate && (status === 'Ganha' || status === 'Perdida')) {
          mes = closeDate.getMonth() + 1;
        }
        var refDate = closeDate || hoje;
        var dias = createDate ? Math.round((refDate - createDate) / 86400000) : 0;
        var alerta = dias > 90 ? 'CRITICO' : dias > 40 ? 'ATENCAO' : 'OK';

        var empresa = getProp(deal, CUSTOM_FIELDS.empresa_vendedora)
                   || getProp(deal, CUSTOM_FIELDS.empresa_fallback)
                   || (deal.Company ? deal.Company.Name : 'N/D');
        var produto = getProp(deal, CUSTOM_FIELDS.produto)    || 'N/D';
        var tv      = getProp(deal, CUSTOM_FIELDS.tipo_venda) || produto;
        var orig    = getProp(deal, CUSTOM_FIELDS.origem)     || 'N/D';

        var resp    = deal.User    ? deal.User.Name    : 'N/D';
        var cliente = deal.Company ? deal.Company.Name : (deal.Contact ? deal.Contact.Name : 'N/D');
        var val     = deal.Amount  || 0;
        var prop    = (deal.Proposal && deal.Proposal.Value) ? deal.Proposal.Value : val;
        var stage   = deal.Stage   ? deal.Stage.Name  : 'N/D';
        var motivo  = deal.LossReasonSummary || 'nan';

        return {
          resp: resp, emp: empresa, sit: status, mes: mes,
          val: Math.round(val * 100) / 100,
          prop: Math.round(prop * 100) / 100,
          prod: produto, orig: orig, tv: tv, stage: stage,
          motivo: motivo, dias: dias, cliente: cliente,
          alerta: alerta, dataFim: deal.FinishDate || null
        };
      });
  }

  function setLoadingState(msg, isError) {
    var els = ['header-data-atualizacao', 'loading-date-label'];
    els.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = msg;
    });
    var badge = document.getElementById('header-date-badge');
    if (badge) badge.textContent = isError ? '⚠️ ' + msg : '⏳ ' + msg;
  }

  function loadFromPloomes() {
    if (!window.PLOOMES_USER_KEY && !isGitHubPages()) {
      console.warn('[data-loader] PLOOMES_USER_KEY não definida. Usando RAW_DATA existente.');
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
      window.RAW_DATA = normalizeDeals(deals);
      if (typeof populateFilters === 'function') populateFilters();
      if (typeof refreshAll === 'function') refreshAll();
      console.log('[data-loader] Dashboard atualizado — ' + window.RAW_DATA.length + ' deals normalizados');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFromPloomes);
  } else {
    loadFromPloomes();
  }
  window.loadFromPloomes = loadFromPloomes;
})();
