const Anthropic = require("@anthropic-ai/sdk");

async function findYT(name, query) {
  try {
    const r = await fetch(
      "https://www.youtube.com/results?search_query=" + encodeURIComponent(query + " " + name),
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(3000) }
    );
    const h = await r.text();
    const videoMatch = h.match(/"videoId":"([^"]{11})"/);
    const titleMatch = h.match(/"title":{"runs":\[{"text":"([^"]+)"/);
    if (videoMatch) {
      return {
        url: "https://www.youtube.com/watch?v=" + videoMatch[1],
        title: titleMatch ? titleMatch[1] : "",
      };
    }
    return null;
  } catch (_) { return null; }
}

async function fetchSource(url) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ar,en;q=0.9" },
      signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) return null;
    const html = await r.text();
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, "")
                     .replace(/<style[\s\S]*?<\/style>/gi, "")
                     .replace(/<[^>]+>/g, " ")
                     .replace(/\s{2,}/g, " ")
                     .trim()
                     .substring(0, 2000);
    return text.length > 100 ? text : null;
  } catch (_) { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { question, mode = "fatwa" } = req.body || {};
  if (!question) return res.status(400).json({ error: "question مطلوب" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "no api key" });

  try {
    const q = encodeURIComponent(question);
    const [kResult, jResult, fResult, uResult, binbazText, islamwebText, islamqaText] = await Promise.all([
      findYT("عثمان الخميس", question),
      findYT("مطلق الجاسر", question),
      findYT("الفوزان", question),
      findYT("ابن عثيمين", question),
      fetchSource("https://binbaz.org.sa/fatwas?search=" + q),
      fetchSource("https://www.islamweb.net/ar/fatwa/search/?q=" + q),
      fetchSource("https://islamqa.info/ar/search/?q=" + q),
    ]);

    const kSrc = kResult ? kResult.url : "https://www.youtube.com/@othmanalkamees/search?query=" + encodeURIComponent(question);
    const jSrc = jResult ? jResult.url : "https://www.youtube.com/@dr-mutlaq/search?query=" + encodeURIComponent(question);
    const fSrc = fResult ? fResult.url : "https://www.youtube.com/@dralfawzann/search?query=" + encodeURIComponent(question);
    const uSrc = uResult ? uResult.url : "https://www.youtube.com/@ibnothaimeentv/search?query=" + encodeURIComponent(question);
    const kTitle = kResult ? kResult.title : "لم نجد فيديو للشيخ في هذه المسألة";
    const jTitle = jResult ? jResult.title : "لم نجد فيديو للشيخ في هذه المسألة";
    const fTitle = fResult ? fResult.title : "لم نجد فيديو للشيخ في هذه المسألة";
    const uTitle = uResult ? uResult.title : "لم نجد فيديو للشيخ في هذه المسألة";

    const ctx = [
      binbazText ? "[binbaz.org.sa]\n" + binbazText : null,
      islamwebText ? "[islamweb.net]\n" + islamwebText : null,
      islamqaText ? "[islamqa.info]\n" + islamqaText : null,
    ].filter(Boolean).join("\n\n---\n\n");

    const client = new Anthropic({ apiKey });

    const system = mode === "hadith"
      ? "أنت متخصص في علوم الحديث. أجب بـ JSON فقط: {\"text\":\"...\",\"grade\":\"...\",\"source\":\"...\",\"sourceUrl\":\"\",\"scholars\":\"...\",\"note\":\"...\"}"
      : mode === "general"
      ? `أنت موسوعة إسلامية شاملة على منهج أهل السنة والجماعة.
أجب على السؤال بإجابة صحيحة موثقة مباشرة.
القواعد:
- إجابة واحدة صحيحة محددة، لا تسرد خلافاً إلا إذا كان ضرورياً
- اذكر المصدر المعتمد (كتاب، حديث، آية قرآنية، أو مرجع علمي معروف)
- الإجابة واضحة ومختصرة وسهلة الفهم
- استخدم أرقاماً ومعلومات دقيقة عند الحاجة

أجب بـ JSON فقط:
{"answer":"الإجابة الكاملة والصحيحة","source":"المصدر (مثل: صحيح البخاري / البداية والنهاية / سورة كذا آية كذا)"}`
      : `أنت متخصص في الفقه الإسلامي على منهج أهل السنة والجماعة.

نتائج البحث من المواقع الرسمية:
${ctx || "لم نجد نتائج."}

قاعدة صارمة: إذا لم تجد فتوى موثقة اكتب "لم يفتِ الشيخ في هذه المسألة". لا تخترع أبداً.

أجب بـ JSON فقط:
{
  "summary":   "خلاصة جامعة",
  "binbaz":    {"answer":"...","evidence":"...","ruling":"...","sourceUrl":"https://binbaz.org.sa/fatwas?search=${q}"},
  "fawzan":    {"answer":"${fTitle}","evidence":"","ruling":"khilaf","sourceUrl":"${fSrc}"},
  "uthaymeen": {"answer":"${uTitle}","evidence":"","ruling":"khilaf","sourceUrl":"${uSrc}"},
  "alkamees":  {"answer":"${kTitle}","evidence":"","ruling":"khilaf","sourceUrl":"${kSrc}"},
  "aljaser":   {"answer":"${jTitle}","evidence":"","ruling":"khilaf","sourceUrl":"${jSrc}"}
}`;

    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: question }],
    });

    const raw = msg.content[0].text;
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    let parsed;
    try { parsed = JSON.parse(clean); } catch (_) { parsed = { error: "parse error", raw: clean }; }
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
