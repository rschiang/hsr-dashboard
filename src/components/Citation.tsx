import { SOURCES, type SourceId } from '../data/sources';

export function SourceLink({ sourceId, label = 'source', title }: { sourceId: SourceId; label?: string; title?: string }) {
  const source = SOURCES[sourceId];
  return (
    <sup className="source-link">
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        title={title ?? `${source.publisher}, ${source.title} (${source.date})`}
      >
        {label}
      </a>
    </sup>
  );
}

export function SourcesList() {
  return (
    <section className="sources-list" aria-labelledby="sources-heading">
      <h2 id="sources-heading">Sources</h2>
      <ol>
        {Object.entries(SOURCES).map(([id, source]) => (
          <li key={id}>
            <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
            <span>{source.publisher} · {source.date}{'accessed' in source ? ` · accessed ${source.accessed}` : ''}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
