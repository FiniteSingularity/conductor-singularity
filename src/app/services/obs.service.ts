import { Injectable } from "@angular/core";
import { ComponentStore } from "@ngrx/component-store";
import OBSWebSocket, {
  OBSEventTypes,
  OBSRequestTypes,
  OBSResponseTypes,
} from "obs-websocket-js";
import {
  defer,
  exhaustMap,
  fromEventPattern,
  pipe,
  retry,
  switchMap,
  tap,
  timer,
} from "rxjs";
import { environment } from "src/environments/environment";

interface ObsState {
  obsWs: OBSWebSocket;
  connected: boolean;
  currentScene: string;
  streamer: string;
  roscodesId: number;
}

@Injectable({
  providedIn: "root",
})
export class ObsService extends ComponentStore<ObsState> {
  readonly streamer$ = this.select((s) => s.streamer);
  readonly currentScene$ = this.select((s) => s.currentScene);

  constructor() {
    super({
      obsWs: new OBSWebSocket(),
      connected: false,
      currentScene: "",
      streamer: "",
      roscodesId: -1,
    });
    this.connect();
    this.monitorConnectionClose();
    this.setupListeners();
  }

  readonly connect = this.effect<void>(
    pipe(
      exhaustMap(() => {
        return defer(() => {
          return this.get().obsWs.connect(
            environment.obsUrl,
            environment.obsPassword
          );
        }).pipe(
          tap({
            next: (val) => {
              this.patchState({ connected: true });
              this.loadState();
            },
            error: (err) => {
              console.log("OBS WS Connection Error:", err);
            },
          }),
          retry({
            delay: (error) => {
              console.log("Reattempting connection shortly...");
              return timer(2000);
            },
          })
        );
      })
    )
  );

  readonly loadRoscodes = this.callBatchEffect(
    [
      {
        requestType: "GetSceneItemId",
        requestData: {
          sceneName: "Facecam Keyed",
          sourceName: "Roscodes",
        },
        outputVariables: {
          itemId: "sceneItemId",
        },
      },
      {
        requestType: "GetSceneItemEnabled",
        requestData: {
          sceneName: "Facecam Keyed",
        },
        inputVariables: {
          sceneItemId: "itemId",
        },
      },
    ],
    (
      resp: [
        OBSResponseTypes["GetSceneItemId"],
        OBSResponseTypes["GetSceneItemEnabled"]
      ]
    ) => {
      this.patchState({
        roscodesId: resp[0].sceneItemId,
        streamer: resp[1].sceneItemEnabled ? "Roscodes" : "FiniteSingularity",
      });
    }
  );

  readonly loadCurrentScene = this.callEffect({
    eventType: "GetCurrentProgramScene",
    callback: (val) => {
      this.patchState({ currentScene: val.currentProgramSceneName });
    },
  });

  readonly monitorConnectionClose = this.onEffect("ConnectionClosed", (val) => {
    console.log("Connection to OBS Closed.");
    this.connect();
  });

  readonly monitorScene = this.onEffect("CurrentProgramSceneChanged", (val) => {
    this.patchState({ currentScene: val.sceneName });
  });

  readonly monitorSceneItems = this.onEffect(
    "SceneItemEnableStateChanged",
    (val) => {
      if (
        val.sceneItemId === this.get().roscodesId &&
        val.sceneName === "Facecam Keyed"
      ) {
        this.patchState({
          streamer: val.sceneItemEnabled ? "Roscodes" : "FiniteSingularity",
        });
      }
    }
  );

  readonly mac = this.toggleSceneItem({
    sceneName: "Facecam",
    sceneItemName: "Mac",
    enabled: true,
  });

  readonly thanos = this.toggleSceneItem({
    sceneName: "Facecam",
    sceneItemName: "Thanos",
    enabled: true,
  });

  readonly hulk = this.toggleSceneItem({
    sceneName: "Facecam",
    sceneItemName: "Hulk",
    enabled: true,
  });

  readonly throwback = this.toggleSceneItem({
    sceneName: "Facecam",
    sceneItemName: "Throwback",
    enabled: true,
  });

  callBatchEffect(batch: any[], callback: (val: any) => void) {
    return this.effect<void>(
      pipe(
        switchMap(() => {
          return this.get().obsWs.callBatch(batch);
        }),
        tap({
          next: (resp) => {
            callback(resp);
          },
        })
      )
    );
  }

  onEffect<T extends keyof OBSEventTypes>(
    eventType: T | string,
    callback: (val: OBSEventTypes[T]) => void
  ) {
    return this.effect<void>(
      pipe(
        switchMap(() => {
          return fromEventPattern(
            (handler) => {
              (this.get().obsWs as any).on(eventType, handler);
            },
            (handler) => {
              (this.get().obsWs as any).off(eventType, handler);
            }
          ).pipe(
            tap({
              next: (resp) => {
                callback(resp as OBSEventTypes[T]);
              },
              error: (err) => {
                console.log(err);
              },
            })
          );
        })
      )
    );
  }

  callEffect<T extends keyof OBSRequestTypes>(request: {
    eventType: T;
    callback: (resp: OBSResponseTypes[T]) => void;
    payload?: OBSRequestTypes[T];
  }) {
    return this.effect<void>(
      pipe(
        switchMap(() => {
          return this.get().obsWs.call(request.eventType, request.payload);
        }),
        tap({
          next: (resp) => {
            request.callback(resp);
          },
        })
      )
    );
  }

  setupListeners() {
    this.monitorScene();
    this.monitorSceneItems();
  }

  loadState() {
    this.loadCurrentScene();
    this.loadRoscodes();
  }

  toggleSceneItem(payload: {
    sceneName: string;
    sceneItemName: string;
    enabled: boolean;
  }) {
    return this.callBatchEffect(
      [
        {
          requestType: "GetSceneItemId",
          requestData: {
            sceneName: payload.sceneName,
            sourceName: payload.sceneItemName,
          },
          outputVariables: {
            itemId: "sceneItemId",
          },
        },
        {
          requestType: "SetSceneItemEnabled",
          requestData: {
            sceneName: payload.sceneName,
            sceneItemEnabled: payload.enabled,
          },
          inputVariables: {
            sceneItemId: "itemId",
          },
        },
      ],
      (val) => {}
    );
  }
}
