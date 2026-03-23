import DoctorAccount from '../models/DoctorAccount.js';
import { signToken } from '../utils/jwt.js';

const generateToken = (id, role) => {
    return signToken({ id, role }, { expiresIn: '30d' });
};

const normalizePhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.length > 10 ? digits.slice(-10) : digits;
};

const parseLocation = (locationCoordinates) => {
    if (!locationCoordinates) return null;
    const { latitude, longitude } = locationCoordinates;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
    return { latitude, longitude };
};

const toRad = (value) => (value * Math.PI) / 180;
const haversineKm = (a, b) => {
    const R = 6371;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

// @desc    Register doctor
// @route   POST /api/doctor/register
// @access  Public
export const registerDoctor = async (req, res) => {
    try {
        const {
            name,
            username,
            password,
            hospitalName,
            locationCoordinates,
            phoneNumber,
            specialization,
            qualification,
            registrationId,
            experienceYears,
            about,
            languages,
            availability
        } = req.body;
        const parsedLocation = parseLocation(locationCoordinates);

        if (!name || !username || !password || !hospitalName || !parsedLocation) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const existing = await DoctorAccount.findOne({ username: username.toLowerCase() });
        if (existing) {
            return res.status(400).json({ message: 'Doctor already exists' });
        }

        const doctor = await DoctorAccount.create({
            name,
            username,
            password,
            phoneNumber: normalizePhone(phoneNumber) || undefined,
            specialization,
            qualification,
            registrationId,
            experienceYears,
            about,
            languages,
            availability,
            hospitalName,
            locationCoordinates: parsedLocation
        });

        res.status(201).json({
            _id: doctor._id,
            name: doctor.name,
            username: doctor.username,
            phoneNumber: doctor.phoneNumber,
            specialization: doctor.specialization,
            qualification: doctor.qualification,
            registrationId: doctor.registrationId,
            experienceYears: doctor.experienceYears,
            about: doctor.about,
            languages: doctor.languages,
            availability: doctor.availability,
            hospitalName: doctor.hospitalName,
            locationCoordinates: doctor.locationCoordinates,
            token: generateToken(doctor._id, 'doctor')
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Login doctor
// @route   POST /api/doctor/login
// @access  Public
export const loginDoctor = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const doctor = await DoctorAccount.findOne({ username: username.toLowerCase() });
        if (doctor && (await doctor.matchPassword(password))) {
            return res.json({
            _id: doctor._id,
            name: doctor.name,
            username: doctor.username,
            phoneNumber: doctor.phoneNumber,
            specialization: doctor.specialization,
            qualification: doctor.qualification,
            registrationId: doctor.registrationId,
            experienceYears: doctor.experienceYears,
            about: doctor.about,
            languages: doctor.languages,
            availability: doctor.availability,
            hospitalName: doctor.hospitalName,
            locationCoordinates: doctor.locationCoordinates,
            token: generateToken(doctor._id, 'doctor')
        });
        }

        res.status(401).json({ message: 'Invalid username or password' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update doctor profile
// @route   PUT /api/doctor/update
// @access  Private
export const updateDoctor = async (req, res) => {
    try {
        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        if (req.body.hospitalName) updates.hospitalName = req.body.hospitalName;
        if (req.body.specialization) updates.specialization = req.body.specialization;
        if (req.body.qualification) updates.qualification = req.body.qualification;
        if (req.body.registrationId) updates.registrationId = req.body.registrationId;
        if (typeof req.body.experienceYears === 'number') {
            updates.experienceYears = req.body.experienceYears;
        }
        if (req.body.about) updates.about = req.body.about;
        if (Array.isArray(req.body.languages)) updates.languages = req.body.languages;
        if (req.body.availability) updates.availability = req.body.availability;

        if (req.body.locationCoordinates) {
            const parsedLocation = parseLocation(req.body.locationCoordinates);
            if (!parsedLocation) {
                return res.status(400).json({ message: 'Invalid locationCoordinates' });
            }
            updates.locationCoordinates = parsedLocation;
        }

        const doctor = await DoctorAccount.findByIdAndUpdate(req.user._id, updates, {
            new: true
        });

        res.json({
            _id: doctor._id,
            name: doctor.name,
            username: doctor.username,
            phoneNumber: doctor.phoneNumber,
            specialization: doctor.specialization,
            qualification: doctor.qualification,
            registrationId: doctor.registrationId,
            experienceYears: doctor.experienceYears,
            about: doctor.about,
            languages: doctor.languages,
            availability: doctor.availability,
            hospitalName: doctor.hospitalName,
            locationCoordinates: doctor.locationCoordinates
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current doctor profile
// @route   GET /api/doctor/me
// @access  Private
export const getDoctorMe = async (req, res) => {
    res.json({
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
        phoneNumber: req.user.phoneNumber,
        specialization: req.user.specialization,
        qualification: req.user.qualification,
        registrationId: req.user.registrationId,
        experienceYears: req.user.experienceYears,
        about: req.user.about,
        languages: req.user.languages,
        availability: req.user.availability,
        hospitalName: req.user.hospitalName,
        locationCoordinates: req.user.locationCoordinates
    });
};

// @desc    Get doctors near a coordinate
// @route   GET /api/doctor/nearby?latitude=..&longitude=..&radiusKm=..
// @access  Public
export const getDoctorsNearby = async (req, res) => {
    try {
        const latitude = Number(req.query.latitude);
        const longitude = Number(req.query.longitude);
        const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : 10;

        if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            return res.status(400).json({ message: 'latitude and longitude are required' });
        }

        const origin = { latitude, longitude };
        const doctors = await DoctorAccount.find({
            'locationCoordinates.latitude': { $ne: null },
            'locationCoordinates.longitude': { $ne: null }
        }).select('-password');

        const nearby = doctors
            .map((doctor) => {
                const coords = doctor.locationCoordinates;
                if (!coords) return null;
                const distanceKm = haversineKm(origin, coords);
                return { doctor, distanceKm };
            })
            .filter((item) => item && item.distanceKm <= radiusKm)
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .map((item) => ({
                _id: item.doctor._id,
                name: item.doctor.name,
                username: item.doctor.username,
                phoneNumber: item.doctor.phoneNumber,
                specialization: item.doctor.specialization,
                experienceYears: item.doctor.experienceYears,
                availability: item.doctor.availability,
                languages: item.doctor.languages || [],
                hospitalName: item.doctor.hospitalName,
                locationCoordinates: item.doctor.locationCoordinates,
                availableSlots: item.doctor.availableSlots || [],
                distanceKm: Number(item.distanceKm.toFixed(2))
            }));

        res.json({ count: nearby.length, results: nearby });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
