import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const output = process.env.AUDIT_OUTPUT || '.runtime/frontend-performance/after';
const reactPackage = /(?:^|\/)(?:react|react-dom|react-reconciler|react-test-renderer|@types\/react|@types\/react-dom|@vitejs\/plugin-react)(?:\/|$)/;
const lock = JSON.parse(await fs.readFile('package-lock.json', 'utf8'));
const dependencies = Object.keys(lock.packages || {}).filter(name => reactPackage.test(name));
const sourceHits = [];
async function scan(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(filename);
    else if (/\.(?:vue|[cm]?[jt]sx?)$/.test(filename)) {
      const source = await fs.readFile(filename, 'utf8');
      if (/\b(?:from\s*|import\s*\(|require\s*\()\s*['"](?:react(?:-dom)?|@react[^'"]*|@douyinfe\/semi-ui)(?:\/[^'"]*)?['"]/.test(source) || /React\.createElement|ReactDOM\./.test(source)) sourceHits.push(filename);
    }
  }
}
await scan('src');
await scan('vendor/vue3-element-admin/src');
await fs.mkdir(output, { recursive: true });
await build({ plugins: [{
  name: 'qoj-runtime-audit',
  async generateBundle(_options, bundle) {
    const chunks = Object.values(bundle).filter(item => item.type === 'chunk').map(chunk => ({
      file: chunk.fileName, bytes: Buffer.byteLength(chunk.code), gzipBytes: gzipSync(chunk.code).length,
      imports: chunk.imports, dynamicImports: chunk.dynamicImports,
      modules: Object.keys(chunk.modules),
    }));
    const reactModules = chunks.flatMap(chunk => chunk.modules).filter(name => reactPackage.test(name));
    const report = { dependencies, sourceHits, reactModules, passed: !dependencies.length && !sourceHits.length && !reactModules.length, chunks };
    await fs.writeFile(path.join(output, 'build-audit.json'), JSON.stringify(report, null, 2));
    if (!report.passed) this.error('React detected; see build-audit.json');
    console.log(`React audit passed; ${chunks.length} chunks recorded in ${output}`);
  },
}] });
