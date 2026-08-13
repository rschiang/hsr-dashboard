import { SOURCES, type SourceId } from '../data/sources';

const SOURCE_IDS = Object.keys(SOURCES) as SourceId[];
const PARENT_IDS = SOURCE_IDS.filter((id) => SOURCES[id].partOf === undefined);
/** Locators nested under each parent, in registry order — the order their letters follow. */
const CHILD_IDS: Partial<Record<SourceId, SourceId[]>> = Object.fromEntries(
  PARENT_IDS.map((parentId) => [parentId, SOURCE_IDS.filter((id) => SOURCES[id].partOf === parentId)]),
);

/**
 * A parent carries the footnote number; a locator inside it carries the parent's
 * number plus its own letter, so `15c` reads as the third pinpoint in source 15.
 */
function sourceLabel(sourceId: SourceId): string {
  const parentId = SOURCES[sourceId].partOf;
  if (parentId === undefined) return String(PARENT_IDS.indexOf(sourceId) + 1);
  const childIndex = CHILD_IDS[parentId]!.indexOf(sourceId);
  return `${PARENT_IDS.indexOf(parentId) + 1}${String.fromCharCode(97 + childIndex)}`;
}

export function SourceLink({ sourceId, title, page }: {
  sourceId: SourceId;
  title?: string;
  /** Overrides the registry locator in the tooltip, for a source cited at several pages. */
  page?: string;
}) {
  const source = SOURCES[sourceId];
  const parent = source.partOf === undefined ? undefined : SOURCES[source.partOf];
  const locator = page ?? source.page;
  const date = source.date ?? parent?.date;
  const document = parent === undefined ? source.title : `${parent.title} — ${source.title}`;
  const defaultTitle = `${(parent ?? source).publisher}, ${document}${locator ? `, ${locator}` : ''}${date ? ` (${date})` : ''}`;
  return (
    <a className="fn-ref" href={`#fn-${sourceId}`} title={title ?? defaultTitle}>
      <sup>{sourceLabel(sourceId)}</sup>
    </a>
  );
}

/**
 * Direct link to the exact report a claim comes from. It renders `↗` rather than a
 * footnote number because it points past the registry at one document.
 */
export function ReportLink({ url, title }: { url: string; title?: string }) {
  return (
    <a className="fn-ref" href={url} target="_blank" rel="noreferrer" title={title}>
      <sup>↗</sup>
    </a>
  );
}

function SourceEntry({ id }: { id: SourceId }) {
  const source = SOURCES[id];
  const parent = source.partOf === undefined ? undefined : SOURCES[source.partOf];
  const children = CHILD_IDS[id] ?? [];
  // A locator inherits its parent's publisher and date; it prints only what it adds.
  const meta = [
    parent === undefined ? source.publisher : undefined,
    source.page,
    source.date === parent?.date ? undefined : source.date,
    source.accessed === undefined ? undefined : `accessed ${source.accessed}`,
  ].filter((part) => part !== undefined);
  return (
    <li id={`fn-${id}`}>
      <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
      <span>{meta.join(' · ')}</span>
      {source.note && <span>{source.note}</span>}
      {children.length > 0 && (
        <ol className="source-locators">
          {children.map((childId) => <SourceEntry key={childId} id={childId} />)}
        </ol>
      )}
    </li>
  );
}

export function SourcesList() {
  return (
    <section className="sources-list" aria-labelledby="sources-heading">
      <h2 id="sources-heading">Sources</h2>
      <ol>
        {PARENT_IDS.map((id) => <SourceEntry key={id} id={id} />)}
      </ol>
    </section>
  );
}
