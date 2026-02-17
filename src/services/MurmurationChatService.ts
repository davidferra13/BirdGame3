/**
 * Murmuration Chat Service
 * Relays group chat messages through WebSocket and loads history from Supabase.
 *
 * Features:
 * - Load recent chat history from the murmuration_chat_messages table
 * - Send messages through an active WebSocket connection
 * - Rate limiting and message length validation
 * - Register callbacks for incoming chat messages
 */

import { supabase, getCurrentUser } from '@/services/SupabaseClient';
import { MURMURATION } from '@/utils/Constants';
import type { MurmurationChatMessage } from '@/types/murmuration';

class MurmurationChatService {
  private ws: WebSocket | null = null;
  private messageCallbacks: Array<(msg: MurmurationChatMessage) => void> = [];
  private lastSendTime = 0;

  // ---------------------------------------------------------------------------
  // WebSocket management
  // ---------------------------------------------------------------------------

  /**
   * Set the WebSocket connection to use for sending and receiving chat messages.
   */
  setWebSocket(ws: WebSocket): void {
    this.ws = ws;
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  /**
   * Load recent chat messages from Supabase.
   * Falls back to an empty array if the table does not exist or the query fails.
   */
  async loadHistory(
    murmurationId: string,
    limit = 50,
  ): Promise<MurmurationChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('murmuration_chat_messages')
        .select('id, murmuration_id, sender_id, sender_username, message, timestamp')
        .eq('murmuration_id', murmurationId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        // Table may not exist yet -- degrade gracefully
        console.warn('MurmurationChatService.loadHistory: query failed, returning empty array', error.message);
        return [];
      }

      // Reverse so oldest messages come first (chronological order)
      return (data as MurmurationChatMessage[]).reverse();
    } catch (err) {
      console.error('MurmurationChatService.loadHistory: unexpected error', err);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Sending
  // ---------------------------------------------------------------------------

  /**
   * Send a chat message to the murmuration.
   * Validates message length, enforces rate limiting, and transmits via WebSocket.
   *
   * @returns An object indicating success or an error reason.
   */
  async sendMessage(
    murmurationId: string,
    message: string,
  ): Promise<{ success: boolean; error?: string }> {
    // --- Validate message length ---
    if (!message || message.trim().length === 0) {
      return { success: false, error: 'Message cannot be empty' };
    }

    if (message.length > MURMURATION.CHAT_MAX_LENGTH) {
      return {
        success: false,
        error: `Message exceeds maximum length of ${MURMURATION.CHAT_MAX_LENGTH} characters`,
      };
    }

    // --- Rate limiting ---
    const now = Date.now();
    if (now - this.lastSendTime < MURMURATION.CHAT_RATE_LIMIT_MS) {
      return { success: false, error: 'Rate limited. Please wait before sending another message.' };
    }

    // --- Ensure WebSocket is available and open ---
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { success: false, error: 'WebSocket is not connected' };
    }

    // --- Resolve current user ---
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const senderId = user.id;
    const senderUsername = user.user_metadata?.username ?? user.email ?? 'Unknown';

    // --- Build and send the message ---
    const timestamp = Date.now();
    const payload = {
      type: 'murmuration_chat' as const,
      data: {
        senderId,
        senderUsername,
        message: message.trim(),
        timestamp,
      },
    };

    try {
      this.ws.send(JSON.stringify(payload));
      this.lastSendTime = timestamp;
      return { success: true };
    } catch (err) {
      console.error('MurmurationChatService.sendMessage: failed to send', err);
      return { success: false, error: 'Failed to send message' };
    }
  }

  // ---------------------------------------------------------------------------
  // Receiving
  // ---------------------------------------------------------------------------

  /**
   * Register a callback to be invoked whenever an incoming chat message is received.
   * Returns an unsubscribe function.
   */
  onMessage(callback: (msg: MurmurationChatMessage) => void): () => void {
    this.messageCallbacks.push(callback);

    return () => {
      this.messageCallbacks = this.messageCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Parse an incoming WebSocket message and invoke registered callbacks.
   * Should be called from the WebSocket `onmessage` handler with the parsed JSON data.
   */
  handleIncomingMessage(data: any): void {
    if (!data || data.type !== 'murmuration_chat') {
      return;
    }

    const { senderId, senderUsername, message, timestamp } = data.data ?? {};

    if (!senderId || !message) {
      console.warn('MurmurationChatService.handleIncomingMessage: malformed payload', data);
      return;
    }

    const chatMessage: MurmurationChatMessage = {
      murmuration_id: data.data.murmurationId ?? '',
      sender_id: senderId,
      sender_username: senderUsername ?? 'Unknown',
      message,
      timestamp: timestamp ?? Date.now(),
    };

    for (const cb of this.messageCallbacks) {
      try {
        cb(chatMessage);
      } catch (err) {
        console.error('MurmurationChatService.handleIncomingMessage: callback error', err);
      }
    }
  }
}

// Singleton instance
export const murmurationChatService = new MurmurationChatService();
