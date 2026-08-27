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

  declare district: string;

  declare phone: string;

  declare lat: number;

  declare lng: number;

  declare opening_hours: CreationOptional<string | null>;
}

export function initStoreModel(sequelize: Sequelize): typeof Store {
  Store.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      address: { type: DataTypes.STRING(255), allowNull: false },
      district: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      lat: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      lng: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      opening_hours: { type: DataTypes.STRING(100), allowNull: true },
    },
    { sequelize, tableName: 'stores', modelName: 'Store', timestamps: false },
  );
  return Store;
}
