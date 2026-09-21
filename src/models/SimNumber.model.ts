import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type SimCatalog = 'so_dep' | 'phong_thuy' | 'nam_sinh' | 'tra_truoc' | 'sim_data' | 'esim';
export type SimType = 'tam_hoa' | 'tu_quy' | 'phat_loc' | 'than_tai' | 'thuong';
export type SimStatus = 'available' | 'reserved' | 'sold' | 'hidden';
export type SubscriptionType = 'prepaid' | 'postpaid';

export class SimNumber extends Model<
  InferAttributes<SimNumber>,
  InferCreationAttributes<SimNumber>
> {
  declare id: CreationOptional<number>;

  declare phone_number: string;

  declare prefix: string;

  declare subscription_type: SubscriptionType;

  declare catalog: SimCatalog;

  declare sim_type: SimType;

  declare price: CreationOptional<number | null>;

  declare needs_review: CreationOptional<boolean>;

  declare reserved_until: CreationOptional<Date | null>;

  declare reserved_registration_id: CreationOptional<number | null>;

  declare bundle_note: CreationOptional<string | null>;

  declare commitment_months: CreationOptional<number | null>;

  declare status: CreationOptional<SimStatus>;

  declare created_at: CreationOptional<Date>;

  declare updated_at: CreationOptional<Date | null>;

  declare deleted_at: CreationOptional<Date | null>;
}

export function initSimNumberModel(sequelize: Sequelize): typeof SimNumber {
  SimNumber.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      phone_number: { type: DataTypes.STRING(15), unique: true, allowNull: false },
      prefix: { type: DataTypes.STRING(5), allowNull: false },
      subscription_type: {
        type: DataTypes.ENUM('prepaid', 'postpaid'),
        allowNull: false,
      },
      catalog: {
        type: DataTypes.ENUM('so_dep', 'phong_thuy', 'nam_sinh', 'tra_truoc', 'sim_data', 'esim'),
        allowNull: false,
      },
      sim_type: {
        type: DataTypes.ENUM('tam_hoa', 'tu_quy', 'phat_loc', 'than_tai', 'thuong'),
        allowNull: false,
      },
      price: { type: DataTypes.DECIMAL(12, 0), allowNull: true },
      needs_review: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      reserved_until: { type: DataTypes.DATE, allowNull: true },
      reserved_registration_id: { type: DataTypes.INTEGER, allowNull: true },
      bundle_note: { type: DataTypes.STRING(255), allowNull: true },
      commitment_months: { type: DataTypes.INTEGER, allowNull: true },
      status: {
        type: DataTypes.ENUM('available', 'reserved', 'sold', 'hidden'),
        allowNull: false,
        defaultValue: 'available',
      },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
      deleted_at: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'sim_numbers',
      modelName: 'SimNumber',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      paranoid: true,
    },
  );
  return SimNumber;
}
