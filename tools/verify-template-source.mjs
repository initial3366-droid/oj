import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { parse } from '@vue/compiler-sfc';
const root = 'vendor/vue3-element-admin';
const manifestPath = 'vendor/vue3-element-admin.upstream.json';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
async function inventory(dir, prefix = '') {
  const entries = [];
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    if (item.name === '.git') continue;
    const relative = path.posix.join(prefix, item.name);
    if (item.isDirectory()) entries.push(...await inventory(path.join(dir, item.name), relative));
    else if (item.isFile()) entries.push(relative);
  }
  return entries.sort();
}
function uiHash(source, filename) {
  const { descriptor, errors } = parse(source, { filename });
  assert.equal(errors.length, 0, `${filename}: invalid SFC`);
  return hash(JSON.stringify({ template: descriptor.template && { content: descriptor.template.content, attrs: descriptor.template.attrs }, styles: descriptor.styles.map(style => ({ content: style.content, attrs: style.attrs })) }));
}
if (process.argv.includes('--record')) {
  const original = '.runtime/vue3-element-admin-upstream';
  const files = {};
  for (const file of await inventory(original)) {
    const data = await fs.readFile(path.join(original, file));
    files[file] = { sha256: hash(data), ...(file.endsWith('.vue') ? { uiSha256: uiHash(data.toString(), file) } : {}) };
  }
  await fs.writeFile(manifestPath, JSON.stringify({ repository: 'https://gitee.com/youlaiorg/vue3-element-admin.git', commit: 'f852b22d07d220d6526a9173765e21f39160de4e', version: '4.9.0', scriptAdaptations: ['src/layouts/composables/useLayout.ts', 'src/layouts/components/LayoutToolbar.vue', 'src/layouts/components/LayoutTagsView.vue', 'src/stores/tags-view.ts', 'src/components/NoticeCenter/useNotice.ts', 'src/views/login/index.vue'], files }, null, 2) + '\n');
}
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const changes = [], failures = [];
let uiCount = 0;
for (const [file, expected] of Object.entries(manifest.files)) {
  const data = await fs.readFile(path.join(root, file));
  if (expected.uiSha256) {
    uiCount++;
    if (uiHash(data.toString(), file) !== expected.uiSha256) failures.push(`${file}: template/style deviation`);
  }
  if (hash(data) !== expected.sha256) {
    if (!manifest.scriptAdaptations.includes(file)) failures.push(`${file}: unapproved source deviation`);
    changes.push(file);
  }
}
await fs.mkdir('.runtime/upstream-template', { recursive: true });
await fs.writeFile('.runtime/upstream-template/source-report.json', JSON.stringify({ passed: failures.length === 0, commit: manifest.commit, files: Object.keys(manifest.files).length, uiComponents: uiCount, scriptAdaptations: changes, failures }, null, 2));
assert.deepEqual(failures, []);
console.log(`Upstream integrity passed: ${uiCount} original Vue templates/styles, ${Object.keys(manifest.files).length} files, ${changes.length} script adaptations.`);
