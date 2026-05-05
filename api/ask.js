const SOURCES = [
{
name: “binbaz”,
label: “ابن باز”,
searchUrl: (q) => `https://binbaz.org.sa/search?q=${encodeURIComponent(q)}`,
domain: “binbaz.org.sa”,
},
{
name: “uthaymeen”,
label: “ابن عثيمين”,
searchUrl: (q) => `https://www.ibnothaimeen.com/all/search/index.shtml?q=${encodeURIComponent(q)}`,
domain: “ibnothaimeen.com”,
},
{
name: “fawzan”,
label: “الفوزان”,
searchUrl: (q) => `https://alfawzan.af.org.sa/ar/search/node/${encodeURIComponent(q)}`,
domain: “alfawzan.af.org.sa”,
},
{
name: “bukhari”,
label: “البخاري-بيديا”,
searchUrl: (q) => `https://www.bukhari-pedia.net/?s=${encodeURIComponent(q)}`,
domain: “bukhari-pedia.net”,
},
];

function extractText(html) {
let text = html
.replace(/<script[\s\S]*?</script>/gi, “ “)
.replace(/<style[\s\S]*?</style>/gi, “ “)
.replace(/<nav[\s\S]*?</nav>/gi, “ “)
.replace(/<header[\s\S]*?</header>/gi, “ “)
.replace(/<footer[\s\S]*?</footer>/gi, “ “);

const m =
html.match(/<article[^>]*>([\s\S]*?)</article>/i) ||
html.match(/<main[^>]*>([\s\S]*?)</main>/i);
if (m) text = m[1];

text = text
.replace(/<[^>]+>/g, “ “)
.replace(/ /g, “ “)
.replace(/\s{2,}/g, “ “)
.trim();

return text.length > 1500 ? text.substring(0, 1500) + “…” : text;
}

async function fetchSource(src, query) {
try {
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 6000);
const res = await fetch(src.searchUrl(query), {
signal: controller.signal,
headers: { “User-Agent”: “Mozilla/5.0”, “Accept-Language”: “ar,en;q=0.9” },
});
clearTimeout(timeout);
if (!res.ok) return null;
const html = await res.text();
const text = extractText(html);
if (text.length < 80) return null;
return { name: src.name, label: src.label, text };
} catch (_) {
return null;
}
}

async function ragSearch(query) {
const results = await Promise.allSettled(SOURCES.map((s) => fetchSource(s, query)));
return results.filter((r) => r.status === “fulfilled” && r.value).map((r) => r.value);
}

function buildFatwaPrompt(ragResults) {
const ctx = ragResults.length
? ragResults.map((r) => `[${r.label}]\n${r.text}`).join(”\n\n—\n\n”)
: “لم تُوجد نتائج بحث.”;

return `أنت نظام ذكاء اصطناعي إسلامي متخصص في فتاوى أهل السنة.

نتائج البحث:
${ctx}

أجب بـ JSON فقط بدون أي نص خارجه:
{
“binbaz”: { “answer”: “…”, “evidence”: “…”, “ruling”: “halal أو haram أو makruh أو khilaf” },
“uthaymeen”: { “answer”: “…”, “evidence”: “…”, “ruling”: “…” },
“fawzan”: { “answer”: “…”, “evidence”: “…”, “ruling”: “…” },
“summary”: “خلاصة أقوال المشايخ”
}`;
}

function buildHadithPrompt(ragResults) {
const ctx = ragResults.length
? ragResults.map((r) => `[${r.label}]\n${r.text}`).join(”\n\n—\n\n”)
: “لم تُوجد نتائج بحث.”;

return `أنت متخصص في علوم الحديث.

نتائج البحث:
${ctx}

أجب بـ JSON فقط:
{
“text”: “نص الحديث”,
“grade”: “صحيح أو حسن أو ضعيف أو موضوع”,
“source”: “المصدر والتخريج”,
“scholars”: “أقوال العلماء”,
“note”: “ملاحظات”
}`;
}

module.exports = async function handler(req, res) {
res.setHeader(“Access-Control-Allow-Origin”, “*”);
res.setHeader(“Access-Control-Allow-Methods”, “POST, OPTIONS”);
res.setHeader(“Access-Control-Allow-Headers”, “Content-Type”);

if (req.method === “OPTIONS”) return res.status(204).end();
if (req.method !== “POST”) return res.status(405).json({ error: “Method Not Allowed” });

try {
const { question, mode = “fatwa” } = req.body;
if (!question) return res.status(400).json({ error: “question مطلوب” });

```
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY غير مضبوط" });

const ragResults = await ragSearch(question);
const systemPrompt = mode === "hadith" ? buildHadithPrompt(ragResults) : buildFatwaPrompt(ragResults);

const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-opus-4-5",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: question }],
  }),
});

if (!claudeRes.ok) {
  const err = await claudeRes.text();
  return res.status(500).json({ error: `خطأ Claude: ${err}` });
}

const data = await claudeRes.json();
const rawText = data.content?.[0]?.text || "{}";
const clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

let parsed;
try { parsed = JSON.parse(clean); }
catch (_) { parsed = { error: "تعذّر تحليل الإجابة", raw: clean }; }

return res.status(200).json(parsed);
```

} catch (err) {
return res.status(500).json({ error: err.message });
}
};
