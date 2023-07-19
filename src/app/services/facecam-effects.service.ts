import { Injectable } from "@angular/core";
import { ComponentStore } from "@ngrx/component-store";
import * as chroma from "chroma-js";
import { filter, map, pipe, switchMap, tap } from "rxjs";
import { ChannelPointRedemptionAdd, Follow } from "tau-js-client-forked";
import { ObsService } from "./obs.service";
import { facecamQueueIdMap, TauService } from "./tau.service";

@Injectable({
  providedIn: "root",
})
export class FacecamEffectsService extends ComponentStore<{}> {
  constructor(private tau: TauService, private obs: ObsService) {
    super({});
    this.handleRedeem();
  }

  readonly handleRedeem = this.effect<void>(
    pipe(
      switchMap(() => {
        return this.tau.currentFacecamEvent$.pipe(
          filter((redeem) => redeem !== null),
          map((redeem) => redeem as ChannelPointRedemptionAdd)
        );
      }),
      tap({
        next: (redeem) => {
          switch (facecamQueueIdMap[redeem.eventData.reward.id]) {
            case "Throwback": {
              this.obs.throwback();
              setTimeout(() => {
                this.tau.popFacecamEvent();
              }, 40000);
              break;
            }
            case "Thanos": {
              this.obs.thanos();
              setTimeout(() => {
                this.tau.popFacecamEvent();
              }, 40000);
              break;
            }
            case "Hulk": {
              this.obs.hulk();
              setTimeout(() => {
                this.tau.popFacecamEvent();
              }, 40000);
              break;
            }
            case "Mac": {
              this.obs.mac();
              setTimeout(() => {
                this.tau.popFacecamEvent();
              }, 40000);
              break;
            }
            case "Technicolor": {
              this.colorChange(redeem);
              break;
            }
            case "Hacker": {
              this.obs.hacker();
              setTimeout(() => {
                this.tau.popFacecamEvent();
              }, 130000);
              break;
            }
          }
        },
      })
    )
  );

  colorChange(message: ChannelPointRedemptionAdd) {
    console.log(message);
    const colorTxt = message.eventData.userInput;
    const chromaColor = chroma.valid(colorTxt)
      ? chroma(colorTxt)
      : chroma("#80ff80");

    const chromaColorLight = chromaColor.brighten(2);

    const hexColor = chromaColor.hex().substring(1);
    const rgbColor = chromaColor.rgb();
    const hexColorLight = chromaColorLight.hex().substring(1);

    const [r, g, b] = hexColor.split(/(..)/g).filter((s) => s);
    const c2 = hexColorLight.split(/(..)/g).filter((s) => s);

    const color1 = parseInt(`${b}${g}${r}`, 16);

    const effect = this.obs.callBatchEffect(
      [
        {
          requestType: "SetSourceFilterSettings",
          requestData: {
            sourceName: "Color Change Facecam",
            filterName: "Color Correction",
            filterSettings: {
              color_multiply: color1,
            },
          },
        },
        {
          requestType: "SetSourceFilterSettings",
          requestData: {
            sourceName: "Color Change Facecam",
            filterName: "Color Change Mask",
            filterSettings: {
              "Color[0]": rgbColor[0],
              "Color[1]": rgbColor[1],
              "Color[2]": rgbColor[2],
            },
          },
        },
      ],
      (val) => {
        const toggle = this.obs.toggleSceneItem({
          sceneName: "Facecam",
          sceneItemName: "Color Change",
          enabled: true,
        });
        toggle();
        setTimeout(() => {
          this.tau.popFacecamEvent();
        }, 40000);
      }
    );

    effect();
  }
}
