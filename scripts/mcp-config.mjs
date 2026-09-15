import { fileURLToPath } from 'node:url';
console.log(JSON.stringify({ mcpServers: { 'control-studio': { command: process.execPath, args: [fileURLToPath(new URL('./mcp.mjs', import.meta.url))] } } }, null, 2));
