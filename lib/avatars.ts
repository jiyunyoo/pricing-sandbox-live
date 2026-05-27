import type { Persona } from './types';

const BG_PALETTE = ['FBE0C8', 'F5C8A4', 'E5D4EC', 'CAEAF0', 'D4ECE3', 'F0E2CB', 'F0DAE2', 'CAD4EC'];

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** DiceBear Notionists portrait URL, seeded deterministically from persona id+name. */
export function avatarURL(persona: Persona): string {
  const seed = encodeURIComponent(persona.id + persona.name);
  const bg = BG_PALETTE[hashCode(persona.id) % BG_PALETTE.length];

  const params = new URLSearchParams({
    seed,
    backgroundType: 'gradientLinear',
    backgroundColor: bg,
    radius: '50',
  });

  return `https://api.dicebear.com/9.x/notionists/svg?${params.toString()}`;
}
