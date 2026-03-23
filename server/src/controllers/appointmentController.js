import Appointment from '../models/Appointment.js';
import DoctorAccount from '../models/DoctorAccount.js';
import Notification from '../models/Notification.js';
import { analyzeUrgency, structureQuery, summarizeConversation } from '../utils/gemini.js';
import { getCalendlyLink } from '../utils/callLinks.js';

// @desc    Create appointment
// @route   POST /api/appointments
// @access  Private (Patient)
export const createAppointment = async (req, res) => {
    try {
        const {
            doctorId,
            problem,
            symptoms,
            description,
            preferredDate,
            preferredTime,
            appointmentType
        } = req.body;

        if (!doctorId || !problem || !preferredDate || !preferredTime) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const doctor = await DoctorAccount.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        const aiResult = await analyzeUrgency({ symptoms, description, problem });

        const type =
            appointmentType === 'VIDEO_CALL' || appointmentType === 'AUDIO_CALL'
                ? appointmentType
                : 'OFFLINE';

        const appointment = await Appointment.create({
            patient: req.user._id,
            doctor: doctor._id,
            appointmentType: type,
            problem,
            symptoms,
            description,
            preferredDate,
            preferredTime,
            urgencyScore: Number(aiResult?.urgencyScore || 0),
            aiSummary: aiResult?.summary || '',
            structuredQuery: aiResult?.structuredQuery || ''
        });

        if (appointment.appointmentType === 'VIDEO_CALL' || appointment.appointmentType === 'AUDIO_CALL') {
            appointment.videoLink = getCalendlyLink(appointment.appointmentType);
            await appointment.save();
        }

        await Notification.create({
            doctor: doctor._id,
            patient: req.user._id,
            appointment: appointment._id,
            message: `New ${appointment.appointmentType} appointment request from patient.`
        });

        res.status(201).json(appointment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get my appointments
// @route   GET /api/appointments/my
// @access  Private (Patient)
export const getMyAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ patient: req.user._id })
            .populate('doctor', 'name username hospitalName locationCoordinates')
            .sort({ createdAt: -1 });

        const results = appointments.map((appt) => ({
            _id: appt._id,
            doctor: appt.doctor,
            appointmentType: appt.appointmentType,
            problem: appt.problem,
            symptoms: appt.symptoms,
            description: appt.description,
            preferredDate: appt.preferredDate,
            preferredTime: appt.preferredTime,
            status: appt.status,
            videoLink: appt.videoLink
        }));

        res.json({ count: results.length, results });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cancel appointment
// @route   PATCH /api/appointments/:id/cancel
// @access  Private (Patient)
export const cancelAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findOne({
            _id: req.params.id,
            patient: req.user._id
        });

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        appointment.status = 'CANCELLED';
        await appointment.save();

        res.json(appointment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Use AI to structure complaint and urgency
// @route   POST /api/appointments/ai/structure
// @access  Private (Patient)
export const structureAppointment = async (req, res) => {
    try {
        const { problem, symptoms, description } = req.body;
        const ai = await structureQuery({ problem, symptoms, description });
        res.json({
            structuredQuery: ai?.structuredQuery || '',
            summary: ai?.summary || '',
            urgencyScore: Number(ai?.urgencyScore || 0)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Doctor view appointments
// @route   GET /api/doctor/appointments
// @access  Private (Doctor)
export const getDoctorAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ doctor: req.user._id })
            .populate('patient', 'abha_profile locationCoordinates')
            .sort({ createdAt: -1 });

        res.json({ count: appointments.length, results: appointments });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Doctor view past patients (completed appointments)
// @route   GET /api/doctor/past-patients
// @access  Private (Doctor)
export const getDoctorPastPatients = async (req, res) => {
    try {
        const appointments = await Appointment.find({
            doctor: req.user._id,
            status: 'COMPLETED'
        })
            .populate('patient', 'abha_profile locationCoordinates')
            .sort({ createdAt: -1 });

        res.json({ count: appointments.length, results: appointments });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Doctor update appointment status
// @route   PATCH /api/doctor/appointments/:id/status
// @access  Private (Doctor)
export const updateDoctorAppointmentStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ['BOOKED', 'IN_CALL', 'COMPLETED', 'CANCELLED'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const appointment = await Appointment.findOne({
            _id: req.params.id,
            doctor: req.user._id
        });
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        appointment.status = status;
        await appointment.save();
        res.json(appointment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Doctor start call
// @route   POST /api/doctor/appointments/:id/start-call
// @access  Private (Doctor)
export const startDoctorCall = async (req, res) => {
    try {
        const { callType } = req.body || {};
        const appointment = await Appointment.findOne({
            _id: req.params.id,
            doctor: req.user._id
        });
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        const nextType =
            callType === 'AUDIO_CALL' || callType === 'VIDEO_CALL'
                ? callType
                : appointment.appointmentType;

        if (nextType === 'VIDEO_CALL' || nextType === 'AUDIO_CALL') {
            appointment.videoLink = getCalendlyLink(nextType);
            appointment.appointmentType = nextType;
        }

        appointment.status = 'IN_CALL';
        await appointment.save();

        const io = req.app.get('io');
        const userSocketMap = req.app.get('userSocketMap');
        if (io && userSocketMap) {
            const patientSocketId = userSocketMap.get(String(appointment.patient));
            if (patientSocketId) {
                io.to(patientSocketId).emit('incoming-call', {
                    roomId: String(appointment._id),
                    appointmentId: String(appointment._id),
                    fromRole: 'doctor',
                    fromName: req.user?.name || 'Doctor',
                    callType: appointment.appointmentType,
                    videoLink: appointment.videoLink
                });
            }
        }

        res.json({ videoLink: appointment.videoLink, status: appointment.status });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Doctor add conversation summary with AI
// @route   POST /api/doctor/appointments/:id/summary
// @access  Private (Doctor)
export const addAppointmentSummary = async (req, res) => {
    try {
        const { transcript, notes } = req.body;
        const appointment = await Appointment.findOne({
            _id: req.params.id,
            doctor: req.user._id
        });
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        const ai = await summarizeConversation({ transcript, notes });
        appointment.conversationTranscript = transcript || '';
        appointment.conversationSummary = ai?.summary || '';
        appointment.conversationInsights = ai?.insights || '';
        await appointment.save();

        res.json({
            conversationSummary: appointment.conversationSummary,
            conversationInsights: appointment.conversationInsights
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
