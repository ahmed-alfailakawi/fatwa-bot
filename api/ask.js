const Anthropic = require("@anthropic-ai/sdk");

const SCHOLARS = [
  { id: "alkamees", name: "الشيخ د. عثمان الخميس", ytHandle: "عثمان الخميس" },
  { id: "aljaser", name: "الشيخ د. مطلق الجاسر", ytHandle: "مطلق الجاسر" },
  { id: "albani", name: "الشيخ الألباني" },
  { id: "binbaz", name: "الشيخ ابن باز" },
  { id: "uthaymeen", name: "الشيخ ابن عثيمين" },
  { id: "alshikh", name: "الشيخ صالح آل الشيخ" },
  { id: "fawzan", name: "الشيخ الفوزان" },
  { id: "abdulaziz", name: "الشيخ عبدالعزيز آل الشيخ" },
  { id: "albader", name: "الشيخ عبدالرزاق البدر" },
];

async function findYT(name, query) {
  try {
    const r = await fetch(
      "https://www.youtube.com/results?search_query=" + encodeURIComponent(query + " " + name),
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    );
    const h = await r.text();
    const m = h.match(/"videoId":"([^"]{11})"/);
    return m ? "https://www.youtube.com/watch?v=" + m[1] : null;
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
    const kUrl = await findYT("عثمان الخميس", question);
    const jUrl = await findYT("مطلق الجاسر", question);
    const kSrc = kUrl || "https://www.youtube.com/@othmanalkamees/search?query=" + encodeURIComponent(question);
    const jSrc = jUrl || "https://www.youtube.com/@dr-mutlaq/search?query=" + encodeURIComponent(question);

    const client = new Anthropic({ apiKey });

    const system = mode === "hadith"
      ? `أنت متخصص في علوم الحديث. أجب بـ JSON فقط:
{"text":"...","grade":"...","source":"...","sourceUrl":"","scholars":"...","note":"..."}`
      : `أنت متخصص في الفقه على منهج أهل السنة والجماعة. أجب بـ JSON فقط:
{"alkamees":{"answer":"...","evidence":"...","ruling":"haram","sourceUrl":"${kSrc}"},"aljaser":{"answer":"...","evidence":"...","ruling":"haram","sourceUrl":"${jSrc}"},"albani":{"answer":"...","evidence":"...","ruling":"haram","sourceUrl":""},"binbaz":{"answer":"...","evidence":"...","ruling":"haram","sourceUrl":""},"uthaymeen":{"answer":"...","evidence":"...","ruling":"haram","sourceUrl":""},"alshikh":{"answer":"...","evidence":"...","ruling":"haram","sourceUrl":""},"fawzan":{"answer":"...","evidence":"...","ruling":"haram","sourceUrl":""},"abdulaziz":{"answer":"...","evidence":"...","ruling":"haram","sourceUrl":""},"albader":{"answer":"...","evidence":"...","ruling":"haram","sourceUrl":""},"summary":"..."}`;

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
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
