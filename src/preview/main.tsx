/**
 * Design QA gallery (dev only, not part of the extension build): every popup
 * screen with sample data, for side-by-side comparison with the Figma board.
 * Run `npm run preview:ui` and open http://localhost:5173/preview/.
 */
import { render, type ComponentChildren } from 'preact';
import { TriangleAlert } from 'lucide-preact';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/500.css';
import '../styles/tokens.css';
import '../popup/popup.css';
import {
  Footnote,
  Header,
  LinkField,
  Notice,
  PreviewCard,
  PreviewLoading,
  PrimaryButton,
  TagChips,
  TonalButton,
  TopicChips,
  type TopicPick,
} from '../popup/components';
import { Offline, Saved, SignedOut } from '../popup/app';
import type { SavedLink } from '../popup/compose';
import { Home } from '../popup/home';
import type { LibraryLink } from '../lib/library';

const noop = () => {};
const account = { email: 'ada@example.com', initial: 'A' };
const TAGS = ['android', 'design', 'sample', 'ticket', 'to buy'];
const sel = (...t: string[]) => new Set(t);
const compose: SavedLink = {
  url: 'https://developer.android.com/develop/ui/compose/animation/introduction',
  linkUid: 'x',
  title: 'Quick guide to Animations in Compose',
  imageUrl: null,
  tags: ['android'],
  updated: false,
  outcome: 'acked',
};

const NOW = Date.UTC(2026, 8, 25, 12);
const DAY = 86_400_000;
const LIBRARY: LibraryLink[] = [
  { id: 'a', url: compose.url, title: compose.title, tags: ['android'], createdAt: NOW - 3 * DAY },
  {
    id: 'b',
    url: 'https://www.curaahome.com/products/curaa-automatic-pepper-grinder',
    title: 'Curaa Automatic Pepper Grinder — Dual Chamber',
    tags: ['to buy'],
    createdAt: NOW - 7 * DAY,
  },
  {
    id: 'c',
    url: 'https://firebase.google.com/docs/firestore/security/get-started',
    title: 'Introduction to Firestore Security Rules & Best Practices',
    tags: ['database', 'backend'],
    createdAt: NOW - 14 * DAY,
  },
  { id: 'd', url: 'https://fonts.google.com/specimen/Space+Grotesk', title: 'Space Grotesk - Google Fonts', tags: ['design'], createdAt: NOW - 40 * DAY },
];
const homeTab = { id: 1, url: 'https://developer.android.com/develop/ui/compose/animation', title: 'Animations in Compose', linkUid: 'new' };

function Frame({ n, title, children }: { n: string; title: string; children: ComponentChildren }) {
  return (
    <section>
      <h2>
        {n} {title}
      </h2>
      <div class="popup">{children}</div>
    </section>
  );
}

const TOPICS = [
  { uid: 't1', name: 'Android dev', updatedAt: 4 },
  { uid: 't2', name: 'Reading list', updatedAt: 3 },
  { uid: 't3', name: 'Kitchen upgrade', updatedAt: 2 },
  { uid: 't4', name: 'Backend notes', updatedAt: 1 },
];

function Topics({ pick, hint }: { pick: TopicPick; hint?: string }) {
  return <TopicChips topics={TOPICS} pick={pick} onPick={noop} onEditingChange={noop} hint={hint} />;
}

function Tags({ selected, extra }: { selected: Set<string>; extra?: string[] }) {
  return (
    <TagChips tags={[...TAGS, ...(extra ?? [])]} selected={selected} onToggle={noop} onAdd={noop} onEditingChange={noop} />
  );
}

function Gallery() {
  return (
    <div class="gallery">
      <Frame n="01" title="Signed out">
        <Header />
        <SignedOut onSignedIn={noop} />
      </Frame>

      <Frame n="02" title="Save this page">
        <Header account={account} />
        <div class="body">
          <LinkField value={compose.url} trailing="paste" inputRef={{ current: null }} onInput={noop} onPaste={noop} onClear={noop} />
          <PreviewCard url={compose.url} title={compose.title} imageUrl={null} />
          <Tags selected={sel('android')} />
          <Topics pick={{ kind: 'existing', uid: 't1' }} />
          <PrimaryButton label="Save to Links" onClick={noop} />
          <Footnote>Appears in the app after its next sync</Footnote>
        </div>
      </Frame>

      <Frame n="02b" title="Save this page — new topic named">
        <Header account={account} />
        <div class="body">
          <LinkField value={compose.url} trailing="paste" inputRef={{ current: null }} onInput={noop} onPaste={noop} onClear={noop} />
          <PreviewCard url={compose.url} title={compose.title} imageUrl={null} />
          <Tags selected={sel('android')} />
          <Topics pick={{ kind: 'new', name: 'Compose animations' }} />
          <PrimaryButton label="Save to Links" onClick={noop} />
          <Footnote>Appears in the app after its next sync</Footnote>
        </div>
      </Frame>

      <Frame n="03" title="Saved">
        <Header account={account} />
        <Saved saved={{ ...compose, topic: TOPICS[0] }} onAnother={noop} />
      </Frame>

      <Frame n="04" title="Paste any link — reading page">
        <Header account={account} />
        <div class="body">
          <LinkField
            value="https://fonts.google.com/specimen/Space+Grotesk"
            trailing="clear"
            inputRef={{ current: null }}
            onInput={noop}
            onPaste={noop}
            onClear={noop}
          />
          <PreviewLoading />
          <Tags selected={sel()} />
          <PrimaryButton label="Save to Links" onClick={noop} />
          <Footnote>Save works before the page is read</Footnote>
        </div>
      </Frame>

      <Frame n="05" title="Ready">
        <Header account={account} />
        <div class="body">
          <LinkField
            value="https://fonts.google.com/specimen/Space+Grotesk"
            trailing="clear"
            inputRef={{ current: null }}
            onInput={noop}
            onPaste={noop}
            onClear={noop}
          />
          <PreviewCard url="https://fonts.google.com/specimen/Space+Grotesk" title="Space Grotesk - Google Fonts" imageUrl={null} />
          <Tags selected={sel('design', 'typeface')} extra={['typeface']} />
          <PrimaryButton label="Save to Links" onClick={noop} />
          <Footnote>Appears in the app after its next sync</Footnote>
        </div>
      </Frame>

      <Frame n="06" title="Already in Links">
        <Header account={account} />
        <div class="body">
          <LinkField
            value="https://www.curaahome.com/products/curaa-automatic-pepper-grinder"
            trailing="clear"
            inputRef={{ current: null }}
            onInput={noop}
            onPaste={noop}
            onClear={noop}
          />
          <PreviewCard
            url="https://www.curaahome.com/products/curaa-automatic-pepper-grinder"
            title="Auto pepper grinder"
            imageUrl={null}
            status="Already in Links · Saved 3D ago"
          />
          <Tags selected={sel('to buy')} />
          <Topics pick={{ kind: 'none' }} hint="Already in Kitchen upgrade." />
          <TonalButton label="Update tags" onClick={noop} />
          <Footnote>Same page, same link — never saved twice</Footnote>
        </div>
      </Frame>

      <Frame n="07" title="Can’t be saved">
        <Header account={account} />
        <div class="body">
          <Notice icon={<TriangleAlert size={18} />} title="This page can’t be saved">
            Browser pages like chrome://extensions aren’t web links. Paste one instead.
          </Notice>
          <LinkField value="" trailing="paste" inputRef={{ current: null }} onInput={noop} onPaste={noop} onClear={noop} />
        </div>
      </Frame>

      <Frame n="08" title="Saved while offline">
        <Header account={account} />
        <Offline saved={{ ...compose, outcome: 'queued' }} onAnother={noop} />
      </Frame>

      <Frame n="09" title="Saved links">
        <Header account={account} />
        <Home tab={homeTab} links={LIBRARY} now={NOW} onSaveTab={noop} onSaveUrl={noop} onOpen={noop} />
      </Frame>

      <Frame n="09" title="Saved links — tab already saved">
        <Header account={account} />
        <Home tab={{ ...homeTab, linkUid: 'a' }} links={LIBRARY} now={NOW} onSaveTab={noop} onSaveUrl={noop} onOpen={noop} />
      </Frame>

      <Frame n="09" title="Saved links — loading">
        <Header account={account} />
        <Home tab={homeTab} links={null} now={NOW} onSaveTab={noop} onSaveUrl={noop} onOpen={noop} />
      </Frame>
    </div>
  );
}

render(<Gallery />, document.getElementById('app')!);
