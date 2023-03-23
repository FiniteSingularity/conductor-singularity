import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { delay, filter, retryWhen, switchMap, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ChannelPointRedemptionAdd, getTauMessages, TauEvent } from 'tau-js-client-forked';

const unqueuedIds = [
  'c05b769d-d4a1-40fe-a73b-c8d631a12103'
];

// const backgroundQueuedIds = [
//   'an id goes here'
// ];



export interface TauEvents {
  eventsWs: any | null;
  connected: boolean;
  bgEvents: TauEvent[];
  facecamEvents: TauEvent[];
  unqueuedEvent: TauEvent | null;
}

@Injectable({
  providedIn: 'root'
})
export class TauService extends ComponentStore<TauEvents> {
  readonly eventsWs$ = this.select((s) => s.eventsWs);
  readonly bgEvents$ = this.select((s) => s.bgEvents);
  readonly currentBgEvent$ = this.select(this.bgEvents$, events => events[0] ?? null);
  readonly bgEventCount$ = this.select(this.bgEvents$, events => events.length);
  readonly popBgEvent = this.updater((state) => {
    const [popped, ...remaining] = state.bgEvents;
    return {
      ...state,
      bgEvents: remaining
    };
  });
  readonly facecamEvents$ = this.select((s) => s.facecamEvents);
  readonly currentFacecamEvent$ = this.select(this.facecamEvents$, events => events[0] ?? null);
  readonly facecamEventCount$ = this.select(this.facecamEvents$, events => events.length);
  readonly popFacecamEvent = this.updater((state) => {
    const [popped, ...remaining] = state.facecamEvents;
    return {
      ...state,
      facecamEvents: remaining
    };
  });

  readonly unqueuedEvent$ = this.select((s) => s.unqueuedEvent);

  constructor(private http: HttpClient) {
    super({
      eventsWs: null,
      connected: true,
      bgEvents: [],
      facecamEvents: [],
      unqueuedEvent: null,
    });
    this.prepareTau();
    this.handleTauEvents(this.eventsWs$);
  }

  readonly handleTauEvents = this.effect<TauEvents['eventsWs']>((ws$) =>
    ws$.pipe(
      filter((ws): ws is Exclude<TauEvents['eventsWs'], null> => ws !== null),
      switchMap((ws) =>
        ws.pipe(
          retryWhen((errors) => {
            console.log("Disconnected.. Attempting to reconnect...");
            console.log(errors);
            return errors.pipe(delay(2000));
          }),
          filter(evt => evt instanceof ChannelPointRedemptionAdd),
          tap({
            next: (message: ChannelPointRedemptionAdd) => {
              if(unqueuedIds.includes(message.eventData.reward.id)) {
                this.patchState({
                  unqueuedEvent: message
                });
              }
            }
          })
        )
      )
    )
  );

  private prepareTau() {
    this.patchState({
      eventsWs: getTauMessages({
        domain: environment.tauUrl,
        port: 443,
        token: environment.tauToken,
        events: true
      })
    });
  }

  userDetails(userId: string) {
    const headers = {}
    return this.http.get(
      `https://${environment.tauUrl}/api/twitch/helix/users?id=${userId}`,
      {
        headers: { Authorization: `Token ${environment.tauToken}` },
      })
  }
}
