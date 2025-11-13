# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **AI-Powered Health Outcomes Navigator** - a React-based web application for epidemiological analysis. It calculates statistical measures from 2x2 contingency tables and uses Google's Gemini AI to generate interpretative reports for healthcare research studies.

The app originated from AI Studio: https://ai.studio/apps/drive/10ohoWcr2at61c3HRDe59wiOTBB1cNgP5

## Development Commands

### Setup
```bash
npm install
```

### Configuration
Set the `GEMINI_API_KEY` in `.env.local` before running:
```
GEMINI_API_KEY=your_api_key_here
```

### Development Server
```bash
npm run dev
```
- Runs on port 3000 by default
- Available at http://localhost:3000

### Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Architecture

### Core Application Structure

**App.tsx** (1155 lines) - Main application component containing:
- All statistical calculation logic (normalCDF, calculatePValueFromZ, calculateRequiredSampleSize)
- Three distinct page views: calculator, interpretation (AI report), narrativeSummary (AI summary)
- State management for inputs, results, AI interpretations, language selection
- Integration with Google Gemini AI for generating interpretative reports

### Key Statistical Calculations

The app performs epidemiological calculations for different study designs:

1. **Universal metrics (all designs)**:
   - Odds Ratio (OR) with 95% CI
   - Z-statistics and p-values

2. **Non-case-control designs only**:
   - Absolute Risk (Exposed and Control groups)
   - Relative Risk (RR) with 95% CI
   - Risk Difference (RD) with 95% CI
   - Impact Measures (ARR/ARI/ABI/ABR and RRR/RRI/RBI/RBR)
   - Number Needed to Treat/Harm (NNT/NNH) with 95% CI
   - Statistical Power and Type I/II Error rates

3. **Special handling**:
   - Zero-cell correction (0.5 continuity correction) for calculations
   - Study goal determines metric interpretation (desirable vs undesirable outcomes)

### Components

- **InputControl.tsx** - Number input wrapper with styling
- **Tooltip.tsx** - Information tooltips throughout the UI
- **HowToUsePage.tsx** - Full user guide page
- **LanguageSwitcher.tsx** - Language toggle component
- **ResultCard.tsx** - (Present but not actively used in current implementation)

### Internationalization (i18n.ts)

**Critical file** (624 lines) containing:
- All UI translations for 3 languages: English, Ukrainian, Russian
- Study design labels and goal labels
- Tooltip content (via `getTooltips()` function)

When modifying UI text, always update all three language variants.

### Data Flow

1. User inputs 2x2 table values (a, b, c, d) and selects study design/goal
2. `handleCalculate()` validates inputs and performs all statistical calculations
3. Results stored in state and displayed in results table
4. User can request AI interpretation or narrative summary
5. `fetchAiInterpretation()` or `fetchAiNarrativeSummary()` sends structured prompts to Gemini
6. AI responses are formatted with markdown and displayed on separate pages

### Environment Variables

The app uses Vite's environment variable system:
- `GEMINI_API_KEY` from `.env.local` is accessed as `process.env.API_KEY` in code
- Defined in `vite.config.ts` using `defineConfig` and `loadEnv`

### Study Design Types

Five supported study designs with different calculation capabilities:
1. `rct` - Randomized Controlled Trial (full calculations)
2. `non-rct` - Non-Randomized Controlled Trial (full calculations)
3. `cohort-prospective` - Prospective Cohort Study (full calculations)
4. `cohort-retrospective` - Retrospective Cohort Study (full calculations)
5. `case-control` - Case-Control Study (OR only, no incidence-based metrics)

### AI Integration

Two types of AI-generated content:
1. **Full Report** (`fetchAiInterpretation`) - Detailed statistical interpretation with sections on:
   - Interpretation of Findings
   - Statistical Significance, Power, and Clinical Relevance
   - Limitations and Recommendations

2. **Narrative Summary** (`fetchAiNarrativeSummary`) - Accessible summary with sections on:
   - Study Overview
   - Key Findings
   - Impact on Individuals/Populations
   - Conclusion

Both use highly structured prompts with mandatory formatting rules to ensure consistent output across languages.

### Styling

- TailwindCSS via CDN (included in index.html)
- Prose plugin for formatted text content
- Responsive design with mobile-first approach

## Important Implementation Notes

1. **Case-Control Studies**: When `studyDesign === 'case-control'`, the app intentionally skips all incidence-based calculations (RR, RD, NNT, Power). Only OR is valid.

2. **Zero-Cell Handling**: The app uses continuity correction (adds 0.5) for calculations but displays original values in the UI.

3. **NNT/NNH Logic**: The determination of "Benefit" vs "Harm" depends on both the study goal (desirable/undesirable) and the direction of the risk difference.

4. **Language Synchronization**: When language changes, AI-generated content is cleared (`setAiInterpretation(null)`) to prevent language mismatch.

5. **AI Prompt Engineering**: The prompts contain extensive formatting instructions to ensure markdown output is correctly structured for HTML rendering with proper spacing and headers.

6. **Path Alias**: The project uses `@/` as an alias for the root directory (configured in both `vite.config.ts` and `tsconfig.json`).

## Type Definitions

All TypeScript interfaces are in `types.ts`:
- `Inputs` - The 2x2 table cell values
- `Results` - All calculated metrics with confidence intervals

Additional types in i18n.ts:
- `Language` - 'en' | 'uk' | 'ru'
- `StudyDesign` - Study type enum
- `StudyGoal` - 'desirable' | 'undesirable'
