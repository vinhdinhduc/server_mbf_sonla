import {
  DataTypes,
  Model,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export type UserRole = 'admin' | 'chuyen_vien' | 'giao_dich_vien' | 'nhan_vien';
export type UserStatus = 'active' | 'locked';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;

  declare username: string;

  declare password_hash: string;

  declare full_name: string;

  declare email: string;

  declare phone: string;

  /** URL anh dai dien, duoc dung khi giao dich vien dang trong ca truc. */
  declare avatar_url: CreationOptional<string | null>;

  declare role: UserRole;

  declare status: CreationOptional<UserStatus>;

  declare created_at: CreationOptional<Date>;

  declare updated_at: CreationOptional<Date>;
}

export function initUserModel(sequelize: Sequelize): typeof User {
  User.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      username: { type: DataTypes.STRING(50), unique: true, allowNull: false },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      full_name: { type: DataTypes.STRING(100), allowNull: false },
      email: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      avatar_url: { type: DataTypes.STRING(500), allowNull: true },
      role: {
        type: DataTypes.ENUM('admin', 'chuyen_vien', 'giao_dich_vien', 'nhan_vien'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('active', 'locked'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'users',
      modelName: 'User',
      defaultScope: {
        attributes: { exclude: ['password_hash'] },
      },
      scopes: {
        withPassword: {
          attributes: { include: ['password_hash'] },
        },
      },
    },
  );
  return User;
}
