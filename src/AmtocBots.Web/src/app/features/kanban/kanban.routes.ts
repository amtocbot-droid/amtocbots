import { Routes } from '@angular/router';

export const kanbanRoutes: Routes = [
  { path: '', loadComponent: () => import('./board-list/board-list.component').then(m => m.BoardListComponent) },
  { path: ':id', loadComponent: () => import('./board/kanban-board.component').then(m => m.KanbanBoardComponent) },
];
