// Azure OpenAI Realtime API Service
// This service handles real-time voice interactions using Azure OpenAI's Realtime API

// Custom EventEmitter implementation for browser compatibility
class EventEmitter {
  protected events: { [key: string]: Function[] } = {};

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
        'session.created' |
        'session.updated' |
        'session.ready' |
        'session.deleted' |
        'session.ended' |
        'error';
  data?: any;
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
        // Build WebSocket URL with API key
        const wsUrl = this.buildWebSocketUrl();
        console.log('🔗 Connecting to Azure OpenAI Realtime API:', wsUrl);

        // Create WebSocket connection
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
          console.log('✅ Connected to Azure OpenAI Realtime API');
          this.isConnected = true;
          
          // Send initial session setup message after a short delay
          setTimeout(() => {
            this.sendSessionSetup();
          }, 500);
          
          this.emit('connected');
          resolve();
        };

        this.websocket.onmessage = (event) => {
          try {
            console.log('📨 Raw WebSocket message:', event.data);
            
            // Try to parse as JSON
            let message;
            try {
              message = JSON.parse(event.data);
            } catch (parseError) {
              console.error('❌ Failed to parse message as JSON:', event.data);
              console.error('❌ Parse error:', parseError);
              return;
            }
            
            // Handle different message formats
            if (typeof message === 'string') {
              // If it's a string, try to parse it again
              try {
                message = JSON.parse(message);
              } catch (e) {
                console.error('❌ Failed to parse string message:', message);
                return;
              }
            }
            
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error processing WebSocket message:', error);
            console.error('❌ Raw message data:', event.data);
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
    const { endpoint, deployment, apiVersion = '2024-10-01-preview', apiKey } = this.config;
    
    // Validate required configuration
    if (!endpoint || !deployment || !apiKey) {
      throw new Error('Missing required configuration: endpoint, deployment, and apiKey must be provided');
    }
    
    // Convert HTTPS endpoint to WSS
    let wsEndpoint = endpoint;
    if (wsEndpoint.startsWith('https://')) {
      wsEndpoint = wsEndpoint.replace('https://', 'wss://');
    } else if (!wsEndpoint.startsWith('wss://')) {
      wsEndpoint = `wss://${wsEndpoint}`;
    }
    
    // Build the WebSocket URL with API key
    const wsUrl = `${wsEndpoint}/openai/realtime?api-version=${apiVersion}&deployment=${deployment}&api-key=${encodeURIComponent(apiKey)}`;
    
    console.log('🔗 Built WebSocket URL:', wsUrl.replace(apiKey, '***'));
    return wsUrl;
  }

  // Send initial session setup message
  private sendSessionSetup(): void {
    if (!this.websocket || !this.isConnected) {
      console.warn('⚠️ Cannot send session setup: WebSocket not connected');
      return;
    }

    try {
      // Send a simple session update to configure the session
      const setupMessage = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: 'You are TheraChat, a supportive mental health companion.',
          voice: 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          temperature: 0.8
        }
      };

      console.log('📤 Sending session setup:', JSON.stringify(setupMessage, null, 2));
      this.websocket.send(JSON.stringify(setupMessage));
      
    } catch (error) {
      console.error('❌ Error sending session setup:', error);
      this.emit('error', error);
    }
  }

  // Handle incoming messages from the API
  private handleMessage(message: RealtimeMessage): void {
    console.log('📨 Received message:', message);
    console.log('📨 Message type:', message.type);
    console.log('📨 Message data:', message.data);

    // Add safety checks for message structure
    if (!message || typeof message !== 'object') {
      console.error('❌ Invalid message format:', message);
      return;
    }

    if (!message.type) {
      console.error('❌ Message missing type:', message);
      return;
    }

    // Handle different message structures
    const messageData = message.data || message;
    
    switch (message.type) {
      case 'session.created':
        const sessionId = messageData.session_id || messageData.id;
        if (sessionId) {
          this.sessionId = sessionId;
          console.log('🆔 Session created:', this.sessionId);
          this.emit('sessionCreated', this.sessionId);
        } else {
          console.warn('⚠️ Session created message missing session_id:', messageData);
        }
        break;

      case 'session.updated':
        console.log('🔄 Session updated:', messageData);
        this.emit('sessionUpdated', messageData);
        break;

      case 'session.ready':
        console.log('✅ Session ready for interaction');
        this.emit('sessionReady');
        break;

      case 'session.ended':
        console.log('🔚 Session ended');
        this.conversationActive = false;
        this.emit('sessionEnded');
        break;

      case 'session.transcript.interim':
        const interimText = messageData.text || messageData.content;
        if (interimText) {
          console.log('📝 Interim transcript:', interimText);
          this.emit('transcriptInterim', interimText);
        }
        break;

      case 'session.transcript.final':
        const finalText = messageData.text || messageData.content;
        if (finalText) {
          console.log('📝 Final transcript:', finalText);
          this.emit('transcriptFinal', finalText);
        }
        break;

      case 'session.response.text.interim':
        const interimResponse = messageData.text || messageData.content;
        if (interimResponse) {
          console.log('🤖 Interim response:', interimResponse);
          this.emit('responseInterim', interimResponse);
        }
        break;

      case 'session.response.text.final':
        const finalResponse = messageData.text || messageData.content;
        if (finalResponse) {
          console.log('🤖 Final response:', finalResponse);
          this.emit('responseFinal', finalResponse);
        }
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
        this.handleAudioBuffer(messageData);
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
        console.error('❌ API Error:', messageData);
        console.error('❌ Error details:', JSON.stringify(messageData, null, 2));
        this.emit('error', messageData);
        break;

      default:
        console.log('📨 Unhandled message type:', message.type, messageData);
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
    // Clear all event listeners by removing them
    Object.keys(this.events).forEach(event => {
      this.events[event] = [];
    });
  }
}

// Export the service
export default RealtimeService;
