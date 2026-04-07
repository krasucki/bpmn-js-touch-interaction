#!/usr/bin/env node
/*
 * Compare diagram-js source files our monkey-patches depend on against
 * upstream. Fetches both the pinned version (from scripts/upstream.json)
 * and the latest published version from unpkg, diffs them in memory.
 *
 * Nothing is persisted between runs. The only committed state is the
 * version pin in scripts/upstream.json.
 *
 * Usage:
 *   node scripts/check-upstream.mjs            # diff pinned vs latest, exit 1 on drift
 *   node scripts/check-upstream.mjs --update   # bump pin to latest after verifying
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIN_FILE = resolve(__dirname, 'upstream.json');

// diagram-js files our patches or workarounds depend on.
// Keep in sync with README "Monkey-patch surface" + "mouse-only assumptions".
const WATCHED_FILES = [
  'lib/util/Mouse.js',                                  // isPrimaryButton
  'lib/util/Event.js',                                  // toPoint, getOriginal
  'lib/features/hover-fix/HoverFix.js',                 // instanceof MouseEvent bail
  'lib/features/resize/ResizeHandles.js',               // makeDraggable patch
  'lib/features/connect/Connect.js',                    // connect.start patch
  'lib/features/global-connect/GlobalConnect.js',       // globalConnect.start patch
  'lib/features/lasso-tool/LassoTool.js',               // activateSelection patch
  'lib/features/space-tool/SpaceTool.js',               // activateSelection + touchend originalEvent
  'lib/features/dragging/Dragging.js',                  // isTouchEvent, init, keepSelection
];

const UPDATE = process.argv.includes('--update');

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GET ${url}: ${r.status}`);
  return r.text();
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GET ${url}: ${r.status}`);
  return r.json();
}

async function latestVersion(pkg) {
  const meta = await fetchJson(`https://registry.npmjs.org/${pkg}/latest`);
  return meta.version;
}

function unpkgUrl(pkg, version, path) {
  return `https://unpkg.com/${pkg}@${version}/${path}`;
}

function diffTwoStrings(oldContent, newContent, label) {
  const base = join(tmpdir(), `upstream-${label}-base`);
  const head = join(tmpdir(), `upstream-${label}-head`);
  spawnSync('sh', ['-c', `cat > "${base}"`], { input: oldContent });
  spawnSync('sh', ['-c', `cat > "${head}"`], { input: newContent });
  const diff = spawnSync(
    'git',
    ['--no-pager', 'diff', '--no-index', '--color=always', base, head],
    { encoding: 'utf8' },
  );
  process.stdout.write(diff.stdout || '');
}

async function main() {
  const pin = JSON.parse(await readFile(PIN_FILE, 'utf8'));
  const pinned = pin['diagram-js'];

  console.log('Resolving latest upstream version...');
  const [bpmnLatest, djLatest] = await Promise.all([
    latestVersion('bpmn-js'),
    latestVersion('diagram-js'),
  ]);
  console.log(`  bpmn-js    pinned: ${pin['bpmn-js']}   latest: ${bpmnLatest}`);
  console.log(`  diagram-js pinned: ${pinned}   latest: ${djLatest}`);
  console.log('');

  if (UPDATE) {
    const now = new Date().toISOString().slice(0, 10);
    const body = JSON.stringify(
      { 'bpmn-js': bpmnLatest, 'diagram-js': djLatest, fetchedAt: now },
      null,
      2,
    );
    await writeFile(PIN_FILE, body + '\n');
    console.log(`Pin updated: diagram-js@${djLatest}, bpmn-js@${bpmnLatest} (${now}).`);
    return;
  }

  if (pinned === djLatest) {
    console.log('Pinned version is already the latest. Nothing to check.');
    return;
  }

  const changed = [];
  for (const relPath of WATCHED_FILES) {
    let pinnedContent, latestContent;
    try {
      [pinnedContent, latestContent] = await Promise.all([
        fetchText(unpkgUrl('diagram-js', pinned, relPath)),
        fetchText(unpkgUrl('diagram-js', djLatest, relPath)),
      ]);
    } catch (e) {
      console.error(`  ERROR fetching ${relPath}: ${e.message}`);
      process.exit(2);
    }

    if (pinnedContent === latestContent) {
      console.log(`  ok:      ${relPath}`);
      continue;
    }

    changed.push(relPath);
    console.log(`  CHANGED: ${relPath}`);
    diffTwoStrings(pinnedContent, latestContent, relPath.replace(/[/\\]/g, '_'));
  }

  if (changed.length) {
    console.log(`\n${changed.length} file(s) changed between diagram-js@${pinned} and @${djLatest}.`);
    console.log('Review the diffs above. Once you have verified the patches still work:');
    console.log('  npm run check:upstream:update');
    process.exit(1);
  }

  console.log(`\nNo changes in watched files between @${pinned} and @${djLatest}.`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
