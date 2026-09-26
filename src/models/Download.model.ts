import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export class Download extends Model<InferAttributes<Download>, InferCreationAttributes<Download>> {
  declare id: CreationOptional<number>;

  declare title: string;

  declare category: string;

  declare file_url: string;

  declare description: CreationOptional<string | null>;

  declare download_count: CreationOptional<number>;

  declare sort_order: CreationOptional<number>;

  declare status: CreationOptional<'active' | 'inactive'>;

  declare created_at: CreationOptional<Date>;

  declare updated_at: CreationOptional<Date>;
}
export function initDownloadModel(s: Sequelize) {
  Download.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: DataTypes.STRING(255), allowNull: false },
      category: { type: DataTypes.STRING(100), allowNull: false },
      file_url: { type: DataTypes.STRING(1000), allowNull: false },
      description: { type: DataTypes.STRING(500), allowNull: true },
      download_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    { sequelize: s, tableName: 'downloads', modelName: 'Download' },
  );
  return Download;
}
