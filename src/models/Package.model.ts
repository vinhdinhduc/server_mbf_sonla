import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type PackageGroupType = 'hot' | 'tra_truoc' | 'tra_sau' | 'wifi_5g';
export type PackageDurationUnit = 'ngay' | 'thang';
export type PackageStatus = 'active' | 'inactive';

export class Package extends Model<InferAttributes<Package>, InferCreationAttributes<Package>> {
  declare id: CreationOptional<number>;

  declare code: string;

  declare name: string;

  declare slug: string;

  declare group_type: PackageGroupType;

  declare headline_desc: CreationOptional<string | null>;

  declare price: number;

  declare duration_value: number;

  declare duration_unit: PackageDurationUnit;

  declare data_desc: CreationOptional<string | null>;

  declare call_desc: CreationOptional<string | null>;

  declare sms_desc: CreationOptional<string | null>;

  declare speed_desc: CreationOptional<string | null>;

  declare description: CreationOptional<string | null>;

  declare status: CreationOptional<PackageStatus>;

  declare display_order: CreationOptional<number>;
}

export function initPackageModel(sequelize: Sequelize): typeof Package {
  Package.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      code: { type: DataTypes.STRING(20), unique: true, allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      slug: { type: DataTypes.STRING(255), unique: true, allowNull: false },
      group_type: {
        type: DataTypes.ENUM('hot', 'tra_truoc', 'tra_sau', 'wifi_5g'),
        allowNull: false,
      },
      headline_desc: { type: DataTypes.STRING(100), allowNull: true },
      price: { type: DataTypes.DECIMAL(12, 0), allowNull: false },
      duration_value: { type: DataTypes.INTEGER, allowNull: false },
      duration_unit: { type: DataTypes.ENUM('ngay', 'thang'), allowNull: false },
      data_desc: { type: DataTypes.STRING(255), allowNull: true },
      call_desc: { type: DataTypes.STRING(255), allowNull: true },
      sms_desc: { type: DataTypes.STRING(255), allowNull: true },
      speed_desc: { type: DataTypes.STRING(100), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, tableName: 'packages', modelName: 'Package', timestamps: false },
  );
  return Package;
}
