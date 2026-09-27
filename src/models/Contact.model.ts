import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type ContactStatus = 'moi' | 'dang_xu_ly' | 'da_phan_hoi';

export class Contact extends Model<InferAttributes<Contact>, InferCreationAttributes<Contact>> {
  declare id: CreationOptional<number>;
  declare agreed_terms_at: CreationOptional<Date | null>;
  declare agreed_terms_version: CreationOptional<string | null>;

  declare name: string;

  declare phone: string;

  declare email: string;

  declare message: string;

  declare code: CreationOptional<string | null>;

  declare topic: CreationOptional<string | null>;

  declare store_id: CreationOptional<number | null>;

  declare consent_at: CreationOptional<Date | null>;

  declare assigned_to: CreationOptional<number | null>;

  declare internal_note: CreationOptional<string | null>;

  declare status: CreationOptional<ContactStatus>;

  declare created_at: CreationOptional<Date>;
}

export function initContactModel(sequelize: Sequelize): typeof Contact {
  Contact.init(
    {
      agreed_terms_at: { type: DataTypes.DATE, allowNull: true },
      agreed_terms_version: { type: DataTypes.STRING(20), allowNull: true },
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      email: { type: DataTypes.STRING(100), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      code: { type: DataTypes.STRING(24), allowNull: true },
      topic: { type: DataTypes.STRING(50), allowNull: true },
      store_id: { type: DataTypes.INTEGER, allowNull: true },
      consent_at: { type: DataTypes.DATE, allowNull: true },
      assigned_to: { type: DataTypes.INTEGER, allowNull: true },
      internal_note: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM('moi', 'dang_xu_ly', 'da_phan_hoi'),
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
