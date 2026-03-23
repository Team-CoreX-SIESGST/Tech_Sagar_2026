import Patient from '../models/Patient.js';
import AshaWorkerAccount from '../models/AshaWorkerAccount.js';
import Appointment from '../models/Appointment.js';
import { signToken } from '../utils/jwt.js';

const generateToken = (id, role) => {
    return signToken({ id, role }, { expiresIn: '30d' });
};

const parseLocation = (locationCoordinates, latitude, longitude) => {
    const coords = locationCoordinates || { latitude, longitude };
    if (!coords) return null;
    const lat = Number(coords.latitude);
    const lng = Number(coords.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { latitude: lat, longitude: lng };
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

const pickBestAsha = (candidates) => {
    if (!candidates.length) return null;
    return candidates.reduce((best, current) => {
        if (!best) return current;
        if (current.load < best.load) return current;
        if (current.load === best.load && current.distanceKm < best.distanceKm) {
            return current;
        }
        return best;
    }, null);
};

// @desc    Register patient
// @route   POST /api/patient/register
// @access  Public
export const registerPatient = async (req, res) => {
    try {
        const { name, abhaId, phoneNumber, locationCoordinates, latitude, longitude } = req.body;
        const parsedLocation = parseLocation(locationCoordinates, latitude, longitude);

        if (!name || !abhaId || !phoneNumber || !parsedLocation) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const existing = await Patient.findOne({
            'abha_profile.healthIdNumber': abhaId
        });
        if (existing) {
            return res.status(400).json({ message: 'Patient already exists' });
        }

        const patient = await Patient.create({
            abha_profile: {
                healthIdNumber: abhaId,
                name,
                mobile: phoneNumber
            },
            locationCoordinates: parsedLocation
        });

        res.status(201).json({
            _id: patient._id,
            name: patient?.abha_profile?.name,
            abhaId: patient?.abha_profile?.healthIdNumber,
            phoneNumber: patient?.abha_profile?.mobile,
            locationCoordinates: patient.locationCoordinates,
            token: generateToken(patient._id, 'patient')
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Login patient (ABHA ID only)
// @route   POST /api/patient/login
// @access  Public
export const loginPatient = async (req, res) => {
    try {
        const { abhaId } = req.body;
        if (!abhaId) {
            return res.status(400).json({ message: 'ABHA ID is required' });
        }

        const patient = await Patient.findOne({
            'abha_profile.healthIdNumber': abhaId
        });

        if (!patient) {
            return res.status(401).json({ message: 'Invalid ABHA ID' });
        }
console.log('foiwehofhewo')
        res.json({
            _id: patient._id,
            name: patient?.abha_profile?.name,
            abhaId: patient?.abha_profile?.healthIdNumber,
            phoneNumber: patient?.abha_profile?.mobile,
            locationCoordinates: patient.locationCoordinates,
            token: generateToken(patient._id, 'patient')
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update patient profile
// @route   PUT /api/patient/update
// @access  Private
export const updatePatient = async (req, res) => {
    try {
        const updates = {};
        if (req.body.name) updates['abha_profile.name'] = req.body.name;
        if (req.body.phoneNumber) updates['abha_profile.mobile'] = req.body.phoneNumber;

        if (req.body.locationCoordinates || req.body.latitude || req.body.longitude) {
            const parsedLocation = parseLocation(
                req.body.locationCoordinates,
                req.body.latitude,
                req.body.longitude
            );
            if (!parsedLocation) {
                return res.status(400).json({ message: 'Invalid locationCoordinates' });
            }
            updates.locationCoordinates = parsedLocation;
        }

        const patient = await Patient.findByIdAndUpdate(req.user._id, updates, {
            new: true
        });

        res.json({
            _id: patient._id,
            name: patient?.abha_profile?.name,
            abhaId: patient?.abha_profile?.healthIdNumber,
            phoneNumber: patient?.abha_profile?.mobile,
            locationCoordinates: patient.locationCoordinates
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current patient profile (rich view for mobile app)
// @route   GET /api/patient/me
// @access  Private
export const getPatientMe = async (req, res) => {
    try {
        const patient = req.user;
        const abha = patient?.abha_profile || {};
        const health = patient?.health_records || {};
        const address = patient?.address || {};
        const insurance = patient?.insurance || {};
        const asha = patient?.ashaWorker || {};

        const consultations = Array.isArray(patient?.consultations)
            ? patient.consultations
            : [];
        const recent = consultations.length > 0 ? consultations[0] : null;

        const reports = consultations
            .flatMap((consultation) => consultation?.labTests || [])
            .filter((lab) => lab?.reportUrl || lab?.reportId)
            .map((lab) => ({
                reportId: lab.reportId || null,
                testName: lab.testName || 'Lab Report',
                date: lab.date || null,
                status: lab.status || null,
                impression: lab.impression || null,
                reportUrl: lab.reportUrl || null
            }));

        const appointments = await Appointment.find({ patient: req.user._id })
            .populate('doctor', 'name hospitalName')
            .sort({ createdAt: -1 });

        const appointmentHistory = appointments.map((appt) => ({
            _id: appt._id,
            doctorName: appt.doctor?.name || 'Doctor',
            hospitalName: appt.doctor?.hospitalName || null,
            appointmentType: appt.appointmentType,
            preferredDate: appt.preferredDate,
            preferredTime: appt.preferredTime,
            status: appt.status,
            summary: appt.conversationSummary || appt.aiSummary || '',
            notes: appt.conversationInsights || ''
        }));

        const fullAddressParts = [
            address.addressLine,
            address.village,
            address.subDistrict,
            address.district,
            address.state,
            address.pincode,
            address.country
        ].filter(Boolean);

        res.json({
            _id: patient._id,
            // Basic identifiers
            name: abha.firstName || abha.name || patient.name,
            abhaId: abha.healthIdNumber,
            healthId: abha.healthId,
            phoneNumber: abha.mobile,
            // Raw ABHA profile for richer client use
            abha_profile: abha,
            // Flattened health record fields used by the mobile app
            bloodGroup: health.bloodGroup || null,
            bmi: typeof health.bmi === 'number' ? health.bmi : null,
            allergies: Array.isArray(health.allergies)
                ? health.allergies.join(', ')
                : health.allergies || null,
            condition: Array.isArray(health.chronicConditions)
                ? health.chronicConditions.join(', ')
                : health.chronicConditions || null,
            // Insurance / policy
            policyNumber: insurance.policyNumber || null,
            // Local support / ASHA worker
            supportName: asha.name || null,
            supportRole: asha.village
                ? `ASHA Worker, ${asha.village}`
                : asha.name
                ? 'ASHA Worker'
                : null,
            ashaWorker: asha?.name
                ? {
                      name: asha.name,
                      contact: asha.contact || null,
                      village: asha.village || null
                  }
                : null,
            ashaWorkerId: patient.ashaWorkerId || null,
            ashaWorkerAssignedAt: patient.ashaWorkerAssignedAt || null,
            // Human readable address line
            address: fullAddressParts.length ? fullAddressParts.join(', ') : null,
            // Recent consultation summary used by the profile screen
            recentConsultation: recent
                ? {
                      doctor: recent.doctorName,
                      specialty: recent.facility,
                      status: 'Completed',
                      diagnosis: Array.isArray(recent.diagnosis)
                          ? recent.diagnosis.join(', ')
                          : recent.diagnosis,
                      followUp: recent.followUpDate
                  }
                : null,
            // Location (used for nearby search)
            locationCoordinates: patient.locationCoordinates,
            // Full health records and history
            health_records: health,
            consultations,
            reports,
            appointmentHistory
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get patients near a coordinate
// @route   GET /api/patient/nearby?latitude=..&longitude=..&radiusKm=..
// @access  Private
export const getPatientsNearby = async (req, res) => {
    try {
        const latitude = Number(req.query.latitude);
        const longitude = Number(req.query.longitude);
        const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : 10;

        if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            return res.status(400).json({ message: 'latitude and longitude are required' });
        }

        const origin = { latitude, longitude };
        const patients = await Patient.find({
            'locationCoordinates.latitude': { $ne: null },
            'locationCoordinates.longitude': { $ne: null }
        }).limit(500);

        const nearby = patients
            .map((patient) => {
                const coords = patient.locationCoordinates;
                if (!coords) return null;
                const distanceKm = haversineKm(origin, coords);
                return { patient, distanceKm };
            })
            .filter((item) => item && item.distanceKm <= radiusKm)
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .map((item) => ({
                _id: item.patient._id,
                name: item.patient?.abha_profile?.name,
                healthId: item.patient?.abha_profile?.healthId,
                healthIdNumber: item.patient?.abha_profile?.healthIdNumber,
                locationCoordinates: item.patient.locationCoordinates,
                distanceKm: Number(item.distanceKm.toFixed(2))
            }));

        res.json({ count: nearby.length, results: nearby });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    List ASHA workers (for patient connect flow)
// @route   GET /api/patient/asha/list
// @access  Private
export const listAshaWorkers = async (req, res) => {
    try {
        const ashaWorkers = await AshaWorkerAccount.find({
            'locationCoordinates.latitude': { $ne: null },
            'locationCoordinates.longitude': { $ne: null }
        })
            .select('name username locationCoordinates')
            .limit(500);

        const loadAgg = await Patient.aggregate([
            { $match: { ashaWorkerId: { $ne: null } } },
            { $group: { _id: '$ashaWorkerId', count: { $sum: 1 } } }
        ]);
        const loadMap = new Map(loadAgg.map((row) => [String(row._id), row.count]));

        const results = ashaWorkers.map((asha) => ({
            _id: asha._id,
            name: asha.name,
            username: asha.username,
            locationCoordinates: asha.locationCoordinates,
            assignedCount: loadMap.get(String(asha._id)) || 0
        }));

        res.json({ count: results.length, results });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Assign nearest ASHA worker based on current allotment
// @route   POST /api/patient/asha/assign
// @access  Private
export const assignAshaWorker = async (req, res) => {
    try {
        const patient = await Patient.findById(req.user._id);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        const coords = patient.locationCoordinates;
        if (!coords?.latitude || !coords?.longitude) {
            return res.status(400).json({ message: 'Patient location is required' });
        }

        const ashaId = req.body?.ashaId;
        let chosen = null;

        if (ashaId) {
            const asha = await AshaWorkerAccount.findById(ashaId);
            if (!asha) {
                return res.status(404).json({ message: 'ASHA worker not found' });
            }
            const distanceKm = haversineKm(coords, asha.locationCoordinates);
            const load = await Patient.countDocuments({ ashaWorkerId: asha._id });
            chosen = { asha, distanceKm, load };
        } else {
            const ashaWorkers = await AshaWorkerAccount.find({
                'locationCoordinates.latitude': { $ne: null },
                'locationCoordinates.longitude': { $ne: null }
            }).limit(500);

            if (!ashaWorkers.length) {
                return res.status(404).json({ message: 'No ASHA workers available' });
            }

            const candidates = await Promise.all(
                ashaWorkers.map(async (asha) => {
                    const distanceKm = haversineKm(coords, asha.locationCoordinates);
                    const load = await Patient.countDocuments({ ashaWorkerId: asha._id });
                    return { asha, distanceKm, load };
                })
            );

            const nearby = candidates.filter((c) => c.distanceKm <= 10);
            const pool = nearby.length ? nearby : candidates;

            chosen = pickBestAsha(pool);
            if (!chosen) {
                return res.status(404).json({ message: 'No ASHA worker found' });
            }
        }

        patient.ashaWorkerId = chosen.asha._id;
        patient.ashaWorkerAssignedAt = new Date();
        patient.ashaWorker = {
            name: chosen.asha.name,
            contact: chosen.asha.username,
            village: ''
        };
        await patient.save();

        res.json({
            ashaWorkerId: chosen.asha._id,
            ashaWorker: {
                name: chosen.asha.name,
                contact: chosen.asha.username,
                village: ''
            },
            distanceKm: Number(chosen.distanceKm.toFixed(2)),
            load: chosen.load
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
