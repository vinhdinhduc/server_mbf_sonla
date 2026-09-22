import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type RegistrationItemType = 'sim' | 'goi_cuoc' | 'giai_phap' | 'solution_plan';

export class RegistrationItem extends Model<
  InferAttributes<RegistrationItem>,
  InferCreationAttributes<RegistrationItem>
> {
  declare id: CreationOptional<number>;

  declare registration_group_id: number;

  declare type: RegistrationItemType;

  declare reference_id: number;

  declare reference_label: string;

  declare price_snapshot: CreationOptional<number | null>;
  declare fee_snapshot: CreationOptional<number>;
  declare quantity: CreationOptional<number>;
}

export function initRegistrationItemModel(sequelize: Sequelize): typeof RegistrationItem {
  RegistrationItem.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      registration_group_id: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM('sim', 'goi_cuoc', 'giai_phap', 'solution_plan'),
        allowNull: false,
      },
      reference_id: { type: DataTypes.INTEGER, allowNull: false },
      reference_label: { type: DataTypes.STRING(255), allowNull: false },
      price_snapshot: { type: DataTypes.DECIMAL(12, 0), allowNull: true },
      fee_snapshot: { type: DataTypes.DECIMAL(12, 0), allowNull: false, defaultValue: 0 },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    },
    {
      sequelize,
      tableName: 'registration_items',
      modelName: 'RegistrationItem',
      timestamps: false,
    },
  );
  return RegistrationItem;
}
