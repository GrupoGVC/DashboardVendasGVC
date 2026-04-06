# Dashboard de Vendas — Grupo GVC

Dashboard interativo de performance comercial integrado ao CRM Ploomes.  
Hospedado via **GitHub Pages** · Atualização automática via **Ploomes API**.

---

## Estrutura do repositório

```
dashboard-gvc/
├── index.html        ← Dashboard principal (layout, lógica, charts)
├── config.js         ← Configurações: API key, metas, dados históricos
├── data-loader.js    ← Integração com a API do Ploomes
└── README.md
```

---

## Como configurar

### 1. Obter a User-Key do Ploomes

1. Acesse o Ploomes como **Administrador**
2. Vá em **Configurações de Conta → API**
3. Clique em **Gerar chave** (ou copie a existente)

### 2. Mapear os campos customizados

Para que `produto`, `origem`, `tipo_venda` e `empresa_vendedora` sejam corretamente extraídos:

1. Faça uma chamada de teste à API:
   ```
   GET https://api2.ploomes.com/Deals?$expand=OtherProperties&$top=1
   User-Key: SUA_CHAVE
   ```
2. Inspecione o array `OtherProperties` de um deal
3. Copie os valores de `FieldId` para os campos correspondentes em `config.js`

### 3. Configurar o `config.js`

```javascript
window.PLOOMES_USER_KEY = 'sua_chave_real_aqui';

window.PLOOMES_CUSTOM_FIELDS = {
  empresa_vendedora : 111111,  // FieldId real
  produto           : 111112,
  tipo_venda        : 111113,
  origem            : 111114,
};
```

### 4. Subir para o GitHub

```bash
git init
git remote add origin https://github.com/GrupoGVC/dashboard-vendas.git
git add .
git commit -m "feat: dashboard de vendas com integração Ploomes"
git push -u origin main
```

### 5. Ativar GitHub Pages

1. Repositório → **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / pasta `/ (root)`
4. Salvar → URL gerada: `https://grupogvc.github.io/dashboard-vendas/`

---

## Segurança da chave API

> ⚠️ **Mantenha o repositório PRIVADO se a chave estiver no `config.js`.**

Para repositório público ou maior segurança, use um proxy:

**Opção recomendada:** Supabase Edge Function (já existe `plano-api` no projeto GVC)

```javascript
// Em data-loader.js, substitua a URL base:
var base = 'https://lqbmjmqrhcokimdtekyc.supabase.co/functions/v1/ploomes-proxy';
```

A Edge Function faz a chamada ao Ploomes server-side, sem expor a chave no browser.

---

## Atualização dos dados

O dashboard busca os dados do Ploomes **ao carregar a página**.  
Não é necessária nenhuma ação manual — basta abrir ou recarregar.

Para forçar atualização sem recarregar a página:
```javascript
// No console do browser:
loadFromPloomes();
```

---

## Dados históricos (2023–2025)

Os dados de anos anteriores estão hardcoded em `config.js` (array `EVOL_DATA_HISTORICO`).  
São estáticos por design — referem-se a anos já encerrados.  
**Atualizar manualmente ao fechar cada ano** com a exportação do Ploomes.

---

## Manutenção

| Tarefa | Frequência | Arquivo |
|---|---|---|
| Adicionar novo consultor + meta | Por admissão | `config.js` → `METAS_INDIVIDUAIS` |
| Atualizar meta mensal do time | Mensal/trimestral | `config.js` → `DASHBOARD_META_TEAM` |
| Fechar dados do ano anterior | Anual (Jan) | `config.js` → `EVOL_DATA_HISTORICO` |
| Mapear novo campo customizado | Quando criado no Ploomes | `config.js` → `PLOOMES_CUSTOM_FIELDS` |

---

## Tecnologias

- **HTML/CSS/JS** puro — sem dependências de build
- **Chart.js 4.4** — gráficos
- **Ploomes REST API v2** — fonte de dados
- **GitHub Pages** — hospedagem gratuita
