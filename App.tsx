
import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import type { Inputs, Results } from './types';
import { InputControl } from './components/InputControl';
import { Tooltip } from './components/Tooltip';
import { HowToUsePage } from './components/HowToUsePage';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { translations, getTooltips, studyDesignLabels, studyGoalLabels, languageName, type Language, type StudyGoal, type StudyDesign } from './i18n';


// Standard Normal cumulative distribution function using Abramowitz and Stegun approximation for erf
const normalCDF = (x: number): number => {
    // Constants for the approximation
    const p = 0.3275911;
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;

    // The relationship is CDF(x) = 0.5 * (1 + erf(x / sqrt(2)))
    const z = x / Math.sqrt(2);
    const sign = z >= 0 ? 1 : -1;
    const t = 1.0 / (1.0 + p * Math.abs(z));
    const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    const cdf = 0.5 * (1.0 + sign * erf);

    return cdf;
};

// Calculates a two-tailed p-value from a Z-statistic using the corrected normalCDF
const calculatePValueFromZ = (z: number): string => {
  const absZ = Math.abs(z);
  const p = 2 * (1 - normalCDF(absZ));
  return p < 0.0001 ? '<0.0001' : p.toFixed(4);
};

// Calculates the required sample size per group to achieve 80% power
const calculateRequiredSampleSize = (p1: number, p2: number): number | null => {
    if (p1 === p2 || isNaN(p1) || isNaN(p2)) return null;

    const powerTarget = 0.80;
    const alpha = 0.05;
    const z_alpha_half = 1.96; 
    const z_beta = 0.8416; // for 80% power

    const p_pooled = (p1 + p2) / 2;

    const term1 = z_alpha_half * Math.sqrt(2 * p_pooled * (1 - p_pooled));
    const term2 = z_beta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
    const numerator = Math.pow(term1 + term2, 2);
    const denominator = Math.pow(p1 - p2, 2);

    if (denominator === 0) return null;
    
    return Math.ceil(numerator / denominator);
};

type AiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';

const App: React.FC = () => {
  const initialInputs: Inputs = { a: '', b: '', c: '', d: '' };
  const [inputs, setInputs] = useState<Inputs>(initialInputs);
  const [studyGoal, setStudyGoal] = useState<StudyGoal | null>(null);
  const [studyDesign, setStudyDesign] = useState<StudyDesign | null>(null);
  const [aiModel, setAiModel] = useState<AiModel>('gemini-2.5-flash');
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isInterpreting, setIsInterpreting] = useState<boolean>(false);
  const [aiInterpretation, setAiInterpretation] = useState<string | null>(null);
  const [aiNarrativeSummary, setAiNarrativeSummary] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<'calculator' | 'interpretation' | 'narrativeSummary' | 'howToUse'>('calculator');
  const [language, setLanguage] = useState<Language>('en');

  const T = translations[language];
  const tooltips = getTooltips(language);

  const handleLanguageChange = useCallback((lang: Language) => {
    setLanguage(lang);
    setAiInterpretation(null);
    setAiNarrativeSummary(null);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setInputs(initialInputs);
    setStudyGoal(null);
    setStudyDesign(null);
    setAiModel('gemini-2.5-flash');
    setResults(null);
    setError(null);
    setAiInterpretation(null);
    setAiNarrativeSummary(null);
    setIsCalculating(false);
    setIsInterpreting(false);
    setCurrentPage('calculator');
  }, [initialInputs]);

  const fetchAiNarrativeSummary = useCallback(async (currentResults: Results, currentInputs: Inputs, goal: StudyGoal, design: StudyDesign, model: AiModel, lang: Language) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const formatValue = (val: number | string | undefined | null, precision = 2) => {
      if (typeof val === 'number' && isFinite(val)) return val.toFixed(precision);
      return val || 'N/A';
    };
    
    const currentTranslations = translations[lang];
    const langNameForPrompt = languageName[lang];
    const studyDesignLabel = studyDesignLabels[lang][design];
    const goalLabel = studyGoalLabels[lang][goal];

    let keyMetricsPrompt = '';
    let individualImpactPrompt = '';
    let findingsOnRiskPrompt = '';

    const or_result = formatValue(currentResults.oddsRatio?.value);
    
    if (design === 'case-control') {
        keyMetricsPrompt = `- Odds Ratio (OR): ${or_result}`;
        findingsOnRiskPrompt = `(In 2-3 paragraphs, explain the primary measure of association.
- As this is a Case-Control study, the key measure of association is the Odds Ratio (OR). Define it as the odds of prior exposure in the case group compared to the odds of prior exposure in the control group. For example: "An Odds Ratio of ${or_result} indicates that the group with the outcome had ${or_result} times the odds of having been exposed compared to the control group.")`;
        individualImpactPrompt = `(In 1-2 paragraphs, explain that Case-Control studies are not designed to calculate absolute risk or measures like NNT/NNH. Briefly state that the Odds Ratio provides an estimate of the strength of the association between the exposure and the outcome.)`;

    } else {
        const are_result = formatValue(currentResults.absoluteRiskExposed?.value, 4);
        const arc_result = formatValue(currentResults.absoluteRiskControl?.value, 4);
        const rr_result = formatValue(currentResults.relativeRisk?.value);
        const rd_result = formatValue(currentResults.riskDifference?.value, 4);

        let nnt_result_for_ai = 'Not applicable';
        let nnt_narrative_example = '';
        if (currentResults.nnt) {
            if (currentResults.nnt.type === 'Benefit') {
                nnt_result_for_ai = `Number Needed to Treat (NNT): ${formatValue(currentResults.nnt.value)}`;
                nnt_narrative_example = `For example: "The study found a Number Needed to Treat of ${formatValue(currentResults.nnt.value)}, suggesting that for every ${formatValue(currentResults.nnt.value)} people treated, one additional positive outcome is expected."`;
            } else {
                nnt_result_for_ai = `Number Needed to Harm (NNH): ${formatValue(currentResults.nnt.value)}`;
                nnt_narrative_example = `For example: "The study found a Number Needed to Harm of ${formatValue(currentResults.nnt.value)}, suggesting that for every ${formatValue(currentResults.nnt.value)} people exposed, one additional harmful outcome is expected."`;
            }
        }

        keyMetricsPrompt = `- Risk in Exposed Group: ${are_result}
- Risk in Control Group: ${arc_result}
- Relative Risk (RR): ${rr_result}
- Odds Ratio (OR): ${or_result}
- Risk Difference (RD): ${rd_result}
- ${nnt_result_for_ai}`;
        
        findingsOnRiskPrompt = `(In 2-3 paragraphs, explain the primary measures of association.
- First, explain the Relative Risk (RR). Define it as the ratio of risk in the exposed group to the risk in the control group. For example: "A Relative Risk of ${rr_result} indicates that the exposed group was ${rr_result} times as likely to experience the outcome as the control group."
- Briefly mention the Odds Ratio (OR) as another way to measure association, particularly useful in certain study designs like case-control studies. Do not go into excessive detail on the OR.)`;

        individualImpactPrompt = `(In 2-3 paragraphs, translate the findings to an individual or population level.
- Explain Absolute Risk for both groups. For example: "The absolute risk in the exposed group was ${are_result}, meaning that for every 100 individuals in this group, approximately ${formatValue(currentResults.absoluteRiskExposed?.value * 100)} experienced the outcome."
- Explain the Number Needed to Treat (NNT) or Harm (NNH). Define it as the number of people who must receive the treatment (or exposure) for one person to experience the benefit (or harm). ${nnt_narrative_example})`;
    }


    const prompt = `You are an expert science writer and epidemiologist. Your task is to produce a clear, professional summary of a health study's findings for an educated, non-specialist audience. The style should be academic yet accessible, similar to a university public health report. **The entire response must be written in ${langNameForPrompt}**.

The user has specified this is a **${studyDesignLabel}** analyzing a **${goalLabel} outcome**. They have provided the following data from a 2x2 contingency table:
- Exposed Group, With Outcome (a): ${currentInputs.a}
- Exposed Group, Without Outcome (b): ${currentInputs.b}
- Control Group, With Outcome (c): ${currentInputs.c}
- Control Group, Without Outcome (d): ${currentInputs.d}

Here are the key calculated metrics:
${keyMetricsPrompt}

Please write a summary in **${langNameForPrompt}** organized under the following four headers.

**MANDATORY FORMATTING RULES:**
1.  Use markdown bolding (\`**text**\`) for the four main headers and the final disclaimer header ONLY.
2.  The headers you MUST use are (in this exact order): **"${currentTranslations.narrativeHeaders.overview}"**, **"${currentTranslations.narrativeHeaders.findings}"**, **"${currentTranslations.narrativeHeaders.impact}"**, and **"${currentTranslations.narrativeHeaders.conclusion}"**.
3.  Separate every header and every paragraph with a double newline (\`\\n\\n\`) to create a blank line.
4.  Explain key statistical terms (e.g., Relative Risk, Absolute Risk) clearly and concisely upon first use.
5.  Maintain an objective, neutral, and professional tone throughout. Do not give medical advice.
6.  End the summary with the provided disclaimer header and text.

---

**${currentTranslations.narrativeHeaders.overview}**

(In 1-2 paragraphs, describe the study's design as a **${studyDesignLabel}**. Explain that it compares an 'exposed' group to a 'control' (unexposed) group to assess the effect of the exposure on a specific, **${goalLabel}** health outcome.)

**${currentTranslations.narrativeHeaders.findings}**

${findingsOnRiskPrompt}

**${currentTranslations.narrativeHeaders.impact}**

${individualImpactPrompt}

**${currentTranslations.narrativeHeaders.conclusion}**

(Provide a concluding paragraph summarizing the findings. Emphasize that these results are from a single study and that a body of evidence is needed for definitive conclusions. Avoid definitive statements and maintain a cautious, academic tone. Mention that the limitations inherent to a **${studyDesignLabel}** mean that factors not included in this analysis could also influence the outcome.)

**${currentTranslations.narrativeHeaders.disclaimer}:** This summary is for educational purposes only and is not a substitute for professional medical advice. Always consult with a qualified healthcare provider for any health concerns or before making any decisions related to your health or treatment.`;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });
        const unescapedText = response.text.replace(/\\n/g, '\n');
        setAiNarrativeSummary(unescapedText.trim());
    } catch (e) {
        console.error("Error fetching AI Narrative Summary:", e);
        setAiNarrativeSummary("An error occurred while generating the narrative summary. Please try again.");
        throw e;
    }
  }, []);

  const fetchAiInterpretation = useCallback(async (currentResults: Results, currentInputs: Inputs, goal: StudyGoal, design: StudyDesign, model: AiModel, lang: Language) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const formatValue = (val: number | string | undefined | null, precision = 2) => {
      if (typeof val === 'number' && isFinite(val)) return val.toFixed(precision);
      return val || 'N/A';
    };
    
    const currentTranslations = translations[lang];
    const langNameForPrompt = languageName[lang];
    const studyDesignLabel = studyDesignLabels[lang][design];
    const goalLabel = studyGoalLabels[lang][goal];

    const or_result = formatValue(currentResults.oddsRatio?.value);
    const or_ci_result = currentResults.oddsRatio ? `${formatValue(currentResults.oddsRatio.lower)} to ${formatValue(currentResults.oddsRatio.upper)}` : 'N/A';
    const p_value_result_raw = currentResults.oddsRatio?.pValue || currentResults.relativeRisk?.pValue;
    const p_value_result = p_value_result_raw ? (p_value_result_raw.startsWith('<') ? '0.0001' : p_value_result_raw) : 'N/A';

    let metricsPrompt = '';
    let p1_for_calc = NaN;
    let p2_for_calc = NaN;
    
    if (design === 'case-control') {
      metricsPrompt = `- Odds Ratio (OR): ${or_result} (95% CI: ${or_ci_result})
- P-value: ${p_value_result}`;
    } else {
      const are_result = formatValue(currentResults.absoluteRiskExposed?.value, 4);
      p1_for_calc = currentResults.absoluteRiskExposed?.value ?? NaN;
      const arc_result = formatValue(currentResults.absoluteRiskControl?.value, 4);
      p2_for_calc = currentResults.absoluteRiskControl?.value ?? NaN;

      const rd_result = formatValue(currentResults.riskDifference?.value, 4);
      const rd_ci_result = currentResults.riskDifference ? `${formatValue(currentResults.riskDifference.lower, 4)} to ${formatValue(currentResults.riskDifference.upper, 4)}` : 'N/A';
      
      const impact_absolute_label = currentResults.impactMeasures?.absolute.label || 'Absolute Impact';
      const impact_absolute_value = formatValue(currentResults.impactMeasures?.absolute.value, 4);
      const impact_relative_label = currentResults.impactMeasures?.relative.label || 'Relative Impact';
      const impact_relative_value = currentResults.impactMeasures ? `${formatValue(currentResults.impactMeasures.relative.value * 100)}%` : 'N/A';

      const rr_result = formatValue(currentResults.relativeRisk?.value);
      const rr_ci_result = currentResults.relativeRisk ? `${formatValue(currentResults.relativeRisk.lower)} to ${formatValue(currentResults.relativeRisk.upper)}` : 'N/A';
      
      let nnt_result_for_ai = 'Not applicable';
      if (currentResults.nnt) {
        if (currentResults.nnt.type === 'Benefit') {
          nnt_result_for_ai = `Number Needed to Treat (NNT): ${formatValue(currentResults.nnt.value)}`;
        } else {
          nnt_result_for_ai = `Number Needed to Harm (NNH): ${formatValue(currentResults.nnt.value)}`;
        }
      }

      let nnt_ci_result = 'Not applicable';
      if (currentResults.nnt && currentResults.riskDifference) {
          const rd_ci_lower = currentResults.riskDifference.lower;
          const rd_ci_upper = currentResults.riskDifference.upper;
          if (rd_ci_lower < 0 && rd_ci_upper > 0) {
              const nnh_ci_val = (1 / rd_ci_upper).toFixed(3);
              const nnt_ci_val = Math.abs(1 / rd_ci_lower).toFixed(3);
              nnt_ci_result = `${nnt_ci_val} (${currentTranslations.nntCIbenefit}) to ${nnh_ci_val} (${currentTranslations.nntCIharm})`;
          } else {
              let lower = currentResults.nnt.lower as number;
              let upper = currentResults.nnt.upper as number;
              if (isFinite(lower) && isFinite(upper)) {
                if (lower > upper) [lower, upper] = [upper, lower];
                nnt_ci_result = `${Math.abs(lower).toFixed(3)} to ${Math.abs(upper).toFixed(3)}`;
              } else {
                nnt_ci_result = 'CI includes infinity';
              }
          }
      }
      
      const power_result = currentResults.power ? `${(currentResults.power.value * 100).toFixed(1)}%` : 'N/A';
      const beta_result = currentResults.type2Error ? `${(currentResults.type2Error.value * 100).toFixed(1)}%` : 'N/A';

      metricsPrompt = `- Absolute Risk (Exposed): ${are_result}
- Absolute Risk (Control): ${arc_result}
- Risk Difference (RD): ${rd_result} (95% CI: ${rd_ci_result})
- ${impact_absolute_label}: ${impact_absolute_value}
- ${impact_relative_label}: ${impact_relative_value}
- Relative Risk (RR): ${rr_result} (95% CI: ${rr_ci_result})
- Odds Ratio (OR): ${or_result} (95% CI: ${or_ci_result})
- P-value: ${p_value_result}
- ${nnt_result_for_ai} (95% CI: ${nnt_ci_result})
- Statistical Power: ${power_result}
- Type II Error (β): ${beta_result}`;
    }
    
    let sampleSizeRecommendationPrompt = '';
    if (currentResults.power && currentResults.power.value < 0.80) {
        const requiredN = calculateRequiredSampleSize(p1_for_calc, p2_for_calc);
        if (requiredN) {
            sampleSizeRecommendationPrompt = `The calculated statistical power is low (${(currentResults.power.value * 100).toFixed(1)}%). To achieve 80% power, a future study would require approximately **${requiredN}** participants in each group.`;
        } else {
            sampleSizeRecommendationPrompt = `The calculated statistical power is low, but a sample size recommendation could not be determined from the provided data.`;
        }
    } else if (currentResults.power) {
        sampleSizeRecommendationPrompt = `The study was adequately powered at **${(currentResults.power.value * 100).toFixed(1)}%**. The current sample size was sufficient to detect an effect of the observed magnitude.`;
    }

    const prompt = `You are an expert epidemiologist and biostatistician. A healthcare professional is analyzing a **${studyDesignLabel}** with a **${goalLabel} outcome**. **The entire response must be written in ${langNameForPrompt}**. They have provided the following data:

- Exposed Group, With Outcome (a): ${currentInputs.a}
- Exposed Group, Without Outcome (b): ${currentInputs.b}
- Control Group, With Outcome (c): ${currentInputs.c}
- Control Group, Without Outcome (d): ${currentInputs.d}

Based on this data, the following metrics were calculated:
${metricsPrompt}

ADDITIONAL CONTEXT FOR RECOMMENDATIONS:
- Sample Size Analysis: ${sampleSizeRecommendationPrompt}

Please provide a structured interpretation in **${langNameForPrompt}** organized under the following three headers.

**MANDATORY FORMATTING RULES (Your response will be rejected if you do not follow these):**

1.  **Paragraph Separation:** Every distinct paragraph, header, sub-header, or list block MUST be separated by a double newline (\`\\n\\n\`). This creates a blank line between elements.
2.  **Bolding:** Use markdown bolding (\`**text**\`) ONLY for the three main headers, the limitation titles and the recommendations sub-header in Section 3, and for critical numerical values within the text. Do not bold anything else.
3.  **Headers:** You MUST use these exact headers, in this exact order: **"${currentTranslations.reportHeaders.interpretation}"**, **"${currentTranslations.reportHeaders.significance}"**, and **"${currentTranslations.reportHeaders.limitations}"**.
4.  **Content Instructions:**
    - **Context Framing:** Because the outcome is **${goalLabel}**, frame your entire analysis accordingly. **If the outcome is undesirable**, interpret the findings in the context of harm, risk factors, and adverse events. **If the outcome is desirable**, interpret the findings in the context of benefit, treatment efficacy, and protective factors.
    - **1. Interpretation of Findings:** Under this header, interpret the key metrics. Explain the Relative Risk (RR) and Odds Ratio (OR) as measures of association. Then, explain the measures of impact: describe the Absolute Impact as the actual difference in risk, and contrast it with the Relative Impact. Explain why both are important for clinical context (e.g., a relative measure can sound impressive, but the absolute measure provides the real-world impact). If the study is Case-Control, focus ONLY on the Odds Ratio.
    - **2. Statistical Significance, Power, and Clinical Relevance:** Under this header, assess the study's conclusions in three parts.
        - **Part A (Significance):** First, discuss statistical significance by interpreting the p-value and the **95% Confidence Intervals (CIs)** for the OR, and if applicable, RR and Risk Difference. Explicitly state whether the CIs for RR/OR include 1.0 or the CI for RD includes 0, and what this means for significance. Comment on the precision of the estimates based on the width of the CIs.
        - **Part B (Statistical Power - CRITICAL ANALYSIS):** Your interpretation MUST incorporate the study's **Statistical Power**.
            - **IF the result is NOT statistically significant (p-value > 0.05) AND Power is LOW (<80%):** Explain that the study was likely **underpowered**. State that this means the study had a high chance of missing a true effect if one existed. Explicitly mention the **Type II Error Rate (β)** as the probability of a false negative. Conclude that this non-significant finding should be interpreted with **extreme caution**.
            - **IF the result is NOT statistically significant (p-value > 0.05) AND Power is HIGH (≥80%):** Explain that the study was **adequately powered**. State that this provides stronger, more confident evidence that there is likely no meaningful association between the exposure and outcome.
            - **IF the result IS statistically significant (p-value ≤ 0.05):** State that the finding is robust. Explain that the calculated power indicates the study had a sufficient sample size to detect an effect of this magnitude, lending more confidence to the result. Mention that a Type I error (false positive) is always a possibility, with a 5% chance as defined by alpha.
        - **Part C (Clinical Relevance):** Second, discuss clinical relevance. If applicable, use the Absolute Impact and NNT/NNH to evaluate the real-world impact of the findings. For example, is the effect size large enough to change clinical practice?
    - **3. Limitations and Recommendations:** This section has a specific multi-part structure.
        - **Part A (Study Design Context):** Your first paragraph MUST explicitly address the specified study design. Based on the specified design of **${studyDesignLabel}**, you MUST tailor your analysis to reflect the inherent strengths and weaknesses of that methodology.
            - If the design is an **RCT**, emphasize the strong evidence for **causality**. Discuss the importance of randomization in minimizing confounding. Your limitations should focus on generalizability (external validity), potential for attrition bias, and the idealized nature of the trial.
            - If the design is a **Cohort Study**, emphasize that it shows strong evidence for **association** and can establish temporality (exposure precedes outcome), but cannot prove causality as definitively as an RCT. Your limitations MUST discuss the risk of **confounding variables** and **selection bias**.
            - If the design is a **Case-Control Study**, you MUST state that the primary measure of association is the **Odds Ratio**. Emphasize that this design is excellent for studying rare diseases but is susceptible to **recall bias** and **selection bias**. Clearly state that it cannot determine incidence or prevalence, and therefore Relative Risk and Risk Difference cannot be calculated.
        - **Part B (Limitations):** After the study design paragraph, write any additional paragraphs, each focusing on a single general limitation. Each of these paragraphs MUST begin with a bolded title followed by a colon. Example: \`**Confounding Variables:** The analysis does not...\`
        - **Part C (Sub-header):** After the limitation paragraphs, you MUST include the sub-header \`**${currentTranslations.reportHeaders.recommendations}**\` on its own line.
        - **Part D (Recommendations):** AFTER THE SUB-HEADER, YOU MUST ADD A DOUBLE NEWLINE (\\n\\n). Then, provide a single numbered list of recommendations.
            - **Your first recommendation MUST address sample size.** Use the "Sample Size Analysis" context provided above to formulate this recommendation.
            - Add other general recommendations in the list as you see fit.

Start your response directly with "**${currentTranslations.reportHeaders.interpretation}**".`;

    try {
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
        });
        
        const unescapedText = response.text.replace(/\\n/g, '\n');
        const cleanedText = unescapedText.replace(/###\s*/g, '').trim();
        setAiInterpretation(cleanedText);

    } catch (e) {
      console.error("Error fetching AI Interpretation:", e);
      setAiInterpretation("An error occurred while fetching the AI interpretation. Please check the console for details.");
      throw e;
    }
  }, []);
  
  const handleRequestSummary = useCallback(async () => {
    if (!results || !studyGoal || !studyDesign) return;
    
    setCurrentPage('narrativeSummary');

    if (!aiNarrativeSummary) {
        setIsInterpreting(true);
        try {
            await fetchAiNarrativeSummary(results, inputs, studyGoal, studyDesign, aiModel, language);
        } catch (e) {
            setAiNarrativeSummary("Failed to generate summary. Please go back and try again.");
        } finally {
            setIsInterpreting(false);
        }
    }
  }, [results, inputs, studyGoal, studyDesign, aiModel, language, aiNarrativeSummary, fetchAiNarrativeSummary]);

  const handleRequestReport = useCallback(async () => {
      if (!results || !studyGoal || !studyDesign) return;

      setCurrentPage('interpretation');
      
      if (!aiInterpretation) {
          setIsInterpreting(true);
          try {
              await fetchAiInterpretation(results, inputs, studyGoal, studyDesign, aiModel, language);
          } catch (e) {
              setAiInterpretation("Failed to generate report. Please go back and try again.");
          } finally {
              setIsInterpreting(false);
          }
      }
  }, [results, inputs, studyGoal, studyDesign, aiModel, language, aiInterpretation, fetchAiInterpretation]);

  const handleCalculate = useCallback(() => {
    setError(null);
    setResults(null);
    setAiInterpretation(null);
    setAiNarrativeSummary(null);
    
    if (!studyGoal) {
      setError(T.errorStudyGoal);
      return;
    }
    if (!studyDesign) {
      setError(T.errorStudyDesign);
      return;
    }
    
    setIsCalculating(true);

    const values = {
      a: parseInt(inputs.a, 10),
      b: parseInt(inputs.b, 10),
      c: parseInt(inputs.c, 10),
      d: parseInt(inputs.d, 10),
    };

    for (const key in values) {
      const val = values[key as keyof typeof values];
      if (isNaN(val) || val < 0) {
        setError(T.errorInvalidNumber(key));
        setIsCalculating(false);
        return;
      }
    }

    const corrected = {
        a: values.a === 0 ? 0.5 : values.a,
        b: values.b === 0 ? 0.5 : values.b,
        c: values.c === 0 ? 0.5 : values.c,
        d: values.d === 0 ? 0.5 : values.d,
    };

    const { a, b, c, d } = values;
    const { a: ca, b: cb, c: cc, d: cd } = corrected;
    
    const exposedTotal = a + b;
    const controlTotal = c + d;
    const exposedTotal_c = ca + cb;
    const controlTotal_c = cc + cd;

    let newResults: Results = {
      absoluteRiskExposed: null,
      absoluteRiskControl: null,
      riskDifference: null,
      relativeRisk: null,
      oddsRatio: null,
      impactMeasures: null,
      nnt: null,
      power: null,
      type1Error: null,
      type2Error: null,
    };
    
    // Risk, RD, RR, and Impact Measures are only valid for designs where incidence can be calculated.
    if (studyDesign !== 'case-control') {
      if (exposedTotal > 0 && controlTotal > 0) {
          const riskExposed = a / exposedTotal;
          const riskControl = c / controlTotal;
          
          newResults.absoluteRiskExposed = { value: riskExposed };
          newResults.absoluteRiskControl = { value: riskControl };
          
          const riskExposed_c = ca / exposedTotal_c;
          const riskControl_c = cc / controlTotal_c;
          
          const rd = riskExposed - riskControl;
          const se_rd = Math.sqrt((riskExposed_c * (1 - riskExposed_c) / exposedTotal_c) + (riskControl_c * (1 - riskControl_c) / controlTotal_c));
          newResults.riskDifference = { value: rd, lower: rd - 1.96 * se_rd, upper: rd + 1.96 * se_rd };
          
          if (riskControl > 0 && rd !== 0) {
              const absoluteValue = Math.abs(rd);
              const relativeValue = absoluteValue / riskControl;
              let absoluteLabel = '';
              let relativeLabel = '';

              if (studyGoal === 'undesirable') {
                  if (rd > 0) { // Harmful exposure increases undesirable outcome
                      absoluteLabel = 'Absolute Risk Increase (ARI)';
                      relativeLabel = 'Relative Risk Increase (RRI)';
                  } else { // Protective exposure reduces undesirable outcome
                      absoluteLabel = 'Absolute Risk Reduction (ARR)';
                      relativeLabel = 'Relative Risk Reduction (RRR)';
                  }
              } else { // desirable
                  if (rd > 0) { // Beneficial exposure increases desirable outcome
                      absoluteLabel = 'Absolute Benefit Increase (ABI)';
                      relativeLabel = 'Relative Benefit Increase (RBI)';
                  } else { // Harmful exposure reduces desirable outcome
                      absoluteLabel = 'Absolute Benefit Reduction (ABR)';
                      relativeLabel = 'Relative Benefit Reduction (RBR)';
                  }
              }
              newResults.impactMeasures = {
                  absolute: { label: absoluteLabel, value: absoluteValue },
                  relative: { label: relativeLabel, value: relativeValue },
              };
          }
          
          if (riskControl > 0 && riskExposed >= 0) { // Allow riskExposed to be 0
              const rr = riskExposed === 0 ? 0 : riskExposed / riskControl;
              const ln_rr = Math.log(rr);
              const se_ln_rr = Math.sqrt( (1-riskExposed_c)/ca + (1-riskControl_c)/cc );
              const zStat = ln_rr / se_ln_rr;
              newResults.relativeRisk = {
                  value: rr,
                  lower: Math.exp(ln_rr - 1.96 * se_ln_rr),
                  upper: Math.exp(ln_rr + 1.96 * se_ln_rr),
                  pValue: calculatePValueFromZ(zStat),
                  zStat: zStat,
              };
          }
          
          if (rd !== 0) {
              let nntType: 'Benefit' | 'Harm';

              // A "benefit" (NNT) occurs when an intervention reduces an undesirable outcome (rd < 0)
              // or increases a desirable one (rd > 0).
              // A "harm" (NNH) occurs when an intervention increases an undesirable outcome (rd > 0)
              // or reduces a desirable one (rd < 0).
              if ((studyGoal === 'undesirable' && rd < 0) || (studyGoal === 'desirable' && rd > 0)) {
                  nntType = 'Benefit';
              } else {
                  nntType = 'Harm';
              }
              
              newResults.nnt = {
                  value: 1 / Math.abs(rd),
                  type: nntType,
                  lower: 1 / newResults.riskDifference.upper,
                  upper: 1 / newResults.riskDifference.lower,
              }
          }

          // Post-hoc Power Calculation
          const alpha = 0.05;
          if (riskExposed !== riskControl) {
              const z_alpha_half = 1.96; // For two-tailed test
              const p_pooled = (a + c) / (exposedTotal + controlTotal);

              if (p_pooled > 0 && p_pooled < 1) {
                  const se_null = Math.sqrt(p_pooled * (1 - p_pooled) * (1 / exposedTotal + 1 / controlTotal));
                  const critical_diff = z_alpha_half * se_null;
                  
                  const se_alt_variance = (riskExposed * (1 - riskExposed) / exposedTotal) + (riskControl * (1 - riskControl) / controlTotal);
                  
                  if (se_alt_variance > 0) {
                      const se_alt = Math.sqrt(se_alt_variance);
                      const observed_diff = riskExposed - riskControl;
                      
                      // Standardize the critical values under the alternative hypothesis
                      const z_for_upper_tail = (critical_diff - observed_diff) / se_alt;
                      const z_for_lower_tail = (-critical_diff - observed_diff) / se_alt;

                      // Power is the probability of being in the rejection region under H1
                      // This is P(Z > z_for_upper_tail) + P(Z < z_for_lower_tail)
                      const power = (1 - normalCDF(z_for_upper_tail)) + normalCDF(z_for_lower_tail);
                      const beta = 1 - power;

                      newResults.power = { value: power };
                      newResults.type1Error = { value: alpha };
                      newResults.type2Error = { value: beta };
                  } else {
                       // Undefined SE, cannot calculate power
                       newResults.power = null;
                       newResults.type1Error = { value: alpha };
                       newResults.type2Error = null;
                  }
              } else {
                  // Pooled proportion is 0 or 1, cannot calculate power
                  newResults.power = null;
                  newResults.type1Error = { value: alpha };
                  newResults.type2Error = null;
              }
          } else { 
               // If there's no difference, power is the Type I error rate (alpha).
              newResults.power = { value: alpha };
              newResults.type1Error = { value: alpha };
              newResults.type2Error = { value: 1 - alpha };
          }
      }
    }
    
    // Odds Ratio is valid for all designs.
    if (a >= 0 && b > 0 && c > 0 && d >= 0) {
        const or = (ca * cd) / (cb * cc);
        const ln_or = Math.log(or);
        const se_ln_or = Math.sqrt(1/ca + 1/cb + 1/cc + 1/cd);
        const zStat = ln_or / se_ln_or;
        newResults.oddsRatio = {
            value: or,
            lower: Math.exp(ln_or - 1.96 * se_ln_or),
            upper: Math.exp(ln_or + 1.96 * se_ln_or),
            pValue: calculatePValueFromZ(zStat),
            zStat: zStat,
        };
    }

    setResults(newResults);
    setIsCalculating(false);
  }, [inputs, studyGoal, studyDesign, T]);
  

  const exposedTotal = (parseInt(inputs.a) || 0) + (parseInt(inputs.b) || 0);
  const controlTotal = (parseInt(inputs.c) || 0) + (parseInt(inputs.d) || 0);
  
  const formattedInterpretation = aiInterpretation
    ? aiInterpretation
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .split('\n\n')
        .map(block => {
            const trimmedBlock = block.trim();
            if (!trimmedBlock) return '';
            
            const reportHeaders = translations[language].reportHeaders;

            if (trimmedBlock.includes(reportHeaders.interpretation) ||
                trimmedBlock.includes(reportHeaders.significance) ||
                trimmedBlock.includes(reportHeaders.limitations)) {
                const mtClass = trimmedBlock.includes(reportHeaders.interpretation) ? '' : 'mt-6';
                const headerText = trimmedBlock.replace(/<\/?strong>/g, '').replace(/^\d+\.\s*/, '');
                return `<h4 class="text-lg font-semibold text-blue-700 mb-2 ${mtClass}">${headerText}</h4>`;
            }

            if (trimmedBlock.startsWith(`<strong>${reportHeaders.recommendations}</strong>`)) {
                const lines = trimmedBlock.split('\n');
                const subHeaderText = lines[0].replace(/<\/?strong>/g, '');
                const subHeaderHtml = `<p class="font-semibold text-slate-800 mt-4 mb-2">${subHeaderText}</p>`;
                
                const listContent = lines.slice(1).join('\n').trim();

                if (listContent.match(/^\d+\./m)) {
                    // The list is in the same block as the sub-header
                    const listItems = listContent.split('\n').map(item => {
                        const content = item.trim().replace(/^\d+\.\s*/, '');
                        return `<li>${content}</li>`;
                    }).join('');
                    const listHtml = `<ol class="list-decimal list-outside ml-4 space-y-2">${listItems}</ol>`;
                    return subHeaderHtml + listHtml;
                }
                
                // Only the sub-header is in this block
                return subHeaderHtml;
            }

            if (trimmedBlock.match(/^\d+\./m)) {
                const listItems = trimmedBlock.split('\n').map(item => {
                    const content = item.trim().replace(/^\d+\.\s*/, '');
                    return `<li>${content}</li>`;
                }).join('');
                return `<ol class="list-decimal list-outside ml-4 space-y-2">${listItems}</ol>`;
            }

            return `<p>${trimmedBlock}</p>`;
        })
        .join('')
    : '';

  const formattedNarrative = aiNarrativeSummary
    ? aiNarrativeSummary
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .split('\n\n')
        .map(block => {
            const trimmedBlock = block.trim();
            if (!trimmedBlock) return '';

            if (trimmedBlock.startsWith('<strong>')) {
                const headerText = trimmedBlock.replace(/<\/?strong>/g, '');
                
                const disclaimerHeader = translations[language].narrativeHeaders.disclaimer;
                if (headerText.toLowerCase().startsWith(disclaimerHeader.toLowerCase())) {
                    return `<p class="text-xs text-slate-500 mt-8">${trimmedBlock}</p>`;
                }
                
                const overviewHeader = translations[language].narrativeHeaders.overview;
                const mtClass = headerText.startsWith(overviewHeader) ? '' : 'mt-6';
                return `<h4 class="text-lg font-semibold text-blue-700 mb-2 ${mtClass}">${headerText}</h4>`;
            }

            return `<p>${trimmedBlock}</p>`;
        })
        .join('')
    : '';
    
  const Footer = () => (
    <footer className="bg-slate-100 border-t border-slate-200 mt-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-slate-500">
        <p><strong>{T.footerDisclaimer.split(':')[0]}:</strong> {T.footerDisclaimer.split(':')[1]}</p>
        <p className="mt-2">Created by Vitalii Usenko © 2025</p>
      </div>
    </footer>
  );
  
  if (currentPage === 'howToUse') {
    return <HowToUsePage language={language} onBack={() => setCurrentPage('calculator')} />;
  }

  if (currentPage === 'narrativeSummary') {
    return (
       <div className="min-h-screen flex flex-col bg-slate-50 antialiased text-slate-800 font-sans">
            <main className="flex-grow container mx-auto p-4 sm:p-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">{T.aiSummaryTitle}</h1>
                        <p className="text-slate-500 mt-2">{T.aiSummarySubtitle}</p>
                    </div>
                    <div className="mt-6">
                         <button
                            onClick={() => setCurrentPage('calculator')}
                            className="w-full sm:w-auto inline-flex justify-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                            {T.backToCalculatorButton}
                        </button>
                    </div>
                    <div className="mt-6 bg-white p-6 rounded-xl shadow-lg border border-slate-200 min-h-[300px] flex flex-col">
                        {isInterpreting && !aiNarrativeSummary && (
                            <div className="flex items-center justify-center p-4 flex-grow">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-slate-600">{T.generatingSummary}</span>
                            </div>
                        )}
                        
                        {aiNarrativeSummary && (
                            <div 
                                className="prose prose-sm prose-slate max-w-none space-y-4"
                                dangerouslySetInnerHTML={{ __html: formattedNarrative }}
                            />
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    )
  }

  if (currentPage === 'interpretation') {
    return (
       <div className="min-h-screen flex flex-col bg-slate-50 antialiased text-slate-800 font-sans">
            <main className="flex-grow container mx-auto p-4 sm:p-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">{T.aiFullReportTitle}</h1>
                        <p className="text-slate-500 mt-2">{T.aiFullReportSubtitle}</p>
                    </div>
                    <div className="mt-6">
                         <button
                            onClick={() => setCurrentPage('calculator')}
                            className="w-full sm:w-auto inline-flex justify-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                            {T.backToCalculatorButton}
                        </button>
                    </div>
                    <div className="mt-6 bg-white p-6 rounded-xl shadow-lg border border-slate-200 min-h-[300px] flex flex-col">
                        {isInterpreting && !aiInterpretation && (
                            <div className="flex items-center justify-center p-4 flex-grow">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-slate-600">{T.interpretingResults}</span>
                            </div>
                        )}
                        
                        {aiInterpretation && (
                            <div 
                                className="prose prose-sm prose-slate max-w-none space-y-4"
                                dangerouslySetInnerHTML={{ __html: formattedInterpretation }}
                            />
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col text-slate-800 font-sans">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-blue-700 tracking-tight">
              {T.headerTitle}
            </h1>
            <p className="text-slate-500 text-sm">{T.headerSubtitle}</p>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher currentLanguage={language} onLanguageChange={handleLanguageChange} />
            <button
              onClick={() => setCurrentPage('howToUse')}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              {T.howToUseButton}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-8 max-w-5xl mx-auto">
          
          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
            <div className="flex items-center mb-6 border-b pb-3">
              <h2 className="text-xl font-semibold text-slate-800">{T.setupAnalysisTitle}</h2>
              <Tooltip text={tooltips.contingencyTableInputs} />
            </div>
            <div className="space-y-6">

              <div className="p-4 border rounded-lg bg-slate-50">
                  <div className="flex items-center mb-2">
                      <h3 className="font-semibold text-lg text-slate-700">{T.step1Title}</h3>
                      <Tooltip text={tooltips.studyGoal} />
                  </div>
                  <p className="text-sm text-slate-600 mb-4">{T.step1Description}</p>
                  <fieldset className="flex flex-col sm:flex-row gap-x-6 gap-y-3">
                      <legend className="sr-only">Study Goal</legend>
                      <div className="flex items-center">
                          <input type="radio" id="undesirable" name="studyGoal" value="undesirable" checked={studyGoal === 'undesirable'} onChange={(e) => setStudyGoal(e.target.value as StudyGoal)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                          <label htmlFor="undesirable" className="ml-2 block text-sm font-medium text-slate-700">{T.goalUndesirable} <span className="text-slate-500 font-normal">{T.goalUndesirableExample}</span></label>
                      </div>
                      <div className="flex items-center">
                          <input type="radio" id="desirable" name="studyGoal" value="desirable" checked={studyGoal === 'desirable'} onChange={(e) => setStudyGoal(e.target.value as StudyGoal)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                          <label htmlFor="desirable" className="ml-2 block text-sm font-medium text-slate-700">{T.goalDesirable} <span className="text-slate-500 font-normal">{T.goalDesirableExample}</span></label>
                      </div>
                  </fieldset>
              </div>

              <div className="p-4 border rounded-lg bg-slate-50">
                  <div className="flex items-center mb-2">
                      <h3 className="font-semibold text-lg text-slate-700">{T.step2Title}</h3>
                      <Tooltip text={tooltips.studyDesign} />
                  </div>
                   <div className="relative">
                        <select
                            id="studyDesign"
                            name="studyDesign"
                            value={studyDesign || ''}
                            onChange={(e) => setStudyDesign(e.target.value as StudyDesign)}
                            className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                                       transition duration-150 ease-in-out appearance-none"
                        >
                            <option value="" disabled>{T.studyDesignPlaceholder}</option>
                            {(Object.keys(studyDesignLabels[language]) as StudyDesign[]).map(key => (
                                <option key={key} value={key} title={tooltips.studyDesignOptions[key]}>
                                    {studyDesignLabels[language][key]}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                           <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                   </div>
              </div>
              
              <div className="p-4 border rounded-lg bg-slate-50">
                  <div className="flex items-center mb-2">
                      <h3 className="font-semibold text-lg text-slate-700">{T.step3Title}</h3>
                      <Tooltip text={tooltips.aiModelSelection} />
                  </div>
                  <p className="text-sm text-slate-600 mb-4">{T.step3Description}</p>
                  <fieldset className="flex flex-col sm:flex-row gap-x-6 gap-y-3">
                      <legend className="sr-only">AI Model</legend>
                      <div className="flex items-center">
                          <input type="radio" id="gemini-flash" name="aiModel" value="gemini-2.5-flash" checked={aiModel === 'gemini-2.5-flash'} onChange={(e) => setAiModel(e.target.value as AiModel)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                          <label htmlFor="gemini-flash" className="ml-2 block text-sm font-medium text-slate-700">{T.geminiFlash} <span className="text-slate-500 font-normal">{T.geminiFlashDesc}</span></label>
                      </div>
                      <div className="flex items-center">
                          <input type="radio" id="gemini-pro" name="aiModel" value="gemini-2.5-pro" checked={aiModel === 'gemini-2.5-pro'} onChange={(e) => setAiModel(e.target.value as AiModel)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                          <label htmlFor="gemini-pro" className="ml-2 block text-sm font-medium text-slate-700">{T.geminiPro} <span className="text-slate-500 font-normal">{T.geminiProDesc}</span></label>
                      </div>
                  </fieldset>
              </div>


              <div className="p-4 border rounded-lg bg-slate-50">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                      <h3 className="font-semibold text-lg text-slate-700">{T.step4Title}</h3>
                      <Tooltip text={tooltips.exposedGroup} />
                    </div>
                    <span className="text-sm font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded">{T.total}: {exposedTotal}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center mb-1">
                      <label htmlFor="a" className="block text-sm font-medium text-slate-700">{T.withOutcomeA}</label>
                      <Tooltip text={tooltips.positiveOutcomeA} />
                    </div>
                    <InputControl id="a" value={inputs.a} onChange={handleInputChange} placeholder="e.g., 20" />
                  </div>
                  <div>
                    <div className="flex items-center mb-1">
                      <label htmlFor="b" className="block text-sm font-medium text-slate-700">{T.withoutOutcomeB}</label>
                      <Tooltip text={tooltips.negativeOutcomeB} />
                    </div>
                    <InputControl id="b" value={inputs.b} onChange={handleInputChange} placeholder="e.g., 80" />
                  </div>
                </div>
              </div>
              <div className="p-4 border rounded-lg bg-slate-50">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                      <h3 className="font-semibold text-lg text-slate-700">{T.step5Title}</h3>
                      <Tooltip text={tooltips.controlGroup} />
                    </div>
                    <span className="text-sm font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded">{T.total}: {controlTotal}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center mb-1">
                      <label htmlFor="c" className="block text-sm font-medium text-slate-700">{T.withOutcomeC}</label>
                      <Tooltip text={tooltips.positiveOutcomeC} />
                    </div>
                    <InputControl id="c" value={inputs.c} onChange={handleInputChange} placeholder="e.g., 5" />
                  </div>
                  <div>
                    <div className="flex items-center mb-1">
                      <label htmlFor="d" className="block text-sm font-medium text-slate-700">{T.withoutOutcomeD}</label>
                      <Tooltip text={tooltips.negativeOutcomeD} />
                    </div>
                    <InputControl id="d" value={inputs.d} onChange={handleInputChange} placeholder="e.g., 95" />
                  </div>
                </div>
              </div>
            </div>
            {error && <div className="mt-4 text-red-600 bg-red-100 p-3 rounded-md text-sm">{error}</div>}
            <div className="mt-8 flex items-center gap-4">
              <button type="button" onClick={handleCalculate} disabled={isCalculating || !studyGoal || !studyDesign} className="w-full inline-flex justify-center py-2.5 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed">
                {isCalculating ? T.calculatingButton : T.calculateButton}
              </button>
              <button type="button" onClick={handleReset} className="w-full inline-flex justify-center py-2.5 px-4 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 transition-colors">{T.resetButton}</button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 flex flex-col">
             {results ? (
                 <>
                    <div className="flex-wrap flex justify-between items-start gap-y-3 mb-4 border-b pb-3">
                      <div>
                        <div className="flex items-center">
                          <h2 className="text-xl font-semibold text-slate-800">{T.resultsTitle}</h2>
                          <Tooltip text={tooltips.calculatedMetrics} />
                        </div>
                        {studyGoal && studyDesign && (
                          <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                             <p><span className="font-semibold">{T.resultsGoal}:</span> {studyGoal === 'desirable' ? T.resultsGoalDesirable : T.resultsGoalUndesirable}</p>
                             <p><span className="font-semibold">{T.resultsDesign}:</span> {studyDesignLabels[language][studyDesign]}</p>
                             <p><span className="font-semibold">{T.resultsAiModel}:</span> {aiModel === 'gemini-2.5-flash' ? T.geminiFlash : T.geminiPro}</p>
                          </div>
                        )}
                      </div>
                      {results && (
                          <div className="flex items-center gap-2">
                              <button
                                  onClick={handleRequestSummary}
                                  className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                              >
                                  {T.aiSummaryButton}
                              </button>
                              <button
                                  onClick={handleRequestReport}
                                  className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                              >
                                  {T.aiFullReportButton}
                              </button>
                          </div>
                      )}
                    </div>
                    <div className="space-y-6">
                        {studyDesign === 'case-control' && (
                          <div className="p-3 bg-blue-50 text-blue-800 rounded-md text-sm" role="alert">
                            <p>
                                {T.caseControlWarning.split('<strong>')[0]}
                                <strong>{T.caseControlWarning.split('<strong>')[1].split('</strong>')[0]}</strong>
                                {T.caseControlWarning.split('</strong>')[1].split('<strong>')[0]}
                                <strong>{T.caseControlWarning.split('<strong>')[2].split('</strong>')[0]}</strong>
                                {T.caseControlWarning.split('</strong>')[2]}
                            </p>
                          </div>
                        )}
                        <div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-600">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                        <tr>
                                            <th scope="col" className="px-4 py-2 rounded-l-lg">{T.metricHeader}</th>
                                            <th scope="col" className="px-4 py-2 rounded-r-lg">{T.resultHeader}</th>
                                        </tr>
                                    </thead>
                                    
                                    {studyDesign !== 'case-control' && (
                                      <tbody className="bg-white">
                                          <tr className="bg-slate-50 font-semibold text-slate-600"><td colSpan={2} className="px-4 py-2 text-sm"><div className="flex items-center"><span>{T.incidenceHeader}</span><Tooltip text={tooltips.incidence} /></div></td></tr>
                                          {results.absoluteRiskExposed && <tr className="border-b border-slate-200"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.absRiskExposed}</span><Tooltip text={tooltips.absoluteRiskExposed} /></div></th><td className="px-4 py-3 font-mono">{results.absoluteRiskExposed.value.toFixed(4)}</td></tr>}
                                          {results.absoluteRiskControl && <tr className="border-b border-slate-200"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.absRiskControl}</span><Tooltip text={tooltips.absoluteRiskControl} /></div></th><td className="px-4 py-3 font-mono">{results.absoluteRiskControl.value.toFixed(4)}</td></tr>}
                                      </tbody>
                                    )}

                                    <tbody className="bg-white">
                                        <tr className="bg-slate-50 font-semibold text-slate-600"><td colSpan={2} className="px-4 py-2 text-sm"><div className="flex items-center"><span>{T.assocMeasuresHeader}</span><Tooltip text={tooltips.measuresOfAssociation} /></div></td></tr>
                                        {studyDesign !== 'case-control' && (
                                          results.relativeRisk ? (
                                              <>
                                                  <tr className="border-t border-slate-300"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.relativeRisk}</span><Tooltip text={tooltips.relativeRisk} /></div></th><td className="px-4 py-3 font-mono">{results.relativeRisk.value.toFixed(4)}</td></tr>
                                                  <tr className="border-t border-slate-200"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.ci95}</span><Tooltip text={tooltips.rr95CI} /></div></th><td className="px-4 py-3 font-mono">{`${results.relativeRisk.lower.toFixed(4)} to ${results.relativeRisk.upper.toFixed(4)}`}</td></tr>
                                                  <tr className="border-t border-slate-200"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.zStatistic}</span><Tooltip text={tooltips.rrZStat} /></div></th><td className="px-4 py-3 font-mono">{results.relativeRisk.zStat.toFixed(3)}</td></tr>
                                                  <tr className="border-t border-slate-200"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.significanceLevel}</span><Tooltip text={tooltips.rrSignificance} /></div></th><td className="px-4 py-3 font-mono">P = {results.relativeRisk.pValue}</td></tr>
                                              </>
                                          ) : <tr className="border-t border-slate-300"><th scope="row" className="px-4 py-3 font-medium">{T.relativeRisk}</th><td className="px-4 py-3 font-mono">{T.notCalculable}</td></tr>
                                        )}

                                        {results.oddsRatio ? (
                                            <>
                                                <tr className="border-t-2 border-slate-300"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.oddsRatio}</span><Tooltip text={tooltips.oddsRatio} /></div></th><td className="px-4 py-3 font-mono">{results.oddsRatio.value.toFixed(4)}</td></tr>
                                                <tr className="border-t border-slate-200"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.ci95}</span><Tooltip text={tooltips.or95CI} /></div></th><td className="px-4 py-3 font-mono">{`${results.oddsRatio.lower.toFixed(4)} to ${results.oddsRatio.upper.toFixed(4)}`}</td></tr>
                                                <tr className="border-t border-slate-200"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.zStatistic}</span><Tooltip text={tooltips.orZStat} /></div></th><td className="px-4 py-3 font-mono">{results.oddsRatio.zStat.toFixed(3)}</td></tr>
                                                <tr className="border-b border-slate-200"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.significanceLevel}</span><Tooltip text={tooltips.orSignificance} /></div></th><td className="px-4 py-3 font-mono">P = {results.oddsRatio.pValue}</td></tr>
                                            </>
                                        ) : <tr className="border-t-2 border-slate-300 border-b border-slate-200"><th scope="row" className="px-4 py-3 font-medium">{T.oddsRatio}</th><td className="px-4 py-3 font-mono">{T.notCalculable}</td></tr>}
                                    </tbody>

                                    {studyDesign !== 'case-control' && (
                                      <tbody className="bg-white">
                                          <tr className="bg-slate-50 font-semibold text-slate-600"><td colSpan={2} className="px-4 py-2 text-sm"><div className="flex items-center"><span>{T.impactMeasuresHeader}</span><Tooltip text={tooltips.measuresOfImpact} /></div></td></tr>
                                          {results.riskDifference && (
                                              <>
                                                  <tr className="border-t border-slate-300"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.riskDifference}</span><Tooltip text={tooltips.riskDifference} /></div></th><td className="px-4 py-3 font-mono">{results.riskDifference.value.toFixed(4)}</td></tr>
                                                  <tr className="border-t border-slate-200 border-b"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.ci95}</span><Tooltip text={tooltips.rd95CI} /></div></th><td className="px-4 py-3 font-mono">{`${results.riskDifference.lower.toFixed(4)} to ${results.riskDifference.upper.toFixed(4)}`}</td></tr>
                                              </>
                                          )}
                                          {results.impactMeasures && (
                                              <>
                                                  <tr className="border-b border-slate-200">
                                                      <th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{results.impactMeasures.absolute.label}</span><Tooltip text={tooltips.absoluteImpact} /></div></th>
                                                      <td className="px-4 py-3 font-mono">{results.impactMeasures.absolute.value.toFixed(4)}</td>
                                                  </tr>
                                                  { results.impactMeasures.relative &&
                                                      <tr className="border-b border-slate-200">
                                                          <th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{results.impactMeasures.relative.label}</span><Tooltip text={tooltips.relativeImpact} /></div></th>
                                                          <td className="px-4 py-3 font-mono">{`${(results.impactMeasures.relative.value * 100).toFixed(2)}%`}</td>
                                                      </tr>
                                                  }
                                              </>
                                          )}
                                          
                                          {results.nnt && results.riskDifference ? (
                                              (() => {
                                                  const isBenefit = results.nnt!.type === 'Benefit';
                                                  const label = isBenefit ? T.nntBenefit : T.nntHarm;
                                                  const colorClass = isBenefit ? 'text-green-700 font-semibold' : 'text-amber-700 font-semibold';

                                                  return (
                                                      <>
                                                          <tr className="border-t border-slate-300">
                                                              <th scope="row" className="px-4 py-3 font-medium">
                                                                  <div className="flex items-center">
                                                                      <span className={colorClass}>{label}</span>
                                                                      <Tooltip text={tooltips.nnt} />
                                                                  </div>
                                                              </th>
                                                              <td className={`px-4 py-3 font-mono ${colorClass}`}>
                                                                  {results.nnt!.value.toFixed(3)}
                                                              </td>
                                                          </tr>
                                                          <tr className="border-t border-slate-200">
                                                            <th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.ci95}</span><Tooltip text={tooltips.nnt95CI} /></div></th>
                                                            <td className="px-4 py-3 font-mono">
                                                                {(() => {
                                                                    const rd_ci_lower = results.riskDifference!.lower;
                                                                    const rd_ci_upper = results.riskDifference!.upper;
                                                                    if (rd_ci_lower < 0 && rd_ci_upper > 0) {
                                                                        const nnh_ci_val = (1 / rd_ci_upper).toFixed(3);
                                                                        const nnt_ci_val = Math.abs(1 / rd_ci_lower).toFixed(3);
                                                                        return `${nnt_ci_val} (${T.nntCIbenefit}) to ${nnh_ci_val} (${T.nntCIharm})`;
                                                                    } else {
                                                                        let lower = results.nnt!.lower as number;
                                                                        let upper = results.nnt!.upper as number;
                                                                        if (lower > upper) [lower, upper] = [upper, lower];
                                                                        return `${Math.abs(lower).toFixed(3)} to ${Math.abs(upper).toFixed(3)}`;
                                                                    }
                                                                })()}
                                                            </td>
                                                          </tr>
                                                      </>
                                                  );
                                              })()
                                          ) : <tr><th scope="row" className="px-4 py-3 font-medium">{T.nntHeader}</th><td className="px-4 py-3 font-mono">{T.notCalculable}</td></tr>}
                                      </tbody>
                                    )}

                                    <tbody className="bg-white">
                                        <tr className="bg-slate-50 font-semibold text-slate-600"><td colSpan={2} className="px-4 py-2 text-sm"><div className="flex items-center"><span>{T.reliabilityHeader}</span><Tooltip text={tooltips.analysisReliability} /></div></td></tr>
                                        {results.type1Error && <tr className="border-b border-slate-200"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.type1Error}</span><Tooltip text={tooltips.type1Error} /></div></th><td className="px-4 py-3 font-mono">{(results.type1Error.value * 100).toFixed(1)}%</td></tr>}
                                        {results.power && <tr className="border-b border-slate-200"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.statPower}</span><Tooltip text={tooltips.statisticalPower} /></div></th><td className="px-4 py-3 font-mono">{(results.power.value * 100).toFixed(1)}%</td></tr>}
                                        {results.type2Error && <tr className="border-b border-slate-200"><th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center"><span>{T.type2Error}</span><Tooltip text={tooltips.type2Error} /></div></th><td className="px-4 py-3 font-mono">{(results.type2Error.value * 100).toFixed(1)}%</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                 </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-grow text-center text-slate-500 bg-slate-50 rounded-lg p-8">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002 2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                 </svg>
                <p>{T.resultsPlaceholderTitle}</p>
                <p className="text-sm mt-1">{T.resultsPlaceholderDesc}</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default App;
