import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import OBSWebSocket from 'obs-websocket-js';
import { defer, delay, exhaustMap, from, fromEventPattern, pipe, retry, switchMap, tap, timer } from 'rxjs';
import { environment } from 'src/environments/environment';

interface ObsState {
  obsWs: any | null;
  connected: boolean;
  currentScene: string;
  streamer: string;
}

@Injectable({
  providedIn: 'root'
})
export class ObsService extends ComponentStore<ObsState> {

  constructor() {
    super({
      obsWs: null,
      connected: false,
      currentScene: '',
      streamer: '',
    });
    this.prepareObs();
    this.connect();
    this.monitorConnection();
  }

  prepareObs() {
    const ws = new OBSWebSocket();
    this.patchState({
      obsWs: ws,
    })
  }

  readonly connect = this.effect<void>(pipe(
    exhaustMap(() => {
      // return this.get().obsWs.connect(environment.obsUrl, environment.obsPassword)
      return defer(() => { 
        return this.get().obsWs.connect(environment.obsUrl, environment.obsPassword);
      }).pipe(
        tap(
          {
            next: (val) => {
              console.log('OBS WS Connected!', val);
            },
            error: (err) => {console.log('OBS WS Connection Error:', err)}
          }
        ),
        retry({
          delay: error => {console.log('in delay'); return timer(2000)}
        })
      );
    }),

  ));

  readonly monitorConnection = this.effect<void>(pipe(
    switchMap(() => {
      return fromEventPattern(
        (handler) =>  {
          this.get().obsWs.on('ConnectionClosed',  handler);
        },
        (handler) => {
          this.get().obsWs.off('ConnectionClosed', handler);
        }
      ).pipe(tap(
        {
          next: (err) => {
            console.log('We are in monitor connection..');
            this.connect();
          }
        }
      ))
    })
  ));

  macOn() {
    
  }
}
