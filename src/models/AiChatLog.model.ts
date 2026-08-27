import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export class AiChatLog extends Model<
  InferAttributes<AiChatLog>,
  InferCreationAttributes<AiChatLog>
> {
  declare id: CreationOptional<number>;

  declare session_id: string;

  declare user_message: string;

  declare ai_response: string;

  declare ip_address: string;

  declare created_at: CreationOptional<Date>;
}

export function initAiChatLogModel(sequelize: Sequelize): typeof AiChatLog {
  AiChatLog.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      session_id: { type: DataTypes.STRING(100), allowNull: false },
      user_message: { type: DataTypes.TEXT, allowNull: false },
      ai_response: { type: DataTypes.TEXT, allowNull: false },
      ip_address: { type: DataTypes.STRING(45), allowNull: false },
      created_at: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'ai_chat_logs',
      modelName: 'AiChatLog',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    },
  );
  return AiChatLog;
}
