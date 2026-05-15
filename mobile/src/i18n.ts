import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import translations from './locales/translations.json';

const deviceLang = getLocales()[0]?.languageCode ?? 'en';
const supportedLangs = ['ru', 'en'];
const lng = supportedLangs.includes(deviceLang) ? deviceLang : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: translations.ru },
      en: { translation: translations.en },
    },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
