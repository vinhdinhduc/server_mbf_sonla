import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
} from 'sequelize';
import { RegistrationItem } from './RegistrationItem.model';

export type RegistrationStatus = 'moi' | 'dang_xu_ly' | 'hoan_thanh' | 'huy';

export class RegistrationGroup extends Model<
  InferAttributes<RegistrationGroup>,
  InferCreationAttributes<RegistrationGroup>
> {
  declare id: CreationOptional<number>;

  declare customer_name: string;

  declare phone: string;

  declare email: string;

  declare delivery_method: 'address' | 'store';

  declare sim_type: 'physical' | 'esim';

  declare delivery_store: CreationOptional<string | null>;

  declare province: string;

  declare district: string;

  declare ward: string;

  declare delivery_address: string;

  declare note: CreationOptional<string | null>;

  declare status: CreationOptional<RegistrationStatus>;

  declare assigned_to: CreationOptional<number | null>;
  declare code: CreationOptional<string | null>;
  declare customer_type: CreationOptional<'individual' | 'business'>;
  declare store_id: CreationOptional<number | null>;
  declare total_amount: CreationOptional<number>;
  declare source_utm: CreationOptional<Record<string, string> | null>;
  declare consent_at: CreationOptional<Date | null>;
  declare idempotency_key: CreationOptional<string | null>;

  declare created_at: CreationOptional<Date>;

  declare items?: NonAttribute<RegistrationItem[]>;
}

export function initRegistrationGroupModel(sequelize: Sequelize): typeof RegistrationGroup {
  RegistrationGroup.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      customer_name: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      email: { type: DataTypes.STRING(150), allowNull: false },
      delivery_method: { type: DataTypes.ENUM('address', 'store'), allowNull: false },
      sim_type: { type: DataTypes.ENUM('physical', 'esim'), allowNull: false },
      delivery_store: { type: DataTypes.STRING(255), allowNull: true },
      province: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Sơn La' },
      district: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
      ward: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
      delivery_address: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
      note: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM('moi', 'dang_xu_ly', 'hoan_thanh', 'huy'),
        allowNull: false,
        defaultValue: 'moi',
      },
      assigned_to: { type: DataTypes.INTEGER, allowNull: true },
      code: { type: DataTypes.STRING(24), allowNull: true, unique: true },
      customer_type: { type: DataTypes.ENUM('individual', 'business'), allowNull: false, defaultValue: 'individual' },
      store_id: { type: DataTypes.INTEGER, allowNull: true },
      total_amount: { type: DataTypes.DECIMAL(14, 0), allowNull: false, defaultValue: 0 },
      source_utm: { type: DataTypes.JSON, allowNull: true },
      consent_at: { type: DataTypes.DATE, allowNull: true },
      idempotency_key: { type: DataTypes.STRING(100), allowNull: true, unique: true },
      created_at: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'registration_groups',
      modelName: 'RegistrationGroup',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    },
  );
  return RegistrationGroup;
}
