module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const question = req.body && req.body.question;
  if (!question) return res.status(400).json({ error: 'no question' });

  const SYSTEM = `أنت بوت فتاوى إسلامي. أجب بـ JSON فقط ابدأ بـ { مباشرة:
{"binbaz":{"answer":"3-4 جمل","evidence":"الدليل"},"uthaymeen":{"answer":"3-4 جمل","evidence":"الدليل"},"fawzan":{"answer":"3-4 جمل","evidence":"الدليل"},"summary":"خلاصة"}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
       model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: 'user', content: question }]
      })
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const raw = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const s = raw.indexOf('{');
    const e = raw.lastIndexOf('}');
    if (s < 0 || e < 0) return res.status(500).json({ error: 'no json' });
    return res.status(200).json(JSON.parse(raw.slice(s, e + 1)));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
