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
export type SimStatus = 'available' | 'reserved' | 'sold';

export class SimNumber extends Model<
  InferAttributes<SimNumber>,
  InferCreationAttributes<SimNumber>
> {
  declare id: CreationOptional<number>;

  declare phone_number: string;

  declare prefix: string;

  declare catalog: SimCatalog;

  declare sim_type: SimType;

  declare price: number;

  declare bundle_note: CreationOptional<string | null>;

  declare commitment_months: CreationOptional<number | null>;

  declare status: CreationOptional<SimStatus>;

  declare created_at: CreationOptional<Date>;
}

export function initSimNumberModel(sequelize: Sequelize): typeof SimNumber {
  SimNumber.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      phone_number: { type: DataTypes.STRING(15), unique: true, allowNull: false },
      prefix: { type: DataTypes.STRING(5), allowNull: false },
      catalog: {
        type: DataTypes.ENUM('so_dep', 'phong_thuy', 'nam_sinh', 'tra_truoc', 'sim_data', 'esim'),
        allowNull: false,
      },
      sim_type: {
        type: DataTypes.ENUM('tam_hoa', 'tu_quy', 'phat_loc', 'than_tai', 'thuong'),
        allowNull: false,
      },
      price: { type: DataTypes.DECIMAL(12, 0), allowNull: false },
      bundle_note: { type: DataTypes.STRING(255), allowNull: true },
      commitment_months: { type: DataTypes.INTEGER, allowNull: true },
      status: {
        type: DataTypes.ENUM('available', 'reserved', 'sold'),
        allowNull: false,
        defaultValue: 'available',
      },
      created_at: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'sim_numbers',
      modelName: 'SimNumber',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    },
  );
  return SimNumber;
}
