import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export class Station extends Model<InferAttributes<Station>, InferCreationAttributes<Station>> {
  declare id: CreationOptional<number>;

  declare code: string;

  declare name: string;

  declare address: string;

  declare latitude: number;

  declare longitude: number;

  declare type: '2G' | '3G' | '4G' | '5G';

  declare status: 'active' | 'warning' | 'incident' | 'maintenance';

  declare power_watts: number | null;

  declare coverage_radius_m: number | null;

  declare installed_at: string | null;

  declare notes: string | null;

  declare created_at: CreationOptional<Date>;

  declare updated_at: CreationOptional<Date>;
}

export function initStationModel(sequelize: Sequelize) {
  Station.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      code: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      address: { type: DataTypes.STRING(500), allowNull: false },
      latitude: { type: DataTypes.DOUBLE, allowNull: false },
      longitude: { type: DataTypes.DOUBLE, allowNull: false },
      type: { type: DataTypes.ENUM('2G', '3G', '4G', '5G'), allowNull: false },
      status: {
        type: DataTypes.ENUM('active', 'warning', 'incident', 'maintenance'),
        allowNull: false,
        defaultValue: 'active',
      },
      power_watts: { type: DataTypes.DOUBLE, allowNull: true },
      coverage_radius_m: { type: DataTypes.INTEGER, allowNull: true },
      installed_at: { type: DataTypes.DATEONLY, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    { sequelize, tableName: 'stations', modelName: 'Station' },
  );
}
