import { buildOpml } from '~/lib/reader-model';
import type { ReaderState } from '~/lib/reader-state-utils';

export type OpmlCandidate = { url: string; name: string; folder?: string };

const MAX_OPML_BYTES = 1_000_000;
export const MAX_OPML_FEEDS = 50;

function attribute(element: Element, names: string[]) {
  return [...element.attributes].find((candidate) => names.includes(candidate.name.toLowerCase()))?.value?.trim() ?? '';
}

/** Reads subscriptions from an uploaded OPML file. Nested outlines become folders. */
export async function readOpmlFile(file: File): Promise<OpmlCandidate[]> {
  if (file.size > MAX_OPML_BYTES) throw new Error('OPML files must be smaller than 1 MB.');
  const xml = new DOMParser().parseFromString(await file.text(), 'application/xml');
  if (xml.querySelector('parsererror') || xml.documentElement.tagName.toLowerCase() !== 'opml') {
    throw new Error('That file is not a valid OPML document.');
  }
  const candidates = [...xml.querySelectorAll('outline')].flatMap((outline) => {
    const url = attribute(outline, ['xmlurl']);
    if (!url) return [];
    const parent = outline.parentElement?.closest('outline');
    const folder = parent ? attribute(parent, ['title', 'text']) : '';
    return [{ url, name: attribute(outline, ['title', 'text']) || url, ...(folder ? { folder } : {}) }];
  });
  if (!candidates.length) throw new Error('No feed URLs were found in that file.');
  if (candidates.length > MAX_OPML_FEEDS) throw new Error(`Import up to ${MAX_OPML_FEEDS} feeds at a time.`);
  return candidates;
}

export function downloadOpml(state: Pick<ReaderState, 'feeds' | 'folders' | 'feedFolders'>) {
  const href = URL.createObjectURL(new Blob([buildOpml(state)], { type: 'text/x-opml' }));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'feedflow-subscriptions.opml';
  anchor.click();
  URL.revokeObjectURL(href);
}
