import { LowLevelRTClient, SessionUpdateMessage, Voice } from "rt-client";

export interface RealtimeConfig {
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion?: string;
}

export interface RealtimeMessage {
  type: string;
  data?: any;
  session_id?: string;
  id?: string;
  text?: string;
  content?: string;
  transcript?: string;
  delta?: string;
  audio?: string;
  error?: any;
}

class RealtimeService {
  private client: LowLevelRTClient | null = null;
  private config: RealtimeConfig;
  private isConnected: boolean = false;
  private isListening: boolean = false;
  private audioRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioBuffer: Uint8Array = new Uint8Array();
  private messageHandlers: Map<string, (message: any) => void> = new Map();

  constructor(config: RealtimeConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Realtime Service...');
      
      // Create the LowLevelRTClient
      const endpoint = new URL(this.config.endpoint);
      this.client = new LowLevelRTClient(
        endpoint, 
        { key: this.config.apiKey }, 
        { deployment: this.config.deployment }
      );

      console.log('✅ Realtime Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Realtime Service:', error);
      throw error;
    }
  }

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.client) {
          throw new Error('Client not initialized. Call initialize() first.');
        }

        console.log('🔗 Connecting to Azure OpenAI Realtime API...');

        // Send session configuration
        const configMessage = this.createConfigMessage();
        console.log('📤 Sending session config:', configMessage);
        
        await this.client.send(configMessage);
        console.log('✅ Session configuration sent');

        // Start handling messages
        this.handleRealtimeMessages();

        this.isConnected = true;
        this.emit('connected');
        resolve();

      } catch (error) {
        console.error('❌ Failed to connect:', error);
        this.emit('error', error);
        reject(error);
      }
    });
  }

  private createConfigMessage(): SessionUpdateMessage {
    const configMessage: SessionUpdateMessage = {
      type: "session.update",
      session: {
        turn_detection: {
          type: "server_vad",
        },
        input_audio_transcription: {
          model: "whisper-1"
        },
        instructions: "You are TheraChat, a supportive mental health companion. Provide empathetic, helpful responses.",
        voice: "alloy" as Voice,
        temperature: 0.8
      }
    };

    return configMessage;
  }

  private async handleRealtimeMessages(): Promise<void> {
    if (!this.client) return;

    try {
      for await (const message of this.client.messages()) {
        console.log('📨 Received message:', message.type, message);
        
        switch (message.type) {
          case "session.created":
            console.log('✅ Session created');
            this.emit('sessionCreated', message);
            break;

          case "response.audio_transcript.delta":
            console.log('📝 Response transcript delta:', message.delta);
            this.emit('responseInterim', message.delta);
            break;

          case "response.audio.delta":
            console.log('🔊 Response audio delta received');
            // Handle audio playback
            this.handleAudioDelta(message.delta);
            break;

          case "input_audio_buffer.speech_started":
            console.log('🎤 User speech started');
            this.emit('userSpeechStarted');
            break;

          case "input_audio_buffer.speech_stopped":
            console.log('🎤 User speech stopped');
            this.emit('userSpeechStopped');
            break;

          case "conversation.item.input_audio_transcription.completed":
            console.log('📝 User transcript completed:', message.transcript);
            this.emit('transcriptFinal', message.transcript);
            break;

          case "response.done":
            console.log('✅ Response completed');
            this.emit('responseFinal');
            break;

          case "error":
            console.error('❌ API Error:', message);
            this.emit('error', message);
            break;

          default:
            console.log('📨 Unhandled message type:', message.type, message);
        }
      }
    } catch (error) {
      console.error('❌ Error handling messages:', error);
      this.emit('error', error);
    }
  }

  private handleAudioDelta(delta: string): void {
    try {
      const binary = atob(delta);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const pcmData = new Int16Array(bytes.buffer);
      
      // Convert PCM data to audio and play
      this.playAudioData(pcmData);
    } catch (error) {
      console.error('❌ Error handling audio delta:', error);
    }
  }

  private playAudioData(pcmData: Int16Array): void {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sampleRate = 24000; // Azure OpenAI Realtime API uses 24kHz
      
      // Create audio buffer
      const audioBuffer = audioContext.createBuffer(1, pcmData.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      // Convert PCM data to float32
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0; // Convert from int16 to float32
      }
      
      // Create and play audio source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
      
      this.emit('audioPlayed');
    } catch (error) {
      console.error('❌ Error playing audio:', error);
    }
  }

  async startListening(): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to Realtime API');
      }

      console.log('🎤 Starting audio recording...');
      
      // Get user media
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      // Create media recorder
      this.audioRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.processAudioData(event.data);
        }
      };

      this.audioRecorder.start(100); // Collect data every 100ms
      this.isListening = true;
      
      console.log('✅ Started listening');
      this.emit('listeningStarted');

    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    try {
      console.log('🛑 Stopping audio recording...');
      
      if (this.audioRecorder && this.audioRecorder.state !== 'inactive') {
        this.audioRecorder.stop();
      }
      
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }
      
      this.audioRecorder = null;
      this.isListening = false;
      
      console.log('✅ Stopped listening');
      this.emit('listeningStopped');

    } catch (error) {
      console.error('❌ Failed to stop listening:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async processAudioData(audioBlob: Blob): Promise<void> {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Combine with existing buffer
      const newBuffer = new Uint8Array(this.audioBuffer.length + uint8Array.length);
      newBuffer.set(this.audioBuffer);
      newBuffer.set(uint8Array, this.audioBuffer.length);
      this.audioBuffer = newBuffer;
      
      // Send audio data in chunks
      if (this.audioBuffer.length >= 4800) { // Send in 4800 byte chunks
        const toSend = new Uint8Array(this.audioBuffer.slice(0, 4800));
        this.audioBuffer = new Uint8Array(this.audioBuffer.slice(4800));
        
        // Convert to base64
        const regularArray = String.fromCharCode(...toSend);
        const base64 = btoa(regularArray);
        
        // Send to API
        if (this.client && this.isListening) {
          await this.client.send({
            type: "input_audio_buffer.append",
            audio: base64,
          });
        }
      }
    } catch (error) {
      console.error('❌ Error processing audio data:', error);
    }
  }

  async sendTextMessage(text: string): Promise<void> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Not connected to Realtime API');
      }

      console.log('📤 Sending text message:', text);
      
      await this.client.send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: text
            }
          ]
        }
      });

      console.log('✅ Text message sent');
    } catch (error) {
      console.error('❌ Failed to send text message:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      console.log('🔌 Disconnecting from Realtime API...');
      
      if (this.isListening) {
        await this.stopListening();
      }
      
      if (this.client) {
        this.client.close();
        this.client = null;
      }
      
      this.isConnected = false;
      console.log('✅ Disconnected');
      this.emit('disconnected');

    } catch (error) {
      console.error('❌ Error disconnecting:', error);
      this.emit('error', error);
    }
  }

  getStatus(): { connected: boolean; listening: boolean } {
    return {
      connected: this.isConnected,
      listening: this.isListening
    };
  }

  // Event emitter functionality
  private events: { [key: string]: Function[] } = {};

  on(event: string, callback: Function): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event: string, callback: Function): void {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }

  private emit(event: string, ...args: any[]): void {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args));
    }
  }

  cleanup(): void {
    this.disconnect();
    this.events = {};
  }
}

export default RealtimeService;