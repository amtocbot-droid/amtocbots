import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { SignalrService } from '../../core/signalr/signalr.service';

export interface CardDto {
  id: string;
  columnId: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  labels: string[];
  dueDate?: string;
  position: number;
  assignedInstanceId?: string;
  assignedUserId?: string;
  createdByType: 'human' | 'bot';
  createdById: string;
  createdAt: string;
}

export interface ColumnDto {
  id: string;
  name: string;
  position: number;
  color?: string;
  wipLimit?: number;
  cards: CardDto[];
}

export interface BoardDetail {
  id: string;
  name: string;
  description?: string;
  columns: ColumnDto[];
}

export interface BoardSummary {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class KanbanStore {
  private readonly http = inject(HttpClient);
  private readonly signalr = inject(SignalrService);

  readonly boards  = signal<BoardSummary[]>([]);
  readonly board   = signal<BoardDetail | null>(null);
  readonly loading = signal(false);

  readonly totalCards = computed(() =>
    this.board()?.columns.reduce((s, c) => s + c.cards.length, 0) ?? 0
  );

  constructor() {
    this.signalr.on<{ cardId: string; targetColumnId: string; position: number }>('kanban', 'CardMoved')
      .pipe(takeUntilDestroyed())
      .subscribe(({ cardId, targetColumnId, position }) => {
        this.board.update(b => {
          if (!b) return b;
          let moved: CardDto | undefined;
          const cols = b.columns.map(col => ({
            ...col,
            cards: col.cards.filter(c => { if (c.id === cardId) { moved = c; return false; } return true; }),
          }));
          if (!moved) return b;
          moved = { ...moved, columnId: targetColumnId, position };
          return {
            ...b,
            columns: cols.map(col =>
              col.id === targetColumnId
                ? { ...col, cards: [...col.cards, moved!].sort((a, b) => a.position - b.position) }
                : col
            ),
          };
        });
      });

    this.signalr.on<CardDto>('kanban', 'CardCreated')
      .pipe(takeUntilDestroyed())
      .subscribe(card => {
        this.board.update(b => {
          if (!b) return b;
          return {
            ...b,
            columns: b.columns.map(col =>
              col.id === card.columnId
                ? { ...col, cards: [...col.cards, card].sort((a, b) => a.position - b.position) }
                : col
            ),
          };
        });
      });

    this.signalr.on<CardDto>('kanban', 'CardUpdated')
      .pipe(takeUntilDestroyed())
      .subscribe(card => {
        this.board.update(b => {
          if (!b) return b;
          return {
            ...b,
            columns: b.columns.map(col => ({
              ...col,
              cards: col.cards.map(c => c.id === card.id ? card : c),
            })),
          };
        });
      });

    this.signalr.on<{ cardId: string }>('kanban', 'CardDeleted')
      .pipe(takeUntilDestroyed())
      .subscribe(({ cardId }) => {
        this.board.update(b => {
          if (!b) return b;
          return {
            ...b,
            columns: b.columns.map(col => ({
              ...col,
              cards: col.cards.filter(c => c.id !== cardId),
            })),
          };
        });
      });
  }

  async loadBoards() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.http.get<BoardSummary[]>(`${environment.apiBase}/kanban/boards`));
      this.boards.set(data);
    } finally {
      this.loading.set(false);
    }
  }

  async loadBoard(id: string) {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.http.get<BoardDetail>(`${environment.apiBase}/kanban/boards/${id}`));
      this.board.set(data);
      await this.signalr.invoke('kanban', 'JoinBoard', id);
    } finally {
      this.loading.set(false);
    }
  }

  async createBoard(name: string, description?: string): Promise<string> {
    const id = await firstValueFrom(this.http.post<string>(`${environment.apiBase}/kanban/boards`, { name, description }));
    await this.loadBoards();
    return id;
  }

  async createCard(boardId: string, req: Partial<CardDto> & { title: string }) {
    await firstValueFrom(this.http.post(`${environment.apiBase}/kanban/boards/${boardId}/cards`, req));
  }

  async moveCard(cardId: string, targetColumnId: string, position: number) {
    // Optimistic update — SignalR echo will confirm
    this.board.update(b => {
      if (!b) return b;
      let moved: CardDto | undefined;
      const cols = b.columns.map(col => ({
        ...col,
        cards: col.cards.filter(c => { if (c.id === cardId) { moved = c; return false; } return true; }),
      }));
      if (!moved) return b;
      moved = { ...moved, columnId: targetColumnId, position };
      return {
        ...b,
        columns: cols.map(col =>
          col.id === targetColumnId
            ? { ...col, cards: [...col.cards, moved!].sort((a, b) => a.position - b.position) }
            : col
        ),
      };
    });
    await firstValueFrom(
      this.http.patch(`${environment.apiBase}/kanban/cards/${cardId}/move`, { targetColumnId, position })
    );
  }

  leaveBoard(id: string) {
    this.signalr.invoke('kanban', 'LeaveBoard', id).catch(() => {});
    this.board.set(null);
  }
}
