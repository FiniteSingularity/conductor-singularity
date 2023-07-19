import { Injectable } from "@angular/core";
import { ComponentStore } from "@ngrx/component-store";
import OBSWebSocket, {
  OBSEventTypes,
  OBSRequestTypes,
  OBSResponseTypes,
  RequestBatchRequest,
  RequestMessage,
  ResponseMessage,
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
  timeLoopId: number;
  timeLoop: boolean;
}

@Injectable({
  providedIn: "root",
})
export class ObsService extends ComponentStore<ObsState> {
  readonly streamer$ = this.select((s) => s.streamer);
  readonly currentScene$ = this.select((s) => s.currentScene);
  readonly timeLoop$ = this.select((s) => s.timeLoop);

  constructor() {
    super({
      obsWs: new OBSWebSocket(),
      connected: false,
      currentScene: "",
      streamer: "",
      roscodesId: -1,
      timeLoopId: -1,
      timeLoop: false,
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
              this.getBlurDetails();
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

  readonly getBlurDetails = this.callBatchEffect(
    [
      {
        requestType: "GetSourceFilter",
        requestData: {
          sourceName: "Facecam",
          filterName: "ChangeFocus",
        },
      } as RequestBatchRequest,
    ],
    (res) => {
      console.log(res);
    }
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
          roscodesId: "sceneItemId",
        },
      },
      {
        requestType: "GetSceneItemId",
        requestData: {
          sceneName: "Facecam Keyed",
          sourceName: "Time Loop",
        },
        outputVariables: {
          timeLoopId: "sceneItemId",
        },
      },
      {
        requestType: "GetSceneItemEnabled",
        requestData: {
          sceneName: "Facecam Keyed",
        },
        inputVariables: {
          sceneItemId: "roscodesId",
        },
      },
      {
        requestType: "GetSceneItemEnabled",
        requestData: {
          sceneName: "Facecam Keyed",
        },
        inputVariables: {
          sceneItemId: "timeLoopId",
        },
      },
    ],
    (resp: ResponseMessage[]) => {
      console.log(resp);
      this.patchState({
        roscodesId: (resp[0].responseData as OBSResponseTypes["GetSceneItemId"])
          .sceneItemId,
        timeLoopId: (resp[1].responseData as OBSResponseTypes["GetSceneItemId"])
          .sceneItemId,
        streamer: (
          resp[2].responseData as OBSResponseTypes["GetSceneItemEnabled"]
        ).sceneItemEnabled
          ? "Roscodes"
          : "FiniteSingularity",
        timeLoop: (
          resp[3].responseData as OBSResponseTypes["GetSceneItemEnabled"]
        ).sceneItemEnabled,
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
      console.log(val);
      console.log(this.get().roscodesId);
      if (
        val.sceneItemId === this.get().roscodesId &&
        val.sceneName === "Facecam Keyed"
      ) {
        this.patchState({
          streamer: val.sceneItemEnabled ? "Roscodes" : "FiniteSingularity",
        });
      } else if (
        val.sceneItemId === this.get().timeLoopId &&
        val.sceneName === "Facecam Keyed"
      ) {
        this.patchState({
          timeLoop: val.sceneItemEnabled,
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

  readonly hacker = this.toggleSceneItem({
    sceneName: "Facecam",
    sceneItemName: "Hacker",
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

  timedFaceBlur(payload: { time: number; blur: number }) {
    const faceBlur = Math.max(0.01, payload.blur);
    const faceBlurOff = faceBlur < 0.02;

    let batch: any[] = [
      {
        requestType: "SetSourceFilterEnabled",
        requestData: {
          sourceName: "Facecam",
          filterName: "Blur",
          filterEnabled: true,
        },
      },
      {
        requestType: "SetSourceFilterEnabled",
        requestData: {
          sourceName: "Facecam Blur Mask",
          filterName: "Blur",
          filterEnabled: true,
        },
      },
      {
        requestType: "SetSourceFilterSettings",
        requestData: {
          sourceName: "Facecam",
          filterName: "ChangeFocus",
          filterSettings: {
            duration: payload.time,
            "Filter.Blur.StepScale.X": faceBlur,
            "Filter.Blur.StepScale.Y": faceBlur,
          },
        },
      },
      {
        requestType: "SetSourceFilterSettings",
        requestData: {
          sourceName: "Facecam Blur Mask",
          filterName: "ChangeFocus",
          filterSettings: {
            duration: payload.time,
            "Filter.Blur.StepScale.X": faceBlur,
            "Filter.Blur.StepScale.Y": faceBlur,
          },
        },
      },
      {
        requestType: "SetSourceFilterEnabled",
        requestData: {
          sourceName: "Facecam",
          filterName: "ChangeFocus",
          filterEnabled: true,
        },
      },
      {
        requestType: "SetSourceFilterEnabled",
        requestData: {
          sourceName: "Facecam Blur Mask",
          filterName: "ChangeFocus",
          filterEnabled: true,
        },
      },
    ];

    if (faceBlurOff) {
      batch = [
        ...batch,
        {
          requestType: "Sleep",
          requestData: {
            sleepMillis: payload.time + 50,
          },
        },
        {
          requestType: "SetSourceFilterEnabled",
          requestData: {
            sourceName: "Facecam",
            filterName: "Blur",
            filterEnabled: false,
          },
        },
        {
          requestType: "SetSourceFilterEnabled",
          requestData: {
            sourceName: "Facecam Blur Mask",
            filterName: "Blur",
            filterEnabled: false,
          },
        },
      ];
    }
    return this.callBatchEffect(batch, () => {});
  }

  timedBlur(payload: { time: number; blur: number }) {
    // 1. Enable blur on Facecam, Facecam Mask, Facecam Background
    const faceBlur = Math.max(0.01, payload.blur);
    const bgBlur = Math.max(0.01, 100.0 - payload.blur);
    const faceBlurOff = faceBlur < 0.02;
    const bgBlurOff = bgBlur < 0.02;

    let batch: any[] = [
      {
        requestType: "SetSourceFilterEnabled",
        requestData: {
          sourceName: "Facecam",
          filterName: "Blur",
          filterEnabled: true,
        },
      },
      {
        requestType: "SetSourceFilterEnabled",
        requestData: {
          sourceName: "Facecam Blur Mask",
          filterName: "Blur",
          filterEnabled: true,
        },
      },
      {
        requestType: "SetSourceFilterEnabled",
        requestData: {
          sourceName: "Facecam Background",
          filterName: "Blur",
          filterEnabled: true,
        },
      },
      {
        requestType: "SetSourceFilterSettings",
        requestData: {
          sourceName: "Facecam",
          filterName: "ChangeFocus",
          filterSettings: {
            duration: payload.time,
            "Filter.Blur.StepScale.X": faceBlur,
            "Filter.Blur.StepScale.Y": faceBlur,
          },
        },
      },
      {
        requestType: "SetSourceFilterSettings",
        requestData: {
          sourceName: "Facecam Blur Mask",
          filterName: "ChangeFocus",
          filterSettings: {
            duration: payload.time,
            "Filter.Blur.StepScale.X": faceBlur,
            "Filter.Blur.StepScale.Y": faceBlur,
          },
        },
      },
      {
        requestType: "SetSourceFilterSettings",
        requestData: {
          sourceName: "Facecam Background",
          filterName: "ChangeFocus",
          filterSettings: {
            duration: payload.time,
            "Filter.Blur.StepScale.X": bgBlur,
            "Filter.Blur.StepScale.Y": bgBlur,
          },
        },
      },
      {
        requestType: "SetSourceFilterEnabled",
        requestData: {
          sourceName: "Facecam",
          filterName: "ChangeFocus",
          filterEnabled: true,
        },
      },
      {
        requestType: "SetSourceFilterEnabled",
        requestData: {
          sourceName: "Facecam Blur Mask",
          filterName: "ChangeFocus",
          filterEnabled: true,
        },
      },
      {
        requestType: "SetSourceFilterEnabled",
        requestData: {
          sourceName: "Facecam Background",
          filterName: "ChangeFocus",
          filterEnabled: true,
        },
      },
    ];

    if (faceBlurOff) {
      batch = [
        ...batch,
        {
          requestType: "Sleep",
          requestData: {
            sleepMillis: payload.time + 50,
          },
        },
        {
          requestType: "SetSourceFilterEnabled",
          requestData: {
            sourceName: "Facecam",
            filterName: "Blur",
            filterEnabled: false,
          },
        },
        {
          requestType: "SetSourceFilterEnabled",
          requestData: {
            sourceName: "Facecam Blur Mask",
            filterName: "Blur",
            filterEnabled: false,
          },
        },
      ];
    }
    if (bgBlurOff) {
      batch = [
        ...batch,
        {
          requestType: "Sleep",
          requestData: {
            sleepMillis: payload.time + 50,
          },
        },
        {
          requestType: "SetSourceFilterEnabled",
          requestData: {
            sourceName: "Facecam Background",
            filterName: "Blur",
            filterEnabled: false,
          },
        },
      ];
    }
    return this.callBatchEffect(batch, () => {});
  }

  changeScene(payload: { sceneName: string }) {
    return this.callEffect({
      eventType: "SetCurrentProgramScene",
      callback: () => {},
      payload: { sceneName: payload.sceneName },
    });
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
