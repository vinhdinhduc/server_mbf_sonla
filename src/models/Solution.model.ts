import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type SolutionCategory = 'sme' | 'ubnd' | 'ho_kinh_doanh' | 'cuc_nganh' | 'chuyen_doi_so';
export type SolutionStatus = 'active' | 'inactive';

export class Solution extends Model<InferAttributes<Solution>, InferCreationAttributes<Solution>> {
  declare id: CreationOptional<number>;

  declare name: string;

  declare slug: string;

  declare category: SolutionCategory;

  declare thumbnail: CreationOptional<string | null>;

  declare summary: CreationOptional<string | null>;

  declare content: string;

  declare target_customers: CreationOptional<string | null>;

  declare legal_basis: CreationOptional<string | null>;

  declare brochure_url: CreationOptional<string | null>;

  declare video_url: CreationOptional<string | null>;

  declare is_hot: CreationOptional<boolean>;

  declare status: CreationOptional<SolutionStatus>;
  declare hero_badge: CreationOptional<string | null>;
  declare hero_title: CreationOptional<string | null>;
  declare hero_subtitle: CreationOptional<string | null>;
  declare cta_label: CreationOptional<string | null>;
  declare cta_url: CreationOptional<string | null>;
  declare audience_cards: CreationOptional<Array<{ icon: string; title: string; description: string }> | null>;
  declare section_visibility: CreationOptional<Record<string, boolean> | null>;
  declare section_titles: CreationOptional<Record<string, string> | null>;
  declare seo_title: CreationOptional<string | null>;
  declare seo_description: CreationOptional<string | null>;
}

export function initSolutionModel(sequelize: Sequelize): typeof Solution {
  Solution.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      slug: { type: DataTypes.STRING(255), unique: true, allowNull: false },
      category: {
        type: DataTypes.ENUM('sme', 'ubnd', 'ho_kinh_doanh', 'cuc_nganh', 'chuyen_doi_so'),
        allowNull: false,
      },
      thumbnail: { type: DataTypes.STRING(255), allowNull: true },
      summary: { type: DataTypes.TEXT, allowNull: true },
      content: { type: DataTypes.TEXT('long'), allowNull: false },
      target_customers: { type: DataTypes.TEXT, allowNull: true },
      legal_basis: { type: DataTypes.TEXT, allowNull: true },
      brochure_url: { type: DataTypes.STRING(255), allowNull: true },
      video_url: { type: DataTypes.STRING(255), allowNull: true },
      is_hot: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      hero_badge: { type: DataTypes.STRING(100), allowNull: true },
      hero_title: { type: DataTypes.STRING(255), allowNull: true },
      hero_subtitle: { type: DataTypes.TEXT, allowNull: true },
      cta_label: { type: DataTypes.STRING(100), allowNull: true },
      cta_url: { type: DataTypes.STRING(255), allowNull: true },
      audience_cards: { type: DataTypes.JSON, allowNull: true, get() { const value = this.getDataValue('audience_cards'); return typeof value === 'string' ? JSON.parse(value) : value; } },
      section_visibility: { type: DataTypes.JSON, allowNull: true, get() { const value = this.getDataValue('section_visibility'); return typeof value === 'string' ? JSON.parse(value) : value; } },
      section_titles: { type: DataTypes.JSON, allowNull: true, get() { const value = this.getDataValue('section_titles'); return typeof value === 'string' ? JSON.parse(value) : value; } },
      seo_title: { type: DataTypes.STRING(60), allowNull: true },
      seo_description: { type: DataTypes.STRING(160), allowNull: true },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    { sequelize, tableName: 'solutions', modelName: 'Solution', timestamps: false },
  );
  return Solution;
}
