import type { Persona } from './types';

function seededRand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const jit = (r: number, mag: number) => (r - 0.5) * 2 * mag;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export interface PersonaInstance {
  archetype: Persona;
  /** Avatar-only seed (used to vary the inline SVG between instances). */
  avatarSeed: string;
  instanceIndex: 1 | 2;
  label: string;
  /** Display-only jittered income (±10%). */
  jitteredIncome: number;
  /** Display-only jittered lifestyle (±0.05). */
  jitteredLifestyle: { monitor_interest: number; cosmetics_interest: number };
}

/**
 * For each archetype, return 2 display-only instances with small jitter on income and interest.
 * The simulation still runs on the underlying 16 archetypes — these instances never reach the API.
 */
export function makeInstances(personas: Persona[]): PersonaInstance[] {
  const out: PersonaInstance[] = [];
  for (const p of personas) {
    for (const idx of [1, 2] as const) {
      const tag = `${p.id}-i${idx}`;
      const r1 = seededRand(tag + ':income');
      const r2 = seededRand(tag + ':mon');
      const r3 = seededRand(tag + ':cos');
      out.push({
        archetype: p,
        avatarSeed: tag,
        instanceIndex: idx,
        label: `#${idx}`,
        jitteredIncome: Math.max(0, Math.round(p.income * (1 + jit(r1, 0.10)))),
        jitteredLifestyle: {
          monitor_interest: clamp01(p.lifestyle.monitor_interest + jit(r2, 0.05)),
          cosmetics_interest: clamp01(p.lifestyle.cosmetics_interest + jit(r3, 0.05)),
        },
      });
    }
  }
  return out;
}

/** Avatar seed needs a stable persona-shaped value that varies between instances. */
export function avatarPersona(instance: PersonaInstance): Persona {
  return { ...instance.archetype, id: instance.avatarSeed };
}
