/** Nimbus, the default helper. */
export function Mascot({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 96" width={size} height={Math.round(size * 0.8)} aria-hidden="true">
      <path
        d="M32 84 C14 84 8 66 18 56 C10 42 24 26 40 32 C44 16 62 8 76 16 C90 10 106 22 102 38 C114 42 116 62 104 70 C102 80 94 84 86 84 Z"
        fill="#FFFFFF"
        stroke="#9CC6EC"
        stroke-width="5"
      />
      <circle cx="50" cy="56" r="5" fill="#1F2340" />
      <circle cx="72" cy="56" r="5" fill="#1F2340" />
      <path d="M55 67 Q61 73 67 67" fill="none" stroke="#1F2340" stroke-width="4" stroke-linecap="round" />
    </svg>
  );
}
