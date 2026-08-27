import { sequelize } from '../config/database';
import { initUserModel, User } from './User.model';
import { initNewsModel, News } from './News.model';
import { initPackageModel, Package } from './Package.model';
import { initSimNumberModel, SimNumber } from './SimNumber.model';
import { initSolutionModel, Solution } from './Solution.model';
import { initStoreModel, Store } from './Store.model';
import { initRegistrationGroupModel, RegistrationGroup } from './RegistrationGroup.model';
import { initRegistrationItemModel, RegistrationItem } from './RegistrationItem.model';
import { initContactModel, Contact } from './Contact.model';
import { initSettingModel, Setting } from './Setting.model';
import { initAuditLogModel, AuditLog } from './AuditLog.model';
import { initAiChatLogModel, AiChatLog } from './AiChatLog.model';
import { initSliderZoneModel, SliderZone } from './SliderZone.model';
import { initSliderItemModel, SliderItem } from './SliderItem.model';
import { initNewsletterSubscriberModel, NewsletterSubscriber } from './NewsletterSubscriber.model';
import { initWorkShiftModel, WorkShift } from './WorkShift.model';

// 1. Khoi tao tat ca model tren cung 1 Sequelize instance
initUserModel(sequelize);
initNewsModel(sequelize);
initPackageModel(sequelize);
initSimNumberModel(sequelize);
initSolutionModel(sequelize);
initStoreModel(sequelize);
initRegistrationGroupModel(sequelize);
initRegistrationItemModel(sequelize);
initContactModel(sequelize);
initSettingModel(sequelize);
initAuditLogModel(sequelize);
initAiChatLogModel(sequelize);
initSliderZoneModel(sequelize);
initSliderItemModel(sequelize);
initNewsletterSubscriberModel(sequelize);
initWorkShiftModel(sequelize);

// 2. Khai bao association (hasMany / belongsTo) dung theo muc 5.17

// registration_groups 1—N registration_items
RegistrationGroup.hasMany(RegistrationItem, {
  foreignKey: 'registration_group_id',
  as: 'items',
});
RegistrationItem.belongsTo(RegistrationGroup, {
  foreignKey: 'registration_group_id',
  as: 'registrationGroup',
});

// slider_zones 1—N slider_items
SliderZone.hasMany(SliderItem, { foreignKey: 'zone_id', as: 'items' });
SliderItem.belongsTo(SliderZone, { foreignKey: 'zone_id', as: 'zone' });

// news.author_id -> users.id
User.hasMany(News, { foreignKey: 'author_id', as: 'newsList' });
News.belongsTo(User, { foreignKey: 'author_id', as: 'author' });

// registration_groups.assigned_to -> users.id
User.hasMany(RegistrationGroup, { foreignKey: 'assigned_to', as: 'assignedRegistrations' });
RegistrationGroup.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });

// settings.updated_by -> users.id
User.hasMany(Setting, { foreignKey: 'updated_by', as: 'updatedSettings' });
Setting.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

// audit_logs.user_id -> users.id
User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// work_shifts.user_id -> users.id (phai la role giao_dich_vien, kiem tra o Service)
User.hasMany(WorkShift, { foreignKey: 'user_id', as: 'shifts' });
WorkShift.belongsTo(User, { foreignKey: 'user_id', as: 'staff' });

// work_shifts.created_by -> users.id (admin nao xep lich)
User.hasMany(WorkShift, { foreignKey: 'created_by', as: 'createdShifts' });
WorkShift.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

export {
  sequelize,
  User,
  News,
  Package,
  SimNumber,
  Solution,
  Store,
  RegistrationGroup,
  RegistrationItem,
  Contact,
  Setting,
  AuditLog,
  AiChatLog,
  SliderZone,
  SliderItem,
  NewsletterSubscriber,
  WorkShift,
};
