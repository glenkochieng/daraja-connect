import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { healthRouter } from './routes/health.js';

/**
 * Build the Express application. Dependencies are passed in so tests can use an
 * in-memory database and a stub matching service.
 */
export function createApp({ config, mlClient, taxonomy, log = console }) {
  const app = express();
  app.disable('x-powered-by');
  // Behind AWS load balancers the client IP arrives in X-Forwarded-For.
  if (config.isProduction) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.clientOrigins }));
  app.use(express.json({ limit: '200kb' }));
  if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'));

  const deps = { config, mlClient, taxonomy, log };
  app.use('/api/health', healthRouter(deps));

  app.use(notFoundHandler);
  app.use(errorHandler({ log }));
  return app;
}
