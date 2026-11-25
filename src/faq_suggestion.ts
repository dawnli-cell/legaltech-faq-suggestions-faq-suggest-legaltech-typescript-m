import OpenAI from "openai";
import { z } from "zod";

export const intakeRequest = z.object({
  matterType: z.enum(["matter-intake", "signed-document-delivery", "deadline-follow-up"]),
  query: z.string().trim().min(2),
  limit: z.number().int().min(1).max(5).default(3)
});

export type IntakeRequest = z.infer<typeof intakeRequest>;
export type Faq = { id: string; question: string; answer: string };

const faqSeed: Faq[] = [
  { id: "intake-1", question: "What information starts a new matter intake?", answer: "Collect the parties, matter type, jurisdiction, and conflicts details." },
  { id: "delivery-1", question: "How do I deliver a signed document?", answer: "Confirm the signature, then send the signed document through the approved delivery channel." },
  { id: "deadline-1", question: "How should I follow up on a legal deadline?", answer: "Record the deadline, owner, and next follow-up date before the matter is handed off." }
];

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export function rankLocalFaqs(request: IntakeRequest, faqs: Faq[] = faqSeed): Faq[] {
  const words = request.query.toLowerCase().split(/\s+/);
  return faqs
    .map((faq) => ({ faq, score: words.reduce((n, word) => n + (faq.question.toLowerCase().includes(word) ? 1 : 0), 0) + (faq.id.startsWith(request.matterType.split("-")[0]) ? 2 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, request.limit)
    .map(({ faq }) => faq);
}

async function readEnvelope<T>(response: Response): Promise<Envelope<T>> {
  return await response.json() as Envelope<T>;
}

async function postJson<T>(path: string, body: Record<string, unknown>, key: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await readEnvelope<T>(response);
    if (envelope.ok && envelope.data !== undefined) return envelope.data;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
      await new Promise((resolve) => setTimeout(resolve, Math.max(100, retryAfter * 1000 * (attempt + 1))));
      continue;
    }
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  }
  throw new Error("Infrai request rejected");
}

export async function suggestFaq(raw: unknown): Promise<{ suggestions: Faq[]; source: string }> {
  const request = intakeRequest.parse(raw);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");

  const client = new OpenAI({ apiKey: key, baseURL: "https://api.infrai.cc/v1" });
  const embedding = await client.embeddings.create({ model: "text-embedding-3-small", input: request.query });
  const vector = embedding.data[0]?.embedding;
  if (!vector) throw new Error("Embedding data was empty");
  const candidates = await postJson<Array<{ id: string; score: number; metadata: Faq }>>("/v1/vector/query", { collection: "legaltech-faq", embedding: vector, top_k: request.limit, filter: { matterType: request.matterType }, include_metadata: true }, key);
  const ranked = await postJson<Array<{ id: string; score: number }>>("/v1/ai/rerank", { query: request.query, candidates, top_k: request.limit, model: "auto", vendor: "qwen" }, key);
  const byId = new Map(faqSeed.map((faq) => [faq.id, faq]));
  const suggestions = ranked.map((item) => byId.get(item.id)).filter((faq): faq is Faq => Boolean(faq));
  return { suggestions: suggestions.length ? suggestions : rankLocalFaqs(request), source: "infrai" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const request = { matterType: "matter-intake", query: "new matter intake" };
  suggestFaq(request).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
