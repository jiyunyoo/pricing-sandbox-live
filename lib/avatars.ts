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

/**
 * DiceBear Avataaars portrait URL, seeded deterministically from the persona id+name.
 * Older personas get gray hair; biological-sex hint nudges hair length without
 * over-constraining (DiceBear still varies expressions/accessories per seed).
 */
export function avatarURL(persona: Persona): string {
  const seed = encodeURIComponent(persona.id + persona.name);
  const isElderly = persona.gen === 'Boomer';
  const isFemale = persona.sex === 'F';
  const bg = BG_PALETTE[hashCode(persona.id) % BG_PALETTE.length];

  const params = new URLSearchParams({
    seed,
    backgroundType: 'gradientLinear',
    backgroundColor: bg,
    radius: '50',
  });

  // Hair color: gray for elderly, dark otherwise
  if (isElderly) {
    params.append('hairColor', 'a8a29b,b8b2ac,c5bfb9');
    params.append('facialHairProbability', '0');
  } else {
    params.append('hairColor', '2c1b18,4a312c,724133,a55728');
  }

  // Hair length hint by sex (DiceBear still varies style within these sets)
  if (isFemale) {
    params.append('top', 'bigHair,bob,bun,curly,curvy,dreads,straight01,straight02,straightAndStrand');
  } else {
    params.append('top', 'shortCurly,shortFlat,shortRound,shortWaved,sides,theCaesar,theCaesarAndSidePart');
  }

  return `https://api.dicebear.com/9.x/avataaars/svg?${params.toString()}`;
}
