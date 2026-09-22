import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class SolutionStep extends Model<InferAttributes<SolutionStep>, InferCreationAttributes<SolutionStep>> {
  declare id: CreationOptional<number>;
  declare solution_id: number;
  declare title: string;
  declare description: CreationOptional<string | null>;
  declare icon: CreationOptional<string | null>;
  declare sort_order: CreationOptional<number>;
}

export function initSolutionStepModel(sequelize: Sequelize): typeof SolutionStep {
  SolutionStep.init({
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    solution_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    icon: { type: DataTypes.STRING(100), allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { sequelize, tableName: 'solution_steps', modelName: 'SolutionStep', timestamps: false });
  return SolutionStep;
}
