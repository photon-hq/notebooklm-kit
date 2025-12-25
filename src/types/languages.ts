/**
 * Language support for NotebookLM artifacts
 * 
 * NotebookLM supports 80+ languages for audio and video overviews,
 * and multi-language support for artifacts (quizzes, flashcards, slides, infographics).
 * 
 * Language codes follow ISO 639-1 standard (2-letter codes) where available.
 */

/**
 * Supported languages enum
 * Based on NotebookLM's multi-language support (80+ languages)
 */
export enum NotebookLMLanguage {
  // Major World Languages
  ENGLISH = 'en',
  SPANISH = 'es',
  FRENCH = 'fr',
  GERMAN = 'de',
  ITALIAN = 'it',
  PORTUGUESE = 'pt',
  RUSSIAN = 'ru',
  JAPANESE = 'ja',
  KOREAN = 'ko',
  CHINESE_SIMPLIFIED = 'zh',
  CHINESE_TRADITIONAL = 'zh-TW',
  CHINESE_HONG_KONG = 'zh-HK',
  
  // Indian Languages
  HINDI = 'hi',
  BENGALI = 'bn',
  TAMIL = 'ta',
  TELUGU = 'te',
  GUJARATI = 'gu',
  KANNADA = 'kn',
  MALAYALAM = 'ml',
  MARATHI = 'mr',
  PUNJABI = 'pa',
  URDU = 'ur',
  ORIYA = 'or',
  ASSAMESE = 'as',
  KONKANI = 'kok',
  MAITHILI = 'mai',
  SINDHI = 'sd',
  NEPALI = 'ne',
  
  // Middle Eastern Languages
  ARABIC = 'ar',
  HEBREW = 'he',
  PERSIAN = 'fa',
  TURKISH = 'tr',
  AZERBAIJANI = 'az',
  ARMENIAN = 'hy',
  GEORGIAN = 'ka',
  KURDISH = 'ku',
  PASHTO = 'ps',
  UZBEK = 'uz',
  
  // Southeast Asian Languages
  THAI = 'th',
  VIETNAMESE = 'vi',
  INDONESIAN = 'id',
  MALAY = 'ms',
  TAGALOG = 'tl',
  BURMESE = 'my',
  KHMER = 'km',
  LAO = 'lo',
  SINHALA = 'si',
  DHIVEHI = 'dv',
  
  // East Asian Languages
  MONGOLIAN = 'mn',
  TIBETAN = 'bo',
  DZONGKHA = 'dz',
  
  // European Languages
  POLISH = 'pl',
  DUTCH = 'nl',
  SWEDISH = 'sv',
  DANISH = 'da',
  FINNISH = 'fi',
  NORWEGIAN = 'no',
  CZECH = 'cs',
  SLOVAK = 'sk',
  HUNGARIAN = 'hu',
  ROMANIAN = 'ro',
  BULGARIAN = 'bg',
  CROATIAN = 'hr',
  SERBIAN = 'sr',
  SLOVENIAN = 'sl',
  ESTONIAN = 'et',
  LATVIAN = 'lv',
  LITHUANIAN = 'lt',
  GREEK = 'el',
  UKRAINIAN = 'uk',
  BELARUSIAN = 'be',
  ALBANIAN = 'sq',
  MACEDONIAN = 'mk',
  MALTESE = 'mt',
  ICELANDIC = 'is',
  IRISH = 'ga',
  WELSH = 'cy',
  SCOTTISH_GAELIC = 'gd',
  BRETON = 'br',
  BASQUE = 'eu',
  CATALAN = 'ca',
  GALICIAN = 'gl',
  OCCITAN = 'oc',
  CORSICAN = 'co',
  SARDINIAN = 'sc',
  ROMANSH = 'rm',
  WALLOON = 'wa',
  LUXEMBOURGISH = 'lb',
  MANX = 'gv',
  CORNISH = 'kw',
  
  // African Languages
  SWAHILI = 'sw',
  ZULU = 'zu',
  AFRIKAANS = 'af',
  XHOSA = 'xh',
  YORUBA = 'yo',
  IGBO = 'ig',
  HAUSA = 'ha',
  SOMALI = 'so',
  OROMO = 'om',
  KINYARWANDA = 'rw',
  MALAGASY = 'mg',
  SESOTHO = 'st',
  SETSWANA = 'tn',
  VENDA = 've',
  TSONGA = 'ts',
  SWATI = 'ss',
  NDEBELE = 'nr',
  NORTHERN_SOTHO = 'nso',
  AMHARIC = 'am',
  TIGRINYA = 'ti',
  
  // Other Languages
  ESPERANTO = 'eo',
  HAITIAN_CREOLE = 'ht',
  CHEROKEE = 'chr',
  CEBUANO = 'ceb',
  SYRIAC = 'syr',
}

/**
 * Language metadata with display names
 */
export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  region?: string;
}

/**
 * Language information map
 */
export const LANGUAGE_INFO: Record<string, LanguageInfo> = {
  [NotebookLMLanguage.ENGLISH]: { code: 'en', name: 'English', nativeName: 'English' },
  [NotebookLMLanguage.SPANISH]: { code: 'es', name: 'Spanish', nativeName: 'Español' },
  [NotebookLMLanguage.FRENCH]: { code: 'fr', name: 'French', nativeName: 'Français' },
  [NotebookLMLanguage.GERMAN]: { code: 'de', name: 'German', nativeName: 'Deutsch' },
  [NotebookLMLanguage.ITALIAN]: { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  [NotebookLMLanguage.PORTUGUESE]: { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  [NotebookLMLanguage.RUSSIAN]: { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  [NotebookLMLanguage.JAPANESE]: { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  [NotebookLMLanguage.KOREAN]: { code: 'ko', name: 'Korean', nativeName: '한국어' },
  [NotebookLMLanguage.CHINESE_SIMPLIFIED]: { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  [NotebookLMLanguage.CHINESE_TRADITIONAL]: { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
  [NotebookLMLanguage.HINDI]: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  [NotebookLMLanguage.BENGALI]: { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  [NotebookLMLanguage.TAMIL]: { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  [NotebookLMLanguage.TELUGU]: { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  [NotebookLMLanguage.GUJARATI]: { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  [NotebookLMLanguage.KANNADA]: { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  [NotebookLMLanguage.MALAYALAM]: { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  [NotebookLMLanguage.MARATHI]: { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  [NotebookLMLanguage.PUNJABI]: { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  [NotebookLMLanguage.URDU]: { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  [NotebookLMLanguage.ARABIC]: { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  [NotebookLMLanguage.HEBREW]: { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  [NotebookLMLanguage.PERSIAN]: { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  [NotebookLMLanguage.TURKISH]: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  [NotebookLMLanguage.THAI]: { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  [NotebookLMLanguage.VIETNAMESE]: { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  [NotebookLMLanguage.INDONESIAN]: { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  [NotebookLMLanguage.MALAY]: { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  [NotebookLMLanguage.TAGALOG]: { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog' },
  [NotebookLMLanguage.POLISH]: { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  [NotebookLMLanguage.DUTCH]: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  [NotebookLMLanguage.SWEDISH]: { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  [NotebookLMLanguage.DANISH]: { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  [NotebookLMLanguage.FINNISH]: { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  [NotebookLMLanguage.NORWEGIAN]: { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  [NotebookLMLanguage.CZECH]: { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  [NotebookLMLanguage.SLOVAK]: { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
  [NotebookLMLanguage.HUNGARIAN]: { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  [NotebookLMLanguage.ROMANIAN]: { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  [NotebookLMLanguage.BULGARIAN]: { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  [NotebookLMLanguage.CROATIAN]: { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski' },
  [NotebookLMLanguage.SERBIAN]: { code: 'sr', name: 'Serbian', nativeName: 'Српски' },
  [NotebookLMLanguage.SLOVENIAN]: { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina' },
  [NotebookLMLanguage.ESTONIAN]: { code: 'et', name: 'Estonian', nativeName: 'Eesti' },
  [NotebookLMLanguage.LATVIAN]: { code: 'lv', name: 'Latvian', nativeName: 'Latviešu' },
  [NotebookLMLanguage.LITHUANIAN]: { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių' },
  [NotebookLMLanguage.GREEK]: { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  [NotebookLMLanguage.UKRAINIAN]: { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  [NotebookLMLanguage.SWAHILI]: { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  [NotebookLMLanguage.ZULU]: { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
  [NotebookLMLanguage.AFRIKAANS]: { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
  [NotebookLMLanguage.XHOSA]: { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa' },
  [NotebookLMLanguage.YORUBA]: { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  [NotebookLMLanguage.IGBO]: { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
  [NotebookLMLanguage.HAUSA]: { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  [NotebookLMLanguage.SOMALI]: { code: 'so', name: 'Somali', nativeName: 'Soomaali' },
  [NotebookLMLanguage.AMHARIC]: { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  [NotebookLMLanguage.TIGRINYA]: { code: 'ti', name: 'Tigrinya', nativeName: 'ትግርኛ' },
};

/**
 * Get language information by code
 */
export function getLanguageInfo(code: string): LanguageInfo | undefined {
  return LANGUAGE_INFO[code];
}

/**
 * Get all supported language codes
 */
export function getSupportedLanguages(): string[] {
  return Object.values(NotebookLMLanguage);
}

/**
 * Check if a language code is supported
 */
export function isLanguageSupported(code: string): boolean {
  return Object.values(NotebookLMLanguage).includes(code as NotebookLMLanguage);
}

/**
 * Common languages for quick reference
 */
export const COMMON_LANGUAGES = {
  ENGLISH: NotebookLMLanguage.ENGLISH,
  SPANISH: NotebookLMLanguage.SPANISH,
  FRENCH: NotebookLMLanguage.FRENCH,
  GERMAN: NotebookLMLanguage.GERMAN,
  ITALIAN: NotebookLMLanguage.ITALIAN,
  PORTUGUESE: NotebookLMLanguage.PORTUGUESE,
  RUSSIAN: NotebookLMLanguage.RUSSIAN,
  JAPANESE: NotebookLMLanguage.JAPANESE,
  KOREAN: NotebookLMLanguage.KOREAN,
  CHINESE: NotebookLMLanguage.CHINESE_SIMPLIFIED,
  HINDI: NotebookLMLanguage.HINDI,
  ARABIC: NotebookLMLanguage.ARABIC,
  TURKISH: NotebookLMLanguage.TURKISH,
} as const;

