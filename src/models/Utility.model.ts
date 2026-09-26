import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export class Utility extends Model<InferAttributes<Utility>, InferCreationAttributes<Utility>> {
  declare id: CreationOptional<number>;

  declare name: string;

  declare slug: string;

  declare summary: CreationOptional<string | null>;

  declare card_image: CreationOptional<string | null>;

  declare hero_image: CreationOptional<string | null>;

  declare content: CreationOptional<string | null>;

  declare features: CreationOptional<string[] | null>;

  declare ios_url: CreationOptional<string | null>;

  declare android_url: CreationOptional<string | null>;

  declare website_url: CreationOptional<string | null>;

  declare cta_type: CreationOptional<'download' | 'website' | 'call'>;

  declare cta_label: CreationOptional<string | null>;

  declare sort_order: CreationOptional<number>;

  declare status: CreationOptional<'active' | 'inactive'>;

  declare created_at: CreationOptional<Date>;

  declare updated_at: CreationOptional<Date>;

  declare deleted_at: CreationOptional<Date | null>;
}
export function initUtilityModel(s: Sequelize) {
  Utility.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(160), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      summary: { type: DataTypes.STRING(300), allowNull: true },
      card_image: { type: DataTypes.STRING(500), allowNull: true },
      hero_image: { type: DataTypes.STRING(500), allowNull: true },
      content: { type: DataTypes.TEXT('long'), allowNull: true },
      features: { type: DataTypes.JSON, allowNull: true },
      ios_url: { type: DataTypes.STRING(1000), allowNull: true },
      android_url: { type: DataTypes.STRING(1000), allowNull: true },
      website_url: { type: DataTypes.STRING(1000), allowNull: true },
      cta_type: {
        type: DataTypes.ENUM('download', 'website', 'call'),
        allowNull: false,
        defaultValue: 'website',
      },
      cta_label: { type: DataTypes.STRING(100), allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize: s,
      tableName: 'utilities',
      modelName: 'Utility',
      paranoid: true,
      deletedAt: 'deleted_at',
    },
  );
  return Utility;
}
