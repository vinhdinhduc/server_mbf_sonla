import {
  CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize,
} from 'sequelize';

export class PromotionEvent extends Model<InferAttributes<PromotionEvent>, InferCreationAttributes<PromotionEvent>> {
  declare id: CreationOptional<number>;
  declare promotion_id: number;
  declare visit_id: string;
  declare event: 'impression' | 'open' | 'cta';
  declare created_at: CreationOptional<Date>;
}

export function initPromotionEventModel(sequelize: Sequelize) {
  PromotionEvent.init({
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    promotion_id: { type: DataTypes.INTEGER, allowNull: false },
    visit_id: { type: DataTypes.UUID, allowNull: false },
    event: { type: DataTypes.ENUM('impression', 'open', 'cta'), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'promotion_events',
    modelName: 'PromotionEvent',
    updatedAt: false,
    indexes: [
      { unique: true, fields: ['promotion_id', 'visit_id', 'event'], name: 'promotion_event_visit_unique' },
      { fields: ['created_at'], name: 'promotion_events_created_at' },
    ],
  });
  return PromotionEvent;
}
