import express from 'express';
import {
    registerAsha,
    loginAsha,
    updateAsha,
    getAshaMe,
    getAshaPatients
} from '../controllers/ashaController.js';
import { protectAsha } from '../middleware/roleAuth.js';

const router = express.Router();

router.post('/register', registerAsha);
router.post('/login', loginAsha);
router.put('/update', protectAsha, updateAsha);
router.get('/me', protectAsha, getAshaMe);
router.get('/patients', protectAsha, getAshaPatients);

export default router;
