import { Router } from 'express';
import authRoutes from './auth';
import fileRoutes from './files';
import folderRoutes from './folders';
import shareRoutes from './share';
import userRoutes from './users';
import publicFolderRoutes from './publicFolders';
import assetRoutes from './assets';

const router = Router();

// Mount auth routes
router.use('/auth', authRoutes);

// Mount file routes
router.use('/files', fileRoutes); 
router.use('/folders', folderRoutes); 
router.use('/share', shareRoutes);
router.use('/users', userRoutes);
router.use('/public/folders', publicFolderRoutes);
router.use('/assets', assetRoutes);
// router.use('/share', shareRoutes);

export default router;
