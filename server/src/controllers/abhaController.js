import cloudinary from '../config/cloudinary.js';
import Patient from '../models/Patient.js';

const uploadToCloudinary = (buffer, filename) =>
    new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'abha-cards',
                resource_type: 'image',
                public_id: filename ? filename.replace(/\.[^/.]+$/, '') : undefined
            },
            (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(result);
            }
        );
        uploadStream.end(buffer);
    });

const formatAbhaId = (digits) => {
    if (!digits || digits.length !== 14) return null;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
};

const extractAbhaId = (text = '') => {
    const sanitized = text.replace(/[^0-9]/g, '');
    const match = sanitized.match(/\d{14}/);
    if (!match) return null;
    return formatAbhaId(match[0]);
};

const GEMINI_MODEL = process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash-lite';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const getGeminiKey = () =>
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY2 ||
    process.env.GEMINI_API_KEY3 ||
    '';

const parseGeminiText = (data) => {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('\n')
        .trim();
};

const extractAbhaIdWithGemini = async (buffer, mimeType) => {
    const apiKey = getGeminiKey();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const inlineData = {
        mimeType: mimeType || 'image/jpeg',
        data: buffer.toString('base64')
    };

    const prompt = [
        'You are an OCR system for ABHA cards.',
        'Extract the ABHA ID from the image.',
        'Return ONLY the ABHA ID in the format XX-XXXX-XXXX-XXXX.',
        'If not found, return ONLY the word NONE.'
    ].join(' ');

    const body = {
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }, { inlineData }]
            }
        ],
        generationConfig: {
            temperature: 0,
            maxOutputTokens: 64
        }
    };

    const response = await fetch(
        `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.error?.message || response.statusText;
        throw new Error(message || 'Gemini OCR failed');
    }

    const text = parseGeminiText(data);
    if (!text || text.toUpperCase().includes('NONE')) {
        return { abhaId: null, text };
    }

    const abhaId = extractAbhaId(text);
    return { abhaId, text };
};

// @desc    OCR ABHA ID from uploaded card and store image in Cloudinary
// @route   POST /api/patient/abha/ocr
// @access  Public
export const ocrAbhaCard = async (req, res) => {
    try {
        if (!req.file?.buffer) {
            return res.status(400).json({ message: 'ABHA card image is required' });
        }

        if (
            !process.env.CLOUDINARY_CLOUD_NAME ||
            !process.env.CLOUDINARY_API_KEY ||
            !process.env.CLOUDINARY_API_SECRET
        ) {
            return res.status(500).json({ message: 'Cloudinary is not configured' });
        }

        const uploadResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
        const { abhaId } = await extractAbhaIdWithGemini(
            req.file.buffer,
            req.file.mimetype
        );

        let patientUpdated = false;

        if (abhaId) {
            const updated = await Patient.updateOne(
                { 'abha_profile.healthIdNumber': abhaId },
                { $set: { 'abha_profile.abha_id_card': uploadResult.secure_url } }
            );
            patientUpdated = Boolean(updated?.modifiedCount);
        }

        return res.json({
            abhaId,
            imageUrl: uploadResult.secure_url,
            patientUpdated
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
