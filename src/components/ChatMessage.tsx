
import React, { useState } from 'react';
import { Message, formatDate } from '@/services/azureService';
import { Send, Trash2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ChatMessageProps {
  message: Message;
  onDelete: (messageId: string) => void;
  onSendToTherapist: (messageId: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  onDelete,
  onSendToTherapist
}) => {
  const isUser = message.role === 'user';
  const [notes, setNotes] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSendToTherapist = () => {
    onSendToTherapist(message.id);
    setDialogOpen(false);
    toast.success("Message sent to your therapist");
  };

  return (
    <div className={cn(
      "flex gap-3 p-4 my-2 rounded-lg max-w-3xl group",
      isUser 
        ? "ml-auto mr-0 bg-therabot-primary text-white rounded-tr-none" 
        : "ml-0 mr-auto bg-therabot-softPurple text-therabot-dark rounded-tl-none"
    )}>
      <div className="flex-1">
        <div className="flex flex-col gap-1">
          <div className="text-sm font-medium">
            {isUser ? 'You' : 'TheraChat'}
          </div>
          <div className="whitespace-pre-line">
            {message.content}
          </div>
          <div className="text-xs opacity-70 mt-2">
            {formatDate(message.timestamp)}
          </div>
        </div>
      </div>
      
      {/* Action buttons - only show on hover */}
      <div className={cn(
        "flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
        isUser ? "justify-start" : "justify-end"
      )}>
        {isUser && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-white hover:bg-white/20" 
                title="Send to therapist"
              >
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Send to Your Therapist</DialogTitle>
                <DialogDescription>
                  Add optional notes to share with your therapist along with this message.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="bg-gray-100 p-3 rounded-md text-sm text-gray-700">
                  {message.content}
                </div>
                <Textarea
                  placeholder="Add any context or questions for your therapist..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              <DialogFooter>
                <Button onClick={handleSendToTherapist} className="bg-therabot-primary hover:bg-therabot-secondary">
                  Send to Therapist
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "h-6 w-6 hover:bg-white/20",
            isUser ? "text-white" : "text-therabot-dark"
          )}
          onClick={() => onDelete(message.id)}
          title="Delete message"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default ChatMessage;
