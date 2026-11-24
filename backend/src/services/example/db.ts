import pg from 'pg';
import { databaseUrl } from '../../config';

// Connection pool to PostgreSQL; connects lazily on the first query
export const pool = new pg.Pool({ connectionString: databaseUrl });

// Prevents a dropped idle connection from crashing the service
pool.on('error', (err) => console.error('postgres error:', err.message));
