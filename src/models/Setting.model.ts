import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type SettingGroup = 'general' | 'theme' | 'ai' | 'analytics';

export class Setting extends Model<InferAttributes<Setting>, InferCreationAttributes<Setting>> {
  declare id: CreationOptional<number>;

  declare key: string;

  declare value: string;

  declare group: SettingGroup;

  declare updated_by: CreationOptional<number | null>;

  declare updated_at: CreationOptional<Date>;
}

export function initSettingModel(sequelize: Sequelize): typeof Setting {
  Setting.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      key: { type: DataTypes.STRING(100), unique: true, allowNull: false },
      value: { type: DataTypes.TEXT, allowNull: false },
      group: {
        type: DataTypes.ENUM('general', 'theme', 'ai', 'analytics'),
        allowNull: false,
      },
      updated_by: { type: DataTypes.INTEGER, allowNull: true },
      updated_at: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'settings',
      modelName: 'Setting',
      timestamps: true,
      createdAt: false,
      updatedAt: 'updated_at',
    },
  );
  return Setting;
}

/** Cac khoa cong khai duy nhat duoc phep tra ve qua GET /api/public/settings (muc 6.2) */
export const PUBLIC_SETTING_KEYS = [
  'site_name',
  'site_logo',
  'hotline',
  'contact_email',
  'contact_address',
  'working_hours',
  'sim_activation_fee_prepaid',
  'sim_activation_fee_postpaid',
  'theme_primary_color',
  'home_banner',
  'ai_chatbot_enabled',
  'footer_branch_name',
  'footer_address',
  'footer_email',
  'footer_description',
  'footer_facebook_url',
  'footer_about_title',
  'footer_about_content',
  'footer_phone',
  'footer_working_hours',
  'footer_zalo_url',
  'footer_youtube_url',
  'footer_copyright',
  'contact_widget_message',
  'contact_widget_enabled',
  'ga4_id',
  'fb_pixel_id',
];
