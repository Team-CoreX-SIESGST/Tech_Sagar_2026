import Notification from '../models/Notification.js';

// @desc    Get doctor notifications
// @route   GET /api/doctor/notifications
// @access  Private (Doctor)
export const getDoctorNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ doctor: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ count: notifications.length, results: notifications });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get patient notifications
// @route   GET /api/patient/notifications
// @access  Private (Patient)
export const getPatientNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ patient: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ count: notifications.length, results: notifications });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark notification read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markNotificationRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        const userId = String(req.user?._id || '');
        if (
            String(notification.doctor) !== userId &&
            String(notification.patient) !== userId
        ) {
            return res.status(403).json({ message: 'Not authorized to modify this notification' });
        }
        notification.read = true;
        await notification.save();
        res.json(notification);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
