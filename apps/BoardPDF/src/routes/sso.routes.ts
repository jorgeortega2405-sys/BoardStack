import { samlAcs, samlLogin, spMetadata } from '../controllers/sso.controller.js';
import { Router } from 'express';

const router = Router();

router.get('/sso/saml/metadata', spMetadata);
router.get('/sso/saml/login', samlLogin);
router.post('/sso/saml/acs', samlAcs);

export default router;
