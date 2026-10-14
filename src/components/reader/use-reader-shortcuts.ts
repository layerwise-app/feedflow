import { useEffect, useRef } from 'react';

export type ShortcutHandlers = {
  move: (direction: 1 | -1, open: boolean) => void;
  toggleOpen: () => void;
  close: () => void;
  star: () => void;
  later: () => void;
  share: () => void;
  toggleRead: () => void;
  openOriginal: () => void;
  markAllRead: () => void;
  focusSearch: () => void;
  goTo: (target: 'all' | 'starred' | 'later' | 'notes' | 'discover') => void;
  refresh: () => void;
  addFeed: () => void;
  setLayout: (index: 0 | 1 | 2) => void;
  highlight: () => boolean;
  showHelp: () => void;
};

export const SHORTCUT_GROUPS: Array<{ title: string; items: Array<{ keys: string[]; label: string }> }> = [
  {
    title: 'Navigation',
    items: [
      { keys: ['j'], label: 'Next story' },
      { keys: ['k'], label: 'Previous story' },
      { keys: ['n', 'p'], label: 'Move without opening' },
      { keys: ['o'], label: 'Open or close story' },
      { keys: ['Esc'], label: 'Close story' },
      { keys: ['/'], label: 'Search' }
    ]
  },
  {
    title: 'Story',
    items: [
      { keys: ['s'], label: 'Star' },
      { keys: ['l'], label: 'Read later' },
      { keys: ['m'], label: 'Toggle read' },
      { keys: ['v'], label: 'Open original' },
      { keys: ['h'], label: 'Highlight selection' },
      { keys: ['⇧', 'S'], label: 'Share' }
    ]
  },
  {
    title: 'Jump to',
    items: [
      { keys: ['g', 'a'], label: 'All items' },
      { keys: ['g', 's'], label: 'Starred' },
      { keys: ['g', 'l'], label: 'Read later' },
      { keys: ['g', 'n'], label: 'Notes' },
      { keys: ['g', 'd'], label: 'Discover' }
    ]
  },
  {
    title: 'Library',
    items: [
      { keys: ['⇧', 'A'], label: 'Mark all as read' },
      { keys: ['r'], label: 'Refresh' },
      { keys: ['a'], label: 'Add a feed' },
      { keys: ['1', '2', '3'], label: 'List, cards, magazine' },
      { keys: ['?'], label: 'Shortcuts' }
    ]
  }
];

const SEQUENCE_TIMEOUT_MS = 1_200;
const GO_TARGETS = { a: 'all', s: 'starred', l: 'later', n: 'notes', d: 'discover' } as const;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable
    || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    // Menus, popovers, and dialogs own their keys (type-ahead, Escape).
    || Boolean(target.closest('[role="menu"], [role="listbox"], [role="dialog"], [role="combobox"]'));
}

function isActivatable(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, [role="button"], [role="tab"]'));
}

/** Google Reader-style single-key shortcuts. Disabled while typing or while a dialog is open. */
export function useReaderShortcuts(handlers: ShortcutHandlers, enabled: boolean) {
  // Handlers change every render; the listener reads the latest ones without re-subscribing.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    let pendingGo = 0;

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const actions = handlersRef.current;
      const key = event.key;

      if (pendingGo && Date.now() - pendingGo < SEQUENCE_TIMEOUT_MS) {
        pendingGo = 0;
        const target = GO_TARGETS[key.toLowerCase() as keyof typeof GO_TARGETS];
        if (target) {
          event.preventDefault();
          actions.goTo(target);
          return;
        }
      }
      pendingGo = 0;

      const handled = (() => {
        switch (key) {
          case 'j': actions.move(1, true); return true;
          case 'k': actions.move(-1, true); return true;
          case 'n': actions.move(1, false); return true;
          case 'p': actions.move(-1, false); return true;
          case 'o': actions.toggleOpen(); return true;
          // Enter on a focused control already activates it.
          case 'Enter': if (isActivatable(event.target)) return false; actions.toggleOpen(); return true;
          case 'Escape': actions.close(); return true;
          case 's': actions.star(); return true;
          case 'S': actions.share(); return true;
          case 'l': actions.later(); return true;
          case 'm': actions.toggleRead(); return true;
          case 'v': actions.openOriginal(); return true;
          case 'A': actions.markAllRead(); return true;
          case '/': actions.focusSearch(); return true;
          case 'r': actions.refresh(); return true;
          case 'a': actions.addFeed(); return true;
          case '1': actions.setLayout(0); return true;
          case '2': actions.setLayout(1); return true;
          case '3': actions.setLayout(2); return true;
          case 'h': return actions.highlight();
          case '?': actions.showHelp(); return true;
          case 'g': pendingGo = Date.now(); return true;
          default: return false;
        }
      })();
      if (handled) event.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
