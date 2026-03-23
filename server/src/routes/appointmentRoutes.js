import express from 'express';
import {
    createAppointment,
    getMyAppointments,
    cancelAppointment,
    structureAppointment
} from '../controllers/appointmentController.js';
import { protectPatient } from '../middleware/roleAuth.js';

const router = express.Router();

router.post('/', protectPatient, createAppointment);
router.post('/ai/structure', protectPatient, structureAppointment);
router.get('/my', protectPatient, getMyAppointments);
router.patch('/:id/cancel', protectPatient, cancelAppointment);

export default router;
