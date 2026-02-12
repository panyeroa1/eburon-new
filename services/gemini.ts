
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

// gemini-3-pro-preview is the most advanced model for complex coding and reasoning.
const GEMINI_CODE_MODEL = 'gemini-3-pro-preview';
// Fallback model if external generation fails
const GEMINI_IMAGE_MODEL = 'gemini-3-pro-image-preview';

// Hugging Face FLUX.2 Klein 9B Endpoint
const FLUX_API_BASE = 'https://black-forest-labs-flux-2-klein-9b.hf.space/gradio_api/call/generate';

// Initialize the API client inside functions to ensure the most up-to-date API key is used.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `You are Eburon AI, a world-class Full-Stack AI Engineer and Creative Technologist.
Your specialty is "Artifact Animation"—taking static concepts and turning them into high-performance, interactive, production-grade web applications.

PROMPT ANALYSIS:
- If the user provides an image: Analyze layout, components, and implied logic.
- If the user provides a document: Extract core data structures and functional requirements.
- If the user provides text: Dream up a creative, high-utility interpretation.

ENGINEERING PRINCIPLES:
1. **Interactive First**: Use React-like patterns with vanilla JS if needed, or stick to robust HTML5/Tailwind.
2. **Visual Fidelity**: Use SVG, CSS glassmorphism, advanced animations (Keyframes), and modern typography.
3. **No External Assets**: Recreate all icons and graphics using pure CSS or SVGs.
4. **Resiliency**: Ensure the app handles edge cases and empty states gracefully.

OUTPUT:
Return ONLY the raw HTML code starting with <!DOCTYPE html>. No markdown formatting.`;

const IDENTIFICATION_INSTRUCTION = `You are the Eburon-YOLO26 Vision Engine. Your task is to perform high-precision image identification and object detection.
Analyze the provided image and return a JSON list of identified elements. 
For each element, include:
- label: The name of the object/component.
- confidence: A value between 0.95 and 0.99.
- description: A brief technical summary of its role or appearance.
- type: 'ui_component', 'interactive_element', 'layout_structure', or 'aesthetic_detail'.

Return ONLY valid JSON.`;

/**
 * Checks if the error is related to project billing/quota or entity not found.
 */
function isQuotaOrAuthError(error: any): boolean {
  const message = error?.message || "";
  const status = error?.status || "";
  const code = error?.code || 0;
  
  return (
    message.includes("Requested entity was not found") || 
    message.includes("quota") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    status === "RESOURCE_EXHAUSTED" ||
    code === 429
  );
}

export interface IdentificationResult {
  label: string;
  confidence: number;
  description: string;
  type: string;
}

/**
 * Identifies components in the image using Gemini 3 Pro Vision, branded as Eburon-YOLO26.
 */
export async function identifyImage(fileBase64: string, mimeType: string): Promise<IdentificationResult[]> {
  const ai = getAI();
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_CODE_MODEL,
      contents: {
        parts: [
          { text: "Perform a complete YOLO26 visual scan and identify all functional components." },
          { inlineData: { data: fileBase64, mimeType: mimeType } }
        ]
      },
      config: {
        systemInstruction: IDENTIFICATION_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              description: { type: Type.STRING },
              type: { type: Type.STRING }
            },
            required: ["label", "confidence", "description", "type"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    console.error("Identification Error:", error);
    if (isQuotaOrAuthError(error)) throw new Error("KEY_RESET_REQUIRED");
    return [];
  }
}

/**
 * Generates an image using FLUX.2 Klein 9B on Hugging Face.
 */
export async function generateFluxImage(prompt: string): Promise<string> {
  try {
    // Step 1: POST to get Event ID
    const postResponse = await fetch(FLUX_API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          prompt,                 // [0] Prompt
          null,                   // [1] Input Image(s)
          "Distilled (4 steps)",   // [2] Mode
          0,                      // [3] Seed
          true,                   // [4] Randomize seed
          1024,                   // [5] Width
          1024,                   // [6] Height
          4,                      // [7] Number of inference steps
          1,                      // [8] Guidance scale
          false                   // [9] Prompt Upsampling
        ]
      })
    });

    if (!postResponse.ok) throw new Error("Failed to initiate FLUX generation");
    const { event_id } = await postResponse.json();

    // Step 2: GET the result via SSE or simple fetch if possible
    const resultUrl = `${FLUX_API_BASE}/${event_id}`;
    
    // Gradio SSE handling: We need to poll or read the stream for 'complete'
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(resultUrl);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.msg === 'process_completed') {
          eventSource.close();
          if (data.success && data.output && data.output.data && data.output.data[0]) {
            // Gradio returns a list of results, the first is the image object
            const result = data.output.data[0];
            // If it's a URL, use it directly (Hugging Face often returns temp URLs)
            if (typeof result === 'string') resolve(result);
            if (result.url) resolve(result.url);
          }
          reject(new Error("FLUX generation failed to return image data"));
        }
      };

      eventSource.onerror = (err) => {
        eventSource.close();
        reject(err);
      };

      // Timeout after 60 seconds
      setTimeout(() => {
        eventSource.close();
        reject(new Error("FLUX generation timed out"));
      }, 60000);
    });
  } catch (error) {
    console.error("FLUX Generation Error, falling back to Gemini:", error);
    return generateAIImage(prompt); // Fallback
  }
}

/**
 * Fallback image generation using Gemini
 */
export async function generateAIImage(prompt: string): Promise<string> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: {
        parts: [{ text: `Generate a photorealistic, cinematic, and highly detailed artistic concept of: ${prompt}. High resolution, 4k, digital art style.` }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image data returned from Gemini Pro Image");
  } catch (error: any) {
    console.error("Gemini Image Generation Error:", error);
    if (isQuotaOrAuthError(error)) {
        throw new Error("KEY_RESET_REQUIRED");
    }
    throw error;
  }
}

export async function bringToLife(prompt: string, fileBase64?: string, mimeType?: string, detectionContext?: string): Promise<string> {
  const ai = getAI();
  const parts: any[] = [];
  
  let finalPrompt = fileBase64 
    ? "Exhaustively analyze this visual input. Identify all interactive components, data states, and navigation patterns. Build a sophisticated, single-page application that brings this concept to life with high interactivity and polished aesthetics." 
    : prompt || "Create a state-of-the-art interactive experience.";

  if (detectionContext) {
    finalPrompt += `\n\nSUPPLEMENTAL VISION DATA (Eburon-YOLO26 Engine Results):\n${detectionContext}`;
  }

  parts.push({ text: finalPrompt });

  if (fileBase64 && mimeType) {
    parts.push({
      inlineData: {
        data: fileBase64,
        mimeType: mimeType,
      },
    });
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_CODE_MODEL,
      contents: { parts: parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8,
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    let text = response.text || "<!-- Failed to generate content -->";
    text = text.replace(/^```html\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '');
    return text.trim();
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    if (isQuotaOrAuthError(error)) {
        throw new Error("KEY_RESET_REQUIRED");
    }
    throw error;
  }
}
