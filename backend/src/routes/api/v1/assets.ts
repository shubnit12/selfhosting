import { Router } from 'express';
import { apiKeyAuth } from '../../../middleware/apiKeyAuth';
import { uploadSingleFile, handleMulterError } from '../../../middleware/upload';
import { uploadAsset, serveAsset } from '../../../controllers/assetController';

const router = Router();

// POST /api/v1/assets/upload — requires API key, accepts any file
router.post('/upload', apiKeyAuth, uploadSingleFile, handleMulterError, uploadAsset);

// GET /api/v1/assets/:filename — public, no auth required
router.get('/:filename', serveAsset);

export default router;
