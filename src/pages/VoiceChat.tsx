import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Settings, 
  Languages, 
  Headphones,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Star,
  MessageCircle,
  Radio,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import RealtimeService, { RealtimeConfig } from '@/services/realtimeService';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const VoiceChat = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  
  // Voice service state
  const [voiceService, setVoiceService] = useState<RealtimeService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Configuration state
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [availableLanguages] = useState([
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish (Spain)' },
    { code: 'fr-FR', name: 'French (France)' },
    { code: 'de-DE', name: 'German (Germany)' },
    { code: 'it-IT', name: 'Italian (Italy)' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'ru-RU', name: 'Russian (Russia)' },
    { code: 'ja-JP', name: 'Japanese (Japan)' },
    { code: 'ko-KR', name: 'Korean (Korea)' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' }
  ]);
  const [availableVoices] = useState([
    { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced voice' },
    { id: 'ash', name: 'Ash', description: 'Warm, friendly voice' },
    { id: 'ballad', name: 'Ballad', description: 'Smooth, melodic voice' },
    { id: 'coral', name: 'Coral', description: 'Bright, energetic voice' },
    { id: 'echo', name: 'Echo', description: 'Clear, professional voice' },
    { id: 'sage', name: 'Sage', description: 'Calm, wise voice' },
    { id: 'shimmer', name: 'Shimmer', description: 'Soft, gentle voice' },
    { id: 'verse', name: 'Verse', description: 'Expressive, dynamic voice' }
  ]);
  
  // Settings state
  const [autoPlay, setAutoPlay] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [outputFormat, setOutputFormat] = useState<'audio-24khz-96kbitrate-mono-mp3'>('audio-24khz-96kbitrate-mono-mp3');
  
  // Conversation state
  const [conversationActive, setConversationActive] = useState(false);
  const [lastUserSpeech, setLastUserSpeech] = useState<string>('');
  const [lastAssistantResponse, setLastAssistantResponse] = useState<string>('');
  const [rating, setRating] = useState<number | null>(null);
  
  // Error handling
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // Initialize voice service
  useEffect(() => {
    const initializeService = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const config: RealtimeConfig = {
          apiKey: import.meta.env.VITE_AZURE_OPENAI_API_KEY || '',
          endpoint: import.meta.env.VITE_AZURE_REALTIME_ENDPOINT || '',
          deployment: import.meta.env.VITE_AZURE_REALTIME_DEPLOYMENT || 'gpt-4o-realtime-preview',
          apiVersion: '2024-10-01-preview',
          voice: selectedVoice
        };
        
        // Validate configuration
        if (!config.apiKey || !config.endpoint) {
          throw new Error('Missing Azure OpenAI configuration. Please set VITE_AZURE_OPENAI_API_KEY and VITE_AZURE_REALTIME_ENDPOINT environment variables.');
        }
        
        console.log('🔧 RealtimeService config:', {
          endpoint: config.endpoint,
          deployment: config.deployment,
          apiVersion: config.apiVersion,
          hasApiKey: !!config.apiKey
        });
        
        const service = new RealtimeService(config);
        
        // Set up event listeners
        service.on('connected', () => {
          setIsInitialized(true);
          setIsConnected(true);
          toast.success('Connected to Azure OpenAI Realtime API');
        });
        
        service.on('disconnected', () => {
          setIsConnected(false);
          toast.warning('Disconnected from Azure OpenAI Realtime API');
        });
        
        service.on('sessionCreated', (sessionId) => {
          console.log('Session created:', sessionId);
          toast.info('Voice session started');
        });
        
        service.on('listeningStarted', () => {
          setIsListening(true);
          toast.info('Listening for your voice...');
        });
        
        service.on('listeningStopped', () => {
          setIsListening(false);
          toast.info('Stopped listening');
        });
        
        service.on('userSpeechStarted', () => {
          setIsProcessing(true);
          toast.info('I hear you speaking...');
        });
        
        service.on('userSpeechStopped', () => {
          setIsProcessing(false);
          toast.info('Processing your speech...');
        });
        
        service.on('transcriptInterim', (text) => {
          console.log('Interim transcript:', text);
        });
        
        service.on('transcriptFinal', (text) => {
          console.log('Final transcript:', text);
          setLastUserSpeech(text);
          toast.success(`You said: "${text}"`);
        });
        
        service.on('responseInterim', (text) => {
          console.log('Interim response:', text);
        });
        
        service.on('responseFinal', (text) => {
          console.log('Final response:', text);
          toast.success(`TheraChat: "${text}"`);
        });
        
        service.on('speechStarted', () => {
          setIsSpeaking(true);
          toast.info('TheraChat is speaking...');
        });
        
        service.on('speechStopped', () => {
          setIsSpeaking(false);
        });
        
        service.on('audioPlayed', () => {
          setIsPlaying(true);
          setTimeout(() => setIsPlaying(false), 1000);
        });
        
        service.on('error', (error: any) => {
          setError(error.message || 'An error occurred');
          toast.error('Voice service error: ' + (error.message || 'Unknown error'));
        });
        
        await service.initialize();
        await service.connect();
        setVoiceService(service);
        
      } catch (error: any) {
        setError(error.message || 'Failed to initialize voice service');
        toast.error('Failed to initialize voice service');
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeService();
    
    return () => {
      if (voiceService) {
        voiceService.cleanup();
      }
    };
  }, []);

  // Update service when voice changes
  useEffect(() => {
    if (voiceService && selectedVoice) {
      console.log('Voice changed to:', selectedVoice);
      // Reinitialize service with new voice
      const reinitializeService = async () => {
        try {
          await voiceService.disconnect();
          const config: RealtimeConfig = {
            apiKey: import.meta.env.VITE_AZURE_OPENAI_API_KEY || '',
            endpoint: import.meta.env.VITE_AZURE_REALTIME_ENDPOINT || '',
            deployment: import.meta.env.VITE_AZURE_REALTIME_DEPLOYMENT || 'gpt-4o-realtime-preview',
            apiVersion: '2024-10-01-preview',
            voice: selectedVoice
          };
          
          if (!config.apiKey || !config.endpoint) {
            throw new Error('Missing Azure OpenAI configuration');
          }
          
          const newService = new RealtimeService(config);
          
          // Set up event listeners (same as in main useEffect)
          newService.on('connected', () => {
            setIsInitialized(true);
            setIsConnected(true);
            toast.success('Connected to Azure OpenAI Realtime API');
          });
          
          newService.on('disconnected', () => {
            setIsConnected(false);
            toast.warning('Disconnected from Azure OpenAI Realtime API');
          });
          
          newService.on('sessionCreated', (sessionId) => {
            console.log('Session created:', sessionId);
            toast.info('Voice session started');
          });
          
          newService.on('listeningStarted', () => {
            setIsListening(true);
            toast.info('Listening for your voice...');
          });
          
          newService.on('listeningStopped', () => {
            setIsListening(false);
            toast.info('Stopped listening');
          });
          
          newService.on('userSpeechStarted', () => {
            setIsProcessing(true);
            toast.info('I hear you speaking...');
          });
          
          newService.on('userSpeechStopped', () => {
            setIsProcessing(false);
            toast.info('Processing your speech...');
          });
          
          newService.on('transcriptInterim', (text) => {
            console.log('Interim transcript:', text);
          });
          
          newService.on('transcriptFinal', (text) => {
            console.log('Final transcript:', text);
            setLastUserSpeech(text);
            toast.success(`You said: "${text}"`);
          });
          
          newService.on('responseInterim', (text) => {
            console.log('Interim response:', text);
          });
          
          newService.on('responseFinal', (text) => {
            console.log('Final response:', text);
            toast.success(`TheraChat: "${text}"`);
          });
          
          newService.on('speechStarted', () => {
            setIsSpeaking(true);
            toast.info('TheraChat is speaking...');
          });
          
          newService.on('speechStopped', () => {
            setIsSpeaking(false);
          });
          
          newService.on('audioPlayed', () => {
            setIsPlaying(true);
            setTimeout(() => setIsPlaying(false), 1000);
          });
          
          newService.on('error', (error: any) => {
            setError(error.message || 'An error occurred');
            toast.error('Voice service error: ' + (error.message || 'Unknown error'));
          });
          
          await newService.initialize();
          await newService.connect();
          setVoiceService(newService);
          
        } catch (error: any) {
          setError(error.message || 'Failed to update voice');
          toast.error('Failed to update voice');
        }
      };
      
      reinitializeService();
    }
  }, [selectedVoice]);

  const scrollToBottom = () => {
    // No longer needed for voice-only interface
  };

  // Handle AI response to user speech
  const handleAIResponse = async (userSpeech: string) => {
    try {
      console.log('Processing user speech:', userSpeech);
      
      // Call your existing Azure OpenAI service
      const response = await (window as any).sendMessageToAzureOpenAI(userSpeech);
      console.log('AI response received:', response);
      
      setLastAssistantResponse(response);
      
      // Convert text response to speech using Azure TTS
      if (voiceService && response) {
        console.log('Sending response to TTS:', response);
        await (voiceService as any).speakResponse(response);
        console.log('TTS request sent');
      }
      
      toast.success('Assistant responded');
    } catch (error: any) {
      console.error('AI response error:', error);
      toast.error('Failed to get AI response: ' + error.message);
    }
  };

  const handleStartConversation = async () => {
    if (!voiceService) {
      toast.error('Voice service not initialized');
      return;
    }
    
    try {
      console.log('🎤 Starting conversation...');
      await voiceService.startListening();
      setConversationActive(true);
      toast.success('Conversation started! Speak naturally.');
    } catch (error: any) {
      console.error('❌ Failed to start conversation:', error);
      toast.error('Failed to start conversation: ' + error.message);
    }
  };

  const handleTestSystem = async () => {
    if (!voiceService) {
      toast.error('Voice service not initialized');
      return;
    }
    
    try {
      console.log('🧪 Testing voice system...');
      await voiceService.sendTextMessage("Hello, this is a test message");
      toast.success('Voice system test completed!');
    } catch (error: any) {
      console.error('❌ Voice system test failed:', error);
      toast.error('Voice system test failed: ' + error.message);
    }
  };

  const handleTestSpeechRecognition = async () => {
    if (!voiceService) {
      toast.error('Voice service not initialized');
      return;
    }
    
    try {
      console.log('🧪 Testing speech recognition manually...');
      await voiceService.startListening();
      setTimeout(() => voiceService.stopListening(), 3000);
      toast.success('Speech recognition test completed!');
    } catch (error: any) {
      console.error('❌ Speech recognition test failed:', error);
      toast.error('Speech recognition test failed: ' + error.message);
    }
  };

  const handleTestWithSpeechResult = async () => {
    if (!voiceService) {
      toast.error('Voice service not initialized');
      return;
    }
    
    try {
      console.log('🧪 Testing with speech result...');
      await voiceService.sendTextMessage("Test message for speech result");
      toast.success('Speech result test completed!');
    } catch (error: any) {
      console.error('❌ Speech result test failed:', error);
      toast.error('Speech result test failed: ' + error.message);
    }
  };

  const handleTestRestApi = async () => {
    if (!voiceService) {
      toast.error('Voice service not initialized');
      return;
    }
    
    try {
      console.log('🧪 Testing REST API...');
      const status = voiceService.getStatus();
      console.log('Service status:', status);
      toast.success('REST API test completed!');
    } catch (error: any) {
      console.error('❌ REST API test failed:', error);
      toast.error('REST API test failed: ' + error.message);
    }
  };

  const handleStopConversation = async () => {
    if (!voiceService) return;
    
    try {
      await voiceService.stopListening();
      setConversationActive(false);
    } catch (error: any) {
      toast.error('Failed to stop conversation: ' + error.message);
    }
  };

  const toggleMute = () => {
    setIsPlaying(false);
    toast.info('Audio muted');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Headphones className="h-6 w-6 text-therabot-primary" />
            <h1 className="text-xl font-semibold text-therabot-dark dark:text-therabot-primary">
              Voice Chat
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? "default" : "destructive"} className="flex items-center gap-1">
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Chat Area */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Connection Status */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {isLoading && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>Initializing voice service...</AlertDescription>
              </Alert>
            )}
            
            {/* Voice Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5" />
                  Voice Conversation
                </CardTitle>
                <CardDescription>
                  Have a natural voice conversation with TheraChat
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Conversation Status */}
                <div className="text-center">
                  <Badge 
                    variant={conversationActive ? "default" : "secondary"} 
                    className="text-lg px-4 py-2"
                  >
                    {conversationActive ? 'Conversation Active' : 'Ready to Start'}
                  </Badge>
                </div>

                {/* Main Voice Controls */}
                <div className="flex items-center justify-center gap-6">
                  {!conversationActive ? (
                    <>
                      <Button
                        size="lg"
                        onClick={handleStartConversation}
                        disabled={!isConnected || isLoading}
                        className="h-20 w-20 rounded-full bg-green-600 hover:bg-green-700"
                      >
                        <MessageCircle className="h-10 w-10" />
                      </Button>
                      
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handleTestSystem}
                        disabled={!isConnected || isLoading}
                        className="h-16 w-16 rounded-full"
                      >
                        <Volume2 className="h-8 w-8" />
                      </Button>
                      
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handleTestSpeechRecognition}
                        disabled={!isConnected || isLoading}
                        className="h-16 w-16 rounded-full"
                      >
                        <Mic className="h-8 w-8" />
                      </Button>
                      
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handleTestWithSpeechResult}
                        disabled={!isConnected || isLoading}
                        className="h-16 w-16 rounded-full"
                      >
                        <MessageCircle className="h-8 w-8" />
                      </Button>
                      
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handleTestRestApi}
                        disabled={!isConnected || isLoading}
                        className="h-16 w-16 rounded-full"
                      >
                        <Radio className="h-8 w-8" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={handleStopConversation}
                        disabled={!isConnected}
                        className="h-20 w-20 rounded-full"
                      >
                        <X className="h-10 w-10" />
                      </Button>
                    </>
                  )}
                  
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={toggleMute}
                    disabled={!isPlaying}
                    className="h-16 w-16 rounded-full"
                  >
                    {isPlaying ? <Volume2 className="h-8 w-8" /> : <VolumeX className="h-8 w-8" />}
                  </Button>
                </div>
                
                {/* Status Indicators */}
                <div className="flex justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span className="text-sm">Listening</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span className="text-sm">Processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span className="text-sm">AI Speaking</span>
                  </div>
                </div>
                
                {/* Instructions */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {!conversationActive 
                      ? 'Click the green button to start a natural voice conversation'
                      : isSpeaking
                        ? 'TheraChat is speaking...'
                        : isProcessing
                          ? 'Processing your speech...'
                          : isListening
                            ? 'Listening... speak naturally'
                            : 'Ready to listen'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Conversation Display */}
            {(lastUserSpeech || lastAssistantResponse) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Conversation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {lastUserSpeech && (
                      <div className="p-4 bg-therabot-primary text-white rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Mic className="h-4 w-4" />
                          <span className="text-sm font-medium">You said:</span>
                        </div>
                        <p className="text-sm">{lastUserSpeech}</p>
                      </div>
                    )}
                    
                    {lastAssistantResponse && (
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Volume2 className="h-4 w-4" />
                          <span className="text-sm font-medium">TheraChat responded:</span>
                        </div>
                        <p className="text-sm">{lastAssistantResponse}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Settings Sidebar */}
          <div className="space-y-4">
            
            {/* Language Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  Language Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLanguages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="voice">Voice</Label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVoices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name} - {voice.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Audio Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Audio Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="autoPlay">Auto Play Responses</Label>
                  <Switch
                    id="autoPlay"
                    checked={autoPlay}
                    onCheckedChange={setAutoPlay}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="noiseSuppression">Noise Suppression</Label>
                  <Switch
                    id="noiseSuppression"
                    checked={noiseSuppression}
                    onCheckedChange={setNoiseSuppression}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="echoCancellation">Echo Cancellation</Label>
                  <Switch
                    id="echoCancellation"
                    checked={echoCancellation}
                    onCheckedChange={setEchoCancellation}
                  />
                </div>
                
                <div>
                  <Label htmlFor="outputFormat">Output Format</Label>
                  <Select value={outputFormat} onValueChange={(value: any) => setOutputFormat(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="audio-16khz-32kbitrate-mono-mp3">16kHz 32kbps MP3</SelectItem>
                      <SelectItem value="audio-16khz-64kbitrate-mono-mp3">16kHz 64kbps MP3</SelectItem>
                      <SelectItem value="audio-16khz-128kbitrate-mono-mp3">16kHz 128kbps MP3</SelectItem>
                      <SelectItem value="audio-24khz-48kbitrate-mono-mp3">24kHz 48kbps MP3</SelectItem>
                      <SelectItem value="audio-24khz-96kbitrate-mono-mp3">24kHz 96kbps MP3</SelectItem>
                      <SelectItem value="audio-24khz-160kbitrate-mono-mp3">24kHz 160kbps MP3</SelectItem>
                      <SelectItem value="audio-48khz-96kbitrate-mono-mp3">48kHz 96kbps MP3</SelectItem>
                      <SelectItem value="audio-48khz-192kbitrate-mono-mp3">48kHz 192kbps MP3</SelectItem>
                      <SelectItem value="audio-48khz-288kbitrate-mono-mp3">48kHz 288kbps MP3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Feedback */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Rate Experience
                </CardTitle>
                <CardDescription>
                  How was your voice conversation?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Rating</Label>
                  <div className="flex gap-2 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Button
                        key={star}
                        variant={rating && star <= rating ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRating(star)}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>
                </div>
                
                <Button onClick={() => setRating(null)} className="w-full">
                  Clear Rating
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceChat;
