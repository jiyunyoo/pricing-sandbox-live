import OpenAI from 'openai';
import type { Persona, ActiveProduct, Decision } from './types';

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export const MODEL = 'gpt-4o-mini';

export interface DecideRequest {
  persona: Persona;
  product: ActiveProduct;
  basePrice: number;
  newPrice: number;
  deltaPct: number;
  stage: 'decide' | 'comment';
  seedPost?: string;
  comments?: { personaName: string; text: string }[];
}

/* Map ANY product to this persona's category interest (0..1).
   Search goods → monitor-style spec interest; experience goods → cosmetics-style interest.
   This is the key fix: without it, non-monitor/non-cosmetic products had no interest signal. */
function productInterest(persona: Persona, product: ActiveProduct): number {
  return product.goodType === 'search'
    ? persona.lifestyle.monitor_interest
    : persona.lifestyle.cosmetics_interest;
}

function dominantValueKR(persona: Persona): string {
  const map: Record<string, string> = {
    gaseong: '가성비', gasim: '가심비', meaning: '미닝아웃', brand: '브랜드 충성',
  };
  const top = Object.entries(persona.values).sort((a, b) => b[1] - a[1])[0][0];
  return map[top] ?? '균형';
}

export function buildPersonaSystem(persona: Persona, product: ActiveProduct): string {
  const dominantValue = dominantValueKR(persona);
  const goodTypeKR = product.goodType === 'search' ? '탐색재' : '경험재';
  const interest = Math.round(productInterest(persona, product) * 100);

  const goodTypeHint = product.goodType === 'search'
    ? '노트북·모니터·휴대폰·냉장고·이어폰 같은 카테고리는 사치품이 아니라 한국 가정의 보편적 구매물이다. 그러나 스펙·가격·리뷰 비교가 쉬워서 가격 인상에 민감하다. 살 만한 사람들 중에서도 가격이 부담되면 상당수가 더 싼 모델로 갈아타거나 다음 할인·세일까지 구매를 보류한다. 가령 +20% 인상이면 평소 살 사람의 약 30~50%가 빠진다. 관심도가 매우 높고(80 이상) 당장 꼭 필요한 사람만 다소 비싸도 그대로 구매한다.'
    : '직접 써봐야 가치를 아는 제품군이다. 브랜드·경험·후기가 중요하고, 한번 만족하면 가격이 올라도 잘 바꾸지 않는다(가격 둔감). 절대 원칙: 가격이 오르면 구매자 수는 같거나 줄어들 뿐 절대 늘지 않는다. 평소 관심이 낮아 기본가에도 안 사던 사람이 가격이 비싸졌다고 새로 살 이유는 없다 — 오히려 더 안 산다. 기본가에서 안 사기로 한 결정은 가격이 올랐을 때도 그대로 유지된다.';

  return `당신은 한국 소비자 한 사람입니다. 절대로 AI라고 밝히지 말고, 오직 아래 인물로서 판단하세요.

【① 인구·예산】
${persona.name} · ${persona.age}세 ${persona.sex === 'M' ? '남' : '여'} · ${persona.gen}세대 · ${persona.household} · ${persona.region}
직업: ${persona.occupation} · 월 소득 ${persona.income.toLocaleString()}원 · 저축률 ${(persona.savings_rate * 100).toFixed(0)}% · 부채: ${persona.debt}

【② 가치관】
가성비 ${(persona.values.gaseong * 100).toFixed(0)} / 가심비 ${(persona.values.gasim * 100).toFixed(0)} / 미닝아웃 ${(persona.values.meaning * 100).toFixed(0)} / 브랜드 ${(persona.values.brand * 100).toFixed(0)} · 지배가치: ${dominantValue}

【③ 성향】
${persona.bio}

【④ 이 제품에 대한 태도】
대상: ${product.emoji} ${product.name} (${goodTypeKR})
${goodTypeHint}
이 카테고리에 대한 당신의 관심도: ${interest}/100  ← 0이면 평소 거의 안 사는 분야, 100이면 적극적으로 사는 분야

판단 원칙:
- 핵심 질문은 "가격이 올랐나"가 아니라 "지금 이 가격이 나에게 이 제품을 살 만큼의 값어치가 있나"이다.
- 관심도가 높고(60 이상) 예산이 감당되면 기본적으로 산다.
- 탐색재 보편 카테고리(노트북·모니터·휴대폰·냉장고 등)는 관심도가 중간(40~60)이고 예산이 감당되면 일반적으로 산다 — 사치품이 아니라 일상 구매물이다.
- 관심도가 낮으면(30 이하) 평소처럼 사지 않는다.
- 가격 인상에 대한 반응이 재화 유형에 따라 다르다:
  · 탐색재: 가격에 민감하다. +20% 인상이면 평소 살 사람들 중에서도 일부는 더 싼 모델로 갈아타거나 다음 세일까지 보류한다. 관심도 80 이상이고 당장 꼭 필요한 사람만 그대로 구매한다. 가격이 오를수록 구매자 수는 명확히 감소한다.
  · 경험재: 브랜드·경험 가치 때문에 가격 둔감하다. 이미 살 만한 고관심자(60+)는 가격이 올라도 대부분 그대로 유지. 다만 가격 상승은 절대로 새 구매자를 만들지 않는다. 평소 안 사던 저관심자는 더더욱 안 산다. 가격이 오르면 전체적으로 약간 감소하거나 거의 변화 없거나.
- 16명이 모두 같은 결정을 할 필요는 없다. 관심도·소득·가치관에 따라 솔직하게 갈리도록 판단하라.
- 한국어로만, 오직 이 인물로서 답하라.`;
}

function buildDecideUser(req: DecideRequest): string {
  const { product, newPrice, seedPost, comments } = req;
  const priceLine = `가격: ${newPrice.toLocaleString()}원 / ${product.unit}`;

  const discussion = seedPost
    ? `\n\n【커뮤니티 토론】\n오피니언 리더: "${seedPost}"\n${(comments ?? []).map(c => `· ${c.personaName}: "${c.text}"`).join('\n')}\n\n이 토론을 본 뒤 마음이 바뀌었을 수도, 그대로일 수도 있습니다. 솔직하게 다시 판단하세요.`
    : '';

  return `${product.emoji} ${product.name}
${priceLine}${discussion}

이 가격에 이 제품을 지금 사겠습니까? 당신의 관심도·예산·가치관에 비춰 솔직하게 판단하세요.

JSON으로만 응답:
- buy: true(산다) / false(안 산다)
- confidence: 1~5 (확신 정도)
- rationale_cot: 한국어 한 문장, 80자 이내`;
}

const decisionSchema = {
  type: 'object',
  properties: {
    buy: { type: 'boolean' },
    confidence: { type: 'integer', minimum: 1, maximum: 5 },
    rationale_cot: { type: 'string' },
  },
  required: ['buy', 'confidence', 'rationale_cot'],
  additionalProperties: false,
};

export async function callDecide(req: DecideRequest): Promise<Decision> {
  const completion = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 400,
    temperature: 0.9,
    messages: [
      { role: 'system', content: buildPersonaSystem(req.persona, req.product) },
      { role: 'user', content: buildDecideUser(req) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'decision', strict: true, schema: decisionSchema },
    },
  });
  const raw = completion.choices[0]?.message?.content ?? '';
  const parsed = JSON.parse(raw);
  return {
    buy: Boolean(parsed.buy),
    confidence: Math.max(1, Math.min(5, Number(parsed.confidence) || 3)),
    rationale_cot: String(parsed.rationale_cot ?? '').slice(0, 160),
  };
}

export async function callComment(req: DecideRequest, ctx: { seedPost: string; topic: string }): Promise<string> {
  const completion = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 200,
    temperature: 1.0,
    messages: [
      { role: 'system', content: buildPersonaSystem(req.persona, req.product) },
      {
        role: 'user',
        content: `한국 커뮤니티 게시판에 다음 글이 올라왔습니다:\n"${ctx.seedPost}"\n\n${ctx.topic}\n\n페르소나의 말투로 120자 이내 한국어 댓글 하나만. 댓글 내용만, 따옴표·접두어 없이.`,
      },
    ],
  });
  return (completion.choices[0]?.message?.content ?? '').trim().slice(0, 160);
}

export async function callSeedPost(persona: Persona, product: ActiveProduct, basePrice: number, newPrice: number, deltaPct: number, stance: 'skeptic' | 'advocate'): Promise<string> {
  const stanceHint = stance === 'skeptic'
    ? '가격이 비싸다고 회의적·비판적인 톤으로'
    : '제품 가치를 지지하며 이 가격도 살 만하다는 톤으로';
  const completion = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 300,
    temperature: 1.0,
    messages: [
      { role: 'system', content: buildPersonaSystem(persona, product) },
      {
        role: 'user',
        content: `한국 커뮤니티(디시·뽐뿌·올리브영 리뷰 등)에 ${stanceHint} 글을 한 단락(최대 200자) 쓰세요. ${product.emoji} ${product.name}이 ${newPrice.toLocaleString()}원입니다. 본문만, 제목·따옴표·자기소개 없이.`,
      },
    ],
  });
  return (completion.choices[0]?.message?.content ?? '').trim().slice(0, 280);
}
