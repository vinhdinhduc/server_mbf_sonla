import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type NewsCategory = 'khuyen_mai' | 'su_kien' | 'thong_bao';
export type NewsStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export class News extends Model<InferAttributes<News>, InferCreationAttributes<News>> {
  declare id: CreationOptional<number>;

  declare title: string;

  declare slug: string;

  declare category: NewsCategory;

  declare category_id: CreationOptional<number | null>;

  declare thumbnail: CreationOptional<string | null>;

  declare cover_url: CreationOptional<string | null>;

  declare cover_alt: CreationOptional<string | null>;

  declare summary: CreationOptional<string | null>;

  declare content: string;

  declare status: CreationOptional<NewsStatus>;

  declare author_id: CreationOptional<number | null>;

  declare published_at: CreationOptional<Date | null>;

  declare is_featured: CreationOptional<boolean>;

  declare is_pinned: CreationOptional<boolean>;

  declare view_count: CreationOptional<number>;

  declare seo_title: CreationOptional<string | null>;

  declare seo_description: CreationOptional<string | null>;

  declare og_image_url: CreationOptional<string | null>;

  declare canonical_url: CreationOptional<string | null>;

  declare search_text: CreationOptional<string | null>;

  declare autosave_content: CreationOptional<string | null>;

  declare preview_token: CreationOptional<string | null>;

  declare deleted_at: CreationOptional<Date | null>;

  declare created_at: CreationOptional<Date>;

  declare updated_at: CreationOptional<Date>;
}

export function initNewsModel(sequelize: Sequelize): typeof News {
  News.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: DataTypes.STRING(255), allowNull: false },
      slug: { type: DataTypes.STRING(255), unique: true, allowNull: false },
      category: {
        type: DataTypes.ENUM('khuyen_mai', 'su_kien', 'thong_bao'),
        allowNull: false,
      },
      category_id: { type: DataTypes.INTEGER, allowNull: true },
      thumbnail: { type: DataTypes.STRING(255), allowNull: true },
      cover_url: { type: DataTypes.STRING(500), allowNull: true },
      cover_alt: { type: DataTypes.STRING(255), allowNull: true },
      summary: { type: DataTypes.TEXT, allowNull: true },
      content: { type: DataTypes.TEXT('long'), allowNull: false },
      status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'published', 'archived'),
        allowNull: false,
        defaultValue: 'draft',
      },
      author_id: { type: DataTypes.INTEGER, allowNull: true },
      published_at: { type: DataTypes.DATE, allowNull: true },
      is_featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_pinned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      view_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      seo_title: { type: DataTypes.STRING(60), allowNull: true },
      seo_description: { type: DataTypes.STRING(160), allowNull: true },
      og_image_url: { type: DataTypes.STRING(500), allowNull: true },
      canonical_url: { type: DataTypes.STRING(500), allowNull: true },
      search_text: { type: DataTypes.TEXT, allowNull: true },
      autosave_content: { type: DataTypes.TEXT('long'), allowNull: true },
      preview_token: { type: DataTypes.STRING(64), allowNull: true },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    { sequelize, tableName: 'news', modelName: 'News', paranoid: true, deletedAt: 'deleted_at' },
  );
  return News;
}
