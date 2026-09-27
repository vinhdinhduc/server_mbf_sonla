import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type NewsletterStatus = 'pending' | 'subscribed' | 'unsubscribed';

export class NewsletterSubscriber extends Model<
  InferAttributes<NewsletterSubscriber>,
  InferCreationAttributes<NewsletterSubscriber>
> {
  declare id: CreationOptional<number>;
  declare agreed_terms_at: CreationOptional<Date | null>;
  declare agreed_terms_version: CreationOptional<string | null>;

  declare email: string;

  declare status: CreationOptional<NewsletterStatus>;

  declare confirm_token: CreationOptional<string | null>;

  declare unsubscribe_token: CreationOptional<string | null>;

  declare confirmed_at: CreationOptional<Date | null>;

  declare consent_ip: CreationOptional<string | null>;

  declare subscribed_at: CreationOptional<Date>;
}

export function initNewsletterSubscriberModel(sequelize: Sequelize): typeof NewsletterSubscriber {
  NewsletterSubscriber.init(
    {
      agreed_terms_at: { type: DataTypes.DATE, allowNull: true },
      agreed_terms_version: { type: DataTypes.STRING(20), allowNull: true },
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      email: { type: DataTypes.STRING(100), unique: true, allowNull: false },
      status: {
        type: DataTypes.ENUM('pending', 'subscribed', 'unsubscribed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      confirm_token: { type: DataTypes.STRING(64), allowNull: true },
      unsubscribe_token: { type: DataTypes.STRING(64), allowNull: true },
      confirmed_at: { type: DataTypes.DATE, allowNull: true },
      consent_ip: { type: DataTypes.STRING(45), allowNull: true },
      subscribed_at: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'newsletter_subscribers',
      modelName: 'NewsletterSubscriber',
      timestamps: true,
      createdAt: 'subscribed_at',
      updatedAt: false,
    },
  );
  return NewsletterSubscriber;
}
