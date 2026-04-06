/**
 * Supabase Edge Function: ploomes-proxy
 * 
 * Proxy entre o dashboard (GitHub Pages) e a API do Ploomes.
 * Resolve o problema de CORS — a chave fica segura no servidor.
 *
 * Deploy:
 *   supabase functions deploy ploomes-proxy --project-ref lqbmjmqrhcokimdtekyc
 *
 * URL de produção:
 *   https://lqbmjmqrhcokimdtekyc.supabase.co/functions/v1/ploomes-proxy
 */

const PLOOMES_USER_KEY = Deno.env.get('PLOOMES_USER_KEY') ?? '';
const PLOOMES_BASE     = 'https://api2.ploomes.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    // Extrai o path e query string da requisição recebida
    // Ex: /ploomes-proxy/Deals?$expand=OtherProperties&$top=500
    const url      = new URL(req.url);
    const path     = url.pathname.replace(/^\/functions\/v1\/ploomes-proxy/, '');
    const search   = url.search;
    const ploomesUrl = `${PLOOMES_BASE}${path}${search}`;

    console.log(`[ploomes-proxy] → ${ploomesUrl}`);

    const resp = await fetch(ploomesUrl, {
      headers: {
        'User-Key'    : PLOOMES_USER_KEY,
        'Content-Type': 'application/json',
      },
    });

    const data = await resp.text();

    return new Response(data, {
      status : resp.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });

  } catch (err) {
    console.error('[ploomes-proxy] Erro:', err);
    return new Response(
      JSON.stringify({ error: 'Proxy error', detail: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
