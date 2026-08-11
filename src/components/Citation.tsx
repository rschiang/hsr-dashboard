import { SOURCES, type SourceId } from '../data/sources';

const SOURCE_IDS = Object.keys(SOURCES) as SourceId[];

function sourceNumber(sourceId: SourceId): number {
  return SOURCE_IDS.indexOf(sourceId) + 1;
}

export function SourceLink({ sourceId, title }: { sourceId: SourceId; title?: string }) {
  const source = SOURCES[sourceId];
  return (
    <a
      className="fn-ref"
      href={`#fn-${sourceId}`}
      title={title ?? `${source.publisher}, ${source.title} (${source.date})`}
    >
      <sup>{sourceNumber(sourceId)}</sup>
    </a>
  );
}

export function SourcesList() {
  return (
    <section className="sources-list" aria-labelledby="sources-heading">
      <h2 id="sources-heading">Sources</h2>
      <ol>
        {SOURCE_IDS.map((id) => {
          const source = SOURCES[id];
          return (
            <li key={id} id={`fn-${id}`}>
              <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
              <span>{source.publisher} · {source.date}{'accessed' in source ? ` · accessed ${source.accessed}` : ''}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
