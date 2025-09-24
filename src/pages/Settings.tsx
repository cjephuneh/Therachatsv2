
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const Settings = () => {
  const { user, updatePreferences, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [therapistEmail, setTherapistEmail] = useState(user?.preferences.therapistEmail || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user?.preferences.notificationsEnabled || false
  );
  const [isLoading, setIsLoading] = useState(false);

  // Sync theme with user preferences when user changes
  useEffect(() => {
    if (user?.preferences?.theme) {
      setTheme(user.preferences.theme);
    }
  }, [user?.preferences?.theme, setTheme]);

  const handleSavePreferences = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const success = await updatePreferences({
        theme,
        notificationsEnabled,
        therapistEmail: therapistEmail.trim() || undefined,
      });

      if (success) {
        toast.success('Preferences saved successfully');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    // Save immediately to user preferences
    if (user) {
      updatePreferences({
        theme: newTheme,
        notificationsEnabled,
        therapistEmail: therapistEmail.trim() || undefined,
      });
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Please log in to view settings</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
        <Button 
          onClick={handleSavePreferences} 
          disabled={isLoading}
          className="bg-therabot-primary hover:bg-therabot-secondary"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </header>

      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-medium mb-4">Account Information</h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={user.name} disabled />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email} disabled />
              </div>
            </div>
          </div>

          {/* <div>
            <h2 className="text-lg font-medium mb-4">Therapist Connection</h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <div>
                <Label htmlFor="therapistEmail">Your Therapist's Email</Label>
                <Input 
                  id="therapistEmail" 
                  type="email" 
                  placeholder="therapist@example.com" 
                  value={therapistEmail}
                  onChange={e => setTherapistEmail(e.target.value)}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Enter your therapist's email to enable the "Send to Therapist" feature
                </p>
              </div>
            </div>
          </div> */}

          <div>
            <h2 className="text-lg font-medium mb-4">Preferences</h2>
            <div className="bg-muted p-4 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications">Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications about your conversations
                  </p>
                </div>
                <Switch 
                  id="notifications" 
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>
              
              <div>
                <Label>Theme</Label>
                <div className="flex gap-4 mt-2">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    onClick={() => handleThemeChange('light')}
                    className={theme === 'light' ? 'bg-therabot-primary' : ''}
                  >
                    Light
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    onClick={() => handleThemeChange('dark')}
                    className={theme === 'dark' ? 'bg-therabot-primary' : ''}
                  >
                    Dark
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t">
            <Button 
              variant="destructive"
              onClick={handleLogout}
            >
              Log Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
