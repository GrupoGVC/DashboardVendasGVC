# Dashboard de Vendas — Grupo GVC

Dashboard interativo de performance comercial integrado ao CRM Ploomes.
Hospedado via **GitHub Pages** · Atualização automática via **Ploomes API + Supabase Proxy**.

---

## Arquitetura

```
Browser (GitHub Pages)
  └── data-loader.js
        └── GET /ploomes-proxy?url=https://api2.ploomes.com/Deals?...
              └── Supabase Edge Function (ploomes-proxy)
                    └── GET https://api2.ploomes.com/Deals
                          └── Ploomes CRM API
```

**Por que o proxy?**
O browser não pode chamar a API do Ploomes diretamente por CORS. A Edge Function do Supabase faz a chamada server-side e devolve os dados ao dashboard.

---

## Estrutura do repositório

```
DashboardVendasGVC/
├── index.html        ← Dashboard completo (layout, gráficos, lógica)
├── config.js         ← Configurações: metas, FieldIds, dados históricos
├── data-loader.js    ← Integração Ploomes via proxy Supabase
└── README.md
```

---

## Infraestrutura Supabase

**Projeto:** `lqbmjmqrhcokimdtekyc`
**Edge Function:** `ploomes-proxy` (verify_jwt: OFF)
**URL:** `https://lqbmjmqrhcokimdtekyc.supabase.co/functions/v1/ploomes-proxy`

### Secrets configurados

| Nome | Descrição |
|---|---|
| `PLOOMES_KEY` | User-Key da API Ploomes (chave ativa) |
| `PLOOMES_USER_KEY` | Cópia da chave (fallback) |

### Como funciona o proxy

O dashboard envia a URL do Ploomes como parâmetro `?url=`:
```
/ploomes-proxy?url=https://api2.ploomes.com/Deals?$top=2000&$expand=OtherProperties&...
```

O proxy decodifica o parâmetro e faz o fetch com a `User-Key` salva no secret — a chave nunca fica exposta no browser.

> ⚠️ **Regra crítica:** a URL do Ploomes **não pode ter `$select`** (as vírgulas entre os campos quebram o roteamento do Supabase mesmo dentro do parâmetro `?url=`). Use `$expand=OtherProperties` para campos customizados.

---

## Campos customizados Ploomes (FieldIds)

Identificados via `GET /Deals?$expand=OtherProperties` em 06/04/2026:

| Campo no dashboard | FieldId | Valor exemplo |
|---|---|---|
| `empresa_vendedora` | `325257` | "Retec Oeste" |
| `produto` | `347280` | "RSS" |
| `tipo_venda` | `347280` | (mesmo campo) |
| `origem` | `327549` | "Chat Bot" |
| `empresa_fallback` | `347460` | "Retec Oeste" |

Configurados em `config.js` → `window.PLOOMES_CUSTOM_FIELDS`.

---

## Configuração (`config.js`)

```javascript
// Autenticação (usada apenas em localhost — no GitHub Pages a chave fica no Supabase)
window.PLOOMES_USER_KEY = 'SUA_USER_KEY_AQUI';

// Ano de início dos dados
window.PLOOMES_ANO_INICIO = 2026;

// Meta mensal do time (R$)
window.DASHBOARD_META_TEAM = 335000;

// Metas individuais por consultor
window.METAS_INDIVIDUAIS = {
  'Jefferson Ferreira': { total: 55000, ... },
  // ...
};

// FieldIds dos campos customizados
window.PLOOMES_CUSTOM_FIELDS = {
  empresa_vendedora: 325257,
  produto: 347280,
  tipo_venda: 347280,
  origem: 327549,
  empresa_fallback: 347460,
};

// Dados históricos (atualizar manualmente ao fechar cada ano)
window.EVOL_DATA_HISTORICO = {
  '2023': [...],
  '2024': [...],
  '2025': [...]
};
```

---

## Como atualizar a Edge Function

Quando precisar alterar o proxy (ex: adicionar campos, mudar filtro):

1. Acesse `supabase.com/dashboard/project/lqbmjmqrhcokimdtekyc/functions`
2. Clique em **ploomes-proxy** → aba **Code**
3. Edite e clique **Deploy function**
4. Confirme que **Verify JWT** está **OFF** em Settings

---

## Manutenção recorrente

| Tarefa | Frequência | Onde |
|---|---|---|
| Adicionar novo consultor + meta | Por admissão | `config.js` → `METAS_INDIVIDUAIS` |
| Atualizar meta mensal | Mensal/trimestral | `config.js` → `DASHBOARD_META_TEAM` |
| Fechar dados do ano anterior | Janeiro | `config.js` → `EVOL_DATA_HISTORICO` |
| Mapear novo campo customizado | Quando criado no Ploomes | `config.js` → `PLOOMES_CUSTOM_FIELDS` |
| Renovar token GitHub (se necessário) | Por expiração | GitHub → Settings → Developer settings |

---

## Atualização dos dados

O dashboard busca os dados do Ploomes **automaticamente ao abrir a página**.
Não é necessária nenhuma ação manual.

Para forçar atualização sem recarregar:
```javascript
// No console do browser:
loadFromPloomes();
```

---

## Dados históricos (2023–2025)

Hardcoded em `config.js` por design — referem-se a anos já encerrados.
**Atualizar manualmente em Janeiro** de cada ano com a exportação do Ploomes.

---

## Tecnologias

- **HTML/CSS/JS** puro — sem dependências de build
- **Chart.js 4.4** — gráficos
- **Ploomes REST API v2** — fonte de dados
- **Supabase Edge Functions** — proxy server-side (Deno/TypeScript)
- **GitHub Pages** — hospedagem estática gratuita
