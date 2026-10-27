import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { attachAuthUser } from './middleware/authMiddleware.js';
import { apiRouter } from './routes/api.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  // Request logger in development
  if (process.env.NODE_ENV !== 'test') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        if (req.path.startsWith('/api')) {
          const duration = Date.now() - start;
          console.log(`[AquaGuard API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
        }
      });
      next();
    });
  }

  app.use(attachAuthUser);
  app.use('/api', apiRouter);

  // Serve built frontend in production
  const distClientPath = path.resolve(process.cwd(), 'dist', 'client');
  if (fs.existsSync(distClientPath)) {
    app.use(express.static(distClientPath));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(distClientPath, 'index.html'));
    });
  }

  // 404 handler for unknown API routes
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
      code: 'ENDPOINT_NOT_FOUND',
    });
  });

  // Global error handler (never leaks sensitive config or stack traces)
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        error: 'Malformed JSON request body.',
        code: 'INVALID_JSON',
      });
      return;
    }
    console.error('[AquaGuard Server Error]:', err.message);
    res.status(500).json({
      error: 'An unexpected server error occurred while processing the request.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  return app;
}
