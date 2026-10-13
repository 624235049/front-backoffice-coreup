import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { type Locale, useSession } from '@/stores/session';

/**
 * Namespaces are files: `src/locales/<lng>/<namespace>.json`. Drop a new file in (e.g. `customers.json`) and it is
 * picked up automatically — no registry to edit. Thai (default) is bundled eagerly; other languages load on demand.
 */
const thFiles = import.meta.glob('../locales/th/*.json', { eager: true, import: 'default' }) as Record<
  string,
  Record<string, unknown>
>;
const lazyFiles: Record<Exclude<Locale, 'th'>, Record<string, () => Promise<unknown>>> = {
  en: import.meta.glob('../locales/en/*.json', { import: 'default' }),
};

function nsOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '');
}

const thResources = Object.fromEntries(Object.entries(thFiles).map(([p, v]) => [nsOf(p), v]));
export const namespaces = Object.keys(thResources);

const loaded = new Set<Locale>(['th']);

async function ensureLoaded(locale: Locale): Promise<void> {
  if (loaded.has(locale) || locale === 'th') return;
  const files = lazyFiles[locale];
  await Promise.all(
    Object.entries(files).map(async ([p, load]) => {
      i18n.addResourceBundle(locale, nsOf(p), (await load()) as object, true, true);
    }),
  );
  loaded.add(locale);
}

export async function setLanguage(locale: Locale): Promise<void> {
  await ensureLoaded(locale);
  await i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
}

export async function initI18n(): Promise<typeof i18n> {
  const locale = useSession.getState().locale;
  await i18n.use(initReactI18next).init({
    resources: { th: thResources },
    lng: 'th',
    fallbackLng: 'th',
    defaultNS: 'common',
    ns: namespaces,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  await setLanguage(locale);
  // Keep i18next in sync with the persisted locale (language switcher writes the store).
  useSession.subscribe((s, prev) => {
    if (s.locale !== prev.locale) void setLanguage(s.locale);
  });
  return i18n;
}

export { i18n };
