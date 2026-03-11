/**
 * i18n configuration for ReRide.
 * Uses react-i18next with language detection.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      'app.name': 'ReRide',
      'app.tagline': 'Buy & Sell Quality Used Vehicles',
      'home.hero.title': 'Find Your Perfect Ride',
      'home.hero.subtitle': 'Browse thousands of certified used cars. AI-powered recommendations and verified sellers.',
      'nav.usedCars': 'Used Cars',
      'nav.newCars': 'New Cars',
      'nav.sellCar': 'Sell Car',
      'nav.dealers': 'Dealers',
      'nav.carServices': 'Car Services',
      'nav.login': 'Login',
      'nav.profile': 'Profile',
      'nav.inbox': 'Inbox',
      'search.placeholder': 'Search by make, model, city...',
      'vehicle.price': 'Price',
      'vehicle.mileage': 'Mileage',
      'vehicle.fuel': 'Fuel',
      'vehicle.transmission': 'Transmission',
      'vehicle.year': 'Year',
      'footer.privacy': 'Privacy Policy',
      'footer.terms': 'Terms of Service',
      'footer.support': 'Support',
      'footer.faq': 'FAQ',
      'cookie.consent': 'We use cookies to improve your experience and analyze traffic. By continuing you accept our use of cookies.',
      'cookie.accept': 'Accept',
      'cookie.decline': 'Decline',
      'cookie.learnMore': 'Learn more',
    },
  },
  hi: {
    translation: {
      'app.name': 'ReRide',
      'app.tagline': 'गुणवत्ता पूर्ण प्रयुक्त वाहन खरीदें और बेचें',
      'home.hero.title': 'अपनी परफेक्ट राइड खोजें',
      'home.hero.subtitle': 'हजारों प्रमाणित प्रयुक्त कारें देखें। AI-सिफारिशें और सत्यापित विक्रेता।',
      'nav.usedCars': 'प्रयुक्त कारें',
      'nav.newCars': 'नई कारें',
      'nav.sellCar': 'कार बेचें',
      'nav.dealers': 'डीलर',
      'nav.carServices': 'कार सेवाएं',
      'nav.login': 'लॉगिन',
      'nav.profile': 'प्रोफाइल',
      'nav.inbox': 'इनबॉक्स',
      'search.placeholder': 'ब्रांड, मॉडल, शहर से खोजें...',
      'vehicle.price': 'कीमत',
      'vehicle.mileage': 'माइलेज',
      'vehicle.fuel': 'ईंधन',
      'vehicle.transmission': 'ट्रांसमिशन',
      'vehicle.year': 'वर्ष',
      'footer.privacy': 'गोपनीयता नीति',
      'footer.terms': 'सेवा की शर्तें',
      'footer.support': 'सहायता',
      'footer.faq': 'पूछे जाने वाले प्रश्न',
      'cookie.consent': 'हम आपके अनुभव और ट्रैफिक विश्लेषण के लिए कुकीज़ का उपयोग करते हैं। जारी रखकर आप कुकीज़ स्वीकार करते हैं।',
      'cookie.accept': 'स्वीकार करें',
      'cookie.decline': 'अस्वीकार',
      'cookie.learnMore': 'और जानें',
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

export default i18n;
