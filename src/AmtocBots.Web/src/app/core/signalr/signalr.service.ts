import { Injectable, inject, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

export type HubName = 'instances' | 'kanban' | 'chat';

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private readonly auth = inject(AuthService);
  private readonly connections = new Map<HubName, signalR.HubConnection>();
  private readonly subjects    = new Map<string, Subject<unknown>>();

  readonly reconnecting = signal(false);

  /** Get or build a hub connection. Call from feature stores. */
  getConnection(hub: HubName): signalR.HubConnection {
    if (this.connections.has(hub)) return this.connections.get(hub)!;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.hubBase}/${hub}`, {
        accessTokenFactory: () => this.auth.getToken(),
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.onreconnecting(() => this.reconnecting.set(true));
    connection.onreconnected(() => this.reconnecting.set(false));

    this.connections.set(hub, connection);
    return connection;
  }

  /** Start a hub connection if not already started. */
  async start(hub: HubName): Promise<void> {
    const conn = this.getConnection(hub);
    if (conn.state === signalR.HubConnectionState.Disconnected) {
      await conn.start();
    }
  }

  /** Typed event listener — returns an Observable that emits on each server push. */
  on<T>(hub: HubName, event: string): Observable<T> {
    const key = `${hub}:${event}`;
    if (!this.subjects.has(key)) {
      const subject = new Subject<unknown>();
      this.subjects.set(key, subject);
      this.getConnection(hub).on(event, (data: unknown) => subject.next(data));
    }
    return this.subjects.get(key)! as Observable<T>;
  }

  /** Invoke a hub method. */
  invoke(hub: HubName, method: string, ...args: unknown[]): Promise<void> {
    return this.getConnection(hub).invoke(method, ...args);
  }

  async stopAll(): Promise<void> {
    for (const conn of this.connections.values()) {
      await conn.stop();
    }
  }
}
