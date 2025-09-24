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

export interface VoiceLiveConfig {
  subscriptionKey: string;
  region: string;
  language?: string;
  voice?: string;
}

export interface Voice {
  name: string;
  gender: 'Male' | 'Female' | 'Neutral';
  locale: string;
}

export class VoiceLiveService extends EventEmitter {
  public config: VoiceLiveConfig;
  private isConnected = false;
  private isListening = false;
  private isSpeaking = false;
  private isProcessing = false;
  private isPlaying = false;
  private isRecording = false;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private speechRecognizer: any = null;
  private speechSynthesizer: any = null;
  private conversationActive = false;
  private currentAudio: HTMLAudioElement | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioQueue: ArrayBuffer[] = [];
  private messageTimeout: NodeJS.Timeout | null = null;
  private hasReceivedMessage = false;

  constructor(config: VoiceLiveConfig) {
    super();
    this.config = config;
  }

  // Initialize the voice service
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Voice Live Service...');
      
      // Initialize audio
      await this.initializeAudio();
      
      // Set up WebSocket-based speech recognition
      await this.setupWebSocketRecognition();
      
      this.isConnected = true;
      this.emit('initialized');
      this.emit('connected'); // Also emit connected event
      console.log('✅ Voice Live Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Voice Live Service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Set up WebSocket-based speech recognition (WebSocket only)
  private async setupWebSocketRecognition(): Promise<void> {
    try {
      // Try WebSocket connection
      await this.tryWebSocketRecognition();
      console.log('✅ WebSocket recognition setup successful');
    } catch (error) {
      console.error('❌ WebSocket setup failed:', error);
      throw error; // No fallbacks - WebSocket only
    }
  }

  // Try WebSocket-based recognition using Azure Speech Services binary protocol
  private async tryWebSocketRecognition(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get access token for Azure Speech Services
      this.getAccessToken().then(token => {
        // Use the correct Azure Speech Services WebSocket endpoint
        const wsUrl = `wss://${this.config.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${this.config.language || 'en-US'}`;
        
        console.log('🔗 Attempting WebSocket connection to:', wsUrl);
        console.log('🔑 Using access token:', token.substring(0, 20) + '...');
        
        // Create WebSocket connection with proper authentication
        const wsUrlWithAuth = `${wsUrl}&authorization=${encodeURIComponent(`Bearer ${token}`)}`;
        
        this.speechRecognizer = new WebSocket(wsUrlWithAuth);
        
        // Set up WebSocket event handlers
        this.speechRecognizer.onopen = () => {
          console.log('🎤 WebSocket connected for speech recognition');
          
          // Send initial configuration message using correct Azure Speech Services protocol
          const requestId = this.generateRequestId();
          const timestamp = new Date().toISOString();
          
          // Azure Speech Services header format
          const header = `Path: speech.config\r\nX-RequestId: ${requestId}\r\nX-Timestamp: ${timestamp}\r\nContent-Type: application/json\r\n\r\n`;
          const configMessage = {
            context: {
              system: {
                name: 'SpeechSDK',
                version: '1.0.0'
              }
            }
          };
          
          // Convert header and config to bytes
          const headerBytes = new TextEncoder().encode(header);
          const configBytes = new TextEncoder().encode(JSON.stringify(configMessage));
          
          // Create binary message: [2-byte header size][header][config data]
          const headerSize = headerBytes.length;
          const binaryMessage = new Uint8Array(2 + headerSize + configBytes.length);
          
          // Set header size in big-endian (2 bytes)
          binaryMessage[0] = (headerSize >> 8) & 0xFF; // High byte
          binaryMessage[1] = headerSize & 0xFF; // Low byte
          
          // Set header and config data
          binaryMessage.set(headerBytes, 2);
          binaryMessage.set(configBytes, 2 + headerSize);
          
          console.log('📤 Sending configuration message:', {
            headerSize: headerSize,
            header: header.trim(),
            config: JSON.stringify(configMessage)
          });
          
          this.speechRecognizer.send(binaryMessage.buffer);
          
          // Send turn.start message to initiate conversation
          setTimeout(() => {
            const turnStartRequestId = this.generateRequestId();
            const turnStartTimestamp = new Date().toISOString();
            
            const turnStartHeader = `Path:turn.start\r\nX-RequestId: ${turnStartRequestId}\r\nX-Timestamp: ${turnStartTimestamp}\r\nContent-Type: application/json\r\n\r\n`;
            const turnStartMessage = {
              context: {
                serviceTag: turnStartRequestId
              }
            };
            
            const turnStartHeaderBytes = new TextEncoder().encode(turnStartHeader);
            const turnStartConfigBytes = new TextEncoder().encode(JSON.stringify(turnStartMessage));
            
            const turnStartHeaderSize = turnStartHeaderBytes.length;
            const turnStartBinaryMessage = new Uint8Array(2 + turnStartHeaderSize + turnStartConfigBytes.length);
            
            // Set header size in big-endian (2 bytes)
            turnStartBinaryMessage[0] = (turnStartHeaderSize >> 8) & 0xFF;
            turnStartBinaryMessage[1] = turnStartHeaderSize & 0xFF;
            
            // Set header and config data
            turnStartBinaryMessage.set(turnStartHeaderBytes, 2);
            turnStartBinaryMessage.set(turnStartConfigBytes, 2 + turnStartHeaderSize);
            
            console.log('📤 Sending turn.start message:', {
              headerSize: turnStartHeaderSize,
              header: turnStartHeader.trim(),
              config: JSON.stringify(turnStartMessage)
            });
            
            this.speechRecognizer.send(turnStartBinaryMessage.buffer);
          }, 100); // Small delay to ensure config is processed first
          
          this.emit('listeningStarted');
          this.emit('connected'); // Emit connected event
          resolve(); // Resolve on successful connection
        };
        
        this.speechRecognizer.onmessage = (event) => {
          try {
            this.hasReceivedMessage = true; // Mark that we've received a message
            if (this.messageTimeout) {
              clearTimeout(this.messageTimeout);
              this.messageTimeout = null;
            }
            
            console.log('📨 WebSocket message received!', {
              type: typeof event.data,
              isArrayBuffer: event.data instanceof ArrayBuffer,
              isBlob: event.data instanceof Blob,
              size: event.data?.byteLength || event.data?.size || event.data?.length || 'unknown'
            });
            
            // Log the raw data for debugging
            if (event.data instanceof ArrayBuffer) {
              console.log('📨 Raw binary data:', new Uint8Array(event.data));
            } else {
              console.log('📨 Raw text data:', event.data);
            }
            
            // Handle binary messages from Azure Speech Services
            if (event.data instanceof ArrayBuffer) {
              console.log('📨 Binary message received, size:', event.data.byteLength);
              
              // Try to parse Azure Speech Services format: [MessageType][MessageLength][Data]
              try {
                const dataView = new DataView(event.data);
                
                // Check if message has proper Azure format
                if (event.data.byteLength < 5) {
                  console.log('📨 Message too short, trying direct text decode...');
                  const messageText = new TextDecoder().decode(event.data);
                  console.log('📨 Direct text message:', messageText);
                  return;
                }
                
                // Parse Azure format: [MessageType][MessageLength][Data]
                const messageType = dataView.getUint8(0);
                const messageLength = dataView.getUint32(1, true); // Little-endian
                
                console.log('📨 Azure message format:', {
                  type: messageType,
                  length: messageLength,
                  totalSize: event.data.byteLength
                });
                
                // Extract message data
                const messageBytes = new Uint8Array(event.data, 5, messageLength);
                const messageText = new TextDecoder().decode(messageBytes);
                
                console.log('📨 Message data:', messageText);
                
                // Parse as JSON
                const data = JSON.parse(messageText);
                console.log('📨 WebSocket binary message parsed:', data);
                
                if (data.RecognitionStatus === 'Success' && data.DisplayText) {
                  console.log('🎤 Speech recognized via WebSocket:', data.DisplayText);
                  this.handleUserSpeech(data.DisplayText);
                } else if (data.RecognitionStatus === 'NoMatch') {
                  console.log('🔇 No speech detected');
                } else if (data.RecognitionStatus === 'InitialSilenceTimeout') {
                  console.log('⏰ Initial silence timeout');
                } else {
                  console.log('📨 Other recognition status:', data.RecognitionStatus);
                }
              } catch (parseError) {
                console.log('📨 Binary message is not JSON, trying direct text decode...');
                // Try to decode as text directly
                try {
                  const text = new TextDecoder().decode(event.data);
                  console.log('📨 Binary message as text:', text);
                  
                  // Try to parse as JSON
                  try {
                    const data = JSON.parse(text);
                    console.log('📨 Text message parsed as JSON:', data);
                    
                    if (data.RecognitionStatus === 'Success' && data.DisplayText) {
                      console.log('🎤 Speech recognized via WebSocket:', data.DisplayText);
                      this.handleUserSpeech(data.DisplayText);
                    }
                  } catch (jsonError) {
                    console.log('📨 Text is not JSON:', text);
                  }
                } catch (textError) {
                  console.log('📨 Binary message cannot be decoded as text');
                }
              }
            } else if (event.data instanceof Blob) {
              console.log('📨 Blob message received, size:', event.data.size);
              // Convert blob to text
              event.data.text().then(text => {
                console.log('📨 Blob as text:', text);
                try {
                  const data = JSON.parse(text);
                  console.log('📨 Blob text parsed as JSON:', data);
                  
                  if (data.RecognitionStatus === 'Success' && data.DisplayText) {
                    console.log('🎤 Speech recognized via WebSocket:', data.DisplayText);
                    this.handleUserSpeech(data.DisplayText);
                  }
                } catch (jsonError) {
                  console.log('📨 Blob text is not JSON:', text);
                }
              });
            } else {
              // Handle text messages from Azure Speech Services
              const messageText = event.data;
              console.log('📨 WebSocket text message received:', messageText);
              
              // Check if it's a turn.start message (Azure format)
              if (messageText.includes('Path:turn.start')) {
                console.log('🔄 Turn started - waiting for speech recognition results...');
                return;
              }
              
              // Check if it's a turn.end message
              if (messageText.includes('Path:turn.end')) {
                console.log('🔄 Turn ended');
                return;
              }
              
              // Try to parse as JSON
              try {
                // Extract JSON from Azure message format
                const jsonStart = messageText.indexOf('{');
                if (jsonStart !== -1) {
                  const jsonText = messageText.substring(jsonStart);
                  const data = JSON.parse(jsonText);
                  console.log('📨 WebSocket JSON message parsed:', data);
                  
                  if (data.RecognitionStatus === 'Success' && data.DisplayText) {
                    console.log('🎤 Speech recognized via WebSocket:', data.DisplayText);
                    this.handleUserSpeech(data.DisplayText);
                  } else if (data.RecognitionStatus === 'NoMatch') {
                    console.log('🔇 No speech detected');
                  } else if (data.RecognitionStatus === 'InitialSilenceTimeout') {
                    console.log('⏰ Initial silence timeout');
                  } else {
                    console.log('📨 Other recognition status:', data.RecognitionStatus);
                  }
                } else {
                  console.log('📨 WebSocket text message (no JSON found):', messageText);
                }
              } catch (parseError) {
                console.log('📨 WebSocket text message parse error:', parseError);
                console.log('📨 Raw message:', messageText);
              }
            }
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
          }
        };
        
        this.speechRecognizer.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };
        
        this.speechRecognizer.onclose = (event) => {
          console.log('🛑 WebSocket closed:', event.code, event.reason);
          this.emit('listeningStopped');
          this.emit('disconnected'); // Emit disconnected event
        };
        
        // Set a timeout to detect connection failure
        setTimeout(() => {
          if (this.speechRecognizer.readyState !== WebSocket.OPEN) {
            console.warn('⚠️ WebSocket connection timeout');
            this.speechRecognizer.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
      }).catch(reject);
    });
  }

  // Initialize audio context and microphone access
  private async initializeAudio(): Promise<void> {
    try {
      console.log('🎵 Initializing audio...');
      
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      
      console.log('✅ Microphone access granted');
      this.emit('microphoneReady');
    } catch (error) {
      console.error('❌ Failed to initialize audio:', error);
      throw error;
    }
  }

  // Start continuous speech-to-speech conversation (WebSocket only)
  async startConversation(): Promise<void> {
    try {
      console.log('🎤 Starting Web Speech API conversation...');
      
      // Use Web Speech API for direct browser speech recognition
      await this.setupWebSpeechAPI();
      
      this.isListening = true;
      this.conversationActive = true;
      this.emit('conversationStarted');
      console.log('✅ Web Speech API conversation started successfully');
    } catch (error) {
      console.error('❌ Failed to start WebSocket conversation:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Stop continuous conversation
  async stopConversation(): Promise<void> {
    try {
      // Stop audio streaming
      this.stopAudioStreaming();
      
      // Close WebSocket connection
      if (this.speechRecognizer instanceof WebSocket) {
        this.speechRecognizer.close();
        this.speechRecognizer = null;
      }
      
      this.isListening = false;
      this.conversationActive = false;
      this.emit('conversationStopped');
      console.log('✅ Conversation stopped');
    } catch (error) {
      console.error('❌ Failed to stop conversation:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Start WebSocket streaming with PCM audio format
  private async startWebSocketStreaming(): Promise<void> {
    if (!this.mediaStream) return;
    
    try {
      console.log('🎤 Starting WebSocket audio streaming...');
      
      // Create AudioContext for PCM audio processing
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Create a ScriptProcessorNode for real-time audio processing
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      // Reset message tracking
      this.hasReceivedMessage = false;
      this.messageTimeout = null;
      
      processor.onaudioprocess = (event) => {
        if (this.speechRecognizer?.readyState === WebSocket.OPEN) {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Convert float32 to int16 PCM
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          
          // Create binary message with correct Azure Speech Services format
          const requestId = this.generateRequestId();
          const timestamp = new Date().toISOString();
          
          // Azure Speech Services header format for audio
          const header = `Path: audio\r\nX-RequestId: ${requestId}\r\nX-Timestamp: ${timestamp}\r\nContent-Type: audio/x-wav\r\n\r\n`;
          const headerBytes = new TextEncoder().encode(header);
          
          // Create binary message: [2-byte header size][header][audio data]
          const headerSize = headerBytes.length;
          const binaryMessage = new Uint8Array(2 + headerSize + pcmData.byteLength);
          
          // Set header size in big-endian (2 bytes)
          binaryMessage[0] = (headerSize >> 8) & 0xFF; // High byte
          binaryMessage[1] = headerSize & 0xFF; // Low byte
          
          // Set header and audio data
          binaryMessage.set(headerBytes, 2);
          binaryMessage.set(new Uint8Array(pcmData.buffer), 2 + headerSize);
          
          console.log('📤 Sending PCM audio to WebSocket, size:', binaryMessage.length);
          this.speechRecognizer.send(binaryMessage.buffer);
          
          // Set timeout to detect if we're not getting responses
          if (!this.hasReceivedMessage) {
            if (this.messageTimeout) {
              clearTimeout(this.messageTimeout);
            }
            this.messageTimeout = setTimeout(() => {
              if (!this.hasReceivedMessage) {
                console.log('⚠️ No WebSocket responses received, falling back to REST API');
                this.fallbackToRestAPI();
              }
            }, 5000); // Wait 5 seconds for response
          }
        }
      };
      
      // Connect the audio processing chain
      source.connect(processor);
      processor.connect(this.audioContext.destination);
      
      console.log('✅ WebSocket PCM audio streaming started');
      
      // Store reference for stopping
      (this as any).audioProcessor = processor;
      
    } catch (error) {
      console.error('❌ Failed to start WebSocket streaming:', error);
      throw error;
    }
  }

  // Fallback to REST API when WebSocket doesn't work
  private async fallbackToRestAPI(): Promise<void> {
    try {
      console.log('🔄 Falling back to REST API for speech recognition...');
      
      // Stop WebSocket streaming
      this.stopAudioStreaming();
      
      // Close WebSocket
      if (this.speechRecognizer instanceof WebSocket) {
        this.speechRecognizer.close();
        this.speechRecognizer = null;
      }
      
      // Set up REST API recognition
      await this.setupRestApiRecognition();
      
      // Start REST API streaming
      await this.startRestApiStreaming();
      
      console.log('✅ Fallback to REST API completed');
    } catch (error) {
      console.error('❌ Fallback to REST API failed:', error);
      throw error;
    }
  }

  // Set up REST API-based recognition
  private async setupRestApiRecognition(): Promise<void> {
    console.log('🔄 Setting up REST API fallback for speech recognition');
    
    try {
      // Use MediaRecorder with periodic REST API calls
      const mediaRecorder = new MediaRecorder(this.mediaStream!, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      let audioChunks: Blob[] = [];
      let isRecording = false;
      let silenceTimeout: NodeJS.Timeout | null = null;
      let lastProcessTime = 0;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          
          // Enhanced voice activity detection
          const audioLevel = event.data.size;
          const threshold = 2000; // Adjust based on testing
          
          if (audioLevel > threshold) {
            if (!isRecording) {
              isRecording = true;
              console.log('🎤 Voice activity detected (REST API mode)');
            }
            
            // Reset silence timer
            if (silenceTimeout) {
              clearTimeout(silenceTimeout);
              silenceTimeout = null;
            }
          } else {
            if (isRecording) {
              // Set timeout to process speech after silence
              silenceTimeout = setTimeout(async () => {
                const now = Date.now();
                if (audioChunks.length > 0 && !this.isProcessing && (now - lastProcessTime) > 2000) {
                  lastProcessTime = now;
                  await this.processAudioChunks(audioChunks);
                  audioChunks = [];
                  isRecording = false;
                }
              }, 2000); // Wait 2 seconds of silence
            }
          }
        }
      };
      
      mediaRecorder.onerror = (error) => {
        console.error('❌ MediaRecorder error:', error);
        this.emit('error', error);
      };
      
      // Store media recorder for later use
      this.mediaRecorder = mediaRecorder;
      this.emit('listeningStarted');
      console.log('✅ REST API fallback ready');
      
    } catch (error) {
      console.error('❌ Failed to setup REST API fallback:', error);
      throw error;
    }
  }

  // Process audio chunks using REST API
  private async processAudioChunks(audioChunks: Blob[]): Promise<void> {
    try {
      console.log('🔄 Processing audio chunks, count:', audioChunks.length);
      
      // Combine audio chunks
      const combinedBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log('📦 Combined audio blob size:', combinedBlob.size);
      
      // Send directly to REST API without PCM conversion for now
      await this.sendAudioDataDirect(combinedBlob);
      
    } catch (error) {
      console.error('❌ Error processing audio chunks:', error);
      this.emit('error', error);
    }
  }

  // Send audio data directly to Azure Speech-to-Text (simplified)
  private async sendAudioDataDirect(audioBlob: Blob): Promise<void> {
    try {
      console.log('📤 Sending audio to REST API, size:', audioBlob.size);
      
      const token = await this.getAccessToken();
      
      const response = await fetch(`https://${this.config.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${this.config.language || 'en-US'}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'audio/webm; codecs=opus'
        },
        body: audioBlob
      });
      
      console.log('📤 REST API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Speech recognition failed:', response.status, errorText);
        throw new Error(`Speech recognition failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Speech recognized via REST API:', result);
      
      if (result.RecognitionStatus === 'Success' && result.DisplayText) {
        console.log('🎤 Speech recognized:', result.DisplayText);
        this.handleUserSpeech(result.DisplayText);
      } else if (result.RecognitionStatus === 'Success' && result.NBest && result.NBest.length > 0) {
        // Try NBest array if DisplayText is empty
        const bestResult = result.NBest[0];
        if (bestResult.Display) {
          console.log('🎤 Speech recognized (NBest):', bestResult.Display);
          this.handleUserSpeech(bestResult.Display);
        } else {
          console.log('⚠️ Speech recognized but no text found:', result);
        }
      } else {
        console.log('⚠️ Speech recognition result:', result);
      }
      
    } catch (error) {
      console.error('❌ Error sending audio data:', error);
      throw error;
    }
  }

  // Convert WebM audio to PCM format
  private async convertToPCM(audioBlob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const audioContext = new AudioContext({ sampleRate: 16000 });
      
      audio.onloadeddata = () => {
        const source = audioContext.createMediaElementSource(audio);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        const pcmChunks: Int16Array[] = [];
        
        processor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          pcmChunks.push(pcmData);
        };
        
        audio.onended = () => {
          // Combine all PCM chunks
          const totalLength = pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const combinedPCM = new Int16Array(totalLength);
          let offset = 0;
          for (const chunk of pcmChunks) {
            combinedPCM.set(chunk, offset);
            offset += chunk.length;
          }
          
          audioContext.close();
          resolve(combinedPCM.buffer);
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        audio.play();
      };
      
      audio.onerror = (error) => {
        audioContext.close();
        reject(error);
      };
      
      audio.src = URL.createObjectURL(audioBlob);
    });
  }

  // Send audio data to Azure Speech-to-Text
  private async sendAudioData(audioData: ArrayBuffer): Promise<void> {
    try {
      console.log('📤 Sending audio to REST API, size:', audioData.byteLength);
      
      const token = await this.getAccessToken();
      
      const response = await fetch(`https://${this.config.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${this.config.language || 'en-US'}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000'
        },
        body: audioData
      });
      
      if (!response.ok) {
        throw new Error(`Speech recognition failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Speech recognized via REST API:', result);
      
      if (result.RecognitionStatus === 'Success' && result.DisplayText) {
        console.log('🎤 Speech recognized:', result.DisplayText);
        this.handleUserSpeech(result.DisplayText);
      } else if (result.RecognitionStatus === 'Success' && result.NBest && result.NBest.length > 0) {
        // Try NBest array if DisplayText is empty
        const bestResult = result.NBest[0];
        if (bestResult.Display) {
          console.log('🎤 Speech recognized (NBest):', bestResult.Display);
          this.handleUserSpeech(bestResult.Display);
        } else {
          console.log('⚠️ Speech recognized but no text found:', result);
        }
      } else {
        console.log('⚠️ Speech recognition result:', result);
      }
      
    } catch (error) {
      console.error('❌ Error sending audio data:', error);
      throw error;
    }
  }

  // Start REST API streaming
  private async startRestApiStreaming(): Promise<void> {
    if (!this.mediaRecorder) {
      throw new Error('MediaRecorder not initialized');
    }
    
    try {
      // Start the existing MediaRecorder
      this.mediaRecorder.start(100); // Send data every 100ms
      console.log('🎤 REST API streaming started');
    } catch (error) {
      console.error('❌ Failed to start REST API streaming:', error);
      throw error;
    }
  }

  // Stop audio streaming
  private stopAudioStreaming(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
    
    if ((this as any).audioProcessor) {
      (this as any).audioProcessor.disconnect();
      (this as any).audioProcessor = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  // Handle user speech input
  private async handleUserSpeech(text: string): Promise<void> {
    console.log('🎤 handleUserSpeech called with:', text);
    console.log('🎤 isProcessing:', this.isProcessing);
    
    if (this.isProcessing) {
      console.log('⚠️ Already processing, skipping...');
      return;
    }
    
    try {
      this.isProcessing = true;
      this.emit('processingStarted');
      console.log('🔄 Processing user speech:', text);
      
      // Get AI response
      console.log('🤖 Getting AI response...');
      const aiResponse = await this.getAIResponse(text);
      console.log('🤖 AI response received:', aiResponse);
      
      // Speak the response
      console.log('🔊 Speaking AI response...');
      await this.speakResponse(aiResponse);
      console.log('✅ Speech response completed');
      
    } catch (error) {
      console.error('❌ Error processing user speech:', error);
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
      this.emit('processingEnded');
      console.log('🏁 Processing ended');
    }
  }

  // Get AI response (placeholder - replace with your AI service)
  private async getAIResponse(text: string): Promise<string> {
    console.log('🤖 getAIResponse called with:', text);
    
    // This is a placeholder - replace with your actual AI service
    const responses = [
      "Hello! How can I help you today?",
      "That's interesting! Tell me more.",
      "I understand. What would you like to know?",
      "Great question! Let me think about that.",
      "I'm here to help. What else can I assist you with?"
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    console.log('🤖 Returning AI response:', response);
    return response;
  }

  // Speak response using Azure Text-to-Speech
  private async speakResponse(text: string): Promise<void> {
    try {
      console.log('🔊 speakResponse called with:', text);
      this.isSpeaking = true;
      this.emit('speakingStarted');
      
      console.log('🔊 Speaking response:', text);
      
      // Use Azure TTS REST API
      console.log('🎵 Synthesizing speech...');
      const audioData = await this.synthesizeSpeech(text);
      console.log('🎵 Speech synthesized, audio data size:', audioData.byteLength);
      
      // Play the audio
      console.log('🎵 Playing audio...');
      await this.playAudio(audioData);
      console.log('🎵 Audio playback completed');
      
    } catch (error) {
      console.error('❌ Error speaking response:', error);
      this.emit('error', error);
    } finally {
      this.isSpeaking = false;
      this.emit('speakingEnded');
      console.log('🔊 Speaking ended');
    }
  }

  // Synthesize speech using Azure TTS
  private async synthesizeSpeech(text: string): Promise<ArrayBuffer> {
    console.log('🎵 synthesizeSpeech called with:', text);
    
    const token = await this.getAccessToken();
    console.log('🎵 Got access token for TTS');
    
    const voice = this.config.voice || 'en-US-AriaNeural';
    console.log('🎵 Using voice:', voice);
    
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${voice}">
          ${text}
        </voice>
      </speak>
    `;
    
    console.log('🎵 SSML:', ssml);
    console.log('🎵 Making TTS request to:', `https://${this.config.region}.tts.speech.microsoft.com/cognitiveservices/v1`);
    
    const response = await fetch(`https://${this.config.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
      },
      body: ssml
    });
    
    console.log('🎵 TTS response status:', response.status);
    console.log('🎵 TTS response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ TTS request failed:', response.status, errorText);
      throw new Error(`TTS request failed: ${response.status} - ${errorText}`);
    }
    
    const audioData = await response.arrayBuffer();
    console.log('🎵 TTS audio data received, size:', audioData.byteLength);
    
    return audioData;
  }

  // Play audio data
  private async playAudio(audioData: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🎵 playAudio called with audio data size:', audioData.byteLength);
        
        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        console.log('🎵 Created audio URL:', audioUrl);
        
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;
        console.log('🎵 Created audio element');
        
        audio.onended = () => {
          console.log('🎵 Audio playback ended');
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          resolve();
        };
        
        audio.onerror = (error) => {
          console.error('❌ Audio playback error:', error);
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          reject(error);
        };
        
        audio.onloadstart = () => {
          console.log('🎵 Audio loading started');
        };
        
        audio.oncanplay = () => {
          console.log('🎵 Audio can play');
        };
        
        console.log('🎵 Starting audio playback...');
        audio.play().then(() => {
          console.log('🎵 Audio play() promise resolved');
        }).catch((error) => {
          console.error('❌ Audio play() promise rejected:', error);
          reject(error);
        });
        
      } catch (error) {
        console.error('❌ Error in playAudio:', error);
        reject(error);
      }
    });
  }

  // Get access token for Azure Speech Services
  private async getAccessToken(): Promise<string> {
    const response = await fetch(`https://${this.config.region}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status}`);
    }
    
    const token = await response.text();
    console.log('🔑 Access token obtained');
    return token;
  }

  // Get available voices
  async getVoices(): Promise<Voice[]> {
    try {
      const token = await this.getAccessToken();
      
      const response = await fetch(`https://${this.config.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get voices: ${response.status}`);
      }
      
      const voices = await response.json();
      return voices.map((voice: any) => ({
        name: voice.ShortName,
        gender: voice.Gender,
        locale: voice.Locale
      }));
    } catch (error) {
      console.error('❌ Failed to get voices:', error);
      throw error;
    }
  }

  // Test system functionality
  async testSystem(): Promise<void> {
    try {
      console.log('🧪 Testing system...');
      
      // Test WebSocket connection
      if (this.speechRecognizer instanceof WebSocket) {
        console.log('🔗 WebSocket state:', this.speechRecognizer.readyState);
        console.log('🔗 WebSocket URL:', this.speechRecognizer.url);
        
        if (this.speechRecognizer.readyState === WebSocket.OPEN) {
          console.log('✅ WebSocket is open and ready');
          
          // Send a test message to see if we get any response
          const testMessage = {
            context: {
              system: {
                name: 'SpeechSDK',
                version: '1.0.0'
              }
            }
          };
          
          const messageBytes = new TextEncoder().encode(JSON.stringify(testMessage));
          const header = new ArrayBuffer(4);
          const headerView = new DataView(header);
          headerView.setUint32(0, messageBytes.length, false);
          
          const binaryMessage = new Uint8Array(header.byteLength + messageBytes.length);
          binaryMessage.set(new Uint8Array(header), 0);
          binaryMessage.set(messageBytes, header.byteLength);
          
          console.log('📤 Sending test message to WebSocket...');
          this.speechRecognizer.send(binaryMessage.buffer);
        } else {
          console.log('❌ WebSocket is not open, state:', this.speechRecognizer.readyState);
        }
      } else {
        console.log('❌ No WebSocket connection');
      }
      
      // Test TTS
      const testText = "Hello! This is a test of the voice system.";
      console.log('🔊 Testing TTS with:', testText);
      await this.speakResponse(testText);
      
      console.log('✅ System test completed');
    } catch (error) {
      console.error('❌ System test failed:', error);
      throw error;
    }
  }

  // Test speech recognition manually
  async testSpeechRecognition(): Promise<void> {
    try {
      console.log('🧪 Testing speech recognition manually...');
      
      // Simulate speech recognition with a test phrase
      const testSpeech = "Hello, this is a test";
      console.log('🎤 Simulating speech recognition with:', testSpeech);
      
      // Call handleUserSpeech directly
      await this.handleUserSpeech(testSpeech);
      
      console.log('✅ Speech recognition test completed');
    } catch (error) {
      console.error('❌ Speech recognition test failed:', error);
      throw error;
    }
  }

  // Test with actual speech recognition result
  async testWithSpeechResult(): Promise<void> {
    try {
      console.log('🧪 Testing with actual speech result...');
      
      // Simulate what Azure would return
      const mockSpeechResult = "Hello there, how are you?";
      console.log('🎤 Simulating Azure speech result:', mockSpeechResult);
      
      // Call handleUserSpeech directly
      await this.handleUserSpeech(mockSpeechResult);
      
      console.log('✅ Speech result test completed');
    } catch (error) {
      console.error('❌ Speech result test failed:', error);
      throw error;
    }
  }

  // Test REST API speech recognition directly
  async testRestApiRecognition(): Promise<void> {
    try {
      console.log('🧪 Testing REST API speech recognition...');
      
      // Create a simple test audio blob (silence)
      const testAudio = new Blob([new ArrayBuffer(1024)], { type: 'audio/webm' });
      console.log('📦 Created test audio blob, size:', testAudio.size);
      
      // Try to send it to REST API
      await this.sendAudioDataDirect(testAudio);
      
      console.log('✅ REST API test completed');
    } catch (error) {
      console.error('❌ REST API test failed:', error);
      throw error;
    }
  }

  // Generate a unique request ID (no-dash UUID format)
  private generateRequestId(): string {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Cleanup resources
  async cleanup(): Promise<void> {
    try {
      await this.stopConversation();
      
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }
      
      this.isConnected = false;
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  }

  // Setup Web Speech API for direct browser speech recognition
  private async setupWebSpeechAPI(): Promise<void> {
    try {
      console.log('🎤 Setting up Web Speech API...');
      
      // Check if Web Speech API is supported
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        throw new Error('Web Speech API not supported in this browser');
      }
      
      // Create speech recognition instance
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.speechRecognizer = new SpeechRecognition();
      
      // Configure speech recognition
      this.speechRecognizer.continuous = true;
      this.speechRecognizer.interimResults = false;
      this.speechRecognizer.lang = this.config.language || 'en-US';
      this.speechRecognizer.maxAlternatives = 1;
      
      // Set up event handlers
      this.speechRecognizer.onstart = () => {
        console.log('🎤 Web Speech API started');
        this.emit('listeningStarted');
      };
      
      this.speechRecognizer.onresult = (event) => {
        console.log('🎤 Web Speech API result received');
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const transcript = result[0].transcript.trim();
            console.log('🎤 Speech recognized:', transcript);
            this.handleUserSpeech(transcript);
          }
        }
      };
      
      this.speechRecognizer.onerror = (event) => {
        console.error('❌ Web Speech API error:', event.error);
        this.emit('error', new Error(`Speech recognition error: ${event.error}`));
      };
      
      this.speechRecognizer.onend = () => {
        console.log('🔄 Web Speech API ended');
        if (this.conversationActive) {
          // Restart recognition if conversation is still active
          setTimeout(() => {
            if (this.conversationActive) {
              this.speechRecognizer.start();
            }
          }, 100);
        }
      };
      
      // Start recognition
      this.speechRecognizer.start();
      
      console.log('✅ Web Speech API setup complete');
      
    } catch (error) {
      console.error('❌ Failed to setup Web Speech API:', error);
      throw error;
    }
  }
}