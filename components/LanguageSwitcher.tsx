
import React from 'react';
import type { Language } from '../i18n';

interface LanguageSwitcherProps {
  currentLanguage: Language;
  onLanguageChange: (language: Language) => void;
}

const languages: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'uk', label: 'UK' },
  { code: 'ru', label: 'RU' },
];

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ currentLanguage, onLanguageChange }) => {
  return (
    <div className="flex items-center bg-slate-200 rounded-full p-1 shadow-inner">
      {languages.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => onLanguageChange(code)}
          className={`px-3 py-1 text-sm font-bold rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
            ${currentLanguage === code
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-300'
            }`}
          aria-pressed={currentLanguage === code}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
