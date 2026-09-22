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
export type PackageStatus = 'active' | 'inactive' | 'hidden';

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
  declare service_type: CreationOptional<'mobile' | 'data' | 'wifi_5g' | 'combo'>;
  declare subscription_type: CreationOptional<'prepaid' | 'postpaid' | 'none'>;
  declare badges: CreationOptional<string[] | null>;
  declare data_per_day_gb: CreationOptional<number | null>;
  declare data_per_cycle_gb: CreationOptional<number | null>;
  declare unlimited_data: CreationOptional<boolean>;
  declare benefits: CreationOptional<string[] | null>;
  declare conditions: CreationOptional<string | null>;
  declare audience: CreationOptional<string | null>;
  declare sms_syntax: CreationOptional<string | null>;
  declare image_url: CreationOptional<string | null>;
  declare effective_from: CreationOptional<Date | null>;
  declare effective_to: CreationOptional<Date | null>;
  declare deleted_at: CreationOptional<Date | null>;
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
        type: DataTypes.ENUM('active', 'inactive', 'hidden'),
        allowNull: false,
        defaultValue: 'active',
      },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      service_type: { type: DataTypes.ENUM('mobile', 'data', 'wifi_5g', 'combo'), allowNull: false, defaultValue: 'mobile' },
      subscription_type: { type: DataTypes.ENUM('prepaid', 'postpaid', 'none'), allowNull: false, defaultValue: 'none' },
      badges: { type: DataTypes.JSON, allowNull: true, get() { const value = this.getDataValue('badges'); return typeof value === 'string' ? JSON.parse(value) : value; } },
      data_per_day_gb: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      data_per_cycle_gb: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      unlimited_data: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      benefits: { type: DataTypes.JSON, allowNull: true, get() { const value = this.getDataValue('benefits'); return typeof value === 'string' ? JSON.parse(value) : value; } },
      conditions: { type: DataTypes.TEXT, allowNull: true },
      audience: { type: DataTypes.STRING(255), allowNull: true },
      sms_syntax: { type: DataTypes.STRING(255), allowNull: true },
      image_url: { type: DataTypes.STRING(255), allowNull: true },
      effective_from: { type: DataTypes.DATE, allowNull: true },
      effective_to: { type: DataTypes.DATE, allowNull: true },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'packages', modelName: 'Package', timestamps: false },
  );
  return Package;
}
