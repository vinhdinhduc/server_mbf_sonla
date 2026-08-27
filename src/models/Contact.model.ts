import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type ContactStatus = 'moi' | 'da_xu_ly';

export class Contact extends Model<InferAttributes<Contact>, InferCreationAttributes<Contact>> {
  declare id: CreationOptional<number>;

  declare name: string;

  declare phone: string;

  declare email: string;

  declare message: string;

  declare status: CreationOptional<ContactStatus>;

  declare created_at: CreationOptional<Date>;
}

export function initContactModel(sequelize: Sequelize): typeof Contact {
  Contact.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      email: { type: DataTypes.STRING(100), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.ENUM('moi', 'da_xu_ly'),
        allowNull: false,
        defaultValue: 'moi',
      },
      created_at: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'contact_messages',
      modelName: 'Contact',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    },
  );
  return Contact;
}
