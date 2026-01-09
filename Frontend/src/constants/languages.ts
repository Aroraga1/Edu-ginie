/**
 * Supported languages for voice recognition and text-to-speech
 * Includes Indian languages with proper language codes
 */

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  region?: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  // English
  { code: 'en-US', name: 'English', nativeName: 'English', region: 'United States' },
  { code: 'en-IN', name: 'English (India)', nativeName: 'English', region: 'India' },
  
  // Hindi and related languages
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', region: 'India' },
  { code: 'hi-IN', name: 'Hindi (Devanagari)', nativeName: 'हिन्दी', region: 'India' },
  
  // Rajasthani languages
  { code: 'raj-IN', name: 'Rajasthani', nativeName: 'राजस्थानी', region: 'Rajasthan, India' },
  { code: 'mwr-IN', name: 'Marwari', nativeName: 'मारवाड़ी', region: 'Rajasthan, India' },
  { code: 'dhd-IN', name: 'Dhundhari', nativeName: 'ढूंढाड़ी', region: 'Rajasthan, India' },
  { code: 'mup-IN', name: 'Mewari', nativeName: 'मेवाड़ी', region: 'Rajasthan, India' },
  { code: 'wbr-IN', name: 'Wagdi', nativeName: 'वागड़ी', region: 'Rajasthan, India' },
  { code: 'swv-IN', name: 'Shekhawati', nativeName: 'शेखावाटी', region: 'Rajasthan, India' },
  
  // Other Indian languages
  { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা', region: 'India' },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', region: 'India' },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', region: 'India' },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', region: 'India' },
  { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી', region: 'India' },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ', region: 'India' },
  { code: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം', region: 'India' },
  { code: 'pa-IN', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', region: 'India' },
  { code: 'or-IN', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', region: 'India' },
  { code: 'as-IN', name: 'Assamese', nativeName: 'অসমীয়া', region: 'India' },
  { code: 'ur-IN', name: 'Urdu', nativeName: 'اردو', region: 'India' },
  
  // International languages
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', region: 'Spain' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français', region: 'France' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', region: 'Germany' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', region: 'Italy' },
  { code: 'pt-PT', name: 'Portuguese', nativeName: 'Português', region: 'Portugal' },
  { code: 'ru-RU', name: 'Russian', nativeName: 'Русский', region: 'Russia' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', region: 'Japan' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '中文', region: 'China' },
  { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية', region: 'Saudi Arabia' },
];

// Note: Some Rajasthani language codes may not be directly supported by Web Speech API
// These are ISO 639-3 codes that may need fallback to 'hi-IN' or 'en-IN' for recognition
export const LANGUAGE_FALLBACKS: Record<string, string> = {
  'raj-IN': 'hi-IN', // Rajasthani falls back to Hindi
  'mwr-IN': 'hi-IN', // Marwari falls back to Hindi
  'dhd-IN': 'hi-IN', // Dhundhari falls back to Hindi
  'mup-IN': 'hi-IN', // Mewari falls back to Hindi
  'wbr-IN': 'hi-IN', // Wagdi falls back to Hindi
  'swv-IN': 'hi-IN', // Shekhawati falls back to Hindi
};

/**
 * Get the actual language code to use for speech recognition
 * Returns fallback if the language is not directly supported
 */
export function getSpeechRecognitionCode(languageCode: string): string {
  return LANGUAGE_FALLBACKS[languageCode] || languageCode;
}

/**
 * Get language by code
 */
export function getLanguageByCode(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
}

/**
 * Get default language (English)
 */
export function getDefaultLanguage(): Language {
  return SUPPORTED_LANGUAGES[0]; // en-US
}

