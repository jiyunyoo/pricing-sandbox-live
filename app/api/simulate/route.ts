import { NextResponse } from 'next/server';
import { PERSONAS } from '@/lib/personas';
import type { Persona, ActiveProduct, Decision, PersonaDecision, SimulateRequest, SimulateResponse } from '@/lib/types';
import { callDecide, callSeedPost, callComment } from '@/lib/openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const RATE: Map<string, number[]> = new Map();
function rateLimited(ip: string, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const arr = (RATE.get(ip) ?? []).filter(t => now - t < windowMs);
  if (arr.length >= limit) {
    RATE.set(ip, arr);
    return true;
  }
  arr.push(now);
  RATE.set(ip, arr);
  return false;
}

function buyRate(decisions: Decision[]) {
  if (decisions.length === 0) return 0;
  return decisions.filter(d => d.buy).length / decisions.length;
}

function mcnemar(pre: Decision[], post: Decision[]) {
  let b = 0; // pre Yes / post No
  let c = 0; // pre No / post Yes
  for (let i = 0; i < pre.length; i++) {
    if (pre[i].buy && !post[i].buy) b++;
    if (!pre[i].buy && post[i].buy) c++;
  }
  const denom = b + c;
  const chi2 = denom > 0 ? Math.pow(Math.abs(b - c) - 1, 2) / denom : 0;
  return { b, c, chi2, significant: chi2 > 3.84 };
}

function archetypeBuckets(decisions: PersonaDecision[]) {
  const out: Record<string, { n: number; buyRateBase: number; buyRatePre: number; buyRatePost: number }> = {};
  for (const persona of PERSONAS) {
    const gen = persona.gen;
    const found = decisions.find(d => d.personaId === persona.id);
    if (!found) continue;
    if (!out[gen]) out[gen] = { n: 0, buyRateBase: 0, buyRatePre: 0, buyRatePost: 0 };
    out[gen].n += 1;
    out[gen].buyRateBase += found.stage1Base.buy ? 1 : 0;
    out[gen].buyRatePre += found.stage1Priced.buy ? 1 : 0;
    out[gen].buyRatePost += (found.stage2 ?? found.stage1Priced).buy ? 1 : 0;
  }
  for (const k of Object.keys(out)) {
    const r = out[k];
    if (r.n > 0) {
      r.buyRateBase /= r.n;
      r.buyRatePre /= r.n;
      r.buyRatePost /= r.n;
    }
  }
  return out;
}

function pickLeader(personas: Persona[], stage1Priced: Decision[], goodType: 'search' | 'experience') {
  // search: highest-confidence skeptic (didn't buy, confident)
  // experience: highest-confidence advocate (bought, confident)
  const skeptics = personas
    .map((p, i) => ({ p, d: stage1Priced[i] }))
    .filter(x => x.d.buy === false)
    .sort((a, b) => b.d.confidence - a.d.confidence);
  const advocates = personas
    .map((p, i) => ({ p, d: stage1Priced[i] }))
    .filter(x => x.d.buy === true)
    .sort((a, b) => b.d.confidence - a.d.confidence);

  if (goodType === 'search') {
    return skeptics[0] ?? advocates[0] ?? null;
  }
  return advocates[0] ?? skeptics[0] ?? null;
}

function expandPopulation(decisions: PersonaDecision[], popPerArch: number) {
  // Statistical expansion: each archetype's decision probability is treated as p,
  // and N = popPerArch independent Bernoulli draws are sampled. Returns aggregate rates.
  const N = decisions.length * Math.max(1, popPerArch);
  let baseHits = 0;
  let preHits = 0;
  let postHits = 0;
  for (const d of decisions) {
    const probBase = d.stage1Base.buy ? 0.5 + d.stage1Base.confidence * 0.1 : 0.5 - d.stage1Base.confidence * 0.1;
    const probPre = d.stage1Priced.buy ? 0.5 + d.stage1Priced.confidence * 0.1 : 0.5 - d.stage1Priced.confidence * 0.1;
    const post = d.stage2 ?? d.stage1Priced;
    const probPost = post.buy ? 0.5 + post.confidence * 0.1 : 0.5 - post.confidence * 0.1;
    for (let i = 0; i < popPerArch; i++) {
      if (Math.random() < probBase) baseHits++;
      if (Math.random() < probPre) preHits++;
      if (Math.random() < probPost) postHits++;
    }
  }
  return { n: N, Q_base: baseHits / N, Q_pre: preHits / N, Q_post: postHits / N };
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 1분 후 다시 시도해주세요.' }, { status: 429 });
  }

  try {
    const body = (await request.json()) as SimulateRequest;
    const { product, deltaPct, discussion, popPerArch } = body;

    if (!product || typeof deltaPct !== 'number') {
      return NextResponse.json({ error: '잘못된 요청: product/deltaPct가 필요합니다.' }, { status: 400 });
    }

    const personas = PERSONAS.slice(0, 16);
    const basePrice = product.basePrice;
    const newPrice = Math.round(basePrice * (1 + deltaPct / 100));

    // Stage 1: parallel calls for (base) AND (priced) for each persona
    const stage1: Array<{ base: Decision; priced: Decision }> = await Promise.all(
      personas.map(async (persona) => {
        const [base, priced] = await Promise.all([
          callDecide({ persona, product, basePrice, newPrice: basePrice, deltaPct: 0, stage: 'decide' }),
          callDecide({ persona, product, basePrice, newPrice, deltaPct, stage: 'decide' }),
        ]);
        return { base, priced };
      })
    );

    const decisions: PersonaDecision[] = personas.map((p, i) => ({
      personaId: p.id,
      stage1Base: stage1[i].base,
      stage1Priced: stage1[i].priced,
    }));

    let thread: SimulateResponse['thread'] | undefined;

    if (discussion) {
      const leader = pickLeader(personas, stage1.map(s => s.priced), product.goodType);
      if (leader) {
        const stance: 'skeptic' | 'advocate' = leader.d.buy ? 'advocate' : 'skeptic';
        const seedPost = await callSeedPost(leader.p, product, basePrice, newPrice, deltaPct, stance);

        // 3 commenter personas (mix of buyers and non-buyers, not the leader)
        const others = personas.filter(p => p.id !== leader.p.id);
        const commenters = [others[0], others[Math.floor(others.length / 2)], others[others.length - 1]];
        const comments = await Promise.all(
          commenters.map(async (p) => ({
            personaId: p.id,
            personaName: p.name,
            text: await callComment(
              { persona: p, product, basePrice, newPrice, deltaPct, stage: 'comment' },
              { seedPost, topic: '댓글로 자신의 생각을 한 줄 남기세요.' }
            ),
          }))
        );

        thread = {
          leader: { personaId: leader.p.id, seedPost },
          comments: comments.map(c => ({ personaId: c.personaId, text: c.text })),
        };

        // Stage 2: re-decide with thread context, in parallel
        const stage2 = await Promise.all(
          personas.map((persona) => callDecide({
            persona, product, basePrice, newPrice, deltaPct, stage: 'decide',
            seedPost, comments: comments.map(c => ({ personaName: personas.find(p => p.id === c.personaId)!.name, text: c.text })),
          }))
        );
        for (let i = 0; i < decisions.length; i++) {
          decisions[i].stage2 = stage2[i];
          decisions[i].flipped = decisions[i].stage1Priced.buy !== stage2[i].buy;
        }
      }
    }

    // ── Metrics ──
    const Q_base = buyRate(decisions.map(d => d.stage1Base));
    const Q_pre = buyRate(decisions.map(d => d.stage1Priced));
    const Q_post = buyRate(decisions.map(d => d.stage2 ?? d.stage1Priced));
    const deltaQ_pre = Q_pre - Q_base;
    const deltaQ_post = Q_post - Q_base;
    const elasticity = deltaPct !== 0 && Q_base > 0 ? (deltaQ_pre / Q_base) / (deltaPct / 100) : 0;
    const wom_m = deltaQ_pre !== 0 ? deltaQ_post / deltaQ_pre : 1;
    const mc = discussion
      ? mcnemar(decisions.map(d => d.stage1Priced), decisions.map(d => d.stage2 ?? d.stage1Priced))
      : { b: 0, c: 0, chi2: 0, significant: false };

    const population = expandPopulation(decisions, Math.max(1, popPerArch));

    const response: SimulateResponse = {
      product, deltaPct, discussion,
      decisions, thread,
      metrics: {
        Q_base, Q_pre, Q_post,
        deltaQ_pre, deltaQ_post,
        elasticity, wom_m,
        mcnemar: mc,
        cohort: archetypeBuckets(decisions),
      },
      population,
    };
    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
