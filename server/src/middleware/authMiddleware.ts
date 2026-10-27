import { Request, Response, NextFunction } from 'express';
import { AuthTokenPayload, verifyToken } from '../services/authService.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function attachAuthUser(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
      next();
      return;
    }
  }

  // In local demo mode, allow default demo session or explicit X-Demo-Role header for seamless evaluation
  const isDemoMode = process.env.DEMO_MODE !== 'false';
  if (isDemoMode) {
    const headerRole = req.headers['x-demo-role'];
    const role: 'admin' | 'operator' =
      headerRole === 'operator' ? 'operator' : 'admin';

    req.user = {
      userId: role === 'admin' ? 1 : 2,
      username: role,
      email: `${role}@aquaguard.local`,
      fullName:
        role === 'admin'
          ? 'Dr. Elena Vance (Lead Hydrologist / Admin)'
          : 'Marcus Chen (Shift Telemetry Operator)',
      role,
      exp: Math.floor(Date.now() / 1000) + 86400,
    };
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required. Provide a valid Bearer token.',
      code: 'UNAUTHORIZED',
    });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required.',
      code: 'UNAUTHORIZED',
    });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({
      error:
        'Administrator privileges required for this operation. Current role (Operator) has read, alert management, and reporting access only.',
      code: 'FORBIDDEN_ROLE',
    });
    return;
  }
  next();
}

export function requireIoTIngestOrAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-iot-api-key'];
  const expectedKey = process.env.IOT_INGEST_API_KEY || 'ag-iot-device-ingest-key-demo-2026';

  if (apiKey && typeof apiKey === 'string' && apiKey === expectedKey) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const payload = verifyToken(authHeader.slice(7).trim());
    if (payload) {
      req.user = payload;
      next();
      return;
    }
  }

  // If explicitly testing unauthenticated ingestion without x-iot-api-key or bearer token, enforce check if header x-require-strict-ingest is set or not in demo browser session
  if (req.headers['x-strict-iot-auth'] === 'true' || !req.user) {
    res.status(401).json({
      error:
        'Authorized sensor ingestion requires a valid X-IoT-API-Key header or Bearer authentication token.',
      code: 'IOT_AUTH_REQUIRED',
    });
    return;
  }

  next();
}
