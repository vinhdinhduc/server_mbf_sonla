import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export class WorkShift extends Model<
  InferAttributes<WorkShift>,
  InferCreationAttributes<WorkShift>
> {
  declare id: CreationOptional<number>;

  declare user_id: number;

  declare shift_date: string;

  declare start_time: string;

  declare end_time: string;

  declare note: CreationOptional<string | null>;

  declare created_by: number;

  declare created_at: CreationOptional<Date>;
}

export function initWorkShiftModel(sequelize: Sequelize): typeof WorkShift {
  WorkShift.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      shift_date: { type: DataTypes.DATEONLY, allowNull: false },
      start_time: { type: DataTypes.TIME, allowNull: false },
      end_time: { type: DataTypes.TIME, allowNull: false },
      note: { type: DataTypes.STRING(255), allowNull: true },
      created_by: { type: DataTypes.INTEGER, allowNull: false },
      created_at: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'work_shifts',
      modelName: 'WorkShift',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    },
  );
  return WorkShift;
}
