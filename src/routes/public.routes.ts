import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { newsController } from '../controllers/news.controller';
import { packageController } from '../controllers/package.controller';
import { simController } from '../controllers/sim.controller';
import { solutionController } from '../controllers/solution.controller';
import { storeController } from '../controllers/store.controller';
import { searchController } from '../controllers/search.controller';
import { sliderController } from '../controllers/slider.controller';
import { shiftController } from '../controllers/shift.controller';
import { newsletterController } from '../controllers/newsletter.controller';
import { registrationController } from '../controllers/registration.controller';
import { contactController } from '../controllers/contact.controller';
import { settingController } from '../controllers/setting.controller';
import { chatbotController } from '../controllers/chatbot.controller';
import { appointmentController } from '../controllers/appointment.controller';
import { aiRateLimit } from '../middlewares/aiRateLimit.middleware';
import { jobController } from '../controllers/job.controller';
import { uploadCv, validateUploadedCv } from '../config/multer';
import { utilityController } from '../controllers/utility.controller';

const router = Router();

router.get('/news', asyncHandler(newsController.listPublic));
router.get('/news-featured', asyncHandler(newsController.featured));
router.get('/news-preview/:token', asyncHandler(newsController.preview));
router.post('/news/:slug/view', asyncHandler(newsController.view));
router.get('/news/:slug', asyncHandler(newsController.getPublicBySlug));

router.get('/packages', asyncHandler(packageController.listPublic));
router.get('/packages/:slug', asyncHandler(packageController.getPublicBySlug));

router.get('/sims', asyncHandler(simController.listPublic));
router.get('/sims/:id', asyncHandler(simController.getPublicById));

router.get('/solutions', asyncHandler(solutionController.listPublic));
router.get('/solutions/:slug', asyncHandler(solutionController.getPublicBySlug));

router.get('/stores', asyncHandler(storeController.listPublic));
router.get('/wards', asyncHandler(storeController.listWards));

router.get('/search', asyncHandler(searchController.search));

router.get('/sliders/:zoneCode', asyncHandler(sliderController.getPublicByZoneCode));

router.get('/current-duty-staff', asyncHandler(shiftController.currentDutyStaff));

router.post('/appointments', asyncHandler(appointmentController.create));
router.get('/appointments/slots', asyncHandler(appointmentController.slots));
router.get('/appointments/manage', asyncHandler(appointmentController.manage));
router.post('/appointments/cancel', asyncHandler(appointmentController.cancel));
router.post('/appointments/reschedule', asyncHandler(appointmentController.reschedule));
router.get('/appointments/calendar.ics', asyncHandler(appointmentController.ics));

router.post('/newsletter/subscribe', asyncHandler(newsletterController.subscribe));
router.get('/newsletter/confirm', asyncHandler(newsletterController.confirm));
router.get('/newsletter/unsubscribe', asyncHandler(newsletterController.unsubscribe));

router.post('/registrations', asyncHandler(registrationController.submit));
router.post('/registrations/lookup', asyncHandler(registrationController.lookup));
router.post('/registrations/receipt', asyncHandler(registrationController.receiptPublic));

router.post('/contacts', asyncHandler(contactController.create));
router.get('/jobs', asyncHandler(jobController.listPublic));
router.get('/jobs/:slug', asyncHandler(jobController.detail));
router.post(
  '/job-applications',
  uploadCv.single('cv'),
  validateUploadedCv,
  asyncHandler(jobController.apply),
);
router.get('/utilities', asyncHandler(utilityController.list));
router.get('/utilities/:id/qr/:platform', asyncHandler(utilityController.qr));
router.get('/utilities/:slug', asyncHandler(utilityController.detail));
router.get('/downloads', asyncHandler(utilityController.downloads));
router.get('/downloads/:id/file', asyncHandler(utilityController.track));

router.get('/settings', asyncHandler(settingController.listPublic));

router.post('/chatbot/message', aiRateLimit, asyncHandler(chatbotController.message));
router.post('/chat', aiRateLimit, asyncHandler(chatbotController.message));

export default router;
