export enum Speaker {
  User = 'user',
  Bot = 'bot',
}

export interface ChatMessage {
  id: string;
  speaker: Speaker;
  text: string;
}

/**
 * Represents a blob of media data for the Gemini API.
 */
export interface Blob {
  data: string; // base64 encoded data
  mimeType: string;
}
