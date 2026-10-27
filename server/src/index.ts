import 'dotenv/config';
import { getDb, closeDb } from './database/db.js';
import { seedDatabaseIfNeeded } from './database/seed.js';
import { simulationEngine } from './simulation/simulationEngine.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 4000);

getDb();
seedDatabaseIfNeeded(false);
simulationEngine.initialize();

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`==================================================================`);
  console.log(`  AquaGuard — Smart Water Pollution Monitoring Backend`);
  console.log(`  Listening on: http://localhost:${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/api/health`);
  console.log(`  Demo Mode:    ${process.env.DEMO_MODE !== 'false' ? 'ENABLED (SIMULATED TELEMETRY)' : 'DISABLED'}`);
  console.log(`==================================================================`);
});

process.on('SIGINT', () => {
  simulationEngine.stop();
  closeDb();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  simulationEngine.stop();
  closeDb();
  server.close(() => process.exit(0));
});
