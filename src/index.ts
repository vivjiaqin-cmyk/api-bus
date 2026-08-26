import { createApp } from './app.js';
import { config } from './config.js';
import { startGraph, stopGraph } from './data/graph.js';

// Listen first so /health can answer while the graph downloads; requireGraph
// holds the data endpoints at 503 until it is in memory.
const server = createApp().listen(config.port, () => {
  console.log(`api-bus listening on http://localhost:${config.port} (${config.env})`);
  console.log('loading route graph from', config.graphBaseUrl);
});

void startGraph();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down`);
    stopGraph();
    server.close(() => process.exit(0));
  });
}
