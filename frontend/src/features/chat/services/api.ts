import { getApiUrl } from '@/lib/api';
import {
    fetchConversationMessages,
    sendConversationMessage,
    reactToMessage,
    markConversationRead,
    setTypingState,
    downloadMessageMedia,
    sendMediaMessage,
} from './chatApi';
import { Message } from '../types';

export const api = {
    API_URL: getApiUrl(),

    getMessages: async (chatId: string): Promise<Message[]> => {
        try {
            const response = await fetchConversationMessages(chatId, { limit: 20 });
            return response.messages;
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    },

    sendMessage: async (chatId: string, text: string): Promise<boolean> => {
        try {
            await sendConversationMessage(chatId, { content: text, type: 'text' });
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    },

    sendReaction: async (chatId: string, messageId: string, reaction: string): Promise<void> => {
        try {
            await reactToMessage({ conversationId: chatId, messageId, reaction });
        } catch (error) {
            console.error('Error sending reaction:', error);
        }
    },

    markMessagesAsRead: async (messageIds: string[], chatId?: string): Promise<void> => {
        if (chatId) {
            try {
                await markConversationRead(chatId);
            } catch (error) {
                console.error('Error marking conversation read:', error);
            }
        }
    },

    sendPresence: async (chatId: string, status: 'composing' | 'recording' | 'paused'): Promise<void> => {
        try {
            // Send the full presence status to backend, which forwards to WhatsApp
            await setTypingState(chatId, status);
        } catch (error) {
            console.error('Error sending presence:', error);
        }
    },

    downloadMedia: async (messageId: string): Promise<{ fileURL?: string; base64Data?: string; mimetype?: string } | null> => {
        try {
            const result = await downloadMessageMedia({
                id: messageId,
                return_link: true,
                return_base64: true,
                generate_mp3: true,
            });
            return result;
        } catch (error) {
            console.error('Error downloading media:', error);
            return null;
        }
    },

    getQuickAnswers: async (): Promise<any[]> => {
        return [];
    },

    sendMedia: async (chatId: string, type: string, fileData: string, docName?: string, text?: string): Promise<void> => {
        try {
            const number = chatId.replace('@s.whatsapp.net', '').replace('@g.us', '');
            const mediaType = type as "image" | "video" | "document" | "audio" | "ptt" | "sticker";

            await sendMediaMessage({
                number,
                type: mediaType,
                file: fileData,
                text: text,
                docName: docName,
            });
        } catch (error) {
            console.error('Error sending media:', error);
        }
    }
};

