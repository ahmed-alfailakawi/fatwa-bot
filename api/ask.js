export const config = { runtime: “edge” };

// ══════════════════════════════════════════════
//  المصادر الإسلامية للبحث
// ══════════════════════════════════════════════
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

// ── استخراج نص مفيد من HTML ──
function extractText(html, domain) {
let text = html
.replace(/<script[\s\S]*?</script>/gi, “ “)
.replace(/<style[\s\S]*?</style>/gi, “ “)
.replace(/<nav[\s\S]*?</nav>/gi, “ “)
.replace(/<header[\s\S]*?</header>/gi, “ “)
.replace(/<footer[\s\S]*?</footer>/gi, “ “)
.replace(/<!--[\s\S]*?-->/g, “ “);

const articleMatch =
html.match(/<article[^>]*>([\s\S]*?)</article>/i) ||
html.match(/<main[^>]*>([\s\S]*?)</main>/i) ||
html.match(/<div[^>]*class=”[^”]*(?:content|post|fatwa|entry|field-item)[^”]*”[^>]*>([\s\S]*?)</div>/i);

if (articleMatch) text = articleMatch[1];

text = text
.replace(/<[^>]+>/g, “ “)
.replace(/ /g, “ “)
.replace(/&/g, “&”)
.replace(/</g, “<”)
.replace(/>/g, “>”)
.replace(/"/g, ‘”’)
.replace(/&#\d+;/g, “ “)
.replace(/\s{2,}/g, “ “)
.trim();

return text.length > 1500 ? text.substring(0, 1500) + “…” : text;
}

// ── البحث في مصدر واحد ──
async function fetchSource(src, query) {
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 7000);
try {
const res = await fetch(src.searchUrl(query), {
signal: controller.signal,
headers: {
“User-Agent”: “Mozilla/5.0 (compatible; IslamicBot/1.0)”,
Accept: “text/html”,
“Accept-Language”: “ar,en;q=0.9”,
},
});
if (!res.ok) return null;
const html = await res.text();

```
// محاولة فتح أول رابط نتيجة
const linkRe = new RegExp(
  `href="(https?://${src.domain.replace(/\./g, "\\.")}[^"]+)"`, "i"
);
const linkMatch = html.match(linkRe);
let deepText = "";
if (linkMatch) {
  try {
    const c2 = new AbortController();
    const t2 = setTimeout(() => c2.abort(), 5000);
    const r2 = await fetch(linkMatch[1], {
      signal: c2.signal,
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ar,en;q=0.9" },
    });
    clearTimeout(t2);
    if (r2.ok) {
      const h2 = await r2.text();
      deepText = extractText(h2, src.domain);
    }
  } catch (_) {}
}

const pageText = extractText(html, src.domain);
const finalText = deepText.length > 200 ? deepText : pageText;
if (finalText.length < 80) return null;
return { name: src.name, label: src.label, text: finalText };
```

} catch (_) {
return null;
} finally {
clearTimeout(timeout);
}
}

// ── البحث في كل المصادر بالتوازي ──
async function ragSearch(query) {
const results = await Promise.allSettled(
SOURCES.map((s) => fetchSource(s, query))
);
return results
.filter((r) => r.status === “fulfilled” && r.value)
.map((r) => r.value);
}

// ══════════════════════════════════════════════
//  بناء System Prompt للفتاوى
// ══════════════════════════════════════════════
function buildFatwaPrompt(ragResults) {
const ctx = ragResults.length
? ragResults
.map((r) => `【${r.label}】\n${r.text}`)
.join(”\n\n—\n\n”)
: “لم تُوجد نتائج بحث خارجية.”;

return `أنت نظام ذكاء اصطناعي إسلامي متخصص في الفقه وفتاوى أهل السنة والجماعة.

## نتائج البحث التلقائي في المواقع الرسمية:

${ctx}

## تعليمات الإجابة:

- أجب بصيغة JSON فقط بدون أي نص خارجه، وبدون backticks.
- المطلوب هيكل JSON التالي بالضبط:

{
“binbaz”: {
“answer”: “نص الإجابة كما سيقولها ابن باز بناءً على منهجه”,
“evidence”: “الدليل من الكتاب أو السنة”,
“ruling”: “halal أو haram أو makruh أو khilaf”
},
“uthaymeen”: {
“answer”: “نص الإجابة كما سيقولها ابن عثيمين”,
“evidence”: “الدليل”,
“ruling”: “halal أو haram أو makruh أو khilaf”
},
“fawzan”: {
“answer”: “نص الإجابة كما سيقولها الفوزان”,
“evidence”: “الدليل”,
“ruling”: “halal أو haram أو makruh أو khilaf”
},
“summary”: “خلاصة جامعة لأقوال المشايخ الثلاثة”
}

- استعن بنتائج البحث أعلاه أولاً، وإن لم تكفِ فاعتمد على علمك العام بفقه أهل السنة.
- لا تنسب فتوى لعالم بدون دليل.
- اكتب بالعربية الفصيحة.
- أجب بـ JSON فقط.`;
  }

// ══════════════════════════════════════════════
//  بناء System Prompt لتخريج الأحاديث
// ══════════════════════════════════════════════
function buildHadithPrompt(ragResults) {
const ctx = ragResults.length
? ragResults.map((r) => `【${r.label}】\n${r.text}`).join(”\n\n—\n\n”)
: “لم تُوجد نتائج بحث خارجية.”;

return `أنت متخصص في علوم الحديث وتخريج الأحاديث النبوية.

## نتائج البحث:

${ctx}

## تعليمات:

- أجب بـ JSON فقط بدون أي نص خارجه وبدون backticks.
- الهيكل المطلوب:

{
“text”: “نص الحديث كاملاً إن وُجد أو كما ورد في السؤال”,
“grade”: “صحيح أو حسن أو ضعيف أو موضوع أو لا أصل له”,
“source”: “المصدر والتخريج التفصيلي (كتاب، باب، رقم)”,
“scholars”: “أقوال العلماء في درجة الحديث”,
“note”: “ملاحظات إضافية إن وجدت”
}

- اعتمد على نتائج البحث أولاً، ثم علمك العام.
- أجب بـ JSON فقط.`;
  }

// ══════════════════════════════════════════════
//  Handler الرئيسي
// ══════════════════════════════════════════════
export default async function handler(req) {
const cors = {
“Access-Control-Allow-Origin”: “*”,
“Access-Control-Allow-Methods”: “POST, OPTIONS”,
“Access-Control-Allow-Headers”: “Content-Type”,
};

if (req.method === “OPTIONS”) {
return new Response(null, { status: 204, headers: cors });
}
if (req.method !== “POST”) {
return new Response(“Method Not Allowed”, { status: 405, headers: cors });
}

try {
const body = await req.json();
const { question, mode = “fatwa” } = body;

```
if (!question) {
  return new Response(
    JSON.stringify({ error: "question مطلوب" }),
    { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
  );
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  return new Response(
    JSON.stringify({ error: "ANTHROPIC_API_KEY غير مضبوط في بيئة Vercel" }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  );
}

// ── RAG: البحث في المصادر ──
const ragResults = await ragSearch(question);

// ── بناء الـ prompt ──
const systemPrompt =
  mode === "hadith"
    ? buildHadithPrompt(ragResults)
    : buildFatwaPrompt(ragResults);

// ── استدعاء Claude ──
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
  return new Response(
    JSON.stringify({ error: `خطأ Claude: ${err}` }),
    { status: claudeRes.status, headers: { ...cors, "Content-Type": "application/json" } }
  );
}

const claudeData = await claudeRes.json();
const rawText = claudeData.content?.[0]?.text || "{}";

// ── تنظيف JSON ──
const clean = rawText
  .replace(/```json/gi, "")
  .replace(/```/g, "")
  .trim();

let parsed;
try {
  parsed = JSON.parse(clean);
} catch (_) {
  parsed = { error: "تعذّر تحليل الإجابة", raw: clean };
}

return new Response(JSON.stringify(parsed), {
  status: 200,
  headers: { ...cors, "Content-Type": "application/json" },
});
```

} catch (err) {
return new Response(
JSON.stringify({ error: err.message }),
{ status: 500, headers: { …cors, “Content-Type”: “application/json” } }
);
}
}
