# Branding Extraction with LLM Enhancement

## Overview

We've implemented a two-phase branding extraction system where **LLM makes the final decision** on button classification:

1. **Phase 1 (JS)**: Fast extraction of ALL buttons and their styles (~200ms)
2. **Phase 2 (LLM)**: LLM analyzes all buttons and **selects** which is primary/secondary (~2-5s)

**Key Innovation**: Instead of relying on class names like `.primary` or `.btn-cta` (which modern Tailwind sites don't use), the LLM analyzes button text, colors, and visual hierarchy to identify the actual CTA.

## Architecture

### Phase 1: JavaScript Extraction (`brandingScript.js`)

Extracts raw branding data from the DOM:

- Colors (primary, secondary, accent, backgrounds)
- Fonts (with Next.js font name cleaning)
- Typography (font families, sizes)
- Buttons (primary & secondary with class-based and heuristic detection)
- Color scheme (light/dark mode detection)
- Spacing tokens (border radius, base units)
- Logo & images

**JS Extracts ALL Buttons (top 20):**

- Text content
- Background, text, and border colors
- Border radius
- CSS classes
- HTML structure

**LLM Analyzes & Selects:**

1. **Primary Button**: Looks for:
   - Action-oriented text ("Get Started", "Sign Up", "Start Free", "Start your Project")
   - Brand/accent colors (green, blue, orange CTAs)
   - Higher contrast
   - Prominent styling
2. **Secondary Button**: Looks for:
   - Less prominent text ("Login", "Learn More", "Contact")
   - Transparent/subtle backgrounds
   - Border/outline styles
   - Muted colors

3. **Returns Button Indices**: LLM returns index (0-19) of which button is primary/secondary, with reasoning

### Phase 2: LLM Enhancement (`lib/branding-llm.ts`)

Uses AI to:

- **PRIMARY TASK**: Classify buttons semantically by analyzing ALL detected buttons
- Clarify color roles (primary vs accent vs background)
- Extract brand personality (tone, energy, target audience)
- Detect design system (Tailwind, Bootstrap, custom, etc.)
- Provide confidence scores and reasoning

## API Usage

### Basic Request (with LLM)

```bash
POST /v2/scrape
{
  "url": "https://example.com",
  "formats": [
    { "type": "branding" },
    { "type": "screenshot" }  # Optional but recommended for better LLM analysis
  ]
}
```

### Response Structure

```json
{
  "data": {
    "branding": {
      "color_scheme": "dark",
      "fonts": ["Inter", "Roboto Mono"],
      "colors": {
        "primary": "#FA5D19",
        "secondary": "#000000",
        "accent": "#FA5D19",
        "background": "#000000",
        "text_primary": "#FFFFFF"
      },
      "typography": {
        "font_families": {
          "primary": "Inter",
          "heading": "Inter"
        },
        "font_sizes": {
          "h1": "32px",
          "h2": "24px",
          "body": "16px"
        }
      },
      "components": {
        "button_primary": {
          "background": "#FA5D19",
          "text_color": "#FFFFFF",
          "border_color": null,
          "border_radius": "10px"
        },
        "button_secondary": {
          "background": "rgba(0, 0, 0, 0.04)",
          "text_color": "#262626",
          "border_color": "#E5E7EB",
          "border_radius": "10px"
        },
        "input": {
          "border_color": "#E5E7EB",
          "border_radius": "8px"
        }
      },
      "spacing": {
        "base_unit": "8px",
        "border_radius": "8px"
      },
      "images": {
        "logo": "data:image/svg+xml;utf8,...",
        "favicon": "https://...",
        "og_image": "https://..."
      },

      // LLM-added fields
      "personality": {
        "tone": "professional",
        "energy": "high",
        "target_audience": "developers"
      },
      "design_system": {
        "framework": "tailwind",
        "component_library": "radix-ui"
      },
      "confidence": {
        "buttons": 0.95,
        "colors": 0.92,
        "overall": 0.935
      },

      // DEBUG: LLM's reasoning (helpful for development)
      "__llm_button_reasoning": {
        "primary": {
          "index": 3,
          "text": "Start your Project",
          "reasoning": "This button has the strongest CTA text and uses the brand green color (#3ECF8E), making it the primary action"
        },
        "secondary": {
          "index": 5,
          "text": "Login",
          "reasoning": "This button has a transparent background with border, typical of secondary actions"
        }
      }
    }
  }
}
```

## Implementation Details

### File Structure

```
apps/api/src/
├── lib/
│   └── branding-llm.ts          # LLM enhancement service
├── scraper/scrapeURL/
│   ├── engines/fire-engine/
│   │   └── brandingScript.js    # Browser-side JS extraction
│   └── transformers/
│       └── index.ts              # Integrates JS + LLM
└── types/
    └── branding.ts               # TypeScript types
```

### LLM Provider

- **Default Model**: `gpt-4o-mini` (fast, cheap, vision-capable)
- **Fallback**: JS-only analysis if LLM fails
- **Supports**: OpenAI, Anthropic, Ollama, Groq, and more

### Performance

- **JS only**: ~200ms
- **JS + LLM**: ~2-5s
- **With screenshot**: +0.5-1s

### Cost Estimation

- ~$0.001-0.002 per request with gpt-4o-mini
- Includes vision analysis if screenshot provided

## Demo Page

Visit: `http://localhost:3002/demo/branding`

Features:

- Live branding extraction
- Visual style guide
- Color swatches
- Button previews (on appropriate background for dark/light mode)
- Font showcase
- Collapsible JSON viewer

## Future Enhancements

1. **Caching**: Cache LLM results by domain (7-day TTL)
2. **Async Mode**: Return JS results immediately, LLM via webhook
3. **Targeted Screenshots**: Crop to buttons/logo areas only
4. **Fine-tuned Model**: Train on branding dataset for better accuracy
5. **Batch Analysis**: Analyze multiple pages for brand consistency

## Debugging

### Enable Debug Output

The JS extraction includes debug information in development:

- Button class detection
- Color scheme detection
- Font name cleaning
- DOM element inspection

Check server logs for:

```
DEBUG: Buttons with "brand" in classes: [...]
Snapshot button: { tag: 'BUTTON', extractedClasses: '...' }
🔥 JS branding analysis { ... }
🔥 Final branding (JS + LLM) { ... }
```

### Common Issues

**1. Classes not captured:**

- Check `__debug.dom_buttons` in response
- Verify button elements have `class` attribute
- Check console logs for `Snapshot button:` entries

**2. Wrong button detected:**

- LLM should correct this with high confidence
- Check `confidence.buttons` score
- Review button HTML in logs

**3. LLM fails:**

- Falls back to JS-only analysis
- Check logs for "LLM branding enhancement failed"
- Verify API keys are set

## Configuration

### Environment Variables

```bash
# LLM Provider (optional, defaults to OpenAI)
OPENAI_API_KEY=sk-...
MODEL_NAME=gpt-4o-mini  # Override default model

# Or use alternative providers:
ANTHROPIC_API_KEY=...
GROQ_API_KEY=...
OLLAMA_BASE_URL=http://localhost:11434
```

## Testing

Test with various sites:

- ✅ **Supabase** (Tailwind + brand colors) - **FIXED**: Now correctly identifies green "Start your Project" button as primary CTA
- ✅ Firecrawl (Tailwind + custom)
- ✅ Vercel (Dark mode + Next.js fonts)
- ✅ Stripe (Custom design system)
- ✅ Linear (Modern, minimalist)

### Why Supabase Was Hard (and How We Fixed It):

**Problem**: The green CTA button has classes like `bg-brand-400` with no explicit "primary" indicator. Pure class-based detection fails.

**Solution**: LLM analyzes:

- Button text: "Start your Project" (strong CTA vs "Login")
- Colors: Green (#3ECF8E) stands out vs transparent/subtle buttons
- Visual hierarchy: Prominent placement and styling
- Context: Action-oriented vs navigational text

Result: LLM correctly identifies the green button with 90%+ confidence.

```bash
# Test with curl
curl -X POST http://localhost:3002/v2/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://supabase.com",
    "formats": [{"type": "branding"}, {"type": "screenshot"}]
  }'
```

## Notes

- LLM always runs for branding requests (as per requirements)
- Screenshot is optional but improves LLM accuracy
- JS analysis runs first, LLM enhances semantically
- Confidence scores help users know when to trust results
- Falls back gracefully if LLM fails
