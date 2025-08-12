import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    visitorId?: string;
  }
}

@Injectable()
export class VisitorIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const fromHeader = (
      req.headers['x-visitor-id'] as string | undefined
    )?.trim();
    let vid = fromHeader || (req.cookies?.vid as string | undefined);

    if (!vid) {
      vid = randomUUID();
      res.cookie('vid', vid, {
        httpOnly: false, // фронту нужно читать избранное
        sameSite: 'lax',
        secure: false, // PROD: true
        path: '/',
        maxAge: 365 * 24 * 3600 * 1000,
      });
    }
    req.visitorId = vid;
    next();
  }
}
