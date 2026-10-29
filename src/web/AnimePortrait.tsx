// Original vector character, kept local and decorative; role names carry the meaning.
export function AnimePortrait({ variant = 0 }: { variant?: number }) {
  return <svg className="anime-portrait" viewBox="0 0 120 120" fill="none" aria-hidden="true" focusable="false">
    <circle cx="60" cy="60" r="56" fill="var(--portrait-backdrop)" />
    <path d="M22 101C23 81 20 67 24 43C28 11 90 11 96 44L100 102L79 110H41Z" fill="var(--portrait-hair)" />
    <path d="M30 115C31 94 42 87 60 87C78 87 90 95 92 115" fill="var(--portrait-jacket)" />
    <path d="M48 90L60 104L72 90L67 86H53Z" fill="var(--portrait-skin)" />
    <path d="M39 93L54 112L60 104L48 90ZM81 93L66 112L60 104L72 90Z" fill="var(--portrait-paper)" />
    <path d="M60 104L55 113L60 119L65 113Z" fill="var(--accent)" />
    <ellipse cx="60" cy="60" rx="31" ry="33" fill="var(--portrait-skin)" />
    <path d="M28 53C27 23 78 14 91 41L92 58L78 46L76 34L65 54L58 39L47 55L46 42L30 61Z" fill="var(--portrait-hair)" />
    <path d="M35 32L25 16L24 46ZM85 32L95 16L96 46Z" fill="var(--portrait-jacket)" stroke="var(--portrait-hair)" strokeWidth="5" strokeLinejoin="round" />
    <path d="M26 48V67M94 48V67" stroke="var(--portrait-jacket)" strokeWidth="9" strokeLinecap="round" />
    <path d="M39 59Q44 55 49 59M71 59Q76 55 81 59" stroke="var(--portrait-ink)" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="45" cy="65" rx="4.5" ry="7" fill="var(--portrait-eye)" />
    <ellipse cx="75" cy="65" rx="4.5" ry="7" fill="var(--portrait-eye)" />
    <circle cx="46" cy="62" r="2" fill="var(--portrait-paper)" /><circle cx="76" cy="62" r="2" fill="var(--portrait-paper)" />
    <ellipse cx="36" cy="74" rx="6" ry="3" fill="var(--portrait-blush)" /><ellipse cx="84" cy="74" rx="6" ry="3" fill="var(--portrait-blush)" />
    <path d="M55 79Q60 84 65 79" stroke="var(--portrait-ink)" strokeWidth="2" strokeLinecap="round" />
    {variant % 2 === 0 ? <g fill="var(--accent)"><path d="M84 40L74 33V46ZM84 40L94 33V46Z" /><circle cx="84" cy="40" r="3" fill="var(--portrait-paper)" /></g> : <path d="M76 40L85 44M78 35L87 39" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />}
  </svg>;
}
