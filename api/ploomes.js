module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const key = process.env.PLOOMES_KEY;
  
  if (!key) {
    return res.status(500).json({ erro: 'Chave não encontrada no ambiente' });
  }

  // Testa a autenticação com a rota mais simples do Ploomes
  const r = await fetch('https://api2.ploomes.com/Account', {
    headers: { 'User-Key': key }
  });

  const texto = await r.text();

  return res.status(200).json({
    status_ploomes: r.status,
    chave_lida: key.substring(0, 10) + '...',
    chave_tamanho: key.length,
    resposta: texto.substring(0, 500)
  });
}
