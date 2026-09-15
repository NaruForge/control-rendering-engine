import { execFileSync } from 'node:child_process';
// Keep all committed text projections synchronized. Raster/PDF previews are review snapshots.
const jobs = [
  ['--out', 'docs/generated', '--schema', 'schema/model.schema.json'],
  ['--input', 'examples/signal-loop.yaml', '--view', 'signals', '--out', 'docs/generated/signal-loop'],
  ['--theme', 'midnight', '--view', 'overview', '--out', 'docs/generated/midnight'],
  ['--theme', 'paper', '--view', 'overview', '--out', 'docs/generated/paper'],
];
try {
  for (const args of jobs) execFileSync(process.execPath, ['--experimental-strip-types', 'src/cli.ts', ...args], { stdio: 'inherit' });
} catch (error) { process.exitCode = typeof error.status === 'number' ? error.status : 1; }
