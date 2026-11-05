import { TEXTS } from "@/lib/texts";

/**
 * Library. The texts are static files, so this whole page is prerendered at
 * build time: no database call, no loading state.
 */
export default function LibraryPage() {
  const texts = [...TEXTS].sort((a, b) => a.year - b.year);

  return (
    <div>
      <h1 className="font-serif text-4xl tracking-tight">Library</h1>
      <p className="mt-2 max-w-prose text-muted">
        Pick a text to read. Save the ideas you might one day need as cards.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {texts.map((t) => (
          <li key={t.slug} className="rounded-lg border border-rule bg-surface p-5">
            <p className="text-xs uppercase tracking-wider text-muted">
              {t.author} · {t.year}
            </p>
            <h2 className="mt-1 font-serif text-2xl leading-tight">{t.title}</h2>
            {t.translator && <p className="mt-1 text-sm italic text-muted">tr. {t.translator}</p>}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {t.themes.map((theme) => (
                <span key={theme} className="rounded-full border border-rule px-2 py-0.5 text-xs text-muted">
                  {theme}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
