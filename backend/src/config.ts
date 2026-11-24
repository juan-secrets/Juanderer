import fs from 'node:fs';

// Loads backend/.env if it exists (only holds secrets like the database password)
if (fs.existsSync('.env')) process.loadEnvFile('.env');

// Each service listens on its own port; the gateway forwards /api/<name>/* to it
export const services = {
  example: { port: 3001 },
};

export const gatewayPort = 3000;

export const databaseUrl = process.env.DATABASE_URL;
