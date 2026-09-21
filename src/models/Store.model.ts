import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export class Store extends Model<InferAttributes<Store>, InferCreationAttributes<Store>> {
  declare id: CreationOptional<number>;

  declare name: string;

  declare address: string;

  declare district: CreationOptional<string | null>;

  declare phone: string;

  declare lat: number;

  declare lng: number;

  declare opening_hours: CreationOptional<string | null>;

  declare province_code: CreationOptional<string | null>;

  declare ward_code: CreationOptional<string | null>;

  declare street_address: CreationOptional<string | null>;

  declare full_address: CreationOptional<string | null>;

  declare email: CreationOptional<string | null>;

  declare opening_hours_json: CreationOptional<Array<{
    days: number[];
    open: string;
    close: string;
  }> | null>;

  declare needs_review: CreationOptional<boolean>;

  declare geocode_source: CreationOptional<string | null>;

  declare geocoded_at: CreationOptional<Date | null>;

  declare status: CreationOptional<'active' | 'inactive'>;
}

export function initStoreModel(sequelize: Sequelize): typeof Store {
  Store.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      address: { type: DataTypes.STRING(255), allowNull: false },
      district: { type: DataTypes.STRING(100), allowNull: true },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      lat: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      lng: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      opening_hours: { type: DataTypes.STRING(100), allowNull: true },
      province_code: { type: DataTypes.STRING(2), allowNull: true },
      ward_code: { type: DataTypes.STRING(5), allowNull: true },
      street_address: { type: DataTypes.STRING(255), allowNull: true },
      full_address: { type: DataTypes.STRING(500), allowNull: true },
      email: { type: DataTypes.STRING(150), allowNull: true },
      opening_hours_json: { type: DataTypes.JSON, allowNull: true },
      needs_review: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      geocode_source: { type: DataTypes.STRING(30), allowNull: true },
      geocoded_at: { type: DataTypes.DATE, allowNull: true },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    { sequelize, tableName: 'stores', modelName: 'Store', timestamps: false },
  );
  return Store;
}
