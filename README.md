# pricing-sandbox · Live OpenAI Persona Sandbox

KAIST IMMS 졸업 프로젝트 — **호모 실리쿠스 · 페르소나 시뮬레이션 샌드박스**.

16개 KOSTAT·BOK·KB 기반 한국 페르소나가 `gpt-4o-mini` LLM 에이전트로 가격 인상을 평가합니다. 탐색재(Search) vs 경험재(Experience) 가격 탄력성, 커뮤니티 토론 후 행동 변화(WOM_m), McNemar χ² 등 측정.

**Live:** https://pricing-sandbox-live.vercel.app

## Architecture

```
Browser UI (Next.js client)
    │ POST /api/simulate
    ▼
Vercel Serverless Function
    │ × N parallel OpenAI calls (Structured Outputs)
    ▼
gpt-4o-mini  →  Korean rationale per persona
```

API key is server-side only; the browser never sees it.

## Stack

- **Next.js 16** (App Router, TypeScript, no Tailwind)
- **OpenAI SDK** (`gpt-4o-mini`, JSON Schema strict mode)
- **Zod** for input validation
- **Vercel** serverless deploy

## Local development

```bash
git clone https://github.com/IMMS-graduation-project/pricing-sandbox.git
cd pricing-sandbox
npm install
echo "OPENAI_API_KEY=sk-..." > .env.local
npm run dev
```

Open http://localhost:3000.

## Deploy

1. Push to GitHub
2. Import on https://vercel.com/new
3. Add `OPENAI_API_KEY` env var (Production, Preview, Development)
4. Redeploy after env changes

## Key files

| File | Role |
|---|---|
| `app/page.tsx` + `components/Sandbox.tsx` | UI (hero, console, persona grid, results) |
| `lib/personas.ts` | 16 archetypes + 4-layer data |
| `lib/products.ts` | 12-product catalog (6 search + 6 experience) + custom |
| `lib/instances.ts` | Display-only ×2 sampling per archetype (32 cards) |
| `lib/avatars.ts` | Procedural inline-SVG avatar generator |
| `lib/openai.ts` | OpenAI client + Korean persona prompts |
| `app/api/decide/route.ts` | One persona → one decision |
| `app/api/simulate/route.ts` | Orchestrates 16 archetypes + discussion + metrics |

## Metrics

- `ε_sim = (%ΔQ) / (%ΔP)` — price elasticity
- `WOM_m = ΔQ_post / ΔQ_pre` — word-of-mouth multiplier
- McNemar χ² for pre/post discussion flip significance

탐색재 가설: WOM_m > 1 (정보 캐스케이드 → 거부 증폭).
경험재 가설: WOM_m < 1 (밴드왜건 → 거부 완화).
