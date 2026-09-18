import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type AiKnowledgeStatus = 'active' | 'inactive';

export class AiKnowledgeEntry extends Model<
  InferAttributes<AiKnowledgeEntry>,
  InferCreationAttributes<AiKnowledgeEntry>
> {
  declare id: CreationOptional<number>;
  declare title: string;
  declare content: string;
  declare tags: CreationOptional<string | null>;
  declare status: CreationOptional<AiKnowledgeStatus>;
  declare created_by: CreationOptional<number | null>;
  declare updated_at: CreationOptional<Date>;
}

export function initAiKnowledgeEntryModel(sequelize: Sequelize): typeof AiKnowledgeEntry {
  AiKnowledgeEntry.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: DataTypes.STRING(255), allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      tags: { type: DataTypes.STRING(255), allowNull: true },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_by: { type: DataTypes.INTEGER, allowNull: true },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'ai_knowledge_entries',
      modelName: 'AiKnowledgeEntry',
      timestamps: false,
    },
  );
  return AiKnowledgeEntry;
}
