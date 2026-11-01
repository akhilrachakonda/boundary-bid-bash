/** Separate loopback-only development app; never changes the managed preview. */
import { defineConfig } from '@lovable.dev/vite-tanstack-config';
export default defineConfig({
  envDefine: false,
  tanstackStart: { server: { entry: 'server' } },
  vite: { server: { host: '127.0.0.1', port: 8081, strictPort: true } },
});