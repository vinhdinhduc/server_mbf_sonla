import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type SliderItemStatus = 'active' | 'inactive';

export class SliderItem extends Model<
  InferAttributes<SliderItem>,
  InferCreationAttributes<SliderItem>
> {
  declare id: CreationOptional<number>;

  declare zone_id: number;

  declare image_url: string;

  declare link_url: CreationOptional<string | null>;

  declare title: CreationOptional<string | null>;

  declare caption: CreationOptional<string | null>;

  declare display_order: CreationOptional<number>;

  declare status: CreationOptional<SliderItemStatus>;

  declare start_date: CreationOptional<Date | null>;

  declare end_date: CreationOptional<Date | null>;

  declare created_at: CreationOptional<Date>;
}

export function initSliderItemModel(sequelize: Sequelize): typeof SliderItem {
  SliderItem.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      zone_id: { type: DataTypes.INTEGER, allowNull: false },
      image_url: { type: DataTypes.STRING(255), allowNull: false },
      link_url: { type: DataTypes.STRING(255), allowNull: true },
      title: { type: DataTypes.STRING(255), allowNull: true },
      caption: { type: DataTypes.TEXT, allowNull: true },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      start_date: { type: DataTypes.DATE, allowNull: true },
      end_date: { type: DataTypes.DATE, allowNull: true },
      created_at: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'slider_items',
      modelName: 'SliderItem',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    },
  );
  return SliderItem;
}
