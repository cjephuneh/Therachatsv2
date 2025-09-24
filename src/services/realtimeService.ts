// Azure OpenAI Realtime API Service
// This service handles real-time voice interactions using Azure OpenAI's Realtime API

// Custom EventEmitter implementation for browser compatibility
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  emit(event: string, ...args: any[]): void {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }

  off(event: string, listener: Function): void {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }
}

export interface RealtimeConfig {
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion?: string;
}

export interface RealtimeMessage {
  type: 'conversation_item.input_audio_buffer.committed' | 
        'conversation_item.input_audio_buffer.speech_started' |
        'conversation_item.input_audio_buffer.speech_stopped' |
        'conversation_item.input_audio_buffer.speech_ended' |
        'conversation_item.transcript.interim' |
        'conversation_item.transcript.final' |
        'conversation_item.response.audio_buffer.speech_started' |
        'conversation_item.response.audio_buffer.speech_stopped' |
        'conversation_item.response.audio_buffer.speech_ended' |
        'conversation_item.response.audio_buffer.committed' |
        'conversation_item.response.text.interim' |
        'conversation_item.response.text.final' |
        'session.audio_buffer.speech_started' |
        'session.audio_buffer.speech_stopped' |
        'session.audio_buffer.speech_ended' |
        'session.audio_buffer.committed' |
        'session.transcript.interim' |
        'session.transcript.final' |
        'session.response.audio_buffer.speech_started' |
        'session.response.audio_buffer.speech_stopped' |
        'session.response.audio_buffer.speech_ended' |
        'session.response.audio_buffer.committed' |
        'session.response.text.interim' |
        'session.response.text.final' |
        'error' |
        'session.created' |
        'session.updated' |
        'session.deleted' |
        'session.ended' |
        'session.audio_buffer.speech_started' |
        'session.audio_buffer.speech_stopped' |
        'session.audio_buffer.speech_ended' |
        'session.audio_buffer.committed' |
        'session.transcript.interim' |
        'session.transcript.final' |
        'session.response.audio_buffer.speech_started' |
        'session.response.audio_buffer.speech_stopped' |
        'session.response.audio_buffer.speech_ended' |
        'session.response.audio_buffer.committed' |
        'session.response.text.interim' |
        'session.response.text.final' |
        'error' |
        'session.created' |
        'session.updated' |
        'session.deleted' |
        'session.ended';
  data: any;
}

export class RealtimeService extends EventEmitter {
  public config: RealtimeConfig;
  private websocket: WebSocket | null = null;
  private isConnected = false;
  private isListening = false;
  private isSpeaking = false;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private sessionId: string | null = null;
  private conversationActive = false;
  private audioQueue: ArrayBuffer[] = [];
  private isProcessingAudio = false;

  constructor(config: RealtimeConfig) {
    super();
    this.config = config;
  }

  // Initialize the realtime service
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Azure OpenAI Realtime Service...');
      
      // Initialize audio context
      await this.initializeAudio();
      
      // Connect to Azure OpenAI Realtime API
      await this.connect();
      
      this.isConnected = true;
      this.emit('initialized');
      this.emit('connected');
      console.log('✅ Azure OpenAI Realtime Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Realtime Service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Initialize audio context
  private async initializeAudio(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('🎵 Audio context initialized');
    } catch (error) {
      console.error('❌ Failed to initialize audio context:', error);
      throw error;
    }
  }

  // Connect to Azure OpenAI Realtime API
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL
        const wsUrl = this.buildWebSocketUrl();
        console.log('🔗 Connecting to Azure OpenAI Realtime API:', wsUrl);

        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
          console.log('✅ Connected to Azure OpenAI Realtime API');
          this.isConnected = true;
          this.emit('connected');
          resolve();
        };

        this.websocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error parsing message:', error);
            this.emit('error', error);
          }
        };

        this.websocket.onclose = (event) => {
          console.log('🔌 WebSocket connection closed:', event.code, event.reason);
          this.isConnected = false;
          this.emit('disconnected');
        };

        this.websocket.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  // Build WebSocket URL for Azure OpenAI Realtime API
  private buildWebSocketUrl(): string {
    const { endpoint, deployment, apiVersion = '2024-10-01-preview' } = this.config;
    
    // Convert HTTPS endpoint to WSS
    const wsEndpoint = endpoint.replace('https://', 'wss://');
    
    // Build the WebSocket URL
    const wsUrl = `${wsEndpoint}/openai/realtime?api-version=${apiVersion}&deployment=${deployment}`;
    
    return wsUrl;
  }

  // Handle incoming messages from the API
  private handleMessage(message: RealtimeMessage): void {
    console.log('📨 Received message:', message.type, message.data);

    switch (message.type) {
      case 'session.created':
        this.sessionId = message.data.session_id;
        console.log('🆔 Session created:', this.sessionId);
        this.emit('sessionCreated', this.sessionId);
        break;

      case 'session.updated':
        console.log('🔄 Session updated:', message.data);
        this.emit('sessionUpdated', message.data);
        break;

      case 'session.ended':
        console.log('🔚 Session ended');
        this.conversationActive = false;
        this.emit('sessionEnded');
        break;

      case 'session.transcript.interim':
        console.log('📝 Interim transcript:', message.data.text);
        this.emit('transcriptInterim', message.data.text);
        break;

      case 'session.transcript.final':
        console.log('📝 Final transcript:', message.data.text);
        this.emit('transcriptFinal', message.data.text);
        break;

      case 'session.response.text.interim':
        console.log('🤖 Interim response:', message.data.text);
        this.emit('responseInterim', message.data.text);
        break;

      case 'session.response.text.final':
        console.log('🤖 Final response:', message.data.text);
        this.emit('responseFinal', message.data.text);
        break;

      case 'session.response.audio_buffer.speech_started':
        console.log('🔊 Response speech started');
        this.isSpeaking = true;
        this.emit('speechStarted');
        break;

      case 'session.response.audio_buffer.speech_stopped':
        console.log('🔇 Response speech stopped');
        this.isSpeaking = false;
        this.emit('speechStopped');
        break;

      case 'session.response.audio_buffer.committed':
        console.log('🎵 Audio buffer committed');
        this.handleAudioBuffer(message.data);
        break;

      case 'session.audio_buffer.speech_started':
        console.log('🎤 User speech started');
        this.emit('userSpeechStarted');
        break;

      case 'session.audio_buffer.speech_stopped':
        console.log('🎤 User speech stopped');
        this.emit('userSpeechStopped');
        break;

      case 'error':
        console.error('❌ API Error:', message.data);
        this.emit('error', message.data);
        break;

      default:
        console.log('📨 Unhandled message type:', message.type);
    }
  }

  // Handle audio buffer data
  private async handleAudioBuffer(data: any): Promise<void> {
    try {
      if (data.audio && data.audio.length > 0) {
        // Convert base64 audio to ArrayBuffer
        const audioData = this.base64ToArrayBuffer(data.audio);
        
        // Play the audio
        await this.playAudio(audioData);
      }
    } catch (error) {
      console.error('❌ Error handling audio buffer:', error);
      this.emit('error', error);
    }
  }

  // Convert base64 to ArrayBuffer
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Play audio buffer
  private async playAudio(audioData: ArrayBuffer): Promise<void> {
    try {
      if (!this.audioContext) {
        throw new Error('Audio context not initialized');
      }

      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));
      
      // Create audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Connect to speakers
      source.connect(this.audioContext.destination);
      
      // Play audio
      source.start();
      
      console.log('🔊 Playing audio response');
      this.emit('audioPlayed');
      
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      this.emit('error', error);
    }
  }

  // Start listening for user input
  async startListening(): Promise<void> {
    try {
      if (!this.isConnected || !this.websocket) {
        throw new Error('Not connected to Realtime API');
      }

      console.log('🎤 Starting to listen for user input...');
      
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Set up audio processing
      await this.setupAudioProcessing();
      
      this.isListening = true;
      this.conversationActive = true;
      this.emit('listeningStarted');
      
      console.log('✅ Started listening for user input');
      
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Set up audio processing
  private async setupAudioProcessing(): Promise<void> {
    if (!this.mediaStream || !this.audioContext) {
      throw new Error('Media stream or audio context not available');
    }

    try {
      // Create media recorder for audio capture
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.processAudioData(event.data);
        }
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      
      console.log('🎵 Audio processing setup complete');
      
    } catch (error) {
      console.error('❌ Failed to setup audio processing:', error);
      throw error;
    }
  }

  // Process audio data and send to API
  private async processAudioData(audioBlob: Blob): Promise<void> {
    try {
      if (!this.websocket || !this.isConnected) {
        return;
      }

      // Convert blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Convert to base64 for transmission
      const base64Audio = this.arrayBufferToBase64(arrayBuffer);
      
      // Send audio data to API
      const message = {
        type: 'session.audio_buffer.speech_started',
        data: {
          audio: base64Audio
        }
      };

      this.websocket.send(JSON.stringify(message));
      
    } catch (error) {
      console.error('❌ Error processing audio data:', error);
      this.emit('error', error);
    }
  }

  // Convert ArrayBuffer to base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Stop listening
  async stopListening(): Promise<void> {
    try {
      console.log('🛑 Stopping listening...');
      
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      
      this.isListening = false;
      this.emit('listeningStopped');
      
      console.log('✅ Stopped listening');
      
    } catch (error) {
      console.error('❌ Error stopping listening:', error);
      this.emit('error', error);
    }
  }

  // Send text message to the API
  async sendTextMessage(text: string): Promise<void> {
    try {
      if (!this.websocket || !this.isConnected) {
        throw new Error('Not connected to Realtime API');
      }

      const message = {
        type: 'session.update',
        data: {
          input_text: text
        }
      };

      this.websocket.send(JSON.stringify(message));
      console.log('📤 Sent text message:', text);
      
    } catch (error) {
      console.error('❌ Error sending text message:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // End the current session
  async endSession(): Promise<void> {
    try {
      if (!this.websocket || !this.isConnected) {
        return;
      }

      const message = {
        type: 'session.end',
        data: {}
      };

      this.websocket.send(JSON.stringify(message));
      console.log('🔚 Session ended');
      
    } catch (error) {
      console.error('❌ Error ending session:', error);
      this.emit('error', error);
    }
  }

  // Disconnect from the API
  async disconnect(): Promise<void> {
    try {
      console.log('🔌 Disconnecting from Realtime API...');
      
      // Stop listening if active
      if (this.isListening) {
        await this.stopListening();
      }
      
      // End session if active
      if (this.conversationActive) {
        await this.endSession();
      }
      
      // Close WebSocket connection
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }
      
      this.isConnected = false;
      this.conversationActive = false;
      this.sessionId = null;
      
      this.emit('disconnected');
      console.log('✅ Disconnected from Realtime API');
      
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
      this.emit('error', error);
    }
  }

  // Get current status
  getStatus() {
    return {
      isConnected: this.isConnected,
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      conversationActive: this.conversationActive,
      sessionId: this.sessionId
    };
  }

  // Cleanup resources
  cleanup(): void {
    this.disconnect();
    this.events = {};
  }
}

// Export the service
export default RealtimeService;
