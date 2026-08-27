import { auditLogService } from '../../src/services/auditLog.service';
import { AuditLog } from '../../src/models/AuditLog.model';

describe('auditLog.service - read-only invariant', () => {
  it('KHONG duoc co method update/delete/remove tren auditLogService', () => {
    expect((auditLogService as any).update).toBeUndefined();
    expect((auditLogService as any).delete).toBeUndefined();
    expect((auditLogService as any).remove).toBeUndefined();
    expect((auditLogService as any).destroy).toBeUndefined();
  });

  it('chi export method find (doc), khong export method ghi ngoai create', () => {
    const exportedMethods = Object.keys(auditLogService);
    exportedMethods.forEach((method) => {
      expect(['find']).toContain(method);
    });
  });

  it('AuditLog model van co the create (ghi tu dong qua middleware), nhung service khong bao boc update/delete', () => {
    expect(typeof AuditLog.create).toBe('function');
    expect((auditLogService as any).update).toBeUndefined();
  });
});
