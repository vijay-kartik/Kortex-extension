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
} from '../popup/components';
import { Offline, Saved, SignedOut } from '../popup/app';
import type { SavedLink } from '../popup/compose';

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
          <PrimaryButton label="Save to Links" onClick={noop} />
          <Footnote>Appears in the app after its next sync</Footnote>
        </div>
      </Frame>

      <Frame n="03" title="Saved">
        <Header account={account} />
        <Saved saved={compose} onAnother={noop} />
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
    </div>
  );
}

render(<Gallery />, document.getElementById('app')!);
