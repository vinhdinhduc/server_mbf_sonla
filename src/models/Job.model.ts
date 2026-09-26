import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export class Job extends Model<InferAttributes<Job>, InferCreationAttributes<Job>> {
  declare id: CreationOptional<number>;

  declare title: string;

  declare slug: string;

  declare category: string;

  declare level: CreationOptional<string | null>;

  declare employment_type: string;

  declare store_id: CreationOptional<number | null>;

  declare location: string;

  declare quantity: CreationOptional<number>;

  declare salary_min: CreationOptional<number | null>;

  declare salary_max: CreationOptional<number | null>;

  declare salary_type: CreationOptional<'range' | 'negotiable' | 'hidden'>;

  declare description: string;

  declare requirements: CreationOptional<string | null>;

  declare benefits: CreationOptional<string | null>;

  declare deadline: string;

  declare is_hot: CreationOptional<boolean>;

  declare is_urgent: CreationOptional<boolean>;

  declare status: CreationOptional<'draft' | 'recruiting' | 'paused'>;

  declare created_by: CreationOptional<number | null>;

  declare created_at: CreationOptional<Date>;

  declare updated_at: CreationOptional<Date>;

  declare deleted_at: CreationOptional<Date | null>;
}
export function initJobModel(sequelize: Sequelize) {
  Job.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: DataTypes.STRING(255), allowNull: false },
      slug: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      category: { type: DataTypes.STRING(100), allowNull: false },
      level: { type: DataTypes.STRING(80), allowNull: true },
      employment_type: { type: DataTypes.STRING(50), allowNull: false },
      store_id: { type: DataTypes.INTEGER, allowNull: true },
      location: { type: DataTypes.STRING(255), allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      salary_min: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      salary_max: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
      salary_type: {
        type: DataTypes.ENUM('range', 'negotiable', 'hidden'),
        allowNull: false,
        defaultValue: 'negotiable',
      },
      description: { type: DataTypes.TEXT('long'), allowNull: false },
      requirements: { type: DataTypes.TEXT('long'), allowNull: true },
      benefits: { type: DataTypes.TEXT('long'), allowNull: true },
      deadline: { type: DataTypes.DATEONLY, allowNull: false },
      is_hot: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_urgent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      status: {
        type: DataTypes.ENUM('draft', 'recruiting', 'paused'),
        allowNull: false,
        defaultValue: 'draft',
      },
      created_by: { type: DataTypes.INTEGER, allowNull: true },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'jobs', modelName: 'Job', paranoid: true, deletedAt: 'deleted_at' },
  );
  return Job;
}
