import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export class SolutionGallery extends Model<
  InferAttributes<SolutionGallery>,
  InferCreationAttributes<SolutionGallery>
> {
  declare id: CreationOptional<number>;
  declare solution_id: number;
  declare image_url: string;
  declare caption: CreationOptional<string | null>;
  declare sort_order: CreationOptional<number>;
}

export function initSolutionGalleryModel(sequelize: Sequelize): typeof SolutionGallery {
  SolutionGallery.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      solution_id: { type: DataTypes.INTEGER, allowNull: false },
      image_url: { type: DataTypes.STRING(255), allowNull: false },
      caption: { type: DataTypes.STRING(255), allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, tableName: 'solution_gallery', modelName: 'SolutionGallery', timestamps: false },
  );
  return SolutionGallery;
}
