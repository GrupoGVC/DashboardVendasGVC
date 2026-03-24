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
    throw new Error('Ploomes ' + res.status + ': ' + text);
  }
  return res.json();
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
    const [wonDeals, lostDeals, openDeals] = await Promise.all([
      ploomesFetch('/Deals?$filter=StatusId eq 2', key),
      ploomesFetch('/Deals?$filter=StatusId eq 3', key),
      ploomesFetch('/Deals?$filter=StatusId eq 1', key)
    ]);

    return res.status(200).json({
      won: wonDeals.value || [],
      lost: lostDeals.value || [],
      open: openDeals.value || []
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
