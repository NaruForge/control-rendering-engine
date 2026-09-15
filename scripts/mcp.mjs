// Resolve the TS loader relative to this repository, not the caller's working directory.
import { register } from 'tsx/esm/api';
register();
await import('../src/agent/server.ts');
