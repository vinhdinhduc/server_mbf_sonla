import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type NewsCategory = 'khuyen_mai' | 'su_kien' | 'thong_bao';
export type NewsStatus = 'draft' | 'published';

export class News extends Model<InferAttributes<News>, InferCreationAttributes<News>> {
  declare id: CreationOptional<number>;

  declare title: string;

  declare slug: string;

  declare category: NewsCategory;

  declare thumbnail: CreationOptional<string | null>;

  declare summary: CreationOptional<string | null>;

  declare content: string;

  declare status: CreationOptional<NewsStatus>;

  declare author_id: CreationOptional<number | null>;

  declare published_at: CreationOptional<Date | null>;

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
      thumbnail: { type: DataTypes.STRING(255), allowNull: true },
      summary: { type: DataTypes.TEXT, allowNull: true },
      content: { type: DataTypes.TEXT('long'), allowNull: false },
      status: {
        type: DataTypes.ENUM('draft', 'published'),
        allowNull: false,
        defaultValue: 'draft',
      },
      author_id: { type: DataTypes.INTEGER, allowNull: true },
      published_at: { type: DataTypes.DATE, allowNull: true },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    { sequelize, tableName: 'news', modelName: 'News' },
  );
  return News;
}
