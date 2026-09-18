import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export class SolutionFeature extends Model<
  InferAttributes<SolutionFeature>,
  InferCreationAttributes<SolutionFeature>
> {
  declare id: CreationOptional<number>;
  declare solution_id: number;
  declare icon: CreationOptional<string | null>;
  declare title: string;
  declare description: CreationOptional<string | null>;
  declare sort_order: CreationOptional<number>;
}

export function initSolutionFeatureModel(sequelize: Sequelize): typeof SolutionFeature {
  SolutionFeature.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      solution_id: { type: DataTypes.INTEGER, allowNull: false },
      icon: { type: DataTypes.STRING(100), allowNull: true },
      title: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, tableName: 'solution_features', modelName: 'SolutionFeature', timestamps: false },
  );
  return SolutionFeature;
}
