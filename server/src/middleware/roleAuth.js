import Patient from '../models/Patient.js';
import DoctorAccount from '../models/DoctorAccount.js';
import AshaWorkerAccount from '../models/AshaWorkerAccount.js';
import { verifyToken } from '../utils/jwt.js';

const buildProtect = (Model, role) => async (req, res, next) => {
    let token;
    // console.log(req.headers,"foiewhoifh")
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const decoded = verifyToken(token);
        if (decoded.role !== role) {
            return res.status(403).json({ message: 'Not authorized for this role' });
        }

        const user = await Model.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error(error);
        res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

export const protectPatient = buildProtect(Patient, 'patient');
export const protectDoctor = buildProtect(DoctorAccount, 'doctor');
export const protectAsha = buildProtect(AshaWorkerAccount, 'asha');
