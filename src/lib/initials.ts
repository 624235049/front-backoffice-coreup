/** Thai professional titles a staff display name may start with (ทพ. อนันต์ → title ทพ., name อนันต์). */
const TITLES = ['ทพญ.', 'ทพ.', 'นพ.', 'พญ.', 'ภก.', 'ภญ.', 'พท.', 'พย.', 'ดร.'];

/** Words often typed before a name that are never its initial (stripped for avatars only, kept for display). */
const COURTESY = ['หมอ', 'คุณ', 'dr.', 'mrs.', 'mr.', 'ms.'];

/** A Thai initial is always a consonant: never a vowel (incl. เ แ โ ใ ไ written first), tone mark or digit. */
const THAI_CONSONANT = /[ก-ฮ]/;

export function splitTitle(name: string | null | undefined): { title: string | null; name: string } {
  const n = (name ?? '').trim();
  for (const t of TITLES) {
    if (n.startsWith(t)) return { title: t, name: n.slice(t.length).trim() };
  }
  return { title: null, name: n };
}

function dropCourtesy(name: string): string {
  for (const c of COURTESY) {
    const rest = name.slice(c.length);
    // must end in a dot or be followed by a space / consonant: "คุณมินตรา" yes, "คุณากร" (a real name) no
    if (name.toLowerCase().startsWith(c) && rest && (c.endsWith('.') || /^(\s|[ก-ฮ])/.test(rest)))
      return rest.trim();
  }
  return name;
}

/**
 * Initials for an avatar: titles are dropped, then the first real letter. Thai names give one consonant
 * ("ทพ. เกษม" → "ก", "แพร ทดลอง" → "พ"); names in Latin script give the first letters of the first two words
 * ("Mary Ann Lee" → "MA"). Empty input gives `fallback`.
 */
export function initialsOf(name: string | null | undefined, fallback = ''): string {
  const words = dropCourtesy(splitTitle(name).name).split(/\s+/).filter(Boolean);
  const thai = /[\u0E00-\u0E7F]/.test(words[0] ?? '');
  const first = (w: string | undefined) =>
    Array.from(w ?? '').find((ch) => (thai ? THAI_CONSONANT.test(ch) : /\p{L}/u.test(ch))) ?? '';
  const letters = thai ? first(words[0]) : `${first(words[0])}${first(words[1])}`;
  return letters.toLocaleUpperCase() || fallback;
}
