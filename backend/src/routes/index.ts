import { Router } from 'express';
import v1Routes from './api/v1';

const router = Router();

// Mount v1 API routes
router.use('/v1', v1Routes);

// Future API versions:
// router.use('/v2', v2Routes);

export default router;