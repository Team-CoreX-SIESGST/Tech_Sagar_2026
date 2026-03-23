import express from 'express';
import {
    registerDoctor,
    loginDoctor,
    updateDoctor,
    getDoctorMe,
    getDoctorsNearby
} from '../controllers/doctorController.js';
import { sendDoctorOtp, verifyDoctorOtp } from '../controllers/otpController.js';
import {
    getDoctorAppointments,
    getDoctorPastPatients,
    updateDoctorAppointmentStatus,
    startDoctorCall,
    addAppointmentSummary
} from '../controllers/appointmentController.js';
import { getDoctorNotifications, markNotificationRead } from '../controllers/notificationController.js';
import { protectDoctor } from '../middleware/roleAuth.js';

const router = express.Router();

router.post('/register', registerDoctor);
router.post('/login', loginDoctor);
router.post('/otp/send', sendDoctorOtp);
router.post('/otp/verify', verifyDoctorOtp);
router.put('/update', protectDoctor, updateDoctor);
router.get('/me', protectDoctor, getDoctorMe);
router.get('/nearby', getDoctorsNearby);
router.get('/appointments', protectDoctor, getDoctorAppointments);
router.get('/past-patients', protectDoctor, getDoctorPastPatients);
router.patch('/appointments/:id/status', protectDoctor, updateDoctorAppointmentStatus);
router.post('/appointments/:id/start-call', protectDoctor, startDoctorCall);
router.post('/appointments/:id/summary', protectDoctor, addAppointmentSummary);
router.get('/notifications', protectDoctor, getDoctorNotifications);
router.patch('/notifications/:id/read', protectDoctor, markNotificationRead);

export default router;
