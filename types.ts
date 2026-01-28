export enum AppMode {
  CLASSIFICATION = 'CLASSIFICATION',
  OBJECT_DETECTION = 'OBJECT_DETECTION',
  HAND_GESTURES = 'HAND_GESTURES',
  SPEECH_TO_TEXT = 'SPEECH_TO_TEXT',
  TEXT_TO_SPEECH = 'TEXT_TO_SPEECH',
}

export interface ClassificationResult {
  label: string;
  confidence: string;
  details: string;
}

export interface DetectedObject {
  name: string;
  description: string;
}

export interface DetectionResult {
  objects: DetectedObject[];
}

export interface GestureResult {
  gesture: string;
  confidence: string;
  meaning: string;
}

export interface LoadingState {
  isLoading: boolean;
  message: string;
}

export type VisionResult = ClassificationResult | DetectionResult | GestureResult | null;