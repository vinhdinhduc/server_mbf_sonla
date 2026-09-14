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

const router = Router();

router.get('/news', asyncHandler(newsController.listPublic));
router.get('/news/:slug', asyncHandler(newsController.getPublicBySlug));

router.get('/packages', asyncHandler(packageController.listPublic));
router.get('/packages/:slug', asyncHandler(packageController.getPublicBySlug));

router.get('/sims', asyncHandler(simController.listPublic));
router.get('/sims/:id', asyncHandler(simController.getPublicById));

router.get('/solutions', asyncHandler(solutionController.listPublic));
router.get('/solutions/:slug', asyncHandler(solutionController.getPublicBySlug));

router.get('/stores', asyncHandler(storeController.listPublic));

router.get('/search', asyncHandler(searchController.search));

router.get('/sliders/:zoneCode', asyncHandler(sliderController.getPublicByZoneCode));

router.get('/current-duty-staff', asyncHandler(shiftController.currentDutyStaff));

router.post('/appointments', asyncHandler(appointmentController.create));

router.post('/newsletter/subscribe', asyncHandler(newsletterController.subscribe));

router.post('/registrations', asyncHandler(registrationController.submit));

router.post('/contacts', asyncHandler(contactController.create));

router.get('/settings', asyncHandler(settingController.listPublic));

router.post('/chatbot/message', asyncHandler(chatbotController.message));

export default router;
