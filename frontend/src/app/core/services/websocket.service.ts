import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface WsMessage {
  type: string;
  payload?: any;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private socket: WebSocket | null = null;
  private messagesSubject = new Subject<WsMessage>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  public messages$: Observable<WsMessage> = this.messagesSubject.asObservable();

  constructor(private authService: AuthService) {}

  connect(): void {
    const token = this.authService.getAccessToken();
    if (!token) return;

    let wsBase = environment.wsUrl;
    if (wsBase.startsWith('/')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsBase = `${protocol}//${window.location.host}${wsBase}`;
    }
    const wsUrl = `${wsBase}/kanban/?token=${token}`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping') {
          this.send({ type: 'pong' });
          return;
        }
        this.messagesSubject.next(data);
      } catch {
        // Ignore parse errors
      }
    };

    this.socket.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
      }
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  send(message: WsMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0;
    this.socket?.close();
    this.socket = null;
  }

  subscribeToClient(clientId: number): void {
    this.send({ type: 'subscribe_filter', payload: { client_id: clientId } });
  }

  removeFilter(): void {
    this.send({ type: 'remove_filter' });
  }
}
