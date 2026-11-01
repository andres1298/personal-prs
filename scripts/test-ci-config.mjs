import assert from 'node:assert/strict';
import { globSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const lockfile = JSON.parse(read('package-lock.json'));
const workflow = read('.github/workflows/ci.yml');
const dependabot = read('.github/dependabot.yml');

// First version without the critical advisories for next 16.0.0-16.4.0 (npm audit, issue #83).
const PATCHED_NEXT = [16, 4, 1];

const parseVersion = (value) => value.replace(/^[^\d]*/, '').split('.').map(Number);
const atLeast = (version, minimum) => {
  for (let i = 0; i < minimum.length; i += 1) {
    if (version[i] !== minimum[i]) return version[i] > minimum[i];
  }
  return true;
};

test('npm test runs every offline test file and leaves out the database test', () => {
  const script = packageJson.scripts.test;
  assert.match(script, /^node --experimental-vm-modules --test "[^"]+"$/);
  // Node expands the quoted pattern itself, so the script does not depend on shell globbing.
  const pattern = script.match(/"([^"]+)"/)[1];
  const selected = globSync(pattern, { cwd: root }).sort();
  const expected = readdirSync(new URL('scripts/', root))
    .filter((name) => /^test-.+\.mjs$/.test(name) && name !== 'test-prisma.mjs')
    .map((name) => `scripts/${name}`)
    .sort();
  assert.deepEqual(selected, expected);
  assert.ok(selected.includes('scripts/test-ci-config.mjs'));
  assert.ok(!selected.includes('scripts/test-prisma.mjs'));
});

test('next is pinned to a release with the audit fixes in the manifest and the lockfile', () => {
  assert.ok(atLeast(parseVersion(packageJson.dependencies.next), PATCHED_NEXT), packageJson.dependencies.next);
  const locked = lockfile.packages['node_modules/next'].version;
  assert.ok(atLeast(parseVersion(locked), PATCHED_NEXT), locked);
  assert.equal(lockfile.packages[''].dependencies.next, packageJson.dependencies.next);
});

test('the CI workflow runs on pull requests and main with read-only permissions', () => {
  assert.match(workflow, /^on:\n {2}pull_request:\n {2}push:\n {4}branches: \[main\]$/m);
  assert.match(workflow, /^permissions:\n {2}contents: read$/m);
  // No job may widen the token scope.
  assert.equal(workflow.match(/permissions:/g).length, 1);
  assert.doesNotMatch(workflow, /pull_request_target|secrets\./);
  // Only superseded pull request runs are cancelled, never runs for commits on main.
  assert.match(workflow, /^ {2}cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}$/m);
  assert.match(workflow, /persist-credentials: false/);
});

test('every action is pinned to a full commit SHA with its release tag', () => {
  const uses = [...workflow.matchAll(/^\s*(?:- )?uses: (\S+)(.*)$/gm)];
  assert.ok(uses.length >= 2);
  for (const [, reference, comment] of uses) {
    assert.match(reference, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, reference);
    assert.match(comment, /^ # v\d+\.\d+\.\d+$/, `${reference} documents its version`);
  }
  assert.ok(uses.some(([, reference]) => reference.startsWith('actions/checkout@')));
  assert.ok(uses.some(([, reference]) => reference.startsWith('actions/setup-node@')));
});

test('the CI workflow installs, tests, validates, builds and checks whitespace in order', () => {
  const required = ['npm ci', 'npm test', 'npx prisma validate', 'npm run build', 'git diff --check'];
  const positions = required.map((command) => {
    const index = workflow.search(new RegExp(`(?:run: |^\\s+)${command.replace(/[.]/g, '\\.')}(?:\\s|$)`, 'm'));
    assert.notEqual(index, -1, `${command} runs`);
    return index;
  });
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(workflow, /node-version-file: \.nvmrc/);
  assert.equal(read('.nvmrc').trim(), '24');
  // Pushes check whitespace from the previous branch tip, which needs the full history.
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /PUSH_BEFORE: \$\{\{ github\.event\.before \}\}/);
  assert.match(workflow, /git diff --check "\$base" HEAD/);
  // The audit step is informational only.
  assert.match(workflow, /continue-on-error: true\n\s+run: npm audit --omit=dev --audit-level=high/);
});

test('Dependabot watches npm and GitHub Actions weekly', () => {
  assert.match(dependabot, /^version: 2$/m);
  for (const ecosystem of ['npm', 'github-actions']) {
    const block = dependabot.split('- package-ecosystem: ').find((part) => part.startsWith(`${ecosystem}\n`));
    assert.ok(block, `${ecosystem} is configured`);
    assert.match(block, /directory: \/\n/);
    assert.match(block, /interval: weekly/);
    assert.match(block, /open-pull-requests-limit: \d+/);
    assert.match(block, /update-types: \[minor, patch\]/);
  }
});

test('the deployment installs exactly the lockfile with npm ci', () => {
  const vercel = JSON.parse(read('vercel.json'));
  assert.equal(vercel.installCommand, 'npm ci');
  assert.ok(packageJson.engines.node.includes('24'));
});
