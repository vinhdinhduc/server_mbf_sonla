import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
} from 'sequelize';
import { SliderItem } from './SliderItem.model';

export type SliderAnimationType = 'fade' | 'slide' | 'zoom';
export type SliderZoneStatus = 'active' | 'inactive';

export class SliderZone extends Model<
  InferAttributes<SliderZone>,
  InferCreationAttributes<SliderZone>
> {
  declare id: CreationOptional<number>;

  declare code: string;

  declare name: string;

  declare animation_type: CreationOptional<SliderAnimationType>;

  declare autoplay_enabled: CreationOptional<boolean>;

  declare autoplay_speed_ms: CreationOptional<number>;

  declare status: CreationOptional<SliderZoneStatus>;

  declare items?: NonAttribute<SliderItem[]>;
}

export function initSliderZoneModel(sequelize: Sequelize): typeof SliderZone {
  SliderZone.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      code: { type: DataTypes.STRING(50), unique: true, allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      animation_type: {
        type: DataTypes.ENUM('fade', 'slide', 'zoom'),
        allowNull: false,
        defaultValue: 'fade',
      },
      autoplay_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      autoplay_speed_ms: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5000 },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    { sequelize, tableName: 'slider_zones', modelName: 'SliderZone', timestamps: false },
  );
  return SliderZone;
}

/** 3 zone mac dinh duoc seed san - Admin KHONG duoc tao/xoa zone (muc 5.17) */
export const DEFAULT_SLIDER_ZONE_CODES = ['hero_banner', 'partners', 'testimonials'];
