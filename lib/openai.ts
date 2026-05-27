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

export function buildPersonaSystem(persona: Persona, product: ActiveProduct): string {
  const dominantValue = (() => {
    const entries = Object.entries(persona.values).sort((a, b) => b[1] - a[1]);
    const map: Record<string, string> = {
      gaseong: '가성비', gasim: '가심비', meaning: '미닝아웃', brand: '브랜드 충성',
    };
    return map[entries[0][0]] ?? '균형';
  })();

  const goodTypeKR = product.goodType === 'search' ? '탐색재' : '경험재';
  const goodTypeHint = product.goodType === 'search'
    ? '구매 전 스펙·가격·리뷰를 비교하기 쉬운 제품이다. 가격 인상 시 다른 모델로 대체 가능성을 검토하라.'
    : '직접 써봐야 가치를 알 수 있고 브랜드·경험·후기가 의사결정의 핵심인 제품이다. 가격은 자기 보상·체험가치 관점으로 평가하라.';

  return `당신은 한국 소비자 한 사람입니다. 절대로 AI라고 밝히지 말고, 오직 아래 페르소나로서 답하세요.

【① Demographics & Budget】
이름: ${persona.name} (${persona.nameEn}) · ${persona.age}세 ${persona.sex === 'M' ? '남' : '여'}
세대: ${persona.gen} · 가구: ${persona.household} · 지역: ${persona.region}
직업: ${persona.occupation}
월 소득: ${persona.income.toLocaleString()}원 · 저축률 ${(persona.savings_rate * 100).toFixed(0)}% · 부채: ${persona.debt}

【② Psychographics (가치관 가중치)】
가성비 ${(persona.values.gaseong * 100).toFixed(0)} / 가심비 ${(persona.values.gasim * 100).toFixed(0)} / 미닝아웃 ${(persona.values.meaning * 100).toFixed(0)} / 브랜드 ${(persona.values.brand * 100).toFixed(0)}
지배 가치: ${dominantValue}

【③ History & Constraints】
${persona.bio}
관심도(모니터/화장품): ${(persona.lifestyle.monitor_interest * 100).toFixed(0)} / ${(persona.lifestyle.cosmetics_interest * 100).toFixed(0)}

【④ Macro & Product Context】
대상 제품 카테고리: ${product.emoji} ${product.name} (${goodTypeKR})
${goodTypeHint}
가격 참고: ${product.priceSource} 기준

원칙:
- 한국어로만 답하라.
- ${dominantValue} 가치관, 라이프스타일 관심도, 월 소득·부채를 종합적으로 고려해 자연스럽게 판단하라.
- 가격 인상이 있어도 페르소나의 관심도가 높거나 브랜드·경험 가치가 충분하면 살 수도 있다. 반대로 평소 관심 없는 카테고리면 기본가에서도 안 살 수 있다.
- 한국 소비자의 다양한 의사결정 패턴(즉시 포기·대체 모델 검토·할인까지 대기·그래도 구매)을 현실적으로 반영하라.
- 다른 페르소나처럼 행동하지 말고 오직 위 인물로서 답하라.`;
}

function buildDecideUser(req: DecideRequest): string {
  const { product, newPrice, seedPost, comments } = req;
  const priceLine = `현재 시장가: ${newPrice.toLocaleString()}원/${product.unit}`;

  const discussion = seedPost
    ? `\n\n【커뮤니티 토론】\n오피니언 리더 게시글: "${seedPost}"\n${(comments ?? []).map(c => `· ${c.personaName}: "${c.text}"`).join('\n')}\n\n토론을 보고 마음이 흔들렸을 수도, 그대로일 수도 있습니다. 솔직하게 다시 판단하세요.`
    : '';

  return `대상 제품: ${product.emoji} ${product.name}
${priceLine}${discussion}

지금 이 페르소나의 입장에서 이 제품을 사겠습니까? 다음 가능성을 모두 열어두세요:
- 관심도가 높고 자기 가치관에 맞으면 그대로 구매.
- 가격이 부담스러우면 미루거나 대체재를 찾음.
- 평소 관심 없는 카테고리면 기본가에서도 패스.
모든 페르소나가 같은 결정을 할 필요는 없습니다.

JSON으로 응답:
- buy: true/false
- confidence: 1~5
- rationale_cot: 한국어 한 문장 (최대 80자)`;
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
    temperature: 1.1,
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
    confidence: Math.max(1, Math.min(5, Number(parsed.confidence) | 0)),
    rationale_cot: String(parsed.rationale_cot ?? '').slice(0, 160),
  };
}

export async function callComment(req: DecideRequest, ctx: { seedPost: string; topic: string }): Promise<string> {
  const completion = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 200,
    messages: [
      { role: 'system', content: buildPersonaSystem(req.persona, req.product) },
      {
        role: 'user',
        content: `한국 커뮤니티 게시판에 다음 글이 올라왔습니다:\n"${ctx.seedPost}"\n\n${ctx.topic}\n\n페르소나의 말투로 짧게 120자 이내 한국어 댓글 하나만 작성하세요. 댓글 내용만, 따옴표나 접두어 없이.`,
      },
    ],
  });
  return (completion.choices[0]?.message?.content ?? '').trim().slice(0, 160);
}

export async function callSeedPost(persona: Persona, product: ActiveProduct, basePrice: number, newPrice: number, deltaPct: number, stance: 'skeptic' | 'advocate'): Promise<string> {
  const stanceHint = stance === 'skeptic'
    ? '가격 인상에 회의적·비판적인 톤으로'
    : '제품 가치를 지지하며 가격 인상이 정당하다는 톤으로';
  const completion = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 300,
    messages: [
      { role: 'system', content: buildPersonaSystem(persona, product) },
      {
        role: 'user',
        content: `한국 커뮤니티(예: 디시·뽐뿌·올리브영 리뷰)에 ${stanceHint} 글을 한 단락만(최대 200자) 쓰세요. ${product.emoji} ${product.name}이 ${basePrice.toLocaleString()}원에서 ${newPrice.toLocaleString()}원(${deltaPct > 0 ? '+' : ''}${deltaPct}%)으로 변했습니다. 본문만, 제목·따옴표·자기소개 없이.`,
      },
    ],
  });
  return (completion.choices[0]?.message?.content ?? '').trim().slice(0, 280);
}
