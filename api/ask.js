module.exports = async (req, res) => {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST,OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).end();

const { question, mode } = req.body;
if (!question) return res.status(400).json({ error: ‘no question’ });

const FATWA_SYSTEM = `أنت بوت فتاوى إسلامي متخصص. أجب على السؤال الفقهي بأسلوب كل شيخ وفق منهجه المعروف.
ابن باز: واضح مباشر حنبلي يعتمد النص.
ابن عثيمين: تحليلي تفصيلي يذكر الأقوال ويرجح مع تيسير.
الفوزان: محافظ دقيق يعتمد الفقه الحنبلي مع الدليل.

أجب بـ JSON فقط ابدأ مباشرة بـ { بدون أي نص:
{
“binbaz”:{“ruling”:“حلال أو حرام أو مكروه أو مباح أو خلاف”,“answer”:“3-4 جمل”,“evidence”:“الدليل والمصدر”},
“uthaymeen”:{“ruling”:“حلال أو حرام أو مكروه أو مباح أو خلاف”,“answer”:“3-4 جمل”,“evidence”:“الدليل والمصدر”},
“fawzan”:{“ruling”:“حلال أو حرام أو مكروه أو مباح أو خلاف”,“answer”:“3-4 جمل”,“evidence”:“الدليل والمصدر”},
“summary”:“خلاصة 2-3 جمل”
}`;

const HADITH_SYSTEM = `أنت متخصص في علم الحديث والتخريج. عندما يُعطى حديث، قم بتخريجه وبيان درجته. أجب بـ JSON فقط ابدأ مباشرة بـ { بدون أي نص: { "text": "نص الحديث كاملاً", "grade": "صحيح أو حسن أو ضعيف أو موضوع أو لا أصل له", "source": "المصدر مع رقم الحديث إن أمكن", "scholars": "أقوال العلماء في هذا الحديث", "note": "أي ملاحظة مهمة" }`;

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
if (s < 0 || e < 0) return res.status(500).json({ error: 'no json' });

return res.status(200).json(JSON.parse(raw.slice(s, e + 1)));
```

} catch (err) {
return res.status(500).json({ error: err.message });
}
};
