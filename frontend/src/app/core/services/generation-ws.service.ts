import { Injectable } from '@angular/core';
import { Observable, Subject, timer, switchMap, takeWhile, EMPTY, merge } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface StageUpdate {
  stage: string;
  stage_meta: Record<string, any>;
}

/**
 * Service for receiving real-time AI generation pipeline updates.
 *
 * Tries WebSocket first (push-based, minimal traffic).
 * Falls back to HTTP polling if WS connection fails.
 *
 * Usage:
 *   this.genWs.connect('epic_tasks', epicId, pollingFallback$).subscribe(update => ...)
 */
@Injectable({ providedIn: 'root' })
export class GenerationWsService {
  constructor(private authService: AuthService) {}

  /**
   * Connect to the generation pipeline for a specific generation.
   *
   * @param generationType  'epic_tasks' | 'summary'
   * @param generationId    The epic ID or summary ID
   * @param pollingFallback$ An Observable that polls the HTTP endpoint (used if WS fails).
   *                          Must emit StageUpdate objects and complete when generation is done.
   * @returns Observable of stage updates. Completes when generation finishes or errors.
   */
  connect(
    generationType: 'epic_tasks' | 'summary',
    generationId: number,
    pollingFallback$: Observable<StageUpdate | null>,
  ): Observable<StageUpdate> {
    const updates$ = new Subject<StageUpdate>();
    let fallbackActive = false;

    const token = this.authService.getAccessToken();
    if (!token) {
      // No token — go straight to polling
      return this._wrapPollingFallback(pollingFallback$);
    }

    let wsBase = environment.wsUrl;
    if (wsBase.startsWith('/')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsBase = `${protocol}//${window.location.host}${wsBase}`;
    }
    const wsUrl = `${wsBase}/generation/?token=${token}`;

    try {
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: 'subscribe',
          generation_type: generationType,
          generation_id: generationId,
        }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'stage_update') {
            updates$.next({ stage: data.stage, stage_meta: data.stage_meta || {} });
            if (data.stage === 'completed') {
              socket.close();
              updates$.complete();
            }
          }
        } catch { /* ignore parse errors */ }
      };

      socket.onerror = () => {
        if (!fallbackActive) {
          fallbackActive = true;
          socket.close();
          // Switch to polling fallback
          this._wrapPollingFallback(pollingFallback$).subscribe({
            next: (u) => updates$.next(u),
            complete: () => updates$.complete(),
            error: (e) => updates$.error(e),
          });
        }
      };

      socket.onclose = (event) => {
        if (!updates$.closed && !fallbackActive) {
          // Unexpected close — fall back to polling
          fallbackActive = true;
          this._wrapPollingFallback(pollingFallback$).subscribe({
            next: (u) => updates$.next(u),
            complete: () => updates$.complete(),
            error: (e) => updates$.error(e),
          });
        }
      };
    } catch {
      // WebSocket constructor failed — fall back
      return this._wrapPollingFallback(pollingFallback$);
    }

    return updates$.asObservable();
  }

  private _wrapPollingFallback(polling$: Observable<StageUpdate | null>): Observable<StageUpdate> {
    const filtered$ = new Subject<StageUpdate>();
    polling$.subscribe({
      next: (u) => { if (u) filtered$.next(u); },
      complete: () => filtered$.complete(),
      error: (e) => filtered$.error(e),
    });
    return filtered$.asObservable();
  }
}
