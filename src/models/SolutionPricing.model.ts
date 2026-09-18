import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export class SolutionPricing extends Model<
  InferAttributes<SolutionPricing>,
  InferCreationAttributes<SolutionPricing>
> {
  declare id: CreationOptional<number>;
  declare solution_id: number;
  declare package_code: string;
  declare package_name: string;
  declare price: number;
  declare cycle_months: CreationOptional<number>;
  declare condition_note: CreationOptional<string | null>;
  declare sort_order: CreationOptional<number>;
}

export function initSolutionPricingModel(sequelize: Sequelize): typeof SolutionPricing {
  SolutionPricing.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      solution_id: { type: DataTypes.INTEGER, allowNull: false },
      package_code: { type: DataTypes.STRING(50), allowNull: false },
      package_name: { type: DataTypes.STRING(255), allowNull: false },
      price: { type: DataTypes.DECIMAL(15, 2), allowNull: false, validate: { min: 0 } },
      cycle_months: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      condition_note: { type: DataTypes.STRING(255), allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, tableName: 'solution_pricing', modelName: 'SolutionPricing', timestamps: false },
  );
  return SolutionPricing;
}
