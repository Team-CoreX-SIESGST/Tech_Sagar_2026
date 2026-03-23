import dotenv from 'dotenv';
dotenv.config();

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY2;
const GROQ_KEY = process.env.GROQ_KEY;

// Simple in-memory cache to reduce API calls
const medicineCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(medicineName, genericName) {
  return `${medicineName.toLowerCase()}-${genericName?.toLowerCase() || ''}`;
}

function getCachedResponse(key) {
  const cached = medicineCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedResponse(key, data) {
  medicineCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// Basic medicine information fallback for common medicines
function getBasicMedicineInfo(medicineName) {
  const basicInfo = {
    paracetamol: {
      description: "Paracetamol is a common pain reliever and fever reducer.",
      primaryUses: ["Pain relief", "Fever reduction"],
      commonSideEffects: ["Rare at recommended doses"],
      genericAlternatives: [{"name": "Acetaminophen", "note": "Same active ingredient"}],
      otcAvailable: true,
      warningNote: "Do not exceed recommended dosage."
    },
    aspirin: {
      description: "Aspirin is a nonsteroidal anti-inflammatory drug (NSAID).",
      primaryUses: ["Pain relief", "Fever reduction", "Blood thinning"],
      commonSideEffects: ["Stomach upset", "Increased bleeding risk"],
      genericAlternatives: [{"name": "Acetylsalicylic acid", "note": "Same active ingredient"}],
      otcAvailable: true,
      warningNote: "Consult doctor before long-term use."
    },
    ibuprofen: {
      description: "Ibuprofen is a nonsteroidal anti-inflammatory drug (NSAID).",
      primaryUses: ["Pain relief", "Fever reduction", "Inflammation reduction"],
      commonSideEffects: ["Stomach upset", "Heartburn", "Dizziness"],
      genericAlternatives: [],
      otcAvailable: true,
      warningNote: "Take with food to reduce stomach upset."
    }
  };
  
  return basicInfo[medicineName.toLowerCase()] || null;
}

// Critical drug interactions database
const CRITICAL_INTERACTIONS = {
  // Blood thinners + NSAIDs = High bleeding risk
  'warfarin-ibuprofen': {
    severity: 'HIGH',
    description: 'Dangerous bleeding risk',
    recommendation: 'Avoid this combination. Consult doctor immediately.',
    alternatives: ['Acetaminophen for pain relief']
  },
  'warfarin-aspirin': {
    severity: 'HIGH', 
    description: 'Major bleeding risk',
    recommendation: 'Only under medical supervision',
    alternatives: ['Acetaminophen', 'Topical pain relief']
  },
  'clopidogrel-ibuprofen': {
    severity: 'HIGH',
    description: 'Increased bleeding risk',
    recommendation: 'Avoid combination',
    alternatives: ['Acetaminophen']
  },
  
  // SSRIs + NSAIDs = Bleeding risk
  'fluoxetine-ibuprofen': {
    severity: 'MODERATE',
    description: 'Increased bleeding risk',
    recommendation: 'Use with caution, monitor for bleeding',
    alternatives: ['Acetaminophen']
  },
  'sertraline-aspirin': {
    severity: 'MODERATE',
    description: 'Bleeding risk increased',
    recommendation: 'Consult doctor before use',
    alternatives: ['Acetaminophen']
  },
  
  // Statins + Certain antibiotics
  'atorvastatin-clarithromycin': {
    severity: 'HIGH',
    description: 'Muscle damage risk',
    recommendation: 'Avoid combination, dangerous',
    alternatives: ['Other antibiotics like azithromycin']
  },
  'simvastatin-erythromycin': {
    severity: 'HIGH',
    description: 'Rhabdomyolysis risk',
    recommendation: 'Do not combine',
    alternatives: ['Alternative antibiotics']
  },
  
  // ACE inhibitors + Potassium supplements
  'lisinopril-potassium': {
    severity: 'HIGH',
    description: 'Dangerous potassium levels',
    recommendation: 'Life-threatening hyperkalemia risk',
    alternatives: ['Monitor potassium closely']
  },
  
  // Alcohol + Metformin
  'metformin-alcohol': {
    severity: 'MODERATE',
    description: 'Lactic acidosis risk',
    recommendation: 'Limit alcohol intake',
    alternatives: ['Avoid alcohol completely']
  },
  
  // Multiple NSAIDs
  'ibuprofen-aspirin': {
    severity: 'MODERATE',
    description: 'Stomach ulcer risk',
    recommendation: 'Avoid combining NSAIDs',
    alternatives: ['Use only one NSAID at a time']
  },
  'ibuprofen-naproxen': {
    severity: 'MODERATE',
    description: 'GI bleeding risk increased',
    recommendation: 'Do not combine',
    alternatives: ['Single NSAID only']
  }
};

/**
 * Check for dangerous drug interactions using database + AI
 */
async function checkDrugInteractions(medicines) {
  const interactions = [];
  const medicineNames = medicines.map(m => m.toLowerCase().trim());
  
  // Check database interactions
  for (let i = 0; i < medicineNames.length; i++) {
    for (let j = i + 1; j < medicineNames.length; j++) {
      const combo1 = `${medicineNames[i]}-${medicineNames[j]}`;
      const combo2 = `${medicineNames[j]}-${medicineNames[i]}`;
      
      const interaction = CRITICAL_INTERACTIONS[combo1] || CRITICAL_INTERACTIONS[combo2];
      if (interaction) {
        interactions.push({
          medicine1: medicines[i],
          medicine2: medicines[j],
          ...interaction
        });
      }
    }
  }
  
  // Use AI to detect additional interactions
  if (GROQ_KEY && interactions.length === 0) {
    try {
      const prompt = `Check for drug interactions between these medicines: ${medicines.join(', ')}. 
      Respond ONLY with JSON array of interactions. Format:
      [{"medicine1":"drug1","medicine2":"drug2","severity":"HIGH/MODERATE/LOW","description":"brief description","recommendation":"action advice"}]`;
      
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 512,
        }),
      });
      
      if (resp.ok) {
        const data = await resp.json();
        const aiInteractions = JSON.parse(data?.choices?.[0]?.message?.content || '[]');
        interactions.push(...aiInteractions);
      }
    } catch (error) {
      console.log('AI interaction check failed:', error.message);
    }
  }
  
  return interactions;
}

/**
 * Uses Groq to generate structured medicine info:
 * description, uses, sideEffects, genericAlternatives[], otcAvailable
 */
async function askGroq(medicineName, genericName) {
  const prompt = `For medicine "${medicineName}" (generic: "${genericName}"), respond ONLY with this JSON:
{
  "description": "Brief one-sentence description",
  "primaryUses": ["Use 1", "Use 2"],
  "commonSideEffects": ["Side 1", "Side 2"],
  "genericAlternatives": [
    {"name": "Generic name", "note": "Brief note"}
  ],
  "otcAvailable": true,
  "warningNote": "One warning or null"
}
Return ONLY valid JSON, no markdown.`;

  const resp = await fetch(
    `https://api.groq.com/openai/v1/chat/completions`,
    {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1024,
      }),
    }
  );

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    if (resp.status === 429) {
      const retryAfter = errorData.error?.details?.[0]?.retryDelay?.seconds || '60';
      throw new Error(`Rate limit exceeded. Please try again in ${retryAfter} seconds.`);
    }
    throw new Error(`Groq API error: ${resp.status} - ${errorData.error?.message || resp.statusText}`);
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  // Strip any markdown code fences
  let clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // Handle truncated JSON responses by attempting to fix common issues
  if (clean && !clean.endsWith('}')) {
    // Try to find the last complete object or array
    const lastBraceIndex = clean.lastIndexOf('}');
    const lastBracketIndex = clean.lastIndexOf(']');
    
    if (lastBraceIndex > lastBracketIndex && lastBraceIndex > 0) {
      clean = clean.substring(0, lastBraceIndex + 1);
    } else if (lastBracketIndex > lastBraceIndex && lastBracketIndex > 0) {
      clean = clean.substring(0, lastBracketIndex + 1);
    }
  }
  
  // Validate that we have content before parsing
  if (!clean) {
    throw new Error('Empty response from Groq API');
  }
  
  try {
    return JSON.parse(clean);
  } catch (parseError) {
    console.error('JSON parse error:', parseError.message);
    console.error('Raw response:', raw);
    console.error('Cleaned response:', clean);
    throw new Error('Invalid JSON response from Groq API');
  }
}

/**
 * Get medicine image URL from multiple sources
 */
async function getMedicineImage(medicineName) {
  try {
    // First try FDA API for drug information
    const encoded = encodeURIComponent(medicineName.split(' ')[0]);
    const fdaUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encoded}"&limit=1`;
    const fdaResp = await fetch(fdaUrl);
    const fdaData = await fdaResp.json();
    
    if (fdaData?.results?.length) {
      // FDA doesn't provide images, but we can use the drug info to construct better image searches
      console.log('FDA data found for', medicineName);
    }
  } catch (error) {
    console.log('FDA API failed:', error.message);
  }

  // Try Google Custom Search API for images (we have the credentials)
  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
    try {
      const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(medicineName + ' medicine pill tablet')}&searchType=image&num=1&safe=active`;
      const googleResp = await fetch(googleUrl);
      const googleData = await googleResp.json();
      
      if (googleData?.items?.length > 0) {
        return googleData.items[0].link;
      }
    } catch (error) {
      console.log('Google Custom Search API failed:', error.message);
    }
  }

  // Try Pixabay API (free, requires API key)
  if (process.env.PIXABAY_API_KEY) {
    try {
      const pixabayUrl = `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(medicineName + ' medicine pill')}&image_type=photo&per_page=3`;
      const pixabayResp = await fetch(pixabayUrl);
      const pixabayData = await pixabayResp.json();
      
      if (pixabayData?.hits?.length > 0) {
        return pixabayData.hits[0].webformatURL;
      }
    } catch (error) {
      console.log('Pixabay API failed:', error.message);
    }
  }

  // Try Unsplash API (free, requires API key)
  if (process.env.UNSPLASH_ACCESS_KEY) {
    try {
      const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(medicineName + ' medicine')}&client_id=${process.env.UNSPLASH_ACCESS_KEY}&per_page=1`;
      const unsplashResp = await fetch(unsplashUrl);
      const unsplashData = await unsplashResp.json();
      
      if (unsplashData?.results?.length > 0) {
        return unsplashData.results[0].urls.regular;
      }
    } catch (error) {
      console.log('Unsplash API failed:', error.message);
    }
  }

  // Try Pexels API (free, requires API key)
  if (process.env.PEXELS_API_KEY) {
    try {
      const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(medicineName + ' medicine')}&per_page=1`;
      const pexelsResp = await fetch(pexelsUrl, {
        headers: { 'Authorization': process.env.PEXELS_API_KEY }
      });
      const pexelsData = await pexelsResp.json();
      
      if (pexelsData?.photos?.length > 0) {
        return pexelsData.photos[0].src.large;
      }
    } catch (error) {
      console.log('Pexels API failed:', error.message);
    }
  }

  // Fallback to placeholder with medicine name
  return `https://via.placeholder.com/300x200/0d9488/ffffff?text=${encodeURIComponent(medicineName)}`;
}

export async function getMedicineInfo(req, res) {
  const { name, generic } = req.query;
  if (!name) return res.status(400).json({ success: false, message: 'name is required' });

  // Check cache first
  const cacheKey = getCacheKey(name, generic);
  const cachedResponse = getCachedResponse(cacheKey);
  if (cachedResponse) {
    return res.json(cachedResponse);
  }

  if (!GROQ_KEY) {
    return res.status(500).json({ success: false, message: 'Groq API key not configured' });
  }

  try {
    const [aiInfo, imageUrl] = await Promise.all([
      askGroq(name, generic || name),
      getMedicineImage(name),
    ]);

    const response = {
      success: true,
      medicineName: name,
      genericName: generic || '',
      imageUrl,
      ...aiInfo,
    };

    // Cache the successful response
    setCachedResponse(cacheKey, response);

    return res.json(response);
  } catch (err) {
    console.error('Medicine info error:', err.message);
    
    // Check if it's a rate limit error
    const isRateLimit = err.message.includes('Rate limit exceeded') || err.message.includes('quota');
    
    // Try to get basic medicine info first
    const basicInfo = getBasicMedicineInfo(name);
    
    // Get fallback image
    const fallbackImageUrl = await getMedicineImage(name);
    
    // Fallback response when AI fails
    const fallbackResponse = {
      success: true,
      medicineName: name,
      genericName: generic || '',
      imageUrl: fallbackImageUrl,
      description: basicInfo?.description || (isRateLimit 
        ? `AI service is temporarily unavailable due to high demand. Please try again later.`
        : `Information about ${name} is currently unavailable. Please consult a healthcare professional.`),
      primaryUses: basicInfo?.primaryUses || (isRateLimit ? ["Service temporarily unavailable"] : ["Consult healthcare provider"]),
      commonSideEffects: basicInfo?.commonSideEffects || (isRateLimit ? ["Service temporarily unavailable"] : ["Consult healthcare provider"]),
      genericAlternatives: basicInfo?.genericAlternatives || [],
      otcAvailable: basicInfo?.otcAvailable || false,
      warningNote: basicInfo?.warningNote || (isRateLimit 
        ? "AI service is experiencing high demand. Please try again in a few minutes."
        : "Always consult with a healthcare professional before taking any medication.")
    };
    
    // Cache fallback responses for a shorter time to reduce repeated API calls
    setCachedResponse(cacheKey, fallbackResponse);
    
    return res.json(fallbackResponse);
  }
}

export async function checkMedicineInteractions(req, res) {
  const { medicines } = req.body;
  
  if (!medicines || !Array.isArray(medicines) || medicines.length < 2) {
    return res.status(400).json({ 
      success: false, 
      message: 'At least 2 medicines required for interaction check' 
    });
  }
  
  try {
    const interactions = await checkDrugInteractions(medicines);
    
    const response = {
      success: true,
      medicines: medicines,
      interactions: interactions,
      totalInteractions: interactions.length,
      highRiskCount: interactions.filter(i => i.severity === 'HIGH').length,
      moderateRiskCount: interactions.filter(i => i.severity === 'MODERATE').length,
      recommendation: interactions.length > 0 
        ? 'Consult healthcare provider before taking these medicines together'
        : 'No known interactions found - still consult doctor'
    };
    
    return res.json(response);
  } catch (error) {
    console.error('Drug interaction check error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to check drug interactions' 
    });
  }
}

/**
 * Translate medicine information using Groq
 */
export async function translateMedicineInfo(req, res) {
  const { medicineInfo, targetLanguage } = req.body;
  
  if (!medicineInfo || !targetLanguage) {
    return res.status(400).json({ 
      success: false, 
      message: 'Medicine info and target language are required' 
    });
  }

  if (!GROQ_KEY) {
    return res.status(500).json({ success: false, message: 'Groq API key not configured' });
  }

  const languageMap = {
    // Indian languages
    'hi': 'Hindi',
    'bn': 'Bengali',
    'te': 'Telugu',
    'mr': 'Marathi',
    'ta': 'Tamil',
    'gu': 'Gujarati',
    'kn': 'Kannada',
    'ml': 'Malayalam',
    'pa': 'Punjabi',
    'or': 'Odia',
    'as': 'Assamese',
    'ur': 'Urdu',
    // International languages
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese'
  };

  const targetLanguageName = languageMap[targetLanguage] || targetLanguage;

  try {
    const prompt = `Translate the following medicine information to ${targetLanguageName}. Respond ONLY with valid JSON in this exact format:
{
  "description": "translated description",
  "primaryUses": ["translated use 1", "translated use 2"],
  "commonSideEffects": ["translated side effect 1", "translated side effect 2"],
  "genericAlternatives": [
    {"name": "translated name", "note": "translated note"}
  ],
  "otcStatus": "translated OTC status",
  "warningNote": "translated warning or null"
}

Original English text:
Description: ${medicineInfo.description}
Primary Uses: ${medicineInfo.primaryUses?.join(', ') || ''}
Common Side Effects: ${medicineInfo.commonSideEffects?.join(', ') || ''}
Generic Alternatives: ${medicineInfo.genericAlternatives?.map(g => `${g.name}: ${g.note}`).join(', ') || ''}
OTC Status: ${medicineInfo.otcAvailable ? 'Available Over-the-Counter' : 'Prescription Required'}
Warning: ${medicineInfo.warningNote || 'None'}

Return ONLY valid JSON, no markdown.`;

    const resp = await fetch(
      `https://api.groq.com/openai/v1/chat/completions`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 1024,
        }),
      }
    );

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(`Groq API error: ${resp.status} - ${errorData.error?.message || resp.statusText}`);
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    if (!clean) {
      throw new Error('Empty response from Groq API');
    }
    
    const translatedInfo = JSON.parse(clean);
    
    return res.json({
      success: true,
      translatedInfo,
      targetLanguage,
      sourceLanguage: 'en'
    });
  } catch (error) {
    console.error('Translation error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to translate medicine information' 
    });
  }
}
