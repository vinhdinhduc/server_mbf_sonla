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

  declare province: string;

  declare district: string;

  declare ward: string;

  declare delivery_address: string;

  declare note: CreationOptional<string | null>;

  declare status: CreationOptional<RegistrationStatus>;

  declare assigned_to: CreationOptional<number | null>;

  declare created_at: CreationOptional<Date>;

  declare items?: NonAttribute<RegistrationItem[]>;
}

export function initRegistrationGroupModel(sequelize: Sequelize): typeof RegistrationGroup {
  RegistrationGroup.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      customer_name: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
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
