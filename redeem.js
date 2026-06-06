export default async function handler(req, res) {
  // CORS headers — allow any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mobile, voucher_hash } = req.body;

  if (!mobile || !voucher_hash) {
    return res.status(400).json({ error: 'Missing mobile or voucher_hash' });
  }

  try {
    const response = await fetch(
      `https://gift.truemoney.com/campaign/vouchers/${voucher_hash}/redeem`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, voucher_hash }),
      }
    );

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach TrueMoney API', detail: err.message });
  }
}
