import { buildApp } from './app.js';
import { ConfigError, loadConfig } from './config/env.js';
import { ContentError } from './modules/catalog/repository.js';

// A local .env file is optional. Hosting platforms inject real environment variables.
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file present.
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config });

  if (config.usingDevKey) {
    app.log.warn('Using the built-in development access key. Set CLINICIAN_KEYS before sharing this server.');
  }

  let closing = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: config.host, port: config.port });
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError || error instanceof ContentError) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
