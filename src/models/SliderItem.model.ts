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
  declare mobile_image_url: CreationOptional<string | null>;
  declare alt_text: CreationOptional<string | null>;
  declare open_new_tab: CreationOptional<boolean>;
  declare image_width: CreationOptional<number | null>;
  declare image_height: CreationOptional<number | null>;
  declare image_bytes: CreationOptional<number | null>;
  declare person_name: CreationOptional<string | null>;
  declare job_title: CreationOptional<string | null>;
  declare rating: CreationOptional<number | null>;
}

export function initSliderItemModel(sequelize: Sequelize): typeof SliderItem {
  SliderItem.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      zone_id: { type: DataTypes.INTEGER, allowNull: false },
      image_url: { type: DataTypes.STRING(255), allowNull: false },
      mobile_image_url: { type: DataTypes.STRING(255), allowNull: true },
      alt_text: { type: DataTypes.STRING(255), allowNull: true },
      open_new_tab: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      image_width: { type: DataTypes.INTEGER, allowNull: true },
      image_height: { type: DataTypes.INTEGER, allowNull: true },
      image_bytes: { type: DataTypes.INTEGER, allowNull: true },
      person_name: { type: DataTypes.STRING(100), allowNull: true },
      job_title: { type: DataTypes.STRING(100), allowNull: true },
      rating: { type: DataTypes.INTEGER, allowNull: true },
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
