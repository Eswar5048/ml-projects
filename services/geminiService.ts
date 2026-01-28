import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ClassificationResult, DetectionResult, GestureResult } from "../types";

// Initialize Gemini Client
// API Key is automatically injected from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = async (file: Blob): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type || 'image/jpeg',
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const classifyImage = async (imageFile: Blob): Promise<ClassificationResult> => {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    
    // Using gemini-3-flash-preview for fast multimodal understanding
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          imagePart,
          { text: "Analyze this image. Provide a main classification label (e.g. 'Persian Cat'), a confidence score percentage (e.g. '98%'), and a brief 1-sentence description. Return strictly as JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            confidence: { type: Type.STRING },
            details: { type: Type.STRING }
          },
          required: ["label", "confidence", "details"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    return JSON.parse(text) as ClassificationResult;
  } catch (error) {
    console.error("Classification error:", error);
    throw error;
  }
};

export const detectObjects = async (imageFile: Blob): Promise<DetectionResult> => {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    
    // Using gemini-3-flash-preview for fast multimodal understanding
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          imagePart,
          { text: "Detect the main objects in this image. List them with a short visual description for each. Return strictly as JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            objects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    return JSON.parse(text) as DetectionResult;
  } catch (error) {
    console.error("Detection error:", error);
    throw error;
  }
};

export const detectHandGestures = async (imageFile: Blob): Promise<GestureResult> => {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          imagePart,
          { text: `Analyze this image specifically for hand gestures. 
            Identify the primary hand gesture shown. 
            Recognize a wide range of gestures including but not limited to: 
            - Thumbs Up / Thumbs Down
            - Peace Sign / Victory (V Sign)
            - OK Sign
            - Open Palm / Stop
            - High Five (Open palm facing forward or towards another hand)
            - Fist / Punch
            - Fist Bump (Knuckles facing forward or two fists touching)
            - Clapping Hands (Two hands striking together)
            - Finger Heart (Korean Heart)
            - Love (ASL 'I Love You')
            - Rock On / Devil Horns
            - Shaka / Hang Loose
            - Pointing (Index Finger)
            - Crossed Fingers (Good Luck)
            - Waving
            - Call Me (Thumb and pinky extended near ear)
            - C-Shape
            
            Provide a confidence score percentage (e.g., "98%") and a brief, interesting explanation of its common meaning or action.
            If multiple hands are visible, prioritize interaction gestures like Fist Bump, Clapping, or High Five.
            If no clear hand gesture is found, label it 'Unknown' and explain why. 
            Return strictly as JSON.` 
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gesture: { type: Type.STRING },
            confidence: { type: Type.STRING },
            meaning: { type: Type.STRING }
          },
          required: ["gesture", "confidence", "meaning"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    return JSON.parse(text) as GestureResult;
  } catch (error) {
    console.error("Gesture detection error:", error);
    throw error;
  }
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1]; // Remove data URL prefix

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: audioBlob.type.includes('wav') ? 'audio/wav' : 'audio/mp3', // Map common recording types
                    data: base64Data
                  }
                },
                { text: "Transcribe the spoken audio into clear text. Do not add any commentary, just the transcription." }
              ]
            }
          });
          
          resolve(response.text || "No transcription generated.");
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};

export const synthesizeSpeech = async (text: string, voiceName: string = 'Puck'): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: {
        parts: [{ text }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName } 
          }
        }
      }
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      if (parts && parts.length > 0) {
        const audioPart = parts[0];
        if (audioPart.inlineData && audioPart.inlineData.data) {
           return audioPart.inlineData.data;
        }
      }
    }
    throw new Error("No audio data returned");

  } catch (error) {
    console.error("TTS error:", error);
    throw error;
  }
};