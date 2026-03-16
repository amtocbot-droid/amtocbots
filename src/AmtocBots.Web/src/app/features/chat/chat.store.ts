import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { SignalrService } from '../../core/signalr/signalr.service';

export interface RoomSummary {
  id: string;
  name: string;
  description?: string;
  isGlobal: boolean;
}

export interface MessageDto {
  id: string;
  roomId: string;
  senderType: 'user' | 'bot';
  senderId: string;
  senderName: string;
  content: string;
  mentions: string[];
  replyToId?: string;
  createdAt: string;
  editedAt?: string;
}

export interface TypingUser {
  userId: string;
  username: string;
  at: number;
}

@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly http = inject(HttpClient);
  private readonly signalr = inject(SignalrService);

  readonly rooms        = signal<RoomSummary[]>([]);
  readonly activeRoomId = signal<string | null>(null);
  readonly messages     = signal<MessageDto[]>([]);
  readonly typingUsers  = signal<TypingUser[]>([]);
  readonly loadingMore  = signal(false);
  readonly hasMore      = signal(true);

  readonly activeRoom = computed(() => this.rooms().find(r => r.id === this.activeRoomId()));
  readonly typingText = computed(() => {
    const users = this.typingUsers().filter(t => Date.now() - t.at < 4000);
    if (!users.length) return '';
    if (users.length === 1) return `${users[0].username} is typing…`;
    return `${users.map(u => u.username).join(', ')} are typing…`;
  });

  constructor() {
    this.signalr.on<MessageDto>('chat', 'MessageReceived')
      .pipe(takeUntilDestroyed())
      .subscribe(msg => {
        if (msg.roomId !== this.activeRoomId()) return;
        this.messages.update(ms => [...ms, msg]);
        this.typingUsers.update(ts => ts.filter(t => t.userId !== msg.senderId));
      });

    this.signalr.on<{ userId: string; username: string }>('chat', 'UserTyping')
      .pipe(takeUntilDestroyed())
      .subscribe(({ userId, username }) => {
        this.typingUsers.update(ts => [
          ...ts.filter(t => t.userId !== userId),
          { userId, username, at: Date.now() },
        ]);
      });
  }

  async loadRooms() {
    const data = await firstValueFrom(this.http.get<RoomSummary[]>(`${environment.apiBase}/chat/rooms`));
    this.rooms.set(data);
  }

  async joinRoom(roomId: string) {
    const prev = this.activeRoomId();
    if (prev) await this.leaveRoom(prev);

    this.activeRoomId.set(roomId);
    this.messages.set([]);
    this.typingUsers.set([]);
    this.hasMore.set(true);

    await this.signalr.invoke('chat', 'JoinRoom', roomId);
    await this.loadMessages(roomId);
  }

  async leaveRoom(roomId: string) {
    await this.signalr.invoke('chat', 'LeaveRoom', roomId);
    this.activeRoomId.set(null);
    this.messages.set([]);
  }

  async loadMessages(roomId: string, before?: string) {
    this.loadingMore.set(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (before) params.set('before', before);
      const data = await firstValueFrom(
        this.http.get<MessageDto[]>(`${environment.apiBase}/chat/rooms/${roomId}/messages?${params}`)
      );
      if (data.length < 50) this.hasMore.set(false);
      if (before) {
        this.messages.update(ms => [...data, ...ms]);
      } else {
        this.messages.set(data);
      }
    } finally {
      this.loadingMore.set(false);
    }
  }

  async loadMore() {
    const roomId = this.activeRoomId();
    if (!roomId || !this.hasMore() || this.loadingMore()) return;
    const oldest = this.messages()[0]?.createdAt;
    if (oldest) await this.loadMessages(roomId, oldest);
  }

  async sendMessage(content: string, replyToId?: string) {
    const roomId = this.activeRoomId();
    if (!roomId) return;
    await this.signalr.invoke('chat', 'SendMessage', roomId, content, replyToId ?? null);
  }

  sendTyping() {
    const roomId = this.activeRoomId();
    if (roomId) this.signalr.invoke('chat', 'SendTyping', roomId).catch(() => {});
  }

  async createRoom(name: string, description?: string, isGlobal = false) {
    await firstValueFrom(
      this.http.post(`${environment.apiBase}/chat/rooms`, { name, description, isGlobal })
    );
    await this.loadRooms();
  }
}
