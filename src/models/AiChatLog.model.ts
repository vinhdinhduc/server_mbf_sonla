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
  declare agreed_terms_at: CreationOptional<Date | null>;
  declare agreed_terms_version: CreationOptional<string | null>;

  declare session_id: string;

  declare user_message: string;

  declare ai_response: string;

  declare was_helpful: CreationOptional<boolean | null>;

  declare flagged_for_review: CreationOptional<boolean>;

  declare ip_address: string;

  declare input_tokens: CreationOptional<number>;

  declare output_tokens: CreationOptional<number>;

  declare estimated_cost: CreationOptional<number>;

  declare provider: CreationOptional<string | null>;

  declare model: CreationOptional<string | null>;

  declare latency_ms: CreationOptional<number | null>;

  declare created_at: CreationOptional<Date>;
}

export function initAiChatLogModel(sequelize: Sequelize): typeof AiChatLog {
  AiChatLog.init(
    {
      agreed_terms_at: { type: DataTypes.DATE, allowNull: true },
      agreed_terms_version: { type: DataTypes.STRING(20), allowNull: true },
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      session_id: { type: DataTypes.STRING(100), allowNull: false },
      user_message: { type: DataTypes.TEXT, allowNull: false },
      ai_response: { type: DataTypes.TEXT, allowNull: false },
      was_helpful: { type: DataTypes.BOOLEAN, allowNull: true },
      flagged_for_review: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ip_address: { type: DataTypes.STRING(45), allowNull: false },
      input_tokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      output_tokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      estimated_cost: { type: DataTypes.DECIMAL(12, 6), allowNull: false, defaultValue: 0 },
      provider: { type: DataTypes.STRING(30), allowNull: true },
      model: { type: DataTypes.STRING(100), allowNull: true },
      latency_ms: { type: DataTypes.INTEGER, allowNull: true },
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
