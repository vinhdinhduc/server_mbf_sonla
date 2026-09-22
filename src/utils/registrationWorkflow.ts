import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { RegistrationStatus } from '../models/RegistrationGroup.model';
import { AppError } from './AppError';

export const allowedTransitions: Record<RegistrationStatus, RegistrationStatus[]> = {
  moi: ['dang_xu_ly', 'huy'],
  dang_xu_ly: ['hoan_thanh', 'huy'],
  hoan_thanh: [],
  huy: [],
};

export function assertTransition(from: RegistrationStatus, to: RegistrationStatus, role: string, note?: string | null) {
  if (from === to) return;
  if (from === 'hoan_thanh' && to === 'dang_xu_ly' && role === 'admin') return;
  if (!allowedTransitions[from].includes(to)) throw AppError.conflict('Không thể chuyển trạng thái theo thứ tự này');
  if (to === 'huy' && !note?.trim()) throw AppError.badRequest('Cần nhập lý do hủy');
}

export async function allocateNumber(bucket: string, transaction: Transaction): Promise<number> {
  await sequelize.query('INSERT IGNORE INTO registration_counters(bucket,counter) VALUES (:bucket,0)', { replacements: { bucket }, transaction });
  await sequelize.query('UPDATE registration_counters SET counter=LAST_INSERT_ID(counter+1) WHERE bucket=:bucket', { replacements: { bucket }, transaction });
  const result = await sequelize.query<{ number: number }>('SELECT LAST_INSERT_ID() AS number', { type: QueryTypes.SELECT, transaction });
  return Number(result[0].number);
}

export function maskPhone(phone: string): string {
  return phone.length > 5 ? `${phone.slice(0, 3)}***${phone.slice(-3)}` : '***';
}
