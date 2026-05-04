module.exports = async (req, res) => {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST,OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).end();

const { question, mode } = req.body;
if (!question) return res.status(400).json({ error: ‘no question’ });

const FATWA_SYSTEM = `You are an Islamic fatwa bot. Answer in Arabic based on each scholar’s methodology.
Ibn Baz: clear, direct, Hanbali.
Ibn Uthaymeen: analytical, detailed, with easement.
Al-Fawzan: conservative, precise, Hanbali fiqh.

Reply ONLY with valid JSON starting with { no text before or after:
{“binbaz”:{“ruling”:“one of: halal/haram/makruh/mubah/khilaf”,“answer”:“3-4 sentences in Arabic”,“evidence”:“source in Arabic”},“uthaymeen”:{“ruling”:“one of: halal/haram/makruh/mubah/khilaf”,“answer”:“3-4 sentences in Arabic”,“evidence”:“source in Arabic”},“fawzan”:{“ruling”:“one of: halal/haram/makruh/mubah/khilaf”,“answer”:“3-4 sentences in Arabic”,“evidence”:“source in Arabic”},“summary”:“2-3 sentences summary in Arabic”}`;

const HADITH_SYSTEM = `You are a hadith verification specialist. When given a hadith text, verify and grade it. Reply ONLY with valid JSON starting with { no text before or after: {"text":"full hadith text in Arabic","grade":"one of: sahih/hasan/daif/mawdu","source":"source with hadith number in Arabic","scholars":"scholars opinions in Arabic","note":"any important note in Arabic"}`;

try {
const r = await fetch(‘https://api.anthropic.com/v1/messages’, {
method: ‘POST’,
headers: {
‘Content-Type’: ‘application/json’,
‘x-api-key’: process.env.ANTHROPIC_API_KEY,
‘anthropic-version’: ‘2023-06-01’
},
body: JSON.stringify({
model: ‘claude-sonnet-4-5’,
max_tokens: 1500,
system: mode === ‘hadith’ ? HADITH_SYSTEM : FATWA_SYSTEM,
messages: [{ role: ‘user’, content: question }]
})
});

```
const data = await r.json();
if (data.error) return res.status(500).json({ error: data.error.message });

const raw = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
const s = raw.indexOf('{');
const e = raw.lastIndexOf('}');
if (s < 0 || e < 0) return res.status(500).json({ error: 'no json found' });

return res.status(200).json(JSON.parse(raw.slice(s, e + 1)));
```

} catch (err) {
return res.status(500).json({ error: err.message });
}
};
