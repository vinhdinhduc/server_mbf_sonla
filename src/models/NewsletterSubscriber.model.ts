import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type NewsletterStatus = 'subscribed' | 'unsubscribed';

export class NewsletterSubscriber extends Model<
  InferAttributes<NewsletterSubscriber>,
  InferCreationAttributes<NewsletterSubscriber>
> {
  declare id: CreationOptional<number>;

  declare email: string;

  declare status: CreationOptional<NewsletterStatus>;

  declare subscribed_at: CreationOptional<Date>;
}

export function initNewsletterSubscriberModel(sequelize: Sequelize): typeof NewsletterSubscriber {
  NewsletterSubscriber.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      email: { type: DataTypes.STRING(100), unique: true, allowNull: false },
      status: {
        type: DataTypes.ENUM('subscribed', 'unsubscribed'),
        allowNull: false,
        defaultValue: 'subscribed',
      },
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
