import {
  CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize,
} from 'sequelize';

export class Promotion extends Model<InferAttributes<Promotion>, InferCreationAttributes<Promotion>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare title: string;
  declare content: string;
  declare image_url: CreationOptional<string | null>;
  declare coupon_code: CreationOptional<string | null>;
  declare cta_text: CreationOptional<string | null>;
  declare cta_link: CreationOptional<string | null>;
  declare effect_type: CreationOptional<'bounce' | 'shake' | 'popup'>;
  declare position: CreationOptional<'center' | 'bottom_right' | 'bottom_left'>;
  declare trigger_type: CreationOptional<'immediate' | 'delay' | 'scroll'>;
  declare trigger_value: CreationOptional<number>;
  declare target_pages: CreationOptional<string[]>;
  declare frequency: CreationOptional<'visit' | 'daily' | 'once'>;
  declare device: CreationOptional<'desktop' | 'mobile' | 'all'>;
  declare start_at: CreationOptional<Date | null>;
  declare end_at: CreationOptional<Date | null>;
  declare is_active: CreationOptional<boolean>;
  declare impression_count: CreationOptional<number>;
  declare open_count: CreationOptional<number>;
  declare cta_count: CreationOptional<number>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

export function initPromotionModel(sequelize: Sequelize) {
  Promotion.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(160), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    image_url: { type: DataTypes.STRING(2000), allowNull: true },
    coupon_code: { type: DataTypes.STRING(100), allowNull: true },
    cta_text: { type: DataTypes.STRING(100), allowNull: true },
    cta_link: { type: DataTypes.STRING(2000), allowNull: true },
    effect_type: { type: DataTypes.ENUM('bounce', 'shake', 'popup'), allowNull: false, defaultValue: 'bounce' },
    position: { type: DataTypes.ENUM('center', 'bottom_right', 'bottom_left'), allowNull: false, defaultValue: 'bottom_right' },
    trigger_type: { type: DataTypes.ENUM('immediate', 'delay', 'scroll'), allowNull: false, defaultValue: 'delay' },
    trigger_value: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    target_pages: {
      type: DataTypes.JSON, allowNull: false, defaultValue: [],
      get() {
        // MariaDB reports JSON columns as text through the MySQL driver.
        // Decode before exact page matching; string.includes('/') would match every campaign on home.
        const value: unknown = this.getDataValue('target_pages');
        const pages: unknown = typeof value === 'string' ? JSON.parse(value) : value;
        if (!Array.isArray(pages) || pages.some((page) => typeof page !== 'string')) {
          throw new Error('Trang áp dụng của chương trình khuyến mại không hợp lệ');
        }
        return pages;
      },
    },
    frequency: { type: DataTypes.ENUM('visit', 'daily', 'once'), allowNull: false, defaultValue: 'daily' },
    device: { type: DataTypes.ENUM('desktop', 'mobile', 'all'), allowNull: false, defaultValue: 'all' },
    start_at: { type: DataTypes.DATE, allowNull: true },
    end_at: { type: DataTypes.DATE, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    impression_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    open_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    cta_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  }, { sequelize, tableName: 'promotions', modelName: 'Promotion' });
  return Promotion;
}
