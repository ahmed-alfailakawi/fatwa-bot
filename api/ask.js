const handler = async (req, res) => {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST,OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).end();

const { question } = req.body;
if (!question) return res.status(400).json({ error: ‘no question’ });

const SYSTEM = `أنت بوت فتاوى إسلامي متخصص. أجب على السؤال الفقهي بأسلوب كل شيخ وفق منهجه المعروف. ابن باز: واضح مباشر حنبلي يعتمد النص، يبسّط الأحكام. ابن عثيمين: تحليلي تفصيلي يذكر الأقوال ويرجح مع تيسير. الفوزان: محافظ دقيق يعتمد الفقه الحنبلي مع الدليل. أجب بـ JSON فقط ابدأ مباشرة بـ { بدون أي نص: {"binbaz":{"answer":"3-4 جمل","evidence":"الدليل والمصدر"},"uthaymeen":{"answer":"3-4 جمل","evidence":"الدليل والمصدر"},"fawzan":{"answer":"3-4 جمل","evidence":"الدليل والمصدر"},"summary":"خلاصة 2-3 جمل"}`;

try {
const response = await fetch(‘https://api.anthropic.com/v1/messages’, {
method: ‘POST’,
headers: {
‘Content-Type’: ‘application/json’,
‘x-api-key’: process.env.ANTHROPIC_API_KEY,
‘anthropic-version’: ‘2023-06-01’
},
body: JSON.stringify({
model: ‘claude-sonnet-4-20250514’,
max_tokens: 1500,
system: SYSTEM,
messages: [{ role: ‘user’, content: question }]
})
});

```
const data = await response.json();
if (data.error) return res.status(500).json({ error: data.error.message });

const raw = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
const s = raw.indexOf('{');
const e = raw.lastIndexOf('}');
if (s < 0 || e < 0) return res.status(500).json({ error: 'no json' });

return res.status(200).json(JSON.parse(raw.slice(s, e + 1)));
```

} catch (err) {
return res.status(500).json({ error: err.message });
}
};

module.exports = handler;
