import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export class SolutionFaq extends Model<
  InferAttributes<SolutionFaq>,
  InferCreationAttributes<SolutionFaq>
> {
  declare id: CreationOptional<number>;
  declare solution_id: number;
  declare question: string;
  declare answer: CreationOptional<string | null>;
  declare sort_order: CreationOptional<number>;
}

export function initSolutionFaqModel(sequelize: Sequelize): typeof SolutionFaq {
  SolutionFaq.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      solution_id: { type: DataTypes.INTEGER, allowNull: false },
      question: { type: DataTypes.STRING(500), allowNull: false },
      answer: { type: DataTypes.TEXT, allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, tableName: 'solution_faqs', modelName: 'SolutionFaq', timestamps: false },
  );
  return SolutionFaq;
}
