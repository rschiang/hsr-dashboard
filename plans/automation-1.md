# CI data automation — ArcGIS refresh + CVSR publication check

## Context

`.github/workflows/update-data.yml` (monthly cron `17 14 5 * *`, commits only `public/data`) has never
executed — the repo is four days old and the cron falls on the 5th. It is also inert by construction: it
pushes with `GITHUB_TOKEN`, which cannot trigger `deploy.yml`'s `push` event, so nothing it commits would
ever reach the site.

Replace it with **two cron workflows** — a BuildHSR ArcGIS refresh and a CVSR publication check — plus one
edit making `deploy.yml` callable. Both workflows *discover and accumulate*: they add new observations to
tracked artifacts and never rebuild the historical corpus. Both are noise-averse: a transient upstream
outage or a blocked page ends the run quietly at exit 0, while a condition that persists for months, or a
report that downloads but will not parse, fails loudly.

The CVSR side needs **no PDF corpus in CI**. Today `npm run parse:cvsr` rebuilds
`data/raw/cvsr/parsed-snapshots.json` from the whole local PDF corpus (`scripts/fetch-cvsr.ts:637-687`),
which in a CI checkout holding one downloaded PDF would replace 87 snapshots with 1. Step 4 adds an
incremental mode that merges a single new report into the tracked artifact instead, so the ~29 of 30 runs
that find nothing cost two JSON requests.

## Approach

Steps 1, 2, 6 are independent of each other and of 3–5. Step 3 must land before 4. Step 7 depends on 1+2;
step 8 depends on 1+3+4+5. The tree builds and `npm test` passes after every step.

### Step 1 — make `deploy.yml` callable (independent)

In `.github/workflows/deploy.yml`, add `workflow_call:` to the `on:` block (keeping `push` and
`workflow_dispatch`), and change `cancel-in-progress: true` to `false` on the existing
`concurrency: group: pages` (line 15) so a data deploy is never cancelled mid-flight.

Both new workflows invoke it as `uses: ./.github/workflows/deploy.yml` inside their own run. This is the
whole reason no PAT or GitHub App is needed: reusable-workflow calls do not depend on an event, so the
`GITHUB_TOKEN` restriction ("events triggered by the `GITHUB_TOKEN` will not create a new workflow run")
never applies. A caller job that `uses:` a local workflow must declare `pages: write` and `id-token: write`
itself; those are listed per workflow in steps 7 and 8.

### Step 2 — make a stale ArcGIS poll self-evident (independent)

`scripts/fetch-arcgis.ts:57-80` catches a failed fetch, reuses the committed cache, warns, and exits 0.
The metadata write at `:83-86` sits **outside** that try, so the stale payload receives a fresh
`fetchedAt`, which flows to `segments.json:generatedAt` (`build-segments.ts:607`) and reaches users as
"Last updated" (`src/App.tsx:152-154`). Fix it so a poll that observed nothing cannot claim freshness:

- Change `fetchTarget` to return `boolean` (`true` = fetched from network, `false` = served from cache);
  collect the results in the loop at `:82`.
- Extend the metadata payload at `:83-86` to `sources: [{ name, url, stale }]`, where `stale` is `true`
  for any target that fell back to cache.
- When **any** target is stale, reuse the previous `fetchedAt` from the existing
  `data/raw/arcgis/fetch-metadata.json` instead of `new Date().toISOString()`; if that file is absent or
  unparseable, stamp the current time. Keep exit code 0.

Consequence relied on by step 7: an all-stale run leaves all four raw payloads *and* the metadata
byte-identical, so the change gate short-circuits and the run is a clean no-op. The existing hard throw at
`:77` (fetch failed and no valid cache) is unchanged and still fails the run.

Do **not** add an env-var strict mode; the `stale` flag plus the gate covers CI and local runs with one rule.

### Step 3 — extract three helpers in `scripts/fetch-cvsr.ts` (prerequisite for step 4)

No behavior change; `npm run parse:cvsr` output must stay byte-identical. Each helper is currently inline
logic that step 4 needs to reuse rather than duplicate.

1. `async function loadGuidewayLabels(): Promise<Map<string, string>>` — move the body of
   `parseLocalPdfs:627-636` (reads `data/raw/arcgis/progress.json`, maps trimmed `Limits` →
   `${Section}:${OBJECTID}` for `StructureType === 'guideway'`, throws on a duplicate label). Call it from
   `parseLocalPdfs`.
2. `function preferSnapshot(existing: Snapshot, candidate: Snapshot, candidateFile: string): { winner: Snapshot; loser: Snapshot; identical: boolean }`
   — move the precedence logic from `parseLocalPdfs:650-671`: score each side as
   `(file.toLowerCase().includes('draft') ? -10 : 0) + (file.toLowerCase().includes('final') ? 2 : 0)`,
   compare `JSON.stringify({ perPackage, program })` for `identical`, and let the candidate win only when
   `!identical && candidateScore > existingScore`. Use it in `parseLocalPdfs` to build the same
   `rejectedReports` entries and warning it emits today.
3. `function knownReportFiles(snapshots: readonly Snapshot[], reportUrls: ReportUrlRegistry): Set<string>`
   — union of every `snapshot.reportFile`, every key of `reportUrls`, and every `file` in
   `REVIEWED_CVSR_REPORTS`. Verified against the current tree: that union is exactly 107 filenames and
   equals the 107 local PDFs with no member missing on either side, so it is a faithful stand-in for a
   `readdir` of the corpus.

### Step 4 — add incremental CVSR ingest: `--ingest` in `scripts/fetch-cvsr.ts`

New mode dispatched alongside the existing `--parse` / `--resolve-urls` branches at `:883-887`. Add to
`package.json`: `"ingest:cvsr": "tsx scripts/fetch-cvsr.ts --ingest"`. Leave `fetch:cvsr` and `parse:cvsr`
untouched.

Constants (module scope, beside `PREFIX_BYTES` at `:43`):

```ts
const DISCOVERY_WINDOW_DAYS = 180;
// MIN_PDF_BYTES is defined and exported by scripts/lib/cvsr-download.ts (below) — import it, do not redeclare.
const EXPECTED_LAG_MONTHS = 4;
const MEDIA_API = 'https://hsr.ca.gov/wp-json/wp/v2/media';
const MEDIA_SEARCH_TERMS = ['CVSR', 'Central Valley Status Report'] as const;
const VARIANT_REPORT = /Executive[_ -]Summary|PRESENTATION|PPT|with[_ -]Flash|Remediation/i;
```

**Flags.** `--ingest` runs discovery + download + merge. `--ingest --file <name>` skips discovery and
download and merges the already-local `data/raw/cvsr/<name>`; it throws if that name has neither a
`report-urls.json` entry nor a `REVIEWED_CVSR_REPORTS` entry, because the snapshot would otherwise carry
no citation — the maintainer runs `npm run resolve:cvsr-urls` first. `HSR_CVSR_SKIP` (env,
comma-separated, entries trimmed, empties ignored) removes names from the candidate set before anything
is downloaded; step 8 populates it from closed GitHub issues.

**Machine-readable output.** Step 8 parses stdout, so these lines are a contract — emit them exactly,
one per line, with no surrounding decoration:

- `cvsr-ingested: <dataMonth> <filename>` — once per merged report.
- `cvsr-overdue: <YYYY-MM>` — once per overdue month.
- `cvsr: discovery unavailable` — when both discovery channels fail.

**Discovery.** For each term in `MEDIA_SEARCH_TERMS`, GET
`${MEDIA_API}?search=<urlencoded term>&per_page=100&after=<ISO>&orderby=date&order=desc&_fields=date,source_url`
where `<ISO>` is now minus `DISCOVERY_WINDOW_DAYS`, spacing requests by the existing
`REQUEST_INTERVAL_MS` (`:45`) and sending the existing `USER_AGENT` (`:44`). Both terms are required:
`search=CVSR` matches titles and misses `FA-Central-Valley-Status-Report-July-2026-A11Y.pdf`, which only
the second term returns. Union the results by filename (`basename(source_url)`), keeping `date` as
`publishedAt`.

If neither term yields parseable JSON, fall back to one GET of `CURRENT_INDEX` (`:40`) and scrape
`href="…​.pdf"`. If that is also unusable — non-200, not HTML, or zero PDF hrefs — print
`cvsr: discovery unavailable` and **exit 0** after running the overdue report (below). The committee page
carries intermittent bot protection; a blocked read is weather. Never retry, rotate headers, or otherwise
work around it (README:161, `plans/amendment-1.md:21-22`).

**Candidate selection.** Keep entries whose filename matches `CVSR_CANDIDATE` (`:41`), drop
`VARIANT_REPORT` matches, drop anything in `knownReportFiles(...)` or `HSR_CVSR_SKIP`. The window is the
primary filter and the variant regex is secondary: unbounded, the union surfaces 8 files absent from the
corpus, all 2023–2025-01 re-postings and decks, of which the regex catches only 5 — the 180-day window
excludes all 8. Verified against today's tree, the full rule yields 6 in-window PDFs → 4 already known,
2 variants, **0 new**, matching reality (corpus complete through the July 2026 report).

Nothing new ⇒ run the overdue report and exit 0.

**Download.** Put the response contract in a new `scripts/lib/cvsr-download.ts` so it is unit-testable
without importing the script (importing `fetch-cvsr.ts` would execute its top-level dispatch at
`:883-887`):

```ts
export const MIN_PDF_BYTES = 100_000;
export function assertPdfResponse(
  file: string, url: string, status: number, contentType: string, body: Uint8Array,
): void;
```

It throws unless `status === 200`, `contentType` starts with `application/pdf`, `body` begins with the
bytes `%PDF-`, and `body.byteLength >= MIN_PDF_BYTES`; every message names `file`, `url`, `status` and
`contentType`. Add `scripts/lib/cvsr-download.test.ts` to the `test` script's file list in
`package.json`.

`--ingest` then, per candidate, oldest `publishedAt` first and spaced by `REQUEST_INTERVAL_MS`, GETs the
URL with `USER_AGENT`, calls `assertPdfResponse`, and lets the throw fail the run — a page served where a
PDF was promised is a challenge or a dead link and needs a human. On success write
`data/raw/cvsr/<filename>` (gitignored, so it stays on the runner) and add a registry entry to
`report-urls.json`:

```ts
{ url, bytes, prefixSha256, publishedAt, verifiedAt }
```

`bytes` is the full length; `prefixSha256` is SHA-256 over the first `PREFIX_BYTES` — the same fields
`resolveReportUrls` writes (`:48-53`), computed from a whole download rather than a range probe.
`publishedAt` is the API `date`, recorded as provenance only; the window stays a fixed 180 days so no
bookkeeping can drift. Verified: this URL returns `application/pdf`, 1 577 322 bytes, byte-identical
SHA-256 to the reviewed local copy, matching the `bytes` already in `report-urls.json`.

**Parse and merge.** Call the existing `parsePdf(path, reportUrls, guidewayByLabel)` (`:419`) — it already
handles files absent from `REVIEWED_CVSR_REPORTS`, taking the citation from `reportUrls[reportFile].url`
(`:435`) and the data month from PDF text (`:433`). A throw propagates and fails the run. Then:

- Load `parsed-snapshots.json` as `{ snapshots, cvsrInventory, diagnostics }`.
- If a snapshot with the same `date` exists, resolve with `preferSnapshot`; a losing candidate is appended
  to `rejectedReports` and does not replace the incumbent. Otherwise append. Sort by `date` ascending.
- Compute field failures for the new snapshot only, with the rule at `:689-699`: for each of
  `CVSR_PACKAGES`, `parcelsTotal === undefined && !parcelOmission(dataMonth, cp)` ⇒
  `{ month, cp, metric: 'parcels' }`; `dataMonth >= '2020-08' && utilitiesTotal === undefined` ⇒
  `{ month, cp, metric: 'utilities' }`. Union with `diagnostics.fieldFailures`.
- Rebuild the inventory with `buildCvsrInventory` using: merged `snapshots`;
  `localFiles: knownReportFiles(mergedSnapshots, mergedRegistry)`; `reviewedReports: REVIEWED_CVSR_REPORTS`;
  `rejectedReports: [...cvsrInventory.rejectedReports, ...newRejections]`;
  `parseFailures: diagnostics.parseFailures`; the merged `fieldFailures`; `revisions: REVIEWED_REVISIONS`;
  `coverageStart: '2019-03'`; `coverageEnd` = max `dataMonth` across merged snapshots;
  `unresolvedReportUrls: cvsrInventory.unresolvedReportUrls`; `reportUrls: mergedRegistry`.
  Carrying these forward is what makes the merge faithful: `localFiles` is read only at
  `cvsr-inventory.ts:135,145` to classify months that have no snapshot, and today all 87 expected months
  have one, so it currently cannot alter output. `transcriptions` and `derivations` are recomputed from the
  merged snapshots by the builder and must not be carried. An ingested report whose data month skips one
  needs no special handling: the builder emits a `report_not_located` gap for the skipped month.
- Write `parsed-snapshots.json` with exactly the shape and formatting of `:723` —
  `JSON.stringify({ snapshots, cvsrInventory, diagnostics: { parseFailures, fieldFailures } }, null, 2)`
  plus a trailing newline — then throw if `fieldFailures.length > 0`, mirroring `:727-731` so diagnostics
  are on disk before the failure.

**Overdue report.** Always runs, including on blocked discovery, and never fails on its own. Let
`maxDataMonth` be the largest merged `dataMonth` and `expectedLatest` be the current UTC month minus
`EXPECTED_LAG_MONTHS`. Print one line per month in `(maxDataMonth, expectedLatest]`:
`cvsr-overdue: YYYY-MM`. Four months is the threshold because the observed data-to-publication lag is
~2 months (2026-05 data published 2026-07-23), leaving over a month of slack before anything is called
late. Data months are monthly and complete — 87 expected, 87 available, zero snapshot gaps — so a missing
month is genuinely unusual. Step 8 turns these lines into issues.

### Step 5 — derive `coverageEnd` in `parseLocalPdfs` (independent)

`scripts/fetch-cvsr.ts:717` passes the literal `coverageEnd: '2026-05'`, which equals today's max parsed
`dataMonth`. Replace it with the max `dataMonth` across `snapshots`, matching what `--ingest` computes, so
neither mode needs a source edit per report. `coverageStart: '2019-03'` (`:716`) stays literal. Output is
unchanged for the current corpus, so `npm run parse:cvsr` must still reproduce the committed artifact.

### Step 6 — validate before publishing in `scripts/build-segments.ts` (independent)

The artifact writes at `:615` and `:631` happen *before* the large-hole check at `:633-635` and the
input-geometry check at `:651-659`, so a run that ultimately throws has already overwritten
`public/data/segments.json` and `segments.geojson`. Move both checks above the first write, leaving the
console summaries where they are. A failing run must leave the previous published artifacts intact.

### Step 7 — `.github/workflows/refresh-arcgis.yml` (replaces `update-data.yml`)

Delete `.github/workflows/update-data.yml`. New workflow, `name: Refresh BuildHSR ArcGIS data`:

```yaml
on:
  schedule:
    - cron: '40 9 * * 2'
      timezone: "America/Los_Angeles"
  workflow_dispatch:
permissions:
  contents: write
  issues: write
  pages: write
  id-token: write
concurrency:
  group: data-refresh
  cancel-in-progress: false
```

Tuesday 09:40 PT: the layers are staff-edited in Pacific business hours, and weekly is the useful ceiling
because `build-history.ts:62` stores exactly one tier-2 poll rebuilt from scratch each run — a denser
cadence adds no rows, only freshness. Mid-hour and timezone-pinned because GitHub warns `schedule` "can be
delayed during periods of high loads… High load times include the start of every hour", and an IANA
`timezone` keeps the intent across DST.

`refresh` job, `outputs.changed`:

1. `actions/checkout@v5` (shallow), `actions/setup-node@v5` with `node-version: 24`, `cache: npm`, `npm ci`.
2. `npx tsx scripts/fetch-arcgis.ts`.
3. Stale check, reading `data/raw/arcgis/fetch-metadata.json`: if any `sources[].stale` is `true`, append
   a note to `$GITHUB_STEP_SUMMARY`, then compare that file's `fetchedAt` — which a stale run leaves at
   the committed value, per step 2 — against now using `STALE_FAIL_AFTER_DAYS=60`. Older ⇒ exit 1, because
   four unreachable layers for two months is structural, not weather. Otherwise `git restore .`, set
   `changed=false`, and end the job successfully.
4. Change gate: `git diff --quiet -- data/raw/arcgis/alignment.json data/raw/arcgis/progress.json
   data/raw/arcgis/structures.json data/raw/arcgis/stations.json`. Quiet ⇒ `git restore .`,
   `changed=false`, stop. Gating on the four raw payloads rather than `public/data` is essential: they
   carry no wall-clock field, whereas `fetchedAt` propagates into `segments.json:generatedAt` and
   `history.json:generatedAt`/`polledAt`, so a `public/data` diff is never empty — a verified live re-fetch
   against unchanged upstream produced a 3-file, 3-line diff of pure timestamps.
5. Changed ⇒ `npx tsx scripts/build-centerline.ts && npx tsx scripts/build-segments.ts && npx tsx
   scripts/build-history.ts`, then `npm run lint`, `npm test`, `npm run build`.
6. Commit `data/raw/arcgis` **and** `public/data` together — the raw layers are tracked precisely so the
   committed snapshot stays reproducible (README:111) — as
   `github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>`, message
   `data: refresh BuildHSR ArcGIS snapshot`. `git pull --rebase` before `git push`. Set `changed=true`.

`deploy` job: `needs: refresh`, `if: needs.refresh.outputs.changed == 'true'`,
`uses: ./.github/workflows/deploy.yml`.

Failure notice — a **final step of the `refresh` job** guarded by `if: failure()`, not a separate job, so
it inherits the checkout and `gh` resolves the repository from the git remote with no `GH_REPO` override.
With `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`, run `gh issue list --state open --limit 200 --json
number,title` and select the exact title `CI: ArcGIS refresh failing` with `jq`. Comment the run URL on the
match if one exists, else `gh issue create` with that title and no labels — a missing label would make the
call fail. `GITHUB_TOKEN`-authored issues trigger no workflows, so there is no recursion risk.

### Step 8 — `.github/workflows/ingest-cvsr.yml` (new)

`name: Check CVSR publication`:

```yaml
on:
  schedule:
    - cron: '10 9 * * 1-5'
      timezone: "America/Los_Angeles"
  workflow_dispatch:
permissions:
  contents: write
  issues: write
  pages: write
  id-token: write
concurrency:
  group: data-refresh
  cancel-in-progress: false
```

Weekdays 09:10 PT: two ~20 KB JSON requests, so daily is cheaper than the weekly ArcGIS job, and daily
retries are what convert an intermittently blocked source into reliable detection. Committee meetings bound
the *expected* drops but interim reports appear unannounced, so no calendar is encoded anywhere — a fixed
schedule would miss exactly the unpredictable case and would rot when the Authority changes it. The
`data-refresh` concurrency group is shared with step 7 so the two never race the same push. All four recent
uploads landed on weekdays (2026-07-23 Thu, 06-17 Wed, 05-26 Tue, 04-21 Tue).

`ingest` job, `outputs.changed`:

1. Checkout, Node 24, `npm ci`.
2. Build the skip list: `gh issue list --state closed --limit 200 --json title`, `jq` out titles matching
   `^CI: CVSR ingest failing for (.+)$`, and export the captured filenames as comma-separated
   `HSR_CVSR_SKIP`. A closed issue is the maintainer's acknowledgement that a report is deliberately not
   ingested, so the run must stop rediscovering and re-failing on it.
3. `set -o pipefail`, then `npm run ingest:cvsr 2>&1 | tee /tmp/ingest.log`. Without `pipefail` the `tee`
   exit code masks a script failure. Non-zero exit ⇒ the `notify` job handles it.
4. If `git diff --quiet -- data/raw/cvsr/parsed-snapshots.json data/raw/cvsr/report-urls.json` is quiet,
   set `changed=false` and skip to step 8. `MANIFEST.md` is deliberately **not** regenerated or committed
   here: `writeManifest` derives each report's `downloaded`/`missing` state from a `readdir` of the local
   directory (`:132,143`), so in CI it would relabel all 12 reviewed reports as `missing`. It stays a
   maintainer action run beside the local corpus.
5. `npm run fetch` (rebuilds `public/data` from the tracked raw ArcGIS layers and the merged snapshots —
   no PDFs needed), then `npm run lint`, `npm test`, `npm run build`.
6. Commit `data/raw/cvsr/parsed-snapshots.json`, `data/raw/cvsr/report-urls.json`, `public/data` and
   `data/raw/arcgis` with message `data: ingest CVSR report for <dataMonth>`, taking `<dataMonth>` from
   the `cvsr-ingested:` line(s) in `/tmp/ingest.log` and joining multiples with `, `. Same bot identity as
   step 7; `git pull --rebase` then push. Set `changed=true`.
7. `actions/upload-artifact@v4` with `data/raw/cvsr/*.pdf`, name `cvsr-report`, `retention-days: 90`. The
   PDF cannot be committed — `data/raw/cvsr/.gitignore` is `*.pdf` and the corpus is 107 files at
   1.5–3 MB — so the artifact plus the registry's `url` + `bytes` + `prefixSha256` is the retention and
   provenance path, and the maintainer archives the file into their local corpus.
8. Overdue issues: for each `cvsr-overdue: YYYY-MM` line in `/tmp/ingest.log`, run
   `gh issue list --state all --limit 200 --json number,state,title` and look for the exact title
   `CVSR data month YYYY-MM not published`. Create it only when no issue with that title exists in **any**
   state — a closed one means the maintainer verified the month is genuinely absent, so the run stays
   silent. Use list + `jq` on exact titles rather than `--search`, whose index lags. Body: the month, the
   newest ingested data month, and a link to `CURRENT_INDEX`.
9. Escalation: if six or more `cvsr-overdue:` months are reported **and** at least one of their issues is
   currently `open`, echo `cvsr: overdue escalation` to `/tmp/ingest.log` and exit 1. Six months of
   unexplained absence that nobody has acknowledged is structural. The run then stays red every weekday
   until either a report lands or the maintainer closes those issues to ratify the absence — that
   persistence is the intended signal, not a defect to suppress. The failure notice below must find that
   marker and create nothing, because the per-month issues from step 8 are already the report; a generic
   "ingest failing" issue on top of them would be the duplicate noise this design exists to avoid.

`deploy` job: `needs: ingest`, `if: needs.ingest.outputs.changed == 'true'`,
`uses: ./.github/workflows/deploy.yml`.

Failure notice — again a **final step of the `ingest` job** guarded by `if: failure()`, so it can read
`/tmp/ingest.log` (which captured stderr via `2>&1`) and `gh` needs no `GH_REPO`. Title
`CI: CVSR ingest failing for <filename>` when the log names a candidate file, otherwise
`CI: CVSR ingest failing`. List `--state all` and skip entirely when a match exists in any state — a closed
one is the maintainer's decision to skip that report, and step 2 already keeps it out of future candidate
sets. Comment the run URL on an existing open match. Body must carry the failing filename, its URL, the
script's error text, and the manual runbook from README:118-121.

## Critical files & anchors

- `scripts/fetch-cvsr.ts` — `parseLocalPdfs` (`:624-732`) is the logic `--ingest` mirrors without a corpus;
  `parsePdf` (`:419`) is reused verbatim; dispatch at `:883-887`.
- `scripts/lib/cvsr-inventory.ts` — `buildCvsrInventory` (`:109-290`); `localFiles` is consulted only at
  `:135,145`, which is why a reconstructed corpus set is sufficient.
- `scripts/fetch-arcgis.ts` — `fetchTarget` (`:57-80`) and the metadata write at `:83-86`, which is outside
  the cache-fallback `try`.
- `data/raw/cvsr/parsed-snapshots.json` — the artifact being accumulated: 87 snapshots, coverage
  `2019-03 → 2026-05`, `rejectedReports: 20`, `unresolvedReportUrls: 3`, `diagnostics.parseFailures` and
  `.fieldFailures` both empty.
- `.github/workflows/deploy.yml` — `on:` block and the `pages` concurrency group at `:13-15`.

## Verification

Run from the repo root with the full local PDF corpus present (107 files in `data/raw/cvsr/`).

**Steps 3 + 5 preserve the artifact.** `npm run parse:cvsr && git diff --stat -- data/raw/cvsr/parsed-snapshots.json`
must report no change.

**Step 4 merge is faithful — the load-bearing check.** Rebuild the prior state with the real parser, then
re-add the newest report incrementally and require byte equality:

```bash
mkdir -p /tmp/cvsr-holdout
cp data/raw/cvsr/parsed-snapshots.json /tmp/cvsr-holdout/expected.json
mv data/raw/cvsr/FA-Central-Valley-Status-Report-July-2026-A11Y.pdf /tmp/cvsr-holdout/
npm run parse:cvsr      # 86 snapshots, coverageEnd 2026-04
mv /tmp/cvsr-holdout/FA-Central-Valley-Status-Report-July-2026-A11Y.pdf data/raw/cvsr/
npm run ingest:cvsr -- --file FA-Central-Valley-Status-Report-July-2026-A11Y.pdf
cmp data/raw/cvsr/parsed-snapshots.json /tmp/cvsr-holdout/expected.json && echo MERGE-FAITHFUL
git restore data/raw/cvsr/parsed-snapshots.json
```

`cmp` must be silent. This exercises append, `coverageEnd` derivation, field checks, and every carried
inventory input at once. That file is not among the 3 `unresolvedReportUrls` and already has a
`report-urls.json` entry, so the registry is unaffected and the comparison is apples-to-apples.

**Step 4 discovery against live upstream.** `npm run ingest:cvsr` must print no candidate and exit 0,
because the corpus is complete through the July 2026 report; expect `0 new` and no `cvsr-overdue:` line
(newest data month 2026-05, current month 2026-08, threshold 4). Confirm `git status --porcelain` is empty.

**Step 4 rejects a bad download.** `npm test` must include `scripts/lib/cvsr-download.test.ts` covering
`assertPdfResponse`: a 200 `text/html` response throws; a 200 `application/pdf` body not starting `%PDF-`
throws; a 200 `application/pdf` body of 1 000 bytes throws on `MIN_PDF_BYTES`; and a 200
`application/pdf` body starting `%PDF-` at or above `MIN_PDF_BYTES` returns without throwing. Each
failing message must contain the filename and the URL.

**Step 2 stale honesty.** With networking blocked (e.g. `HTTPS_PROXY=http://127.0.0.1:1` npx tsx
scripts/fetch-arcgis.ts), the run must exit 0, mark every source `stale: true`, and leave `fetchedAt`
unchanged from the committed value — so `git diff --quiet -- data/raw/arcgis` succeeds. Then restore
networking and confirm a normal run flips `stale` to `false`.

**Step 6 ordering.** Temporarily tighten the large-hole threshold so the check fails, run
`npx tsx scripts/build-segments.ts`, and confirm it exits non-zero while
`git diff --quiet -- public/data/segments.json public/data/segments.geojson` still succeeds. Revert.

**Full gate.** `npm run lint && npm test && npm run build` — currently 0, 61/61, 0.

**Workflows.** After merge, `workflow_dispatch` each. `Refresh BuildHSR ArcGIS data` must end with
`changed=false`, no commit, and no `deploy` job. `Check CVSR publication` must end with `changed=false`, no
commit, no issue created, and no `deploy` job. Then confirm `deploy.yml` still runs on a normal push to
`main`, and that a manual `workflow_dispatch` of it succeeds (proving `workflow_call` did not break the
existing triggers).

## Assumptions & contingencies

- **If the holdout `cmp` differs**, the diff names the inventory field that was not carried forward. Fix by
  taking that field from the persisted `cvsrInventory` exactly as `rejectedReports` and
  `unresolvedReportUrls` already are — do not "fix" it by making `--ingest` re-`readdir` the corpus, which
  would reintroduce the CI dependency this plan removes.
- **If `PINNED_PARCELS` (`:271-290`) throws on a future report** because the published program parcel total
  moved, that is the intended fail-fast: the run fails, the `notify` job opens an issue, and the maintainer
  reviews the pin. Do not relax the check.
- **If the WP REST media API stops returning JSON permanently**, the HTML fallback keeps discovery alive and
  the overdue escalation in step 8.9 surfaces the breakage within six months. Do not add retry loops or
  alternative user agents.
- **`EXPECTED_LAG_MONTHS = 4` and the six-month escalation are tuned to a ~2-month observed lag.** If the
  Authority moves to a slower cadence, raise `EXPECTED_LAG_MONTHS`; leave the closed-issue suppression
  alone, since it is what lets a maintainer ratify a genuinely skipped month.
- **Deploy is wired by `workflow_call`, not a token swap.** If a future change needs `on: push` to fire
  from a bot commit instead, that requires a GitHub App or PAT; do not add one just to trigger deploys.
