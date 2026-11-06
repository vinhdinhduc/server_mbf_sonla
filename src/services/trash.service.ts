import { Op, QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { Contact } from '../models/Contact.model';
import { RegistrationGroup } from '../models/RegistrationGroup.model';
import { RegistrationItem } from '../models/RegistrationItem.model';
import { SimNumber } from '../models/SimNumber.model';
import { StoreAppointment } from '../models/StoreAppointment.model';
import { AppError } from '../utils/AppError';

export type TrashType = 'registration_groups' | 'contacts' | 'store_appointments';

const MODULE_LABELS: Record<TrashType, string> = {
  registration_groups: 'đăng ký',
  contacts: 'liên hệ',
  store_appointments: 'lịch hẹn',
};

function findById(type: TrashType, id: number, transaction?: Transaction, lock = false) {
  const options = {
    paranoid: false as const,
    ...(transaction ? { transaction } : {}),
    ...(transaction && lock ? { lock: transaction.LOCK.UPDATE } : {}),
  };
  switch (type) {
    case 'registration_groups':
      return RegistrationGroup.findByPk(id, options);
    case 'contacts':
      return Contact.findByPk(id, options);
    case 'store_appointments':
      return StoreAppointment.findByPk(id, options);
    default:
      throw AppError.badRequest('Loại bản ghi không hợp lệ');
  }
}

function findMany(type: TrashType, ids: number[], transaction: Transaction) {
  const options = {
    where: { id: { [Op.in]: ids } },
    transaction,
    lock: transaction.LOCK.UPDATE,
  };
  switch (type) {
    case 'registration_groups':
      return RegistrationGroup.findAll(options);
    case 'contacts':
      return Contact.findAll(options);
    case 'store_appointments':
      return StoreAppointment.findAll(options);
    default:
      throw AppError.badRequest('Loại bản ghi không hợp lệ');
  }
}

function getLabel(type: TrashType, row: Record<string, unknown>) {
  if (type === 'contacts') return String(row.name ?? row.code ?? `#${row.id}`);
  return String(row.customer_name ?? row.code ?? `#${row.id}`);
}

export const trashService = {
  async list() {
    const [registrations, contacts, appointments] = await Promise.all([
      RegistrationGroup.findAll({
        where: { deleted_at: { [Op.ne]: null } },
        paranoid: false,
        attributes: ['id', 'code', 'customer_name', 'status', 'created_at', 'deleted_at'],
        order: [['deleted_at', 'DESC']],
      }),
      Contact.findAll({
        where: { deleted_at: { [Op.ne]: null } },
        paranoid: false,
        attributes: ['id', 'code', 'name', 'status', 'created_at', 'deleted_at'],
        order: [['deleted_at', 'DESC']],
      }),
      StoreAppointment.findAll({
        where: { deleted_at: { [Op.ne]: null } },
        paranoid: false,
        attributes: ['id', 'code', 'customer_name', 'status', 'created_at', 'deleted_at'],
        order: [['deleted_at', 'DESC']],
      }),
    ]);

    return [
      ...registrations.map((row) => ({
        type: 'registration_groups' as const,
        id: row.id,
        code: row.code,
        label: row.customer_name,
        status: row.status,
        created_at: row.created_at,
        deleted_at: row.deleted_at,
      })),
      ...contacts.map((row) => ({
        type: 'contacts' as const,
        id: row.id,
        code: row.code,
        label: row.name,
        status: row.status,
        created_at: row.created_at,
        deleted_at: row.deleted_at,
      })),
      ...appointments.map((row) => ({
        type: 'store_appointments' as const,
        id: row.id,
        code: row.code,
        label: row.customer_name,
        status: row.status,
        created_at: row.created_at,
        deleted_at: row.deleted_at,
      })),
    ].sort(
      (left, right) =>
        new Date(right.deleted_at ?? 0).getTime() - new Date(left.deleted_at ?? 0).getTime(),
    );
  },

  async removeMany(type: TrashType, ids: number[]) {
    return sequelize.transaction(async (transaction) => {
      const rows = await findMany(type, [...new Set(ids)], transaction);
      if (rows.length !== new Set(ids).size) {
        throw AppError.notFound(`Không tìm thấy đủ ${MODULE_LABELS[type]} được chọn`);
      }

      const previous = rows.map((row) => ({
        id: row.id,
        label: getLabel(type, row.toJSON() as Record<string, unknown>),
        status: row.get('status') as string,
      }));
      if (type === 'registration_groups') {
        const simItems = await RegistrationItem.findAll({
          where: {
            registration_group_id: { [Op.in]: rows.map((row) => row.id) },
            type: 'sim',
          },
          transaction,
        });
        await Promise.all(
          simItems.map((item) =>
            SimNumber.update(
              { status: 'available', reserved_until: null, reserved_registration_id: null },
              {
                where: {
                  id: item.reference_id,
                  status: 'reserved',
                  reserved_registration_id: item.registration_group_id,
                },
                transaction,
              },
            ),
          ),
        );
      }
      await Promise.all(rows.map((row) => row.destroy({ transaction })));
      return previous;
    });
  },

  async restore(type: TrashType, id: number) {
    return sequelize.transaction(async (transaction) => {
      const row = await findById(type, id, transaction, true);
      if (!row || !row.get('deleted_at')) {
        throw AppError.notFound('Không tìm thấy bản ghi đã xóa');
      }
      const record = row.toJSON() as Record<string, unknown>;
      if (type === 'registration_groups' && ['moi', 'dang_xu_ly'].includes(String(record.status))) {
        const items = await RegistrationItem.findAll({
          where: { registration_group_id: id, type: 'sim' },
          transaction,
        });
        await Promise.all(
          items.map(async (item) => {
            const [updated] = await SimNumber.update(
              { status: 'reserved', reserved_until: null, reserved_registration_id: id },
              {
                where: {
                  id: item.reference_id,
                  status: 'available',
                  reserved_registration_id: null,
                },
                transaction,
              },
            );
            if (!updated) {
              throw AppError.conflict(
                'Không thể khôi phục: một SIM thuộc đăng ký đã được giữ hoặc bán cho giao dịch khác',
              );
            }
          }),
        );
      }
      await row.restore({ transaction });
      return {
        id,
        label: getLabel(type, record),
        status: record.status,
      };
    });
  },

  async permanentlyRemove(type: TrashType, id: number) {
    return sequelize.transaction(async (transaction) => {
      const row = await findById(type, id, transaction, true);
      if (!row || !row.get('deleted_at')) {
        throw AppError.notFound('Không tìm thấy bản ghi đã xóa');
      }
      const record = row.toJSON() as Record<string, unknown>;
      if (type === 'registration_groups') {
        await sequelize.query('DELETE FROM registration_receipts WHERE registration_id = :id', {
          replacements: { id },
          type: QueryTypes.DELETE,
          transaction,
        });
      }
      await row.destroy({ force: true, transaction });
      return {
        id,
        label: getLabel(type, record),
        status: record.status,
      };
    });
  },

  moduleLabel(type: TrashType) {
    return MODULE_LABELS[type];
  },
};
