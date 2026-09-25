import { useMemo, useState } from 'preact/hooks';
import { Plus, Search } from 'lucide-preact';
import { formatAge } from '../lib/linkDoc';
import { displayDomain, normalizeInput } from '../lib/linkKey';
import { linkMeta, matchesQuery, type LibraryLink } from '../lib/library';
import type { TabInfo } from './compose';

/** Cards shown before "View All". */
const PREVIEW_COUNT = 3;

/**
 * 09 — signed in: save the current tab, or search and open saved links
 * (Figma: saved-links-list, 186:38).
 */
export function Home(props: {
  /** The current tab when it can be saved, with its linkUid for the saved check. */
  tab: (TabInfo & { linkUid: string }) | null;
  /** Null while the index is loading for the first time. */
  links: LibraryLink[] | null;
  now: number;
  onSaveTab: () => void;
  onSaveUrl: (url: string) => void;
  onOpen: (link: LibraryLink) => void;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const { tab, links, now } = props;

  const saved = tab && links ? (links.find((l) => l.id === tab.linkUid) ?? null) : null;
  const q = query.trim();
  const matches = useMemo(() => (links ? links.filter((l) => matchesQuery(l, q)) : null), [links, q]);
  // A typed or pasted link that isn't in the list can be saved straight from here.
  const typedUrl = q && matches?.length === 0 ? normalizeInput(q) : null;
  const shown = matches && (q || expanded ? matches : matches.slice(0, PREVIEW_COUNT));

  return (
    <div class="body">
      {tab && (
        <div class="quick-save">
          <div class="quick-save-text">
            <div class="quick-save-status">
              {saved ? `Already in Links · ${formatAge(saved.createdAt, now)}` : links ? 'Current tab not yet saved' : 'Current tab'}
            </div>
            <div class="quick-save-title">{saved?.title || tab.title || displayDomain(tab.url)}</div>
          </div>
          {saved ? (
            <button class="small-button tonal" onClick={props.onSaveTab}>
              Edit tags
            </button>
          ) : (
            <button class="small-button primary" onClick={props.onSaveTab}>
              <Plus size={10} strokeWidth={3} />
              Save
            </button>
          )}
        </div>
      )}

      <label class="search">
        <Search size={14} />
        <input
          type="search"
          placeholder="Search saved links..."
          aria-label="Search saved links"
          spellcheck={false}
          autocomplete="off"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && typedUrl) props.onSaveUrl(typedUrl);
          }}
        />
      </label>

      <div class="list-header">
        <div class="label">
          {q ? 'Results' : 'My saved links'}
          {matches && ` (${matches.length})`}
        </div>
        {!q && matches && matches.length > PREVIEW_COUNT && (
          <button class="link-button" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : 'View All'}
          </button>
        )}
      </div>

      <div class="link-list">
        {!shown ? (
          <>
            <LinkCardLoading />
            <LinkCardLoading />
          </>
        ) : typedUrl ? (
          <button class="small-button primary save-typed" onClick={() => props.onSaveUrl(typedUrl)}>
            <Plus size={10} strokeWidth={3} />
            Save {displayDomain(typedUrl)}
          </button>
        ) : shown.length === 0 ? (
          <div class="list-empty">{q ? 'No saved links match.' : 'Links you save show up here.'}</div>
        ) : (
          shown.map((link) => <LinkCard key={link.id} link={link} now={now} onOpen={() => props.onOpen(link)} />)
        )}
      </div>
    </div>
  );
}

function LinkCard({ link, now, onOpen }: { link: LibraryLink; now: number; onOpen: () => void }) {
  return (
    <button class="link-card" title={link.url} onClick={onOpen}>
      <div class="link-card-text">
        <div class="link-card-title">{link.title}</div>
        <div class="link-card-domain">{displayDomain(link.url)}</div>
      </div>
      <div class="link-card-meta">{linkMeta(link, now)}</div>
    </button>
  );
}

function LinkCardLoading() {
  return (
    <div class="link-card" aria-busy="true">
      <div class="link-card-text">
        <div class="bar" style={{ width: 220 }} />
        <div class="bar" style={{ width: 120, height: 8 }} />
      </div>
      <div class="bar" style={{ width: 90, height: 8 }} />
    </div>
  );
}
