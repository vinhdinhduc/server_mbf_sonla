import { UserRole } from '../models/User.model';

export interface AuthUserPayload {
  id: number;
  username: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      /** Duoc auditLogger.middleware gan tam de controller/service bao lai du lieu old/new */
      auditContext?: {
        module: string;
        action: 'create' | 'update' | 'delete' | 'login' | 'logout';
        targetId?: number;
        description?: string;
        oldValue?: unknown;
        newValue?: unknown;
      };
    }
  }
}

export {};
