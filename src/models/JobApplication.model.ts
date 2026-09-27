import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export class JobApplication extends Model<
  InferAttributes<JobApplication>,
  InferCreationAttributes<JobApplication>
> {
  declare id: CreationOptional<number>;
  declare agreed_terms_at: CreationOptional<Date | null>;
  declare agreed_terms_version: CreationOptional<string | null>;

  declare code: string;

  declare job_id: CreationOptional<number | null>;

  declare full_name: string;

  declare phone: string;

  declare email: string;

  declare introduction: CreationOptional<string | null>;

  declare cv_path: string;

  declare cv_original_name: string;

  declare cv_mime: string;

  declare consent_at: Date;

  declare status: CreationOptional<'new' | 'screening' | 'interview' | 'accepted' | 'rejected'>;

  declare internal_note: CreationOptional<string | null>;

  declare created_at: CreationOptional<Date>;

  declare updated_at: CreationOptional<Date>;
}
export function initJobApplicationModel(sequelize: Sequelize) {
  JobApplication.init(
    {
      agreed_terms_at: { type: DataTypes.DATE, allowNull: true },
      agreed_terms_version: { type: DataTypes.STRING(20), allowNull: true },
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      code: { type: DataTypes.STRING(24), allowNull: false, unique: true },
      job_id: { type: DataTypes.INTEGER, allowNull: true },
      full_name: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      email: { type: DataTypes.STRING(150), allowNull: false },
      introduction: { type: DataTypes.TEXT, allowNull: true },
      cv_path: { type: DataTypes.STRING(500), allowNull: false },
      cv_original_name: { type: DataTypes.STRING(255), allowNull: false },
      cv_mime: { type: DataTypes.STRING(100), allowNull: false },
      consent_at: { type: DataTypes.DATE, allowNull: false },
      status: {
        type: DataTypes.ENUM('new', 'screening', 'interview', 'accepted', 'rejected'),
        allowNull: false,
        defaultValue: 'new',
      },
      internal_note: { type: DataTypes.TEXT, allowNull: true },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    { sequelize, tableName: 'job_applications', modelName: 'JobApplication' },
  );
  return JobApplication;
}
