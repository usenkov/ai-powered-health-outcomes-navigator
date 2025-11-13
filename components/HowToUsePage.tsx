
import React from 'react';
import { translations, type Language } from '../i18n';

interface HowToUsePageProps {
  onBack: () => void;
  language: Language;
}

export const HowToUsePage: React.FC<HowToUsePageProps> = ({ onBack, language }) => {
  const T = translations[language];

  const Footer = () => (
      <footer className="bg-slate-100 border-t border-slate-200 mt-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-slate-500">
            <p><strong>{T.footerDisclaimer.split(':')[0]}:</strong> {T.footerDisclaimer.split(':')[1]}</p>
            <p className="mt-2">Created by Vitalii Usenko © 2025</p>
        </div>
      </footer>
  );

  const BackButton: React.FC<{onBack: () => void}> = ({ onBack }) => (
      <button
          onClick={onBack}
          className="w-full sm:w-auto inline-flex justify-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      >
          {T.backToAppButton}
      </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 antialiased text-slate-800 font-sans">
        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">{T.howToUseTitle}</h1>
                    <p className="text-slate-500 mt-2">{T.howToUseSubtitle}</p>
                </div>
                <div className="mt-6">
                    <BackButton onBack={onBack} />
                </div>
                <div className="mt-6 bg-white p-6 sm:p-8 rounded-xl shadow-lg border border-slate-200">
                    <div className="prose prose-slate max-w-none">
                        <h2 className="text-2xl font-semibold text-blue-700">{T.introHeader}</h2>
                        <p>{T.introText}</p>
                        
                        <h2 className="text-2xl font-semibold text-blue-700 mt-8">{T.guideHeader}</h2>
                        
                        <h3>{T.guideStep1Header}</h3>
                        <p>{T.guideStep1Text1}</p>
                        <ul>
                            <li><strong>{T.guideStep1List1.split(':')[0]}:</strong>{T.guideStep1List1.split(':')[1]}</li>
                            <li><strong>{T.guideStep1List2.split(':')[0]}:</strong>{T.guideStep1List2.split(':')[1]}</li>
                        </ul>
                        <p><strong>{T.guideStep1Text2.split(':')[0]}:</strong>{T.guideStep1Text2.split(':')[1]}</p>
                        
                        <h3>{T.guideStep2Header}</h3>
                        <p>{T.guideStep2Text1}</p>
                        <p><strong>{T.guideStep2Text2.split(':')[0]}:</strong>{T.guideStep2Text2.split(':')[1]}</p>
                        
                        <h3>{T.guideStep3Header}</h3>
                        <p>{T.guideStep3Text1}</p>
                        <ul>
                             <li><strong>{T.guideStep3List1.split(':')[0]}:</strong>{T.guideStep3List1.split(':')[1]}</li>
                             <li><strong>{T.guideStep3List2.split(':')[0]}:</strong>{T.guideStep3List2.split(':')[1]}</li>
                        </ul>
                        <p><strong>{T.guideStep3Text2.split(':')[0]}:</strong>{T.guideStep3Text2.split(':')[1]}</p>

                        <h3>{T.guideStep4Header}</h3>
                        <p>{T.guideStep4Text1}</p>
                        <ul>
                            <li><strong>{T.guideStep4List1.split(':')[0]}:</strong>{T.guideStep4List1.split(':')[1]}
                                <ul>
                                    <li><code>a</code>: {T.guideStep4List1_1.split(':')[1]}</li>
                                    <li><code>b</code>: {T.guideStep4List1_2.split(':')[1]}</li>
                                </ul>
                            </li>
                            <li><strong>{T.guideStep4List2.split(':')[0]}:</strong>{T.guideStep4List2.split(':')[1]}
                                <ul>
                                    <li><code>c</code>: {T.guideStep4List2_1.split(':')[1]}</li>
                                    <li><code>d</code>: {T.guideStep4List2_2.split(':')[1]}</li>
                                </ul>
                            </li>
                        </ul>

                        <h3>{T.guideStep5Header}</h3>
                        <p>{T.guideStep5Text1}</p>

                        <h3>{T.guideStep6Header}</h3>
                        <p>{T.guideStep6Text1}</p>
                        <ul>
                            <li><strong className="text-green-700">{T.guideStep6List1.split(':')[0]}:</strong>{T.guideStep6List1.split(':')[1]}</li>
                            <li><strong className="text-blue-700">{T.guideStep6List2.split(':')[0]}:</strong>{T.guideStep6List2.split(':')[1]}</li>
                        </ul>
                        
                        <hr className="my-8" />

                        <h2 className="text-2xl font-semibold text-blue-700">{T.exampleHeader}</h2>
                        <p><strong>{T.exampleScenario.split(':')[0]}:</strong>{T.exampleScenario.split(':')[1]}</p>
                        
                        <p><strong>{T.exampleStep1.split(':')[0]}:</strong>{T.exampleStep1.split(':')[1]}</p>
                        <p><strong>{T.exampleStep2.split(':')[0]}:</strong>{T.exampleStep2.split(':')[1]}</p>
                        <p><strong>{T.exampleStep3.split(':')[0]}:</strong>{T.exampleStep3.split(':')[1]}</p>
                        <p><strong>{T.exampleStep4.split(':')[0]}:</strong>{T.exampleStep4.split(':')[1]}</p>
                        <ul className="list-none p-0">
                            <li>{T.exampleVaccineGroup}
                                <ul className="my-2">
                                    <li>{T.exampleListA}</li>
                                    <li>{T.exampleListB}</li>
                                </ul>
                            </li>
                            <li>{T.examplePlaceboGroup}
                                <ul className="mt-2">
                                    <li>{T.exampleListC}</li>
                                    <li>{T.exampleListD}</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <p><strong>{T.exampleStep5.split(':')[0]}:</strong>{T.exampleStep5.split(':')[1]}</p>
                        <ul className="list-disc ml-5">
                            <li><strong>{T.exampleResult1.split(':')[0]}:</strong>{T.exampleResult1.split(':')[1]}</li>
                            <li><strong>{T.exampleResult2.split(':')[0]}:</strong>{T.exampleResult2.split(':')[1]}</li>
                            <li><strong>{T.exampleResult3.split(':')[0]}:</strong>{T.exampleResult3.split(':')[1]}</li>
                            <li><strong>{T.exampleResult4.split(':')[0]}:</strong>{T.exampleResult4.split(':')[1]}</li>
                            <li><strong>{T.exampleResult5.split(':')[0]}:</strong>{T.exampleResult5.split(':')[1]}</li>
                        </ul>

                        <p><strong>{T.exampleStep6.split(':')[0]}:</strong></p>
                        <p>{T.exampleStep6Text}</p>
                    </div>
                </div>
                <div className="mt-8">
                    <BackButton onBack={onBack} />
                </div>
            </div>
        </main>
        <Footer />
    </div>
  );
};
