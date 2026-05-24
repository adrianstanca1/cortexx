import { Message } from "../types";

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'nemotron-3-super:latest';

export interface OllamaChatConfig {
  model?: string;
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  keep_alive?: string | number;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
    seed?: number;
  };
}

export interface OllamaGenConfig {
  temperature?: number;
  top_p?: number;
  response_format?: { type: string };
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  keep_alive?: string | number;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
    seed?: number;
  };
  model?: string;
}

/**
 * Ollama model information.
 */
export interface OllamaModel {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
}

/**
 * Callback for streaming response chunks.
 */
export interface OllamaStreamCallback {
  (text: string, metadata?: Record<string, unknown>): void;
}

/**
 * Checks if Ollama service is available
 */
export const checkOllamaAvailability = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    return response.ok;
  } catch (error) {
    console.warn('Ollama service unavailable:', error);
    return false;
  }
};

/**
 * Gets available models from Ollama
 */
export const listOllamaModels = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json() as { models: OllamaModel[] };
    return data.models.map((model) => model.name);
  } catch (error) {
    console.error('Error listing Ollama models:', error);
    return [];
  }
};

/**
 * Sends a chat message to Ollama and returns a streaming response
 */
export const streamOllamaChatResponse = async (
  history: Message[],
  newMessage: string,
  imageData?: string,
  mimeType: string = 'image/jpeg',
  onChunk?: OllamaStreamCallback,
  configOverride?: OllamaChatConfig
): Promise<Record<string, unknown>> => {
  try {
    // Check if Ollama is available
    const isAvailable = await checkOllamaAvailability();
    if (!isAvailable) {
      throw new Error('Ollama service is not available. Please ensure Ollama is running.');
    }

    // Prepare the prompt from history
    const promptParts: string[] = [];
    
    // Add system message if provided
    if (configOverride?.system) {
      promptParts.push(`System: ${configOverride.system}`);
    }
    
    // Add chat history
    history
      .filter(msg => !msg.isThinking && msg.id !== 'intro')
      .forEach(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        promptParts.push(`${role}: ${msg.text}`);
      });
    
    // Add the new message
    promptParts.push(`User: ${newMessage}`);
    
    // Add image context if provided (Ollama vision models)
    let images: string[] = [];
    if (imageData) {
      // Handle base64 image data
      const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
      images.push(base64Data);
    }

    // Prepare the request payload
    const payload = {
      model: configOverride?.model || OLLAMA_MODEL,
      prompt: promptParts.join('\n'),
      stream: true,
      images: images.length > 0 ? images : undefined,
      format: 'json', // We'll try to get JSON responses when possible
      options: {
        temperature: configOverride?.options?.temperature ?? 0.7,
        top_p: configOverride?.options?.top_p ?? 0.9,
        ...(configOverride?.options ?? {})
      },
      ...(configOverride?.keep_alive && { keep_alive: configOverride.keep_alive })
    };

    // Remove undefined values
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
    if (payload.options) {
      Object.keys(payload.options).forEach(key => payload.options[key] === undefined && delete payload.options[key]);
    }

    // Make the request to Ollama
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    // Handle streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader from Ollama');
    }

    let accumulatedText = '';
    let finalMetadata: Record<string, unknown> = {};

    // Process the streaming response
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkText = new TextDecoder().decode(value);
      const lines = chunkText.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            accumulatedText += data.response;
            if (onChunk) {
              onChunk(data.response, {
                ...data,
                model: data.model,
                created_at: data.created_at,
                done: data.done
              });
            }
          }
          
          if (data.done) {
            finalMetadata = {
              model: data.model,
              created_at: data.created_at,
              done: data.done,
              total_duration: data.total_duration,
              load_duration: data.load_duration,
              prompt_eval_count: data.prompt_eval_count,
              eval_count: data.eval_count,
              eval_duration: data.eval_duration
            };
            break;
          }
        } catch (e) {
          // Skip malformed JSON lines
          continue;
        }
      }
      
      if (finalMetadata.done) break;
    }

    return {
      text: accumulatedText,
      model: configOverride?.model || OLLAMA_MODEL,
      done: true,
      metadata: finalMetadata
    };

  } catch (error) {
    console.error('Ollama chat error:', error);
    throw error;
  }
};

/**
 * Performs a non-streaming chat completion with Ollama
 */
export const ollamaChatCompletion = async (
  history: Message[],
  newMessage: string,
  imageData?: string,
  mimeType: string = 'image/jpeg',
  configOverride?: OllamaChatConfig
): Promise<{ text: string; model: string }> => {
  try {
    const response = await streamOllamaChatResponse(
      history, 
      newMessage, 
      imageData, 
      mimeType, 
      (text, metadata) => {
        // We'll accumulate the final response
        // The metadata from the last chunk will be returned
      },
      configOverride
    );
    
    return {
      text: response.text,
      model: response.model
    };
  } catch (error) {
    console.error('Ollama completion error:', error);
    throw error;
  }
};

/**
 * Generic prompt execution for Ollama
 */
export const runOllamaPrompt = async (
  prompt: string,
  config?: OllamaGenConfig,
  imageData?: string,
  mimeType: string = 'image/jpeg'
): Promise<string> => {
  try {
    const isAvailable = await checkOllamaAvailability();
    if (!isAvailable) {
      throw new Error('Ollama service is not available. Please ensure Ollama is running.');
    }

    // Prepare images for vision models
    let images: string[] = [];
    if (imageData) {
      const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
      images.push(base64Data);
    }

    const payload = {
      model: config?.model || OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      images: images.length > 0 ? images : undefined,
      format: 'json',
      options: {
        temperature: config?.temperature ?? 0.7,
        top_p: config?.top_p ?? 0.9,
        ...(config?.options ?? {})
      },
      ...(config?.keep_alive && { keep_alive: config.keep_alive })
    };

    // Clean up undefined values
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
    if (payload.options) {
      Object.keys(payload.options).forEach(key => payload.options[key] === undefined && delete payload.options[key]);
    }

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';

  } catch (error) {
    console.error('Ollama prompt error:', error);
    throw error;
  }
};