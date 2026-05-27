'use client';

import { useMemo, useState } from 'react';
import { avatarSVG } from '@/lib/avatars';
import { PRODUCTS, SEARCH_PRODUCTS, EXPERIENCE_PRODUCTS, defaultProduct } from '@/lib/products';
import { dominantValue } from '@/lib/personas';
import { makeInstances, avatarPersona, type PersonaInstance } from '@/lib/instances';
import type {
  Persona,
  ActiveProduct,
  CustomProduct,
  SimulateRequest,
  SimulateResponse,
  GoodType,
} from '@/lib/types';

type LoaderStep = 'stage1' | 'discussion' | 'stage2' | 'metrics' | 'done';

function fmtKRW(n: number) {
  return n.toLocaleString('ko-KR') + '원';
}

function fmtPct(n: number, digits = 0) {
  return (n * 100).toFixed(digits) + '%';
}

function fmtSigned(n: number, digits = 1) {
  return (n >= 0 ? '+' : '') + n.toFixed(digits);
}

interface SandboxProps {
  personas: Persona[];
}

interface CustomFormState {
  enabled: boolean;
  name: string;
  basePrice: string; // string for input handling
  goodType: GoodType;
}

const DEFAULT_CUSTOM: CustomFormState = {
  enabled: false,
  name: '',
  basePrice: '',
  goodType: 'search',
};

export default function Sandbox({ personas }: SandboxProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>(defaultProduct().id);
  const [custom, setCustom] = useState<CustomFormState>(DEFAULT_CUSTOM);
  const [deltaPct, setDeltaPct] = useState<number>(20);
  const [discussion, setDiscussion] = useState<boolean>(true);
  const [popPerArch, setPopPerArch] = useState<number>(20); // N=320 default
  const [loading, setLoading] = useState<boolean>(false);
  const [loaderStep, setLoaderStep] = useState<LoaderStep>('stage1');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<Persona | null>(null);

  const instances = useMemo(() => makeInstances(personas), [personas]);

  const activeProduct = useMemo<ActiveProduct | null>(() => {
    if (custom.enabled) {
      const price = parseInt(custom.basePrice, 10);
      if (!custom.name.trim() || !price || price <= 0) return null;
      const p: CustomProduct = {
        id: 'custom',
        name: custom.name.trim(),
        emoji: custom.goodType === 'search' ? '🔍' : '✨',
        goodType: custom.goodType,
        basePrice: price,
        unit: '개',
        priceSource: '사용자 입력',
        elasticityPrior: '사용자 정의',
      };
      return p;
    }
    return PRODUCTS.find(p => p.id === selectedProductId) ?? defaultProduct();
  }, [custom, selectedProductId]);

  const runDisabled = !activeProduct || loading;

  async function runSimulation() {
    if (!activeProduct) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLoaderStep('stage1');

    // Cosmetic stepping: rotates label while the single network call runs
    let cancel = false;
    const ticker = (async () => {
      const steps: LoaderStep[] = ['stage1', 'discussion', 'stage2', 'metrics'];
      for (const s of steps) {
        if (cancel) return;
        if (s === 'discussion' && !discussion) continue;
        if (s === 'stage2' && !discussion) continue;
        setLoaderStep(s);
        await new Promise(r => setTimeout(r, 2200));
      }
    })();

    try {
      const body: SimulateRequest = {
        product: activeProduct,
        deltaPct,
        discussion,
        popPerArch,
      };
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? `요청 실패 (${res.status})`);
      }
      cancel = true;
      void ticker;
      setLoaderStep('done');
      setResult(json as SimulateResponse);
    } catch (e) {
      cancel = true;
      void ticker;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="kicker">KAIST IMMS · LIVE PRICING SANDBOX</div>
        <h1 className="app-title">호모 실리쿠스 · 페르소나 시뮬레이션 샌드박스</h1>
        <p className="app-subtitle">
          GPT-4o-mini 기반 16개 한국 페르소나가 가격 인상에 대해 실시간으로 추론합니다.
          탐색재(Search) vs 경험재(Experience) 가격 탄력성과 토론 후 행동 변화(WOM_m)를 측정.
        </p>
      </header>

      <main>
        <div className="hero-banner">
          <h2>실시간 LLM 시뮬레이션</h2>
          <p>
            아래에서 제품을 선택(또는 직접 입력)하고 가격 변동률을 설정한 뒤 실행하세요.
            16명의 페르소나 각자가 OpenAI에 별도로 호출되어 한국어로 의사결정을 추론하고, 선택적으로 커뮤니티 토론 단계 후 재결정합니다.
          </p>
        </div>

        {/* ── Console ── */}
        <section className="console">
          {/* Left: products */}
          <div className="panel">
            <h3><span className="step">1</span> 제품 선택</h3>

            <div className="product-group-label">탐색재 · Search Goods</div>
            <div className="product-grid">
              {SEARCH_PRODUCTS.map(p => (
                <button
                  key={p.id}
                  className={`product-chip${!custom.enabled && selectedProductId === p.id ? ' active' : ''}`}
                  onClick={() => { setSelectedProductId(p.id); setCustom({ ...custom, enabled: false }); }}
                >
                  <span className="product-chip-emoji">{p.emoji}</span>
                  <span className="product-chip-meta">
                    <span className="product-chip-name">{p.name}</span>
                    <span className="product-chip-price">{fmtKRW(p.basePrice)}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="product-group-label">경험재 · Experience Goods</div>
            <div className="product-grid">
              {EXPERIENCE_PRODUCTS.map(p => (
                <button
                  key={p.id}
                  className={`product-chip experience${!custom.enabled && selectedProductId === p.id ? ' active' : ''}`}
                  onClick={() => { setSelectedProductId(p.id); setCustom({ ...custom, enabled: false }); }}
                >
                  <span className="product-chip-emoji">{p.emoji}</span>
                  <span className="product-chip-meta">
                    <span className="product-chip-name">{p.name}</span>
                    <span className="product-chip-price">{fmtKRW(p.basePrice)}</span>
                  </span>
                </button>
              ))}
            </div>

            <button
              className={`custom-toggle${custom.enabled ? ' active' : ''}`}
              onClick={() => setCustom(c => ({ ...c, enabled: !c.enabled }))}
            >
              {custom.enabled ? '✓ 직접 입력 중' : '+ 직접 입력 (Custom Product)'}
            </button>

            {custom.enabled && (
              <div className="custom-form">
                <div>
                  <label>제품명</label>
                  <input
                    type="text"
                    value={custom.name}
                    onChange={e => setCustom(c => ({ ...c, name: e.target.value }))}
                    placeholder="예: 골프채 세트"
                  />
                </div>
                <div className="row">
                  <div>
                    <label>가격 (원)</label>
                    <input
                      type="number"
                      value={custom.basePrice}
                      onChange={e => setCustom(c => ({ ...c, basePrice: e.target.value }))}
                      placeholder="500000"
                    />
                  </div>
                  <div>
                    <label>재화 분류</label>
                    <div className="good-type-toggle">
                      <button
                        className={custom.goodType === 'search' ? 'active' : ''}
                        onClick={() => setCustom(c => ({ ...c, goodType: 'search' }))}
                      >탐색재</button>
                      <button
                        className={custom.goodType === 'experience' ? 'active' : ''}
                        onClick={() => setCustom(c => ({ ...c, goodType: 'experience' }))}
                      >경험재</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: controls + run */}
          <div className="panel">
            <h3><span className="step">2</span> 가격 변동 & 시나리오</h3>

            <div className="slider-block">
              <div className="slider-row">
                <span className="slider-label">가격 변동률</span>
                <span className="slider-value">{deltaPct >= 0 ? '+' : ''}{deltaPct}%</span>
              </div>
              <input
                type="range"
                min={-20} max={50} step={5}
                value={deltaPct}
                onChange={e => setDeltaPct(parseInt(e.target.value, 10))}
              />
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 6 }}>
                기본값 +20% (한국 CPI 평균 인상률의 약 6배, 검출력 확보 수준)
              </div>
            </div>

            {activeProduct && (
              <div style={{ marginTop: 16, padding: 12, background: 'var(--paper-2)', borderRadius: 6, fontSize: 12 }}>
                <strong>{activeProduct.emoji} {activeProduct.name}</strong>{' '}
                <span style={{ color: 'var(--ink-mute)' }}>
                  {fmtKRW(activeProduct.basePrice)} → {fmtKRW(Math.round(activeProduct.basePrice * (1 + deltaPct / 100)))}
                </span>
                <div style={{ marginTop: 4, fontFamily: 'var(--font-ibm-plex-mono), monospace', fontSize: 10, color: 'var(--gold-deep)' }}>
                  {activeProduct.goodType === 'search' ? '탐색재' : '경험재'} · {activeProduct.elasticityPrior}
                </div>
              </div>
            )}

            <div className="discussion-row">
              <input
                type="checkbox"
                id="discussion-toggle"
                checked={discussion}
                onChange={e => setDiscussion(e.target.checked)}
              />
              <label htmlFor="discussion-toggle">
                커뮤니티 토론 단계 포함 (오피니언 리더 → 댓글 → 2차 의사결정)
              </label>
            </div>

            <div className="popselect">
              <span>인구 규모:</span>
              <select value={popPerArch} onChange={e => setPopPerArch(parseInt(e.target.value, 10))}>
                <option value={1}>N = 16 (archetypes only)</option>
                <option value={10}>N = 160 (×10 expansion)</option>
                <option value={20}>N = 320 (×20, default)</option>
                <option value={32}>N = 512 (×32)</option>
              </select>
            </div>

            <button
              className="btn-run"
              disabled={runDisabled}
              onClick={runSimulation}
            >
              {loading ? '시뮬레이션 중...' : '시뮬레이션 실행 →'}
            </button>

            {error && <div className="error-banner">⚠ {error}</div>}
          </div>
        </section>

        {/* ── Loader ── */}
        {loading && (
          <div className="loader-card">
            <div className="loader-spinner"></div>
            <div style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: 16, color: 'var(--ink)' }}>
              {loaderStep === 'stage1' && '1차 의사결정 진행 중... (16명 × 2 가격조건)'}
              {loaderStep === 'discussion' && '커뮤니티 토론 생성 중... (오피니언 리더 + 댓글)'}
              {loaderStep === 'stage2' && '2차 의사결정 재평가 중... (토론 후 영향)'}
              {loaderStep === 'metrics' && '탄력성·WOM·McNemar 산출 중...'}
            </div>
            <div className="loader-steps">
              <span className={`loader-step ${loaderStep === 'stage1' ? 'active' : 'done'}`}>STAGE 1</span>
              {discussion && (
                <>
                  <span className={`loader-step ${loaderStep === 'discussion' ? 'active' : loaderStep === 'stage1' ? '' : 'done'}`}>DISCUSSION</span>
                  <span className={`loader-step ${loaderStep === 'stage2' ? 'active' : (loaderStep === 'stage1' || loaderStep === 'discussion') ? '' : 'done'}`}>STAGE 2</span>
                </>
              )}
              <span className={`loader-step ${loaderStep === 'metrics' ? 'active' : ''}`}>METRICS</span>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {result && <ResultsView result={result} personas={personas} />}

        {/* ── Persona library: 2 instances per archetype, display-only ── */}
        <section className="persona-section">
          <h2 className="section-title">페르소나 라이브러리 — 32 instances (16 archetypes × 2)</h2>
          <p className="section-sub">
            KOSTAT·BOK·KB 보고서 기반 4축 (세대 × 가구 × 경제력 × 가치관) 16개 아키타입에서
            각 2명을 샘플링했습니다 (소득 ±10%, 관심도 ±0.05 디스플레이 지터). 카드를 클릭하면 아키타입 상세가 열립니다.
            <br />
            <strong style={{ color: 'var(--ink-soft)' }}>주의:</strong> 시뮬레이션은 16개 아키타입 기준으로만 실행됩니다 — 이 32장은 디스플레이용입니다.
          </p>
          <div className="persona-grid">
            {instances.map(inst => {
              const p = inst.archetype;
              return (
                <button
                  key={`${p.id}-${inst.instanceIndex}`}
                  className="persona-card persona-card-button"
                  onClick={() => setSelectedArchetype(p)}
                  aria-label={`${p.name} ${inst.label} 상세 보기`}
                >
                  <span className="instance-label">{inst.label}</span>
                  <div className="avatar" dangerouslySetInnerHTML={{ __html: avatarSVG(avatarPersona(inst)) }} />
                  <div className="persona-name">{p.name} <span style={{ fontWeight: 400, color: 'var(--ink-mute)', fontSize: 12 }}>· {p.age}</span></div>
                  <div className="persona-archetype">{p.archetype}</div>
                  <div className="persona-meta">
                    {p.gen}세대 · {p.sex === 'M' ? '남' : '여'}<br />
                    월 {Math.round(inst.jitteredIncome / 10000).toLocaleString()}만원
                  </div>
                  <div className="persona-value-tag">{dominantValue(p)}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Archetype detail modal ── */}
        {selectedArchetype && (
          <ArchetypeModal persona={selectedArchetype} onClose={() => setSelectedArchetype(null)} />
        )}

        <div className="footer-note">
          KAIST IMMS · 졸업 프로젝트 프로토타입 · powered by OpenAI gpt-4o-mini
        </div>
      </main>
    </>
  );
}

// ── Results ────────────────────────────────────────────
function ResultsView({ result, personas }: { result: SimulateResponse; personas: Persona[] }) {
  const { product, deltaPct, discussion, decisions, thread, metrics, population } = result;
  const newPrice = Math.round(product.basePrice * (1 + deltaPct / 100));
  const elasticityClass = Math.abs(metrics.elasticity) > 1 ? '|ε| > 1 · 탄력적' : '|ε| ≤ 1 · 비탄력적';
  const womDesc = discussion
    ? (metrics.wom_m > 1 ? '캐스케이드 (저항 증폭)' : metrics.wom_m < 1 ? '밴드왜건 (저항 완화)' : '중립')
    : '토론 미포함';

  return (
    <section className="flow-section">
      <h2 className="section-title">시뮬레이션 결과 · {product.emoji} {product.name}</h2>
      <p className="section-sub">
        {fmtKRW(product.basePrice)} → {fmtKRW(newPrice)} ({fmtSigned(deltaPct, 0)}%) · {product.goodType === 'search' ? '탐색재' : '경험재'} ·
        {' '}1차 구매율 {fmtPct(metrics.Q_base, 0)} → {fmtPct(metrics.Q_pre, 0)}
        {discussion && ` → 토론 후 ${fmtPct(metrics.Q_post, 0)}`}
        {' '}· 인구 확장 N={population.n}
      </p>

      {/* Metrics */}
      <div className="results-summary">
        <div className="metric-card">
          <div className="metric-label">ε_sim (탄력성)</div>
          <div className="metric-value">{metrics.elasticity.toFixed(2)}</div>
          <div className="metric-sub">{elasticityClass}</div>
        </div>
        <div className="metric-card gold">
          <div className="metric-label">1차 구매율 변화</div>
          <div className="metric-value">{fmtSigned((metrics.Q_pre - metrics.Q_base) * 100, 1)}%p</div>
          <div className="metric-sub">{fmtPct(metrics.Q_base, 0)} → {fmtPct(metrics.Q_pre, 0)}</div>
        </div>
        <div className="metric-card green">
          <div className="metric-label">WOM_m 승수</div>
          <div className="metric-value">{discussion ? metrics.wom_m.toFixed(2) : '—'}</div>
          <div className="metric-sub">{womDesc}</div>
        </div>
        <div className="metric-card red">
          <div className="metric-label">McNemar χ²</div>
          <div className="metric-value">{discussion ? metrics.mcnemar.chi2.toFixed(2) : '—'}</div>
          <div className="metric-sub">
            {discussion ? `b=${metrics.mcnemar.b}, c=${metrics.mcnemar.c} · ${metrics.mcnemar.significant ? 'p < 0.05 유의' : 'n.s.'}` : '토론 미포함'}
          </div>
        </div>
      </div>

      {/* Demand curve */}
      <DemandCurve decisions={result.decisions} deltaPct={deltaPct} goodType={product.goodType} />

      {/* Discussion thread */}
      {thread && (
        <div className="flow-stage">
          <h4>커뮤니티 토론 (오피니언 리더 + 댓글)</h4>
          {(() => {
            const leader = personas.find(p => p.id === thread.leader.personaId);
            return (
              <div className="thread-leader">
                <div className="thread-leader-name">
                  {leader?.name ?? thread.leader.personaId} · {leader?.archetype}
                </div>
                <div style={{ color: 'var(--ink-soft)' }}>{thread.leader.seedPost}</div>
              </div>
            );
          })()}
          {thread.comments.map((c, i) => {
            const p = personas.find(x => x.id === c.personaId);
            return (
              <div className="thread-comment" key={i}>
                <span className="thread-comment-name">{p?.name ?? c.personaId}</span>
                <span className="thread-comment-text">{c.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Decisions table */}
      <div className="flow-stage">
        <h4>페르소나별 의사결정 내역</h4>
        <table className="decision-table">
          <thead>
            <tr>
              <th>페르소나</th>
              <th>1차</th>
              {discussion && <th>2차</th>}
              <th>가치관</th>
              <th>근거 (CoT)</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map(d => {
              const p = personas.find(x => x.id === d.personaId);
              if (!p) return null;
              const s2 = d.stage2;
              const flipped = discussion && s2 && s2.buy !== d.stage1Priced.buy;
              return (
                <tr key={d.personaId}>
                  <td>
                    <span className="mini-avatar" dangerouslySetInnerHTML={{ __html: avatarSVG(p) }} />
                    <strong>{p.name}</strong>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginLeft: 42, marginTop: -2 }}>{p.archetype}</div>
                  </td>
                  <td>
                    {d.stage1Priced.buy
                      ? <span className="badge-yes">구매</span>
                      : <span className="badge-no">포기</span>}
                    <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 4 }}>conf {d.stage1Priced.confidence}/5</div>
                  </td>
                  {discussion && (
                    <td>
                      {s2 ? (
                        <>
                          {s2.buy ? <span className="badge-yes">구매</span> : <span className="badge-no">포기</span>}
                          {flipped && <span className="flip-tag">FLIP</span>}
                          <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 4 }}>conf {s2.confidence}/5</div>
                        </>
                      ) : <span style={{ color: 'var(--ink-mute)' }}>—</span>}
                    </td>
                  )}
                  <td><span className="persona-value-tag">{dominantValue(p)}</span></td>
                  <td className="rationale">{(s2 ?? d.stage1Priced).rationale_cot}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Archetype detail modal ────────────────────────────
function ArchetypeModal({ persona, onClose }: { persona: Persona; onClose: () => void }) {
  const valMap: Record<string, string> = { gaseong: '가성비', gasim: '가심비', meaning: '미닝아웃', brand: '브랜드 충성' };
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="닫기">×</button>
        <div className="modal-header">
          <div className="modal-avatar" dangerouslySetInnerHTML={{ __html: avatarSVG(persona) }} />
          <div>
            <div className="modal-name">{persona.name} ({persona.nameEn})</div>
            <div className="modal-archetype">{persona.archetype} · {persona.gen}세대</div>
            <div className="modal-bio">{persona.bio}</div>
          </div>
        </div>
        <div className="detail-grid">
          <div className="detail-block">
            <h4>① Demographics</h4>
            <div className="detail-row"><span>성별·연령</span><span>{persona.sex === 'M' ? '남' : '여'} · {persona.age}세</span></div>
            <div className="detail-row"><span>거주지</span><span>{persona.region}</span></div>
            <div className="detail-row"><span>가구</span><span>{persona.household}</span></div>
            <div className="detail-row"><span>직업</span><span>{persona.occupation}</span></div>
          </div>
          <div className="detail-block red">
            <h4>② Economics</h4>
            <div className="detail-row"><span>월 소득 (아키타입 기준)</span><span>{persona.income.toLocaleString()}원</span></div>
            <div className="detail-row"><span>저축률</span><span>{(persona.savings_rate * 100).toFixed(0)}%</span></div>
            <div className="detail-row"><span>부채</span><span style={{ fontSize: 11 }}>{persona.debt}</span></div>
          </div>
          <div className="detail-block gold">
            <h4>③ Values</h4>
            {Object.entries(persona.values).map(([k, v]) => (
              <div className="value-bar" key={k}>
                <span className="value-bar-label">{valMap[k]}</span>
                <span className="value-bar-track"><span className="value-bar-fill" style={{ width: `${v * 100}%` }} /></span>
                <span className="value-bar-pct">{(v * 100).toFixed(0)}</span>
              </div>
            ))}
          </div>
          <div className="detail-block green">
            <h4>④ Lifestyle</h4>
            <div className="value-bar">
              <span className="value-bar-label">모니터 관심</span>
              <span className="value-bar-track"><span className="value-bar-fill" style={{ width: `${persona.lifestyle.monitor_interest * 100}%` }} /></span>
              <span className="value-bar-pct">{(persona.lifestyle.monitor_interest * 100).toFixed(0)}</span>
            </div>
            <div className="value-bar">
              <span className="value-bar-label">화장품 관심</span>
              <span className="value-bar-track"><span className="value-bar-fill" style={{ width: `${persona.lifestyle.cosmetics_interest * 100}%` }} /></span>
              <span className="value-bar-pct">{(persona.lifestyle.cosmetics_interest * 100).toFixed(0)}</span>
            </div>
          </div>
        </div>
        <div className="modal-sources">출처: {persona.sources}</div>
      </div>
    </div>
  );
}

function DemandCurve({ decisions, deltaPct, goodType }: { decisions: SimulateResponse['decisions']; deltaPct: number; goodType: GoodType }) {
  // Build (price%, Q) points from { Q@0=Q_base, Q@deltaPct=Q_pre/post }.
  // Plus interpolate linearly for visualization.
  const Q0 = decisions.filter(d => d.stage1Base.buy).length / Math.max(1, decisions.length);
  const Q1 = decisions.filter(d => (d.stage2 ?? d.stage1Priced).buy).length / Math.max(1, decisions.length);
  const W = 640, H = 200, padL = 40, padB = 28, padR = 12, padT = 12;
  const xMin = Math.min(0, deltaPct);
  const xMax = Math.max(0, deltaPct);
  const xRange = Math.max(5, xMax - xMin);
  const x = (v: number) => padL + ((v - xMin) / xRange) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v) * (H - padT - padB);

  const stroke = goodType === 'search' ? 'var(--navy)' : 'var(--gold-deep)';
  const fill = goodType === 'search' ? 'rgba(30,39,97,0.08)' : 'rgba(201,169,97,0.12)';

  const pts = `${x(0)},${y(Q0)} ${x(deltaPct)},${y(Q1)}`;
  const areaPts = `${x(0)},${y(0)} ${x(0)},${y(Q0)} ${x(deltaPct)},${y(Q1)} ${x(deltaPct)},${y(0)}`;

  return (
    <div className="curve-panel">
      <h4>수요 곡선 (Q vs ΔP)</h4>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* axes */}
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--line)" />
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--line)" />
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <g key={t}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke="var(--line)" strokeDasharray="2 4" opacity="0.5" />
            <text x={padL - 6} y={y(t) + 4} fontSize="10" fill="var(--ink-mute)" textAnchor="end" fontFamily="var(--font-ibm-plex-mono)">
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        {/* axis labels */}
        <text x={padL} y={H - 6} fontSize="10" fill="var(--ink-mute)" fontFamily="var(--font-ibm-plex-mono)">0%</text>
        <text x={x(deltaPct)} y={H - 6} fontSize="10" fill="var(--ink-mute)" fontFamily="var(--font-ibm-plex-mono)" textAnchor="middle">
          {deltaPct >= 0 ? '+' : ''}{deltaPct}%
        </text>
        {/* fill area */}
        <polygon points={areaPts} fill={fill} />
        {/* line */}
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2.5" />
        {/* points */}
        <circle cx={x(0)} cy={y(Q0)} r="5" fill={stroke} />
        <circle cx={x(deltaPct)} cy={y(Q1)} r="5" fill={stroke} />
        <text x={x(0)} y={y(Q0) - 10} fontSize="11" fill={stroke} textAnchor="middle" fontFamily="var(--font-ibm-plex-mono)">
          {(Q0 * 100).toFixed(0)}%
        </text>
        <text x={x(deltaPct)} y={y(Q1) - 10} fontSize="11" fill={stroke} textAnchor="middle" fontFamily="var(--font-ibm-plex-mono)">
          {(Q1 * 100).toFixed(0)}%
        </text>
      </svg>
    </div>
  );
}
