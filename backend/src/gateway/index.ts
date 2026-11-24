import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { gatewayPort, services } from '../config';

const app = express();

// /api/example/health is forwarded to the example service as /health
for (const [name, { port }] of Object.entries(services)) {
  app.use(`/api/${name}`, createProxyMiddleware({ target: `http://localhost:${port}` }));
}

app.listen(gatewayPort, () => {
  console.log(`gateway listening on http://localhost:${gatewayPort}`);
});
