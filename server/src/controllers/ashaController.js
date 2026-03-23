import AshaWorkerAccount from '../models/AshaWorkerAccount.js';
import Patient from '../models/Patient.js';
import { signToken } from '../utils/jwt.js';

const generateToken = (id, role) => {
    return signToken({ id, role }, { expiresIn: '30d' });
};

const parseLocation = (locationCoordinates) => {
    if (!locationCoordinates) return null;
    const { latitude, longitude } = locationCoordinates;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
    return { latitude, longitude };
};

// @desc    Register ASHA worker
// @route   POST /api/asha/register
// @access  Public
export const registerAsha = async (req, res) => {
    try {
        const { name, username, password, locationCoordinates } = req.body;
        const parsedLocation = parseLocation(locationCoordinates);

        if (!name || !username || !password || !parsedLocation) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const existing = await AshaWorkerAccount.findOne({ username: username.toLowerCase() });
        if (existing) {
            return res.status(400).json({ message: 'ASHA worker already exists' });
        }

        const asha = await AshaWorkerAccount.create({
            name,
            username,
            password,
            locationCoordinates: parsedLocation
        });

        res.status(201).json({
            _id: asha._id,
            name: asha.name,
            username: asha.username,
            locationCoordinates: asha.locationCoordinates,
            token: generateToken(asha._id, 'asha')
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Login ASHA worker
// @route   POST /api/asha/login
// @access  Public
export const loginAsha = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const asha = await AshaWorkerAccount.findOne({ username: username.toLowerCase() });
        if (asha && (await asha.matchPassword(password))) {
            return res.json({
                _id: asha._id,
                name: asha.name,
                username: asha.username,
                locationCoordinates: asha.locationCoordinates,
                token: generateToken(asha._id, 'asha')
            });
        }

        res.status(401).json({ message: 'Invalid username or password' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update ASHA worker profile
// @route   PUT /api/asha/update
// @access  Private
export const updateAsha = async (req, res) => {
    try {
        const updates = {};
        if (req.body.name) updates.name = req.body.name;

        if (req.body.locationCoordinates) {
            const parsedLocation = parseLocation(req.body.locationCoordinates);
            if (!parsedLocation) {
                return res.status(400).json({ message: 'Invalid locationCoordinates' });
            }
            updates.locationCoordinates = parsedLocation;
        }

        const asha = await AshaWorkerAccount.findByIdAndUpdate(req.user._id, updates, {
            new: true
        });

        res.json({
            _id: asha._id,
            name: asha.name,
            username: asha.username,
            locationCoordinates: asha.locationCoordinates
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current ASHA worker profile
// @route   GET /api/asha/me
// @access  Private
export const getAshaMe = async (req, res) => {
    res.json({
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
        locationCoordinates: req.user.locationCoordinates
    });
};

// @desc    Get patients assigned to ASHA worker
// @route   GET /api/asha/patients
// @access  Private
export const getAshaPatients = async (req, res) => {
    try {
        const patients = await Patient.find({ ashaWorkerId: req.user._id }).select(
            'abha_profile locationCoordinates ashaWorkerAssignedAt'
        );

        const results = patients.map((patient) => ({
            _id: patient._id,
            name: patient?.abha_profile?.name || 'Patient',
            healthIdNumber: patient?.abha_profile?.healthIdNumber || null,
            locationCoordinates: patient.locationCoordinates,
            assignedAt: patient.ashaWorkerAssignedAt || null
        }));

        res.json({ count: results.length, results });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
