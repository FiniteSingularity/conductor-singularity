import { Injectable } from "@angular/core";
import { ComponentStore } from "@ngrx/component-store";
import { TauService, backgroundQueueIdMap } from "./tau.service";
import { ObsService } from "./obs.service";
import { filter, map, pipe, switchMap, tap } from "rxjs";
import { ChannelPointRedemptionAdd } from "tau-js-client-forked";
import { MersenneTwister } from "fast-mersenne-twister";
import { BringWater } from "../models/bring-water.model";
import {
  CloneInteraction,
  CloneInteractionInstance,
  StepBlurFace,
  StepEnd,
} from "../models/clone-interaction.model";

interface CloneInteractionData {
  queueActive: boolean;
  priorScene: string;
  currentScene: string;
  streamer: string;
}

@Injectable({
  providedIn: "root",
})
export class CloneInteractionService extends ComponentStore<CloneInteractionData> {
  rng: MersenneTwister = new MersenneTwister();
  constructor(private tau: TauService, private obs: ObsService) {
    super({
      queueActive: false,
      priorScene: "",
      currentScene: "",
      streamer: "finite",
    });
    this.currentStreamer();
    this.currentScene();
    this.handleRedeem();
    this.handleEmptyQueue();
  }

  readonly currentStreamer = this.effect<void>(
    pipe(
      switchMap(() => {
        return this.obs.streamer$;
      }),
      tap({
        next: (streamer) => {
          console.log(streamer);
          this.patchState({ streamer });
        },
      })
    )
  );

  readonly currentScene = this.effect<void>(
    pipe(
      switchMap(() => {
        return this.obs.currentScene$;
      }),
      tap({
        next: (scene) => {
          console.log(scene);
          this.patchState({ currentScene: scene });
        },
      })
    )
  );

  readonly handleRedeem = this.effect<void>(
    pipe(
      switchMap(() => {
        return this.tau.currentBgEvent$.pipe(
          filter((redeem) => redeem !== null),
          map((redeem) => redeem as ChannelPointRedemptionAdd)
        );
      }),
      tap({
        next: (redeem) => {
          switch (backgroundQueueIdMap[redeem.eventData.reward.id]) {
            case "Water": {
              this.handleWater();
              break;
            }
          }
        },
      })
    )
  );

  readonly handleEmptyQueue = this.effect<void>(
    pipe(
      switchMap(() => {
        return this.tau.currentBgEvent$.pipe(
          filter((redeem) => redeem === null)
        );
      }),
      tap({
        next: (redeem) => {
          this.clearQueue();
        },
      })
    )
  );

  startQueue() {
    this.patchState({ priorScene: this.get().currentScene, queueActive: true });
    this.obs.changeScene({ sceneName: "[Output] Alerts" })();
    this.obs.timedBlur({ time: 750, blur: 100.0 })();
  }

  setupInteraction(cloneInteraction: CloneInteraction) {
    const streamer =
      this.get().streamer === "FiniteSingularity" ? "finite" : "roscodes";
    const bgCount = cloneInteraction.backgrounds.length;
    console.log(bgCount);
    const interactionCount = cloneInteraction[streamer].length;
    const bg =
      cloneInteraction.backgrounds[Math.floor(this.rng.random() * bgCount)];
    const interaction =
      cloneInteraction[streamer][
        Math.floor(this.rng.random() * interactionCount)
      ];
    setTimeout(() => {
      this.obs.callEffect({
        eventType: "SetInputSettings",
        callback: () => {},
        payload: {
          inputName: cloneInteraction.bgImageSourceName,
          inputSettings: { file: bg.filePath },
        },
      })();
    }, 850);

    this.obs.callEffect({
      eventType: "SetInputSettings",
      callback: () => {},
      payload: {
        inputName: cloneInteraction.cloneSourceName,
        inputSettings: {
          local_file: interaction.filePath,
        },
      },
    })();
    this.obs.toggleSceneItem({
      sceneName: "Facecam Background",
      sceneItemName: cloneInteraction.sceneName,
      enabled: true,
    })();

    return interaction;
  }

  handleEnd(sourceName: string, step: StepEnd) {
    setTimeout(() => {
      this.obs.callEffect({
        eventType: "SetSourceFilterEnabled",
        callback: () => {},
        payload: {
          sourceName,
          filterName: "Fade Out",
          filterEnabled: true,
        },
      })();
      this.tau.popBgEvent();
    }, step.endTime);
  }

  handleBlur(step: StepBlurFace) {
    setTimeout(() => {
      this.obs.timedFaceBlur({ time: step.duration, blur: step.blur })();
    }, step.startTime);
  }

  handleWater() {
    if (!this.get().queueActive) {
      this.startQueue();
    }

    const interaction: CloneInteractionInstance =
      this.setupInteraction(BringWater);

    interaction.steps.forEach((step) => {
      switch (step.stepType) {
        case "end": {
          this.handleEnd(BringWater.sceneName, step);
          break;
        }
        case "blur": {
          this.handleBlur(step);
          break;
        }
      }
    });
  }

  clearQueue() {
    if (this.get().queueActive) {
      console.log("Clearing Queue");
      this.obs.changeScene({ sceneName: this.get().priorScene })();
      this.obs.timedBlur({ time: 750, blur: 0.0 })();
      this.patchState({ priorScene: "", queueActive: false });
    } else {
      console.log("Queue not active.  Waiting...");
    }
  }
}
