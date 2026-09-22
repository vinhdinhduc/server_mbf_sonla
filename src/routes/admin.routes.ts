import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middlewares/auth.middleware';
import { checkRole } from '../middlewares/checkRole.middleware';
import { auditLogger } from '../middlewares/auditLogger.middleware';
import { uploadImage, uploadExcel, validateUploadedImage, validateUploadedImages } from '../config/multer';

import { userController } from '../controllers/user.controller';
import { newsController } from '../controllers/news.controller';
import { packageController } from '../controllers/package.controller';
import { simController } from '../controllers/sim.controller';
import { solutionController } from '../controllers/solution.controller';
import { storeController } from '../controllers/store.controller';
import { sliderController } from '../controllers/slider.controller';
import { newsletterController } from '../controllers/newsletter.controller';
import { shiftController } from '../controllers/shift.controller';
import { registrationController } from '../controllers/registration.controller';
import { contactController } from '../controllers/contact.controller';
import { settingController } from '../controllers/setting.controller';
import { auditLogController } from '../controllers/auditLog.controller';
import { appointmentController } from '../controllers/appointment.controller';
import { aiController } from '../controllers/ai.controller';
import { dashboardController } from '../controllers/dashboard.controller';
import { rateLimitController } from '../controllers/rateLimit.controller';
import { emailController } from '../controllers/email.controller';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';

const router = Router();

const ADMIN_ONLY = ['admin'] as const;
const CONTENT_ROLES = ['admin', 'chuyen_vien'] as const;
const REGISTRATION_ROLES = ['admin', 'giao_dich_vien', 'nhan_vien'] as const;
const DASHBOARD_ROLES = ['admin', 'chuyen_vien', 'giao_dich_vien', 'nhan_vien'] as const;
const AI_ROLES = ['admin'] as const;

// Tat ca route /api/admin/* deu di qua authMiddleware (verify JWT).
// checkRole duoc gan RIENG cho tung route theo dung ma tran phan quyen (muc 4).
router.use(authMiddleware);

router.get('/dashboard', checkRole([...DASHBOARD_ROLES]), asyncHandler(dashboardController.get));
router.get('/health', checkRole([...DASHBOARD_ROLES]), asyncHandler(dashboardController.health));
router.get('/rate-limits', checkRole([...ADMIN_ONLY]), asyncHandler(rateLimitController.list));
router.get('/rate-limits/stats', checkRole([...ADMIN_ONLY]), asyncHandler(rateLimitController.stats));
router.put('/rate-limits/policies/:key', checkRole([...ADMIN_ONLY]), auditLogger('rate_limits', 'update'), asyncHandler(rateLimitController.save));
router.post('/rate-limits/rules', checkRole([...ADMIN_ONLY]), auditLogger('rate_limits', 'create'), asyncHandler(rateLimitController.addRule));
router.delete('/rate-limits/rules/:id', checkRole([...ADMIN_ONLY]), auditLogger('rate_limits', 'delete'), asyncHandler(rateLimitController.removeRule));
router.post('/rate-limits/unblock', checkRole([...ADMIN_ONLY]), auditLogger('rate_limits', 'update'), asyncHandler(rateLimitController.unblock));
router.post('/rate-limits/reset', checkRole([...ADMIN_ONLY]), auditLogger('rate_limits', 'update'), asyncHandler(rateLimitController.reset));
router.get('/email/config', checkRole([...ADMIN_ONLY]), asyncHandler(emailController.config));
router.put('/email/config', checkRole([...ADMIN_ONLY]), auditLogger('email', 'update'), asyncHandler(emailController.saveConfig));
router.post('/email/verify', checkRole([...ADMIN_ONLY]), asyncHandler(emailController.verify));
router.post('/email/test', checkRole([...ADMIN_ONLY]), auditLogger('email', 'update'), asyncHandler(emailController.test));
router.get('/email/templates', checkRole([...ADMIN_ONLY]), asyncHandler(emailController.templates));
router.put('/email/templates/:key', checkRole([...ADMIN_ONLY]), auditLogger('email', 'update'), asyncHandler(emailController.saveTemplate));
router.get('/email/templates/:key/preview', checkRole([...ADMIN_ONLY]), asyncHandler(emailController.preview));
router.post('/email/templates/:key/restore', checkRole([...ADMIN_ONLY]), auditLogger('email', 'update'), asyncHandler(emailController.restore));
router.get('/email/logs', checkRole([...ADMIN_ONLY]), asyncHandler(emailController.logs));
router.post('/email/logs/:id/retry', checkRole([...ADMIN_ONLY]), auditLogger('email', 'update'), asyncHandler(emailController.retry));
router.get('/email/suppressions', checkRole([...ADMIN_ONLY]), asyncHandler(emailController.suppressions));
router.post('/email/suppressions', checkRole([...ADMIN_ONLY]), auditLogger('email', 'create'), asyncHandler(emailController.suppress));
router.delete('/email/suppressions', checkRole([...ADMIN_ONLY]), auditLogger('email', 'delete'), asyncHandler(emailController.unsuppress));
router.post('/media', checkRole([...CONTENT_ROLES]), uploadImage.single('image'), validateUploadedImage, (req, res) => {
  if (!req.file) throw AppError.badRequest('Thiếu ảnh tải lên');
  return sendSuccess(res, { url: `/uploads/${req.file.filename}` });
});

router.get('/ai-settings', checkRole([...AI_ROLES]), asyncHandler(aiController.getSettings));
router.put('/ai-settings', checkRole([...AI_ROLES]), asyncHandler(aiController.updateSettings));
router.post(
  '/ai-settings/test-connection',
  checkRole([...AI_ROLES]),
  asyncHandler(aiController.testConnection),
);
router.get('/ai-knowledge', checkRole([...AI_ROLES]), asyncHandler(aiController.listKnowledge));
router.post('/ai-knowledge', checkRole([...AI_ROLES]), asyncHandler(aiController.createKnowledge));
router.put(
  '/ai-knowledge/:id',
  checkRole([...AI_ROLES]),
  asyncHandler(aiController.updateKnowledge),
);
router.delete(
  '/ai-knowledge/:id',
  checkRole([...AI_ROLES]),
  asyncHandler(aiController.deleteKnowledge),
);
router.get('/ai-chat-logs', checkRole([...AI_ROLES]), asyncHandler(aiController.listLogs));
router.put('/ai-chat-logs/:id', checkRole([...AI_ROLES]), asyncHandler(aiController.updateLog));

// ============== Users - chi admin ==============
router.get('/users', checkRole([...ADMIN_ONLY]), asyncHandler(userController.list));
router.get('/users/:id', checkRole([...ADMIN_ONLY]), asyncHandler(userController.getById));
router.post(
  '/users',
  checkRole([...ADMIN_ONLY]),
  uploadImage.single('avatar'),
  validateUploadedImage,
  auditLogger('users', 'create'),
  asyncHandler(userController.create),
);
router.put(
  '/users/:id',
  checkRole([...ADMIN_ONLY]),
  uploadImage.single('avatar'),
  validateUploadedImage,
  auditLogger('users', 'update'),
  asyncHandler(userController.update),
);
router.delete(
  '/users/:id',
  checkRole([...ADMIN_ONLY]),
  auditLogger('users', 'delete'),
  asyncHandler(userController.remove),
);

// ============== News - admin & chuyen_vien ==============
router.get('/news', checkRole([...CONTENT_ROLES]), asyncHandler(newsController.listAdmin));
router.get('/news/:id', checkRole([...CONTENT_ROLES]), asyncHandler(newsController.getById));
router.post(
  '/news',
  checkRole([...CONTENT_ROLES]),
  uploadImage.single('image'),
  validateUploadedImage,
  auditLogger('news', 'create'),
  asyncHandler(newsController.create),
);
router.put(
  '/news/:id',
  checkRole([...CONTENT_ROLES]),
  uploadImage.single('image'),
  validateUploadedImage,
  auditLogger('news', 'update'),
  asyncHandler(newsController.update),
);
router.delete(
  '/news/:id',
  checkRole([...CONTENT_ROLES]),
  auditLogger('news', 'delete'),
  asyncHandler(newsController.remove),
);

// ============== Packages - admin & chuyen_vien ==============
router.get('/packages', checkRole([...CONTENT_ROLES]), asyncHandler(packageController.listAdmin));
router.get('/packages/:id', checkRole([...CONTENT_ROLES]), asyncHandler(packageController.getById));
router.post(
  '/packages',
  checkRole([...CONTENT_ROLES]),
  uploadImage.single('image'),
  validateUploadedImage,
  auditLogger('packages', 'create'),
  asyncHandler(packageController.create),
);
router.put(
  '/packages/:id',
  checkRole([...CONTENT_ROLES]),
  uploadImage.single('image'),
  validateUploadedImage,
  auditLogger('packages', 'update'),
  asyncHandler(packageController.update),
);
router.delete(
  '/packages/:id',
  checkRole([...CONTENT_ROLES]),
  auditLogger('packages', 'delete'),
  asyncHandler(packageController.remove),
);

// ============== Sims - admin & chuyen_vien ==============
router.get('/sims', checkRole([...CONTENT_ROLES]), asyncHandler(simController.listAdmin));
router.get(
  '/sims/export',
  checkRole(['admin', 'giao_dich_vien']),
  asyncHandler(simController.exportData),
);
router.get(
  '/sims/import-template',
  checkRole(['admin']),
  asyncHandler(simController.downloadImportTemplate),
);
router.get('/sims/:id', checkRole([...CONTENT_ROLES]), asyncHandler(simController.getById));
router.patch(
  '/sims/bulk-status',
  checkRole(['admin', 'giao_dich_vien']),
  auditLogger('sims', 'update'),
  asyncHandler(simController.bulkUpdateStatus),
);
router.delete(
  '/sims/bulk',
  checkRole(['admin']),
  auditLogger('sims', 'delete'),
  asyncHandler(simController.bulkRemove),
);
router.post(
  '/sims',
  checkRole([...CONTENT_ROLES]),
  auditLogger('sims', 'create'),
  asyncHandler(simController.create),
);
router.put(
  '/sims/:id',
  checkRole([...CONTENT_ROLES]),
  auditLogger('sims', 'update'),
  asyncHandler(simController.update),
);
router.delete(
  '/sims/:id',
  checkRole([...CONTENT_ROLES]),
  auditLogger('sims', 'delete'),
  asyncHandler(simController.remove),
);
router.post(
  '/sims/import/preview',
  checkRole(['admin']),
  uploadExcel.single('file'),
  asyncHandler(simController.previewImport),
);
router.post(
  '/sims/import',
  checkRole(['admin']),
  uploadExcel.single('file'),
  auditLogger('sims', 'create'),
  asyncHandler(simController.importExcel),
);

// ============== Solutions - admin & chuyen_vien ==============
router.get('/solutions', checkRole([...CONTENT_ROLES]), asyncHandler(solutionController.listAdmin));
router.get(
  '/solutions/:id',
  checkRole([...CONTENT_ROLES]),
  asyncHandler(solutionController.getById),
);
router.post(
  '/solutions',
  checkRole([...CONTENT_ROLES]),
  uploadImage.single('image'),
  validateUploadedImage,
  auditLogger('solutions', 'create'),
  asyncHandler(solutionController.create),
);
router.put(
  '/solutions/:id',
  checkRole([...CONTENT_ROLES]),
  uploadImage.single('image'),
  validateUploadedImage,
  auditLogger('solutions', 'update'),
  asyncHandler(solutionController.update),
);
router.delete(
  '/solutions/:id',
  checkRole([...CONTENT_ROLES]),
  auditLogger('solutions', 'delete'),
  asyncHandler(solutionController.remove),
);

// ============== Stores - admin & chuyen_vien ==============
router.get('/stores', checkRole(['admin']), asyncHandler(storeController.listAdmin));
router.get('/stores/geocode', checkRole(['admin']), asyncHandler(storeController.geocode));
router.get('/stores/:id', checkRole(['admin']), asyncHandler(storeController.getById));
router.post(
  '/stores',
  checkRole(['admin']),
  auditLogger('stores', 'create'),
  asyncHandler(storeController.create),
);
router.put(
  '/stores/:id',
  checkRole(['admin']),
  auditLogger('stores', 'update'),
  asyncHandler(storeController.update),
);
router.delete(
  '/stores/:id',
  checkRole(['admin']),
  auditLogger('stores', 'delete'),
  asyncHandler(storeController.remove),
);

// ============== Slider da khu vuc - admin & chuyen_vien ==============
// Zones: CHI xem & cap nhat cau hinh, KHONG tao/xoa zone (muc 5.17)
router.get(
  '/sliders/zones',
  checkRole([...CONTENT_ROLES]),
  asyncHandler(sliderController.listZones),
);
router.put(
  '/sliders/zones/:id',
  checkRole([...CONTENT_ROLES]),
  auditLogger('sliders', 'update'),
  asyncHandler(sliderController.updateZone),
);
// Items: CRUD day du tung anh-slide trong 1 zone
router.get(
  '/sliders/items',
  checkRole([...CONTENT_ROLES]),
  asyncHandler(sliderController.listItems),
);
router.post(
  '/sliders/items',
  checkRole([...CONTENT_ROLES]),
  uploadImage.fields([{ name: 'image', maxCount: 1 }, { name: 'mobile_image', maxCount: 1 }]),
  validateUploadedImages,
  auditLogger('sliders', 'create'),
  asyncHandler(sliderController.createItem),
);
router.put(
  '/sliders/items/:id',
  checkRole([...CONTENT_ROLES]),
  uploadImage.fields([{ name: 'image', maxCount: 1 }, { name: 'mobile_image', maxCount: 1 }]),
  validateUploadedImages,
  auditLogger('sliders', 'update'),
  asyncHandler(sliderController.updateItem),
);
router.delete(
  '/sliders/items/:id',
  checkRole([...CONTENT_ROLES]),
  auditLogger('sliders', 'delete'),
  asyncHandler(sliderController.removeItem),
);

// ============== Newsletter - admin & chuyen_vien, chi doc + export ==============
router.get('/newsletter', checkRole([...CONTENT_ROLES]), asyncHandler(newsletterController.list));
router.get(
  '/newsletter/export',
  checkRole([...CONTENT_ROLES]),
  asyncHandler(newsletterController.exportExcel),
);

// ============== Lich truc ==============
// CRUD lich truc - chi admin xep lich
router.get('/shifts', checkRole([...ADMIN_ONLY]), asyncHandler(shiftController.list));
router.post(
  '/shifts',
  checkRole([...ADMIN_ONLY]),
  auditLogger('shifts', 'create'),
  asyncHandler(shiftController.create),
);
router.put(
  '/shifts/:id',
  checkRole([...ADMIN_ONLY]),
  auditLogger('shifts', 'update'),
  asyncHandler(shiftController.update),
);
router.delete(
  '/shifts/:id',
  checkRole([...ADMIN_ONLY]),
  auditLogger('shifts', 'delete'),
  asyncHandler(shiftController.remove),
);
// giao_dich_vien xem lich cua chinh minh (muc 4)
router.get(
  '/shifts/my-schedule',
  checkRole(['giao_dich_vien']),
  asyncHandler(shiftController.mySchedule),
);

// ============== Xu ly nghiep vu: dang ky & lien he ==============
// admin/chuyen_vien/giao_dich_vien (toan bo), nhan_vien (chi muc duoc giao - loc them trong Service)
router.get(
  '/registration-groups',
  checkRole([...REGISTRATION_ROLES]),
  asyncHandler(registrationController.list),
);
router.get('/registration-groups/export', checkRole([...REGISTRATION_ROLES]), asyncHandler(registrationController.exportExcel));
router.get('/registration-groups/counts', checkRole([...REGISTRATION_ROLES]), asyncHandler(registrationController.counts));
router.get('/registration-groups/:id', checkRole([...REGISTRATION_ROLES]), asyncHandler(registrationController.getById));
router.get('/registration-groups/:id/receipt', checkRole([...REGISTRATION_ROLES]), asyncHandler(registrationController.receiptAdmin));
router.patch(
  '/registration-groups/:id',
  checkRole([...REGISTRATION_ROLES]),
  auditLogger('registration_groups', 'update'),
  asyncHandler(registrationController.updateStatus),
);

router.get('/contacts', checkRole([...REGISTRATION_ROLES]), asyncHandler(contactController.list));
router.patch(
  '/contacts/:id',
  checkRole([...REGISTRATION_ROLES]),
  auditLogger('contacts', 'update'),
  asyncHandler(contactController.updateStatus),
);

router.get(
  '/appointments',
  checkRole([...REGISTRATION_ROLES]),
  asyncHandler(appointmentController.list),
);
router.patch(
  '/appointments/:id',
  checkRole([...REGISTRATION_ROLES]),
  auditLogger('store_appointments', 'update'),
  asyncHandler(appointmentController.updateStatus),
);

// ============== Settings - chi admin ==============
router.get('/settings', checkRole([...ADMIN_ONLY]), asyncHandler(settingController.listAdmin));
router.put(
  '/settings',
  checkRole([...ADMIN_ONLY]),
  auditLogger('settings', 'update'),
  asyncHandler(settingController.update),
);

// ============== Audit log - chi admin, CHI DOC ==============
router.get('/audit-logs', checkRole([...ADMIN_ONLY]), asyncHandler(auditLogController.list));

export default router;
