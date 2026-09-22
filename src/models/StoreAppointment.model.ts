import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize,
} from 'sequelize';
import { Store } from './Store.model';
import { User } from './User.model';

export type AppointmentStatus = 'moi' | 'dang_xu_ly' | 'hoan_thanh' | 'huy';

export class StoreAppointment extends Model<
  InferAttributes<StoreAppointment>,
  InferCreationAttributes<StoreAppointment>
> {
  declare id: CreationOptional<number>;
  declare customer_name: string;
  declare phone: string;
  declare email: CreationOptional<string | null>;
  declare store_id: number;
  declare appointment_date: string;
  declare appointment_time: string;
  declare note: CreationOptional<string | null>;
  declare status: CreationOptional<AppointmentStatus>;
  declare assigned_to: CreationOptional<number | null>;
  declare created_at: CreationOptional<Date>;
  declare store?: NonAttribute<Store>;
  declare assignee?: NonAttribute<User>;
}

export function initStoreAppointmentModel(sequelize: Sequelize): typeof StoreAppointment {
  StoreAppointment.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      customer_name: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      email: { type: DataTypes.STRING(150), allowNull: true },
      store_id: { type: DataTypes.INTEGER, allowNull: false },
      appointment_date: { type: DataTypes.DATEONLY, allowNull: false },
      appointment_time: { type: DataTypes.TIME, allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM('moi', 'dang_xu_ly', 'hoan_thanh', 'huy'),
        allowNull: false,
        defaultValue: 'moi',
      },
      assigned_to: { type: DataTypes.INTEGER, allowNull: true },
      created_at: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'store_appointments',
      modelName: 'StoreAppointment',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    },
  );
  return StoreAppointment;
}
