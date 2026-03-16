import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import { ChatStore, MessageDto } from '../chat.store';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-chat-shell',
  standalone: true,
  imports: [
    FormsModule, MatButtonModule, MatIconModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule, ScrollingModule, DatePipe,
  ],
  template: `
    <div class="chat-layout">
      <!-- Room sidebar -->
      <div class="room-sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">Rooms</span>
          @if (auth.isOperator()) {
            <button mat-icon-button (click)="openCreate()" matTooltip="New room">
              <mat-icon>add</mat-icon>
            </button>
          }
        </div>
        <div class="room-list">
          @for (r of store.rooms(); track r.id) {
            <button class="room-item" [class.active]="store.activeRoomId() === r.id"
              (click)="selectRoom(r.id)">
              <mat-icon>{{ r.isGlobal ? 'public' : 'lock' }}</mat-icon>
              <span class="room-name">{{ r.name }}</span>
              @if (unread()[r.id]) {
                <span class="unread-dot"></span>
              }
            </button>
          } @empty {
            <p class="no-rooms">No rooms yet.</p>
          }
        </div>
      </div>

      <!-- Message area -->
      <div class="message-area">
        @if (store.activeRoom()) {
          <div class="msg-header">
            <mat-icon>{{ store.activeRoom()!.isGlobal ? 'public' : 'lock' }}</mat-icon>
            <span class="msg-room-name">{{ store.activeRoom()!.name }}</span>
            @if (store.activeRoom()!.description) {
              <span class="msg-room-desc">{{ store.activeRoom()!.description }}</span>
            }
          </div>

          <div class="messages-wrap" #messagesWrap (scroll)="onScroll()">
            @if (store.loadingMore()) {
              <div class="load-more-hint">Loading…</div>
            } @else if (store.hasMore()) {
              <button mat-stroked-button class="load-more-btn" (click)="store.loadMore()">
                Load older messages
              </button>
            }

            @for (msg of store.messages(); track msg.id) {
              <div class="msg-row" [class.own]="isOwn(msg)" [class.bot]="msg.senderType === 'bot'">
                <div class="msg-avatar" [class.bot-avatar]="msg.senderType === 'bot'">
                  <mat-icon>{{ msg.senderType === 'bot' ? 'smart_toy' : 'person' }}</mat-icon>
                </div>
                <div class="msg-content">
                  <div class="msg-meta">
                    <span class="msg-sender">{{ msg.senderName }}</span>
                    <span class="msg-time">{{ msg.createdAt | date:'HH:mm' }}</span>
                    @if (msg.editedAt) {
                      <span class="msg-edited">(edited)</span>
                    }
                  </div>
                  @if (replyMessage(msg.replyToId)) {
                    <div class="msg-reply">
                      <mat-icon>reply</mat-icon>
                      {{ replyMessage(msg.replyToId)!.content | slice:0:80 }}
                    </div>
                  }
                  <div class="msg-text" [innerHTML]="renderContent(msg.content)"></div>
                </div>
                <button mat-icon-button class="reply-btn" (click)="replyTo.set(msg)" matTooltip="Reply">
                  <mat-icon>reply</mat-icon>
                </button>
              </div>
            } @empty {
              <p class="empty-chat">No messages yet. Say hello!</p>
            }
          </div>

          @if (store.typingText()) {
            <div class="typing-bar">{{ store.typingText() }}</div>
          }

          @if (replyTo()) {
            <div class="reply-preview">
              <mat-icon>reply</mat-icon>
              <span>Replying to <strong>{{ replyTo()!.senderName }}</strong>: {{ replyTo()!.content | slice:0:60 }}</span>
              <button mat-icon-button (click)="replyTo.set(null)"><mat-icon>close</mat-icon></button>
            </div>
          }

          <div class="input-bar">
            <input #msgInput
              class="msg-input"
              [(ngModel)]="draft"
              (keydown.enter)="send()"
              (input)="onInput()"
              placeholder="Message {{ store.activeRoom()!.name }}…"
              [attr.aria-label]="'Message ' + store.activeRoom()!.name" />
            <button mat-icon-button color="primary" (click)="send()" [disabled]="!draft.trim()">
              <mat-icon>send</mat-icon>
            </button>
          </div>
        } @else {
          <div class="no-room-selected">
            <mat-icon>forum</mat-icon>
            <p>Select a room to start chatting</p>
          </div>
        }
      </div>
    </div>

    @if (creatingRoom()) {
      <div class="overlay" (click)="creatingRoom.set(false)">
        <div class="create-dialog" (click)="$event.stopPropagation()">
          <h2>New Room</h2>
          <input class="simple-input" [(ngModel)]="newRoomName" placeholder="Room name" autofocus />
          <input class="simple-input" [(ngModel)]="newRoomDesc" placeholder="Description (optional)" />
          <label class="checkbox-row">
            <input type="checkbox" [(ngModel)]="newRoomGlobal" />
            <span>Global (visible to all)</span>
          </label>
          <div class="dialog-actions">
            <button mat-stroked-button (click)="creatingRoom.set(false)">Cancel</button>
            <button mat-flat-button color="primary" (click)="createRoom()" [disabled]="!newRoomName.trim()">
              Create
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .chat-layout      { display: flex; height: calc(100vh - 80px); overflow: hidden; }

    /* Sidebar */
    .room-sidebar     { width: 220px; flex-shrink: 0; background: var(--bg-surface);
                        border-right: 1px solid var(--border); display: flex; flex-direction: column; }
    .sidebar-header   { display: flex; align-items: center; padding: 12px 14px;
                        border-bottom: 1px solid var(--border); }
    .sidebar-title    { font-size: 13px; font-weight: 600; text-transform: uppercase;
                        letter-spacing: .5px; flex: 1; }
    .room-list        { overflow-y: auto; flex: 1; padding: 8px 0; }
    .room-item        { width: 100%; display: flex; align-items: center; gap: 8px;
                        padding: 8px 14px; border: none; background: none; cursor: pointer;
                        font-size: 13px; color: var(--text-secondary); text-align: left;
                        border-radius: 0; transition: background .15s; }
    .room-item:hover  { background: var(--bg-hover); color: var(--text-primary); }
    .room-item.active { background: rgba(59,130,246,.12); color: var(--accent-blue); font-weight: 500; }
    .room-item mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    .room-name        { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .unread-dot       { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-blue);
                        flex-shrink: 0; }
    .no-rooms         { font-size: 12px; color: var(--text-secondary); padding: 12px 14px; }

    /* Message area */
    .message-area     { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .msg-header       { display: flex; align-items: center; gap: 8px; padding: 12px 20px;
                        border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .msg-header mat-icon { color: var(--text-secondary); }
    .msg-room-name    { font-weight: 600; font-size: 15px; }
    .msg-room-desc    { font-size: 12px; color: var(--text-secondary); }

    .messages-wrap    { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex;
                        flex-direction: column; gap: 2px; }
    .load-more-hint   { text-align: center; font-size: 12px; color: var(--text-secondary); padding: 8px; }
    .load-more-btn    { align-self: center; font-size: 12px; margin-bottom: 12px; }
    .empty-chat       { text-align: center; color: var(--text-secondary); font-size: 13px; margin: auto; }

    .msg-row          { display: flex; gap: 10px; padding: 4px 0; border-radius: var(--radius-sm);
                        align-items: flex-start; }
    .msg-row:hover    { background: var(--bg-hover); }
    .msg-row:hover .reply-btn { opacity: 1; }
    .msg-avatar       { width: 32px; height: 32px; border-radius: 50%;
                        background: rgba(59,130,246,.15); display: flex; align-items: center; justify-content: center;
                        flex-shrink: 0; }
    .msg-avatar mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--accent-blue); }
    .bot-avatar       { background: rgba(16,185,129,.15); }
    .bot-avatar mat-icon { color: var(--accent-green); }
    .msg-content      { flex: 1; min-width: 0; }
    .msg-meta         { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
    .msg-sender       { font-size: 13px; font-weight: 600; }
    .msg-time         { font-size: 11px; color: var(--text-secondary); }
    .msg-edited       { font-size: 11px; color: var(--text-secondary); font-style: italic; }
    .msg-reply        { display: flex; align-items: center; gap: 4px; font-size: 11px;
                        color: var(--text-secondary); border-left: 2px solid var(--border);
                        padding-left: 8px; margin-bottom: 4px; }
    .msg-reply mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .msg-text         { font-size: 14px; line-height: 1.5; word-break: break-word; }
    .msg-text :global(.mention) { color: var(--accent-blue); font-weight: 500; }
    .reply-btn        { opacity: 0; transition: opacity .15s; flex-shrink: 0; }

    .typing-bar       { font-size: 12px; color: var(--text-secondary); padding: 4px 20px;
                        font-style: italic; flex-shrink: 0; }
    .reply-preview    { display: flex; align-items: center; gap: 8px; padding: 8px 20px;
                        background: var(--bg-surface); border-top: 1px solid var(--border);
                        font-size: 13px; color: var(--text-secondary); flex-shrink: 0; }
    .reply-preview mat-icon { color: var(--accent-blue); }
    .input-bar        { display: flex; align-items: center; gap: 8px; padding: 12px 20px;
                        border-top: 1px solid var(--border); flex-shrink: 0; }
    .msg-input        { flex: 1; background: var(--bg-base); border: 1px solid var(--border);
                        border-radius: var(--radius-sm); padding: 10px 14px; font-size: 14px;
                        color: var(--text-primary); outline: none; }
    .msg-input:focus  { border-color: var(--accent-blue); }

    .no-room-selected { display: flex; flex-direction: column; align-items: center;
                        justify-content: center; height: 100%; gap: 12px; color: var(--text-secondary); }
    .no-room-selected mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .no-room-selected p { font-size: 14px; }

    /* Create dialog */
    .overlay          { position: fixed; inset: 0; background: rgba(0,0,0,.5);
                        display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .create-dialog    { background: var(--bg-surface); border: 1px solid var(--border);
                        border-radius: var(--radius-md); padding: 24px; min-width: 340px;
                        display: flex; flex-direction: column; gap: 12px; }
    .create-dialog h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .simple-input     { background: var(--bg-base); border: 1px solid var(--border);
                        border-radius: var(--radius-sm); padding: 8px 12px; font-size: 13px;
                        color: var(--text-primary); outline: none; }
    .simple-input:focus { border-color: var(--accent-blue); }
    .checkbox-row     { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
    .dialog-actions   { display: flex; justify-content: flex-end; gap: 8px; }
  `],
})
export class ChatShellComponent implements OnInit, OnDestroy {
  readonly store = inject(ChatStore);
  readonly auth  = inject(AuthService);

  @ViewChild('messagesWrap') messagesWrap!: ElementRef<HTMLDivElement>;

  draft = '';
  readonly replyTo = signal<MessageDto | null>(null);
  readonly creatingRoom = signal(false);
  readonly unread = signal<Record<string, number>>({});

  newRoomName = '';
  newRoomDesc = '';
  newRoomGlobal = false;

  private typingTimeout?: ReturnType<typeof setTimeout>;
  private autoScroll = true;

  async ngOnInit() {
    await this.store.loadRooms();
  }

  ngOnDestroy() {
    const room = this.store.activeRoomId();
    if (room) this.store.leaveRoom(room).catch(() => {});
  }

  async selectRoom(id: string) {
    this.replyTo.set(null);
    await this.store.joinRoom(id);
    setTimeout(() => this.scrollToBottom(), 50);
  }

  async send() {
    const content = this.draft.trim();
    if (!content) return;
    this.draft = '';
    await this.store.sendMessage(content, this.replyTo()?.id);
    this.replyTo.set(null);
    setTimeout(() => this.scrollToBottom(), 50);
  }

  onInput() {
    clearTimeout(this.typingTimeout);
    this.store.sendTyping();
    this.typingTimeout = setTimeout(() => {}, 2000);
  }

  onScroll() {
    const el = this.messagesWrap?.nativeElement;
    if (!el) return;
    this.autoScroll = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (el.scrollTop < 80 && this.store.hasMore() && !this.store.loadingMore()) {
      this.store.loadMore();
    }
  }

  private scrollToBottom() {
    const el = this.messagesWrap?.nativeElement;
    if (el && this.autoScroll) el.scrollTop = el.scrollHeight;
  }

  isOwn(msg: MessageDto): boolean {
    return msg.senderType === 'user' && msg.senderId === this.auth.userId();
  }

  replyMessage(replyToId?: string): MessageDto | undefined {
    if (!replyToId) return undefined;
    return this.store.messages().find(m => m.id === replyToId);
  }

  renderContent(content: string): string {
    // Highlight @mentions
    return content.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  }

  openCreate() {
    this.newRoomName = '';
    this.newRoomDesc = '';
    this.newRoomGlobal = false;
    this.creatingRoom.set(true);
  }

  async createRoom() {
    if (!this.newRoomName.trim()) return;
    await this.store.createRoom(this.newRoomName.trim(), this.newRoomDesc.trim() || undefined, this.newRoomGlobal);
    this.creatingRoom.set(false);
  }
}
