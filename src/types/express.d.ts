// Убедись, что tsconfig "typeRoots" включает ./src/types
import type { AuthUser } from '../common/current-user.decorator';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
