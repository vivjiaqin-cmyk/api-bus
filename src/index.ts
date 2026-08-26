import { createApp } from './app.js';
import { config } from './config.js';

const server = createApp().listen(config.port, () => {
  console.log(`api-bus listening on http://localhost:${config.port} (${config.env})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}
