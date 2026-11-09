const INK = '#1F2340';

const face = (
  <>
    <circle cx="50" cy="56" r="5" fill={INK} />
    <circle cx="72" cy="56" r="5" fill={INK} />
    <path d="M55 67 Q61 73 67 67" fill="none" stroke={INK} stroke-width="4" stroke-linecap="round" />
  </>
);

const CHARACTERS = {
  nimbus: (
    <>
      <path
        d="M32 84 C14 84 8 66 18 56 C10 42 24 26 40 32 C44 16 62 8 76 16 C90 10 106 22 102 38 C114 42 116 62 104 70 C102 80 94 84 86 84 Z"
        fill="#FFFFFF"
        stroke="#9CC6EC"
        stroke-width="5"
      />
      {face}
    </>
  ),
  mochi: (
    <>
      <path d="M22 86 Q8 86 10 72 C14 44 34 28 60 28 C86 28 106 44 110 72 Q112 86 98 86 Z" fill="#FFD3DD" />
      <path d="M60 28 C58 16 66 8 78 10 C76 22 70 28 60 28 Z" fill="#86C796" />
      <circle cx="48" cy="60" r="4.5" fill={INK} />
      <circle cx="72" cy="60" r="4.5" fill={INK} />
      <path d="M55 69 Q60 74 65 69" fill="none" stroke={INK} stroke-width="3.5" stroke-linecap="round" />
    </>
  ),
  sprig: (
    <>
      <path d="M60 34 V20" stroke="#4F9A62" stroke-width="4" stroke-linecap="round" />
      <path d="M60 22 C52 10 40 14 42 24 C48 27 55 26 60 22 Z" fill="#7BC48A" />
      <path d="M60 22 C68 10 80 14 78 24 C72 27 65 26 60 22 Z" fill="#7BC48A" />
      <ellipse cx="60" cy="62" rx="38" ry="28" fill="#C9EBCB" />
      <circle cx="49" cy="60" r="4.5" fill={INK} />
      <circle cx="71" cy="60" r="4.5" fill={INK} />
      <path d="M55 69 Q60 74 65 69" fill="none" stroke={INK} stroke-width="3.5" stroke-linecap="round" />
    </>
  ),
  pip: (
    <>
      <path d="M58 22 Q60 10 66 16" fill="none" stroke="#E8B83E" stroke-width="4" stroke-linecap="round" />
      <circle cx="60" cy="56" r="34" fill="#FFE08A" />
      <circle cx="49" cy="52" r="4.5" fill={INK} />
      <circle cx="71" cy="52" r="4.5" fill={INK} />
      <path d="M55 61 H65 L60 68 Z" fill="#F29A57" />
    </>
  ),
  tully: (
    <>
      <path d="M30 86 Q22 86 22 78 V42 L30 20 L46 34 H74 L90 20 L98 42 V78 Q98 86 90 86 Z" fill="#D6CBF6" />
      <circle cx="46" cy="54" r="11" fill="#FFFFFF" />
      <circle cx="74" cy="54" r="11" fill="#FFFFFF" />
      <circle cx="47" cy="55" r="4.5" fill={INK} />
      <circle cx="73" cy="55" r="4.5" fill={INK} />
      <path d="M56 66 H64 L60 72 Z" fill="#F29A57" />
    </>
  ),
};

export type Character = keyof typeof CHARACTERS;

/** The helper's character. Nimbus is the default. */
export function Mascot({ size = 34, character = 'nimbus' }: { size?: number; character?: Character | undefined }) {
  return (
    <svg viewBox="0 0 120 96" width={size} height={Math.round(size * 0.8)} aria-hidden="true">
      {CHARACTERS[character] ?? CHARACTERS.nimbus}
    </svg>
  );
}

/** The business's own picture when it has one, otherwise its character. */
export function HelperFace({ size = 34, character, avatarUrl }: { size?: number; character?: Character | undefined; avatarUrl?: string | null | undefined }) {
  if (avatarUrl && avatarUrl.startsWith('https://')) {
    return <img class="face-photo" src={avatarUrl} width={size} height={size} alt="" loading="lazy" referrerpolicy="no-referrer" />;
  }
  return <Mascot size={size} character={character} />;
}
