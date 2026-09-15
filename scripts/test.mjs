import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const files = readdirSync('tests').filter(f => f.endsWith('.test.ts')).sort().map(f => `tests/${f}`);
try { execFileSync(process.execPath, ['--import', 'tsx', '--test', ...files], { stdio: 'inherit' }); }
catch (e) { process.exitCode = typeof e.status === 'number' ? e.status : 1; }
