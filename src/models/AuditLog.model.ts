import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export';

export class AuditLog extends Model<InferAttributes<AuditLog>, InferCreationAttributes<AuditLog>> {
  declare id: CreationOptional<number>;

  declare user_id: CreationOptional<number | null>;

  declare action: AuditAction;

  declare module: string;

  declare target_id: CreationOptional<number | null>;

  declare description: CreationOptional<string | null>;

  declare old_value: CreationOptional<Record<string, unknown> | null>;

  declare new_value: CreationOptional<Record<string, unknown> | null>;

  declare ip_address: CreationOptional<string | null>;

  declare created_at: CreationOptional<Date>;
}

export function initAuditLogModel(sequelize: Sequelize): typeof AuditLog {
  AuditLog.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      user_id: { type: DataTypes.INTEGER, allowNull: true },
      action: {
        type: DataTypes.ENUM('create', 'update', 'delete', 'login', 'logout', 'export'),
        allowNull: false,
      },
      module: { type: DataTypes.STRING(50), allowNull: false },
      target_id: { type: DataTypes.INTEGER, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      old_value: { type: DataTypes.JSON, allowNull: true },
      new_value: { type: DataTypes.JSON, allowNull: true },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
      created_at: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'audit_logs',
      modelName: 'AuditLog',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    },
  );
  return AuditLog;
}
