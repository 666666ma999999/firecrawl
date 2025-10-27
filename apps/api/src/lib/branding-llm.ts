import { generateObject } from "ai";
import { getModel } from "./generic-ai";
import { z } from "zod";
import { BrandingProfile } from "../types/branding";

// Schema for LLM output
const brandingEnhancementSchema = z.object({
  // Button classification - LLM picks which buttons are primary/secondary
  button_classification: z.object({
    primary_button_index: z
      .number()
      .describe(
        "Index of the primary CTA button in the provided list (0-based), or -1 if none found",
      ),
    primary_button_reasoning: z
      .string()
      .describe("Why this button was selected as primary"),
    secondary_button_index: z
      .number()
      .describe(
        "Index of the secondary button in the provided list (0-based), or -1 if none found",
      ),
    secondary_button_reasoning: z
      .string()
      .describe("Why this button was selected as secondary"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe("Confidence in button classification (0-1)"),
  }),

  // Color role clarification
  color_roles: z.object({
    primary_color: z.string().optional().describe("Main brand color (hex)"),
    accent_color: z.string().optional().describe("Accent/CTA color (hex)"),
    background_color: z
      .string()
      .optional()
      .describe("Main background color (hex)"),
    text_primary: z.string().optional().describe("Primary text color (hex)"),
    confidence: z.number().min(0).max(1),
  }),

  // Brand personality
  personality: z
    .object({
      tone: z
        .enum([
          "professional",
          "playful",
          "modern",
          "traditional",
          "minimalist",
          "bold",
        ])
        .describe("Overall brand tone"),
      energy: z.enum(["low", "medium", "high"]).describe("Visual energy level"),
      target_audience: z.string().describe("Perceived target audience"),
    })
    .optional(),

  // Design system insights
  design_system: z
    .object({
      framework: z
        .enum([
          "tailwind",
          "bootstrap",
          "material",
          "chakra",
          "custom",
          "unknown",
        ])
        .describe("Detected CSS framework"),
      component_library: z
        .string()
        .optional()
        .describe("Detected component library (e.g., radix-ui, shadcn)"),
    })
    .optional(),
});

type BrandingEnhancement = z.infer<typeof brandingEnhancementSchema>;

export interface ButtonSnapshot {
  index: number;
  text: string;
  html: string;
  classes: string;
  background: string;
  textColor: string;
  borderColor?: string;
  borderRadius?: string;
}

interface BrandingLLMInput {
  // JS analysis results
  js_analysis: BrandingProfile;

  // Button data with snapshots
  buttons: ButtonSnapshot[];

  // Screenshot (optional)
  screenshot?: string; // base64 or URL

  // Additional context
  url: string;
}

export async function enhanceBrandingWithLLM(
  input: BrandingLLMInput,
): Promise<BrandingEnhancement> {
  const model = getModel("gpt-4o-mini"); // Fast and cheap for this task

  // Build prompt
  const prompt = buildBrandingPrompt(input);

  try {
    const result = await generateObject({
      model,
      schema: brandingEnhancementSchema,
      messages: [
        {
          role: "system",
          content:
            "You are a brand design expert analyzing websites to extract accurate branding information.",
        },
        {
          role: "user",
          content: input.screenshot
            ? [
                { type: "text", text: prompt },
                { type: "image", image: input.screenshot },
              ]
            : prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent results
    });

    return result.object;
  } catch (error) {
    console.error("LLM branding enhancement failed:", error);
    // Return default/fallback
    return {
      button_classification: {
        primary_button_index: -1,
        primary_button_reasoning: "LLM failed",
        secondary_button_index: -1,
        secondary_button_reasoning: "LLM failed",
        confidence: 0,
      },
      color_roles: {
        confidence: 0,
      },
    };
  }
}

function buildBrandingPrompt(input: BrandingLLMInput): string {
  const { js_analysis, buttons, url } = input;

  let prompt = `Analyze the branding of this website: ${url}\n\n`;

  // Add JS analysis context
  prompt += `## JavaScript Analysis (Baseline):\n`;
  prompt += `Color Scheme: ${js_analysis.color_scheme || "unknown"}\n`;

  if (js_analysis.colors) {
    prompt += `Detected Colors:\n`;
    Object.entries(js_analysis.colors).forEach(([key, value]) => {
      if (value) prompt += `- ${key}: ${value}\n`;
    });
  }

  if (js_analysis.fonts) {
    prompt += `\nFonts: ${js_analysis.fonts.join(", ")}\n`;
  }

  // Helper to analyze color vibrancy
  const getColorInfo = (colorStr: string) => {
    if (!colorStr || colorStr === "transparent")
      return { isVibrant: false, description: "transparent" };

    // Parse hex or rgb/rgba
    let r = 0,
      g = 0,
      b = 0;
    if (colorStr.startsWith("#")) {
      const hex = colorStr.replace("#", "");
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    } else {
      const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      }
    }

    // Calculate saturation and brightness
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const brightness = max / 255;

    // Vibrant = high saturation (>0.3) and decent brightness (>0.2)
    const isVibrant = saturation > 0.3 && brightness > 0.2;

    // Describe the color
    let description = "";
    if (g > r && g > b && g > 100) description = "green";
    else if (b > r && b > g && b > 100) description = "blue";
    else if (r > g && r > b && r > 100) description = "red/orange";
    else if (max < 50) description = "dark";
    else if (min > 200) description = "light/white";
    else description = "neutral";

    return {
      isVibrant,
      description,
      saturation: saturation.toFixed(2),
      brightness: brightness.toFixed(2),
    };
  };

  // Add button context with detailed info
  if (buttons && buttons.length > 0) {
    prompt += `\n## Detected Buttons (${buttons.length} total):\n`;
    prompt += `Analyze these buttons and identify which is the PRIMARY CTA and which is SECONDARY:\n\n`;

    buttons.forEach((btn, idx) => {
      const bgInfo = getColorInfo(btn.background);

      prompt += `**Button #${idx}:**\n`;
      prompt += `- Text: "${btn.text}"\n`;
      prompt += `- Background Color: ${btn.background} (${bgInfo.description}${bgInfo.isVibrant ? " - VIBRANT/BRAND COLOR" : ""})\n`;
      prompt += `- Text Color: ${btn.textColor}\n`;
      if (btn.borderColor) prompt += `- Border Color: ${btn.borderColor}\n`;
      if (btn.borderRadius) prompt += `- Border Radius: ${btn.borderRadius}\n`;
      prompt += `- Classes: ${btn.classes.substring(0, 150)}${btn.classes.length > 150 ? "..." : ""}\n`;
      prompt += `- HTML: \`${btn.html.substring(0, 200)}${btn.html.length > 200 ? "..." : ""}\`\n\n`;
    });
  }

  // Add specific questions
  prompt += `\n## Your Task:\n`;
  prompt += `1. **PRIMARY Button**: Identify which button (by index 0-${buttons.length - 1}) is the main call-to-action.\n`;
  prompt += `   - **CRITICAL**: Buttons with VIBRANT/BRAND COLOR backgrounds (like green, blue, orange) are ALMOST ALWAYS the primary CTA\n`;
  prompt += `   - **STRONG INDICATORS**: Look for these class patterns (very high priority):\n`;
  prompt += `     * \`bg-brand-400\`, \`bg-brand-500\`, or similar brand utility classes\n`;
  prompt += `     * \`bg-green-*\`, \`bg-blue-*\`, \`bg-purple-*\` with high numbers (400+)\n`;
  prompt += `     * Any class containing "brand", "primary", or "cta"\n`;
  prompt += `   - Look for: Bright, saturated colors (green, blue, purple, orange) + action-oriented text\n`;
  prompt += `   - Action-oriented text examples: "Get Started", "Sign Up", "Start Free", "Start your Project", "Try Now", "Get Started Free"\n`;
  prompt += `   - If a button has BOTH vibrant color AND strong CTA text, it's DEFINITELY the primary\n`;
  prompt += `   - Avoid buttons with transparent, white, or muted gray backgrounds UNLESS no vibrant buttons exist\n`;
  prompt += `   - Return the button INDEX (not text) and explain your reasoning\n\n`;

  prompt += `2. **SECONDARY Button**: Identify which button is secondary (outline, ghost, or less prominent).\n`;
  prompt += `   - Usually has transparent/subtle background, border, or muted colors\n`;
  prompt += `   - Common for actions like "Login", "Learn More", "Contact", "Documentation"\n`;
  prompt += `   - Often has an outline/border instead of filled background\n`;
  prompt += `   - Return the button INDEX and reasoning\n\n`;

  prompt += `3. **Color Roles**: Based on button colors and page context:\n`;
  prompt += `   - PRIMARY brand color (usually logo/heading color)\n`;
  prompt += `   - ACCENT color (usually the vibrant CTA button background - green, blue, etc.)\n`;
  prompt += `   - Background and text colors\n\n`;

  prompt += `4. **Brand Personality**: Overall tone and energy\n\n`;

  prompt += `5. **Design System**: CSS framework or component library\n\n`;

  prompt += `**IMPORTANT**: Be decisive and confident. Prioritize vibrant, saturated colors over neutral ones for primary buttons. If no clear primary/secondary, return -1 for that index.`;

  return prompt;
}

// // Helper to extract button HTML for LLM
// export function extractButtonContext(
//   html: string,
//   maxButtons: number = 5,
// ): string[] {
//   // This will be called from the transformer with full HTML
//   if (typeof window === "undefined") {
//     // Server-side: parse HTML
//     return [];
//   }

//   // Client-side (in browser context)
//   const parser = new DOMParser();
//   const doc = parser.parseFromString(html, "text/html");

//   const buttons = Array.from(
//     doc.querySelectorAll(
//       'button, [role=button], a.button, a.btn, [class*="btn"]',
//     ),
//   )
//     .slice(0, maxButtons)
//     .map(btn => {
//       // Clean up and get outer HTML
//       const clone = btn.cloneNode(true) as Element;
//       // Remove event handlers and scripts
//       clone.querySelectorAll("script").forEach(s => s.remove());
//       return clone.outerHTML;
//     });

//   return buttons;
// }

// Merge JS analysis with LLM enhancement
export function mergeBrandingResults(
  js: BrandingProfile,
  llm: BrandingEnhancement,
  buttonSnapshots: ButtonSnapshot[],
): BrandingProfile {
  const merged: BrandingProfile = { ...js };

  // Override button classification if LLM found better ones
  // Use lower threshold (0.5) because LLM is better at semantic understanding
  if (
    llm.button_classification.confidence > 0.5 &&
    buttonSnapshots.length > 0
  ) {
    const primaryIdx = llm.button_classification.primary_button_index;
    const secondaryIdx = llm.button_classification.secondary_button_index;

    // Map LLM's selected buttons to component data
    if (primaryIdx >= 0 && primaryIdx < buttonSnapshots.length) {
      const primaryBtn = buttonSnapshots[primaryIdx];
      if (!merged.components) merged.components = {};
      merged.components.button_primary = {
        background: primaryBtn.background,
        text_color: primaryBtn.textColor,
        border_color: primaryBtn.borderColor,
        border_radius: primaryBtn.borderRadius || "0px",
      };
    }

    if (secondaryIdx >= 0 && secondaryIdx < buttonSnapshots.length) {
      const secondaryBtn = buttonSnapshots[secondaryIdx];
      if (!merged.components) merged.components = {};
      merged.components.button_secondary = {
        background: secondaryBtn.background,
        text_color: secondaryBtn.textColor,
        border_color: secondaryBtn.borderColor,
        border_radius: secondaryBtn.borderRadius || "0px",
      };
    }

    // Add LLM reasoning to debug
    (merged as any).__llm_button_reasoning = {
      primary: {
        index: primaryIdx,
        text: primaryIdx >= 0 ? buttonSnapshots[primaryIdx]?.text : "N/A",
        reasoning: llm.button_classification.primary_button_reasoning,
      },
      secondary: {
        index: secondaryIdx,
        text: secondaryIdx >= 0 ? buttonSnapshots[secondaryIdx]?.text : "N/A",
        reasoning: llm.button_classification.secondary_button_reasoning,
      },
    };
  }

  // Override colors if LLM has high confidence
  if (llm.color_roles.confidence > 0.7) {
    merged.colors = {
      ...merged.colors,
      primary: llm.color_roles.primary_color || merged.colors?.primary,
      accent: llm.color_roles.accent_color || merged.colors?.accent,
      background: llm.color_roles.background_color || merged.colors?.background,
      text_primary: llm.color_roles.text_primary || merged.colors?.text_primary,
    };
  }

  // Add personality insights
  if (llm.personality) {
    (merged as any).personality = llm.personality;
  }

  // Add design system insights
  if (llm.design_system) {
    (merged as any).design_system = llm.design_system;
  }

  // Add confidence scores
  (merged as any).confidence = {
    buttons: llm.button_classification.confidence,
    colors: llm.color_roles.confidence,
    overall:
      (llm.button_classification.confidence + llm.color_roles.confidence) / 2,
  };

  return merged;
}
