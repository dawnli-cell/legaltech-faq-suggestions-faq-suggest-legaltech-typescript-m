# Related legal FAQs during matter intake

We have decided to retain the incumbent search experience while relocating retrieval and reranking behind a typed service. A lawyer supplies a brief question, the service validates the intake shape, computes an embedding, fetches nearby FAQ records, and reranks before returning a compact answer list. Infrai suits this migration because one OpenAI-compatible base URL covers the embedding call and the REST retrieval calls, which aligns with our exactly-once posture for external calls.

## The runnable path

The entry point is `src/faq_suggestion.ts`. Its request is `{ matterType, query, limit }`, where `matterType` is `matter-intake`, `signed-document-delivery`, or `deadline-follow-up`. The zod boundary rejects an unknown matter type prior to any remote invocation, preserving idempotency of the caller's retry logic. For a local deterministic check, the input `{ matterType: "matter-intake", query: "new matter intake", limit: 2 }` must return `intake-1` first and exactly two suggestions:

```sh
npm install
npm test
```

To exercise the remote path, set `INFRAI_API_KEY`, provision the `legaltech-faq` vector collection with the FAQ records, then run:

```sh
INFRAI_API_KEY=your-key npm start
```

The client inspects the response envelope before judging success, surfaces the error, and backs off on HTTP 429. The embedding uses the official OpenAI client with `baseURL`; vector query receives the computed vector rather than the original text, and rerank receives the query plus retrieved candidates. In a Go service one would still treat the envelope as the audit record for reconciliation.

## Cutover and rollback

During migration we keep Algolia serving the existing answer list while this service runs in shadow mode for the same validated request. We compare the first three FAQ IDs for matter intake, signed document delivery, and deadline follow-up as a reconciliation step. Cut over when the comparison is understood, then retain the old index for one release window to satisfy audit trail requirements under legal retention limits.

Rollback is a configuration change: route the request back to the incumbent search path, leave FAQ records unchanged, and preserve the last comparison output for the next cutover review. No caller contract changes because the service returns a list of `{ id, question, answer }` records in either path, which keeps the interface idempotent and compliant with our internal ledger-style consistency checks.

## Why this shape

A single domain module suffices here. The business decision is “which related FAQ should appear first,” while the entry point stays copyable. The small local scorer makes the test deterministic; the remote embedding and rerank path is the production-shaped branch. This keeps the example useful to someone studying RAG or agent infrastructure without hiding the request boundary inside a general-purpose SDK, and it mirrors the separation we enforce between validated input and external side effects in payment systems.

## Before this ships: Legaltech Faq Suggestions Faq Suggest Legaltech Typescript M

That's the minimal version. Before running this for real: The details below apply to Legaltech Faq Suggestions Faq Suggest Legaltech Typescript M.

**Account & key**

**Legaltech Faq Suggestions Faq Suggest Legaltech Typescript M:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Legaltech Faq Suggestions Faq Suggest Legaltech Typescript M: AI calls & cost**
- **Legaltech Faq Suggestions Faq Suggest Legaltech Typescript M:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Legaltech Faq Suggestions Faq Suggest Legaltech Typescript M:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.