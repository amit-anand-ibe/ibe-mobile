/**
 * i18n Configuration
 *
 * This file initializes the i18next localization library and sets up its configuration.
 * It binds the react-i18next module to i18next for React integration.
 * Language files are imported to provide translation resources for different languages.
 *
 * @module i18n
 */

import i18n from "i18next"; // Import the i18next library
import { initReactI18next } from "react-i18next"; // Import the initReactI18next function
import * as Localization from "expo-localization"; // Import expo-localization for accessing device locale

// Import language files
import en from "./locales/en.json"; // English language file
import es from "./locales/es.json"; // Spanish language file
import hi from "./locales/hi.json"; // Hindi language file

const resources = {
  en: { translation: en }, // Provide translation resources for English
  es: { translation: es }, // Provide translation resources for Spanish
  hi: { translation: hi }, // Provide translation resources for Hindi
};

export const getSupportedLanguage = (locale) => {
  if (!locale || typeof locale !== "string") {
    return "en";
  }

  const normalizedLocale = locale.toLowerCase();
  const languageCode = normalizedLocale.split("-")[0];

  if (resources[normalizedLocale]) {
    return normalizedLocale;
  }

  return resources[languageCode] ? languageCode : "en";
};

const getDeviceLanguage = () => {
  if (typeof Localization.getLocales === "function") {
    const locales = Localization.getLocales();
    const primaryLocale = locales?.[0];

    return getSupportedLanguage(
      primaryLocale?.languageTag || primaryLocale?.languageCode
    );
  }

  return getSupportedLanguage(Localization.locale);
};

/**
 * Initialize i18next with configuration options and language resources.
 */
i18n
  .use(initReactI18next) // Bind react-i18next to i18next
  .init({
    compatibilityJSON: "v3", // Compatibility JSON format
    resources,
    lng: getDeviceLanguage(), // Set language based on device locale with Expo SDK 54 compatibility
    fallbackLng: "en", // Fallback language if translation for the device's locale is not available
    interpolation: {
      escapeValue: false, // React already escapes strings by default
    },
  });

// Export the configured i18n instance for use in the application
export default i18n;
