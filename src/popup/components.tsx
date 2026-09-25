import type { ComponentChildren, Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Check, Clipboard, CornerDownLeft, Image, LogOut, Plus, X } from 'lucide-preact';
import { displayDomain } from '../lib/linkKey';

/** Node-graph "K" on Void: the Android launcher foreground, cropped to its visible 72×72. */
export function AppIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="18 18 72 72" aria-hidden="true">
      <rect x="18" y="18" width="72" height="72" rx="18" fill="#0B0E14" />
      <path
        fill="#7C8CFF"
        d="M33 36a8 8 0 1 0 16 0a8 8 0 1 0 -16 0ZM59 36a8 8 0 1 0 16 0a8 8 0 1 0 -16 0ZM33 72a8 8 0 1 0 16 0a8 8 0 1 0 -16 0ZM59 72a8 8 0 1 0 16 0a8 8 0 1 0 -16 0ZM46 72L46 36A5 5 0 0 0 36 36L36 72A5 5 0 0 0 46 72ZM43.85 58.11L69.85 40.11A5 5 0 0 0 64.15 31.89L38.15 49.89A5 5 0 0 0 43.85 58.11ZM38.15 58.11L64.15 76.11A5 5 0 0 0 69.85 67.89L43.85 49.89A5 5 0 0 0 38.15 58.11Z"
      />
    </svg>
  );
}

/** The official multicolour Google "G". */
export function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export interface Account {
  email: string | null;
  initial: string;
}

export function Header({ account, onSignOut }: { account?: Account; onSignOut?: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <header class="header">
      <div class="wordmark">
        <AppIcon size={28} />
        KORTEX
      </div>
      {account && (
        <div ref={menuRef}>
          <button
            class="avatar"
            aria-label="Account"
            aria-haspopup="menu"
            aria-expanded={open}
            title={account.email ?? undefined}
            onClick={() => setOpen(!open)}
          >
            {account.initial}
          </button>
          {open && (
            <div class="menu" role="menu">
              {account.email && <div class="menu-email">{account.email}</div>}
              <button class="menu-item" role="menuitem" onClick={onSignOut}>
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export function Label({ children }: { children: ComponentChildren }) {
  return <div class="label">{children}</div>;
}

export function LinkField(props: {
  value: string;
  /** Clipboard (paste) while the field holds the tab's address or nothing; x (clear) once edited. */
  trailing: 'paste' | 'clear';
  inputRef: Ref<HTMLInputElement>;
  onInput: (value: string) => void;
  onPaste: () => void;
  onClear: () => void;
}) {
  return (
    <div class="field">
      <Label>Link</Label>
      <div class="input">
        <input
          ref={props.inputRef}
          type="text"
          inputMode="url"
          spellcheck={false}
          autocomplete="off"
          placeholder="Paste a link"
          aria-label="Link"
          value={props.value}
          onInput={(e) => props.onInput(e.currentTarget.value)}
        />
        {props.trailing === 'paste' ? (
          <button class="icon-button" aria-label="Paste link" title="Paste" onClick={props.onPaste}>
            <Clipboard size={16} />
          </button>
        ) : (
          <button class="icon-button" aria-label="Clear link" title="Clear" onClick={props.onClear}>
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function Thumbnail({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div class="thumb">
      {src && !failed ? (
        <img src={src} alt="" referrerpolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <Image size={20} />
      )}
    </div>
  );
}

export function PreviewCard(props: { url: string; title: string; imageUrl: string | null; status?: string }) {
  return (
    <div class={`preview${props.status ? ' flagged' : ''}`}>
      <Thumbnail src={props.imageUrl} />
      <div class="preview-text">
        {props.status && <div class="preview-status">{props.status}</div>}
        <div class="preview-title">{props.title}</div>
        <div class="preview-domain">{displayDomain(props.url)}</div>
      </div>
    </div>
  );
}

export function PreviewLoading() {
  return (
    <div class="preview" aria-busy="true">
      <div class="thumb skeleton" />
      <div class="preview-text">
        <div class="bar" style={{ width: 200 }} />
        <div class="bar" style={{ width: 140 }} />
        <div class="preview-status">Reading page…</div>
      </div>
    </div>
  );
}

export function TagChips(props: {
  tags: string[];
  selected: Set<string>;
  onToggle: (tag: string) => void;
  onAdd: (tag: string) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    props.onEditingChange(editing);
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const closing = useRef(false);

  useEffect(() => {
    if (editing) closing.current = false;
  }, [editing]);

  // Enter/Esc and the blur that follows can both land here; only the first counts.
  const finish = (add: boolean) => {
    if (closing.current) return;
    closing.current = true;
    const value = inputRef.current?.value.trim() ?? '';
    if (add && value) props.onAdd(value);
    setDraft('');
    // Unmounting the field returns focus to the page, so the next Enter saves.
    setEditing(false);
  };

  return (
    <div class="tags-block">
      <Label>Tags</Label>
      <div class="chips">
        {props.tags.map((tag) => {
          const on = props.selected.has(tag.toLowerCase());
          return (
            <button
              key={tag}
              class={`chip${on ? ' selected' : ''}`}
              aria-pressed={on}
              onClick={() => props.onToggle(tag)}
            >
              {on && <Check size={12} />}
              {tag}
            </button>
          );
        })}
        {editing ? (
          <label class="chip editing">
            <input
              ref={inputRef}
              value={draft}
              aria-label="New tag"
              maxLength={60}
              onInput={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  finish(true);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  finish(false);
                }
              }}
              onBlur={() => finish(true)}
            />
          </label>
        ) : (
          <button class="chip new" onClick={() => setEditing(true)}>
            <Plus size={12} />
            New tag
          </button>
        )}
      </div>
    </div>
  );
}

export function PrimaryButton(props: { label: string; busy?: boolean; onClick: () => void }) {
  return (
    <button class="button primary" disabled={props.busy} onClick={props.onClick}>
      {props.label}
      <CornerDownLeft class="enter" size={14} />
    </button>
  );
}

export function TonalButton(props: { label: string; busy?: boolean; onClick: () => void; buttonRef?: Ref<HTMLButtonElement> }) {
  return (
    <button ref={props.buttonRef} class="button tonal" disabled={props.busy} onClick={props.onClick}>
      {props.label}
    </button>
  );
}

export function Footnote({ children }: { children: ComponentChildren }) {
  return <div class="footnote">{children}</div>;
}

export function Notice(props: { icon: ComponentChildren; title: string; children: ComponentChildren }) {
  return (
    <div class="notice" role="status">
      {props.icon}
      <div class="notice-text">
        <div class="notice-title">{props.title}</div>
        <div class="notice-body">{props.children}</div>
      </div>
    </div>
  );
}

export function SuccessBadge() {
  return (
    <div class="success">
      <Check size={24} />
    </div>
  );
}
