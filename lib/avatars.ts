import type { Persona } from './types';

const SKIN_TONES = ['#FBE0C8', '#F5C8A4', '#EAB48A', '#D9966B'];
const HAIR_DARK = ['#1F1A17', '#2C2620', '#3A3028', '#4A3E32'];
const HAIR_GRAY = ['#9B9590', '#A8A29B', '#B8B2AC', '#C5BFB9'];
const BG_PALETTES: Array<[string, string]> = [
  ['#B8C5E8', '#CAD4EC'],
  ['#E8C5C0', '#F0D4D0'],
  ['#C5E0D5', '#D4ECE3'],
  ['#E5D5B8', '#F0E2CB'],
  ['#D8C5E8', '#E5D4EC'],
  ['#F5D5A8', '#FCE3BB'],
  ['#B8DCE5', '#CAEAF0'],
  ['#E5C8D5', '#F0DAE2'],
];

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function avatarSVG(persona: Persona): string {
  const h = hashCode(persona.id + persona.name);
  const bgIdx = h % BG_PALETTES.length;
  const skinIdx = (h >> 3) % SKIN_TONES.length;
  const skin = SKIN_TONES[skinIdx];
  const isElderly = persona.gen === 'Boomer';
  const hairColor = isElderly
    ? HAIR_GRAY[h % HAIR_GRAY.length]
    : HAIR_DARK[h % HAIR_DARK.length];
  const isFemale = persona.sex === 'F';
  const wearsGlasses = (h >> 5) % 3 === 0 || isElderly;
  const bg = BG_PALETTES[bgIdx];

  let hairPath: string;
  if (isFemale) {
    if (isElderly) {
      hairPath = `<path d="M30 36 Q30 22 50 22 Q70 22 70 36 Q72 38 70 42 Q68 32 50 30 Q32 32 30 42 Q28 38 30 36 Z" fill="${hairColor}"/>
                  <circle cx="34" cy="34" r="3" fill="${hairColor}"/><circle cx="66" cy="34" r="3" fill="${hairColor}"/>`;
    } else if ((h >> 7) % 2 === 0) {
      hairPath = `<path d="M26 40 Q26 20 50 20 Q74 20 74 40 L 76 72 L 72 70 L 70 50 L 68 36 Q60 30 50 30 Q40 30 32 36 L 30 50 L 28 70 L 24 72 Z" fill="${hairColor}"/>`;
    } else {
      hairPath = `<path d="M28 38 Q28 22 50 22 Q72 22 72 38 L 72 52 L 68 50 L 66 36 Q56 30 50 30 Q44 30 34 36 L 32 50 L 28 52 Z" fill="${hairColor}"/>`;
    }
  } else {
    if (isElderly && (h >> 7) % 2 === 0) {
      hairPath = `<path d="M36 36 Q36 28 50 28 Q64 28 64 36 Q66 38 64 40 Q62 32 50 32 Q38 32 36 40 Q34 38 36 36 Z" fill="${hairColor}"/>`;
    } else if ((h >> 7) % 3 === 0) {
      hairPath = `<path d="M30 38 Q32 24 50 24 Q68 24 70 38 Q72 36 70 32 Q66 22 50 22 Q34 22 30 32 Q28 36 30 38 Z" fill="${hairColor}"/>`;
    } else {
      hairPath = `<path d="M30 38 Q30 22 50 22 Q70 22 70 38 L 68 36 Q66 26 50 26 Q44 26 40 30 L 36 38 L 32 38 Z" fill="${hairColor}"/>`;
    }
  }

  const hasBeard = !isFemale && !isElderly && (h >> 8) % 4 === 0;
  const beardPath = hasBeard
    ? `<path d="M40 64 Q50 70 60 64 Q60 70 50 72 Q40 70 40 64 Z" fill="${hairColor}" opacity="0.7"/>`
    : '';

  const glassesPath = wearsGlasses
    ? `<circle cx="40" cy="52" r="5.5" fill="none" stroke="#1F2937" stroke-width="1.2"/>
       <circle cx="60" cy="52" r="5.5" fill="none" stroke="#1F2937" stroke-width="1.2"/>
       <line x1="45.5" y1="52" x2="54.5" y2="52" stroke="#1F2937" stroke-width="1.2"/>`
    : '';

  const blush = (isFemale && !isElderly)
    ? `<ellipse cx="36" cy="58" rx="3" ry="1.8" fill="#F4A8A8" opacity="0.5"/>
       <ellipse cx="64" cy="58" rx="3" ry="1.8" fill="#F4A8A8" opacity="0.5"/>`
    : '';

  const mouthSmile = persona.values.meaning > 0.6 || persona.values.gasim > 0.7
    ? `<path d="M44 64 Q50 68 56 64" stroke="#3A2820" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
    : `<path d="M44 64 Q50 66 56 64" stroke="#3A2820" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;

  const eyesPath = `<ellipse cx="40" cy="52" rx="1.6" ry="2" fill="#1F2937"/>
                    <ellipse cx="60" cy="52" rx="1.6" ry="2" fill="#1F2937"/>`;

  const browPath = isElderly
    ? `<path d="M36 46 Q40 45 44 46" stroke="${hairColor}" stroke-width="1.2" fill="none"/>
       <path d="M56 46 Q60 45 64 46" stroke="${hairColor}" stroke-width="1.2" fill="none"/>`
    : `<path d="M36 46 Q40 44 44 46" stroke="${hairColor}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
       <path d="M56 46 Q60 44 64 46" stroke="${hairColor}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg-${persona.id}" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stop-color="${bg[1]}"/>
        <stop offset="100%" stop-color="${bg[0]}"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#bg-${persona.id})"/>
    <path d="M44 70 L 44 82 Q44 92 50 92 Q56 92 56 82 L 56 70 Z" fill="${skin}"/>
    <ellipse cx="50" cy="54" rx="20" ry="24" fill="${skin}"/>
    ${hairPath}
    ${browPath}
    ${eyesPath}
    ${blush}
    <path d="M50 56 L 49 62 Q49 64 51 64 L 52 64" stroke="#C9956E" stroke-width="0.8" fill="none" stroke-linecap="round"/>
    ${mouthSmile}
    ${beardPath}
    ${glassesPath}
  </svg>`;
}
