import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, OnInit, Type } from "@angular/core";
import { ComponentStore } from "@ngrx/component-store";
import {
  concatMap,
  EMPTY,
  filter,
  map,
  Observable,
  OperatorFunction,
  pipe,
  switchMap,
} from "rxjs";
import { FacecamEffectsService } from "src/app/services/facecam-effects.service";
import { ObsService } from "src/app/services/obs.service";
import { TauService, unqueuedIdMap } from "src/app/services/tau.service";
import { environment } from "src/environments/environment";
import { ChannelPointRedemptionAdd, TauEvent } from "tau-js-client-forked";
import { TimeLoopComponent } from "../time-loop/time-loop.component";
import { CloneInteractionService } from "src/app/services/clone-interaction.service";

export interface EmoteData {
  id: string;
  positions: [number, number][];
}

export interface EmoteMessage {
  text: string;
  emotes: EmoteData[] | null;
}

export interface MatrixMessageRow {
  mc_type: string;
  value: string;
}

interface EventWithUser<TEvent extends TauEvent> {
  event: TEvent;
  user: any;
}

function ofEventType<T extends TauEvent = TauEvent>(
  eventType?: Type<T>
): OperatorFunction<TauEvent | null, T> {
  return pipe(
    filter((event): event is T => {
      return event !== null && (!eventType || event instanceof eventType);
    })
  );
}

function withUserData<TEvent extends TauEvent>(
  getUser: (id: string) => Observable<any>
): OperatorFunction<TEvent, EventWithUser<TEvent>> {
  return switchMap((event) => {
    return getUser((event.eventData as Record<string, string>)["userId"]).pipe(
      map((user) => ({ event, user }))
    );
  });
}

@Component({
  standalone: true,
  selector: "app-main-overlay",
  templateUrl: "main-overlay.component.html",
  styleUrls: ["main-overlay.component.scss"],
  imports: [CommonModule, TimeLoopComponent],
})
export class MainOverlayComponent extends ComponentStore<{}> implements OnInit {
  constructor(
    public tau: TauService,
    public obs: ObsService,
    private http: HttpClient,
    private facecamEffect: FacecamEffectsService,
    private cloneInteractions: CloneInteractionService
  ) {
    super();
  }

  readonly channelPointRedemptionAddEvent$ = this.tau.unqueuedEvent$.pipe(
    ofEventType(ChannelPointRedemptionAdd),
    withUserData(this.tau.userDetails.bind(this.tau))
  );

  readonly handleUnqueuedRedeem = this.effect<
    EventWithUser<ChannelPointRedemptionAdd>
  >(
    concatMap(({ event, user: userData }) => {
      switch (unqueuedIdMap[event.eventData.reward.id]) {
        case "WriteToMatrix":
          return this.writeToMatrix(event, userData);
        default:
          return EMPTY;
      }
    })
  );

  ngOnInit(): void {
    this.handleUnqueuedRedeem(this.channelPointRedemptionAddEvent$);
  }

  writeToMatrix(event: ChannelPointRedemptionAdd, userData: any) {
    const message: EmoteMessage = {
      text: event.eventData.userInput,
      emotes: event.eventData.userInputEmotes,
    };

    const emoteData = message.emotes;
    const profileImage = userData.data[0].profile_image_url.replace(
      "300x300",
      "28x28"
    );

    const emotes = emoteData
      ? emoteData.reduce((acc, val) => {
          const currentEmotes = val.positions.map((emotePos) => ({
            id: val.id,
            position: emotePos,
          }));
          return [...acc, ...currentEmotes];
        }, [] as any[])
      : [];

    emotes.sort((a, b) => (a.position[0] < b.position[0] ? -1 : 1));

    let payload: MatrixMessageRow[] =
      emotes.length > 0
        ? emotes.reduce((acc, val, i) => {
            let current = [];
            if (i === 0 && val.position[0] > 0) {
              current.push({
                mc_type: "string",
                value: Array.from(message.text)
                  .slice(0, val.position[0])
                  .join(""),
              });
            }
            current.push({
              mc_type: "emote",
              value: val.id,
            });
            if (i < emotes.length - 1) {
              const nextStart = emotes[i + 1].position[0];
              const subStrLng = nextStart - val.position[1] - 1;
              current.push({
                mc_type: "string",
                value: Array.from(message.text)
                  .slice(val.position[1] + 1, nextStart)
                  .join(""),
              });
            } else if (val.position[1] != message.text.length - 1) {
              current.push({
                mc_type: "string",
                value: Array.from(message.text)
                  .slice(val.position[1] + 1)
                  .join(""),
              });
            }
            return [...acc, ...current];
          }, [])
        : [
            {
              mc_type: "string",
              value: message.text,
            },
          ];
    const profileImg = {
      mc_type: "image",
      value: profileImage,
    };
    payload = [profileImg, ...payload, profileImg];
    return this.http.post(environment.matrixUrl, payload);
  }

  setFilter() {
    const effect = this.obs.callBatchEffect(
      [
        {
          requestType: "SetSourceFilterSettings",
          requestData: {
            sourceName: "Hex Stinger From",
            filterName: "Hexy",
            filterSettings: {
              "ToSource.Source": "Hex Stinger To",
              "ToSource.Type": 1,
            },
          },
        },
      ],
      (val) => {
        console.log("It is done");
      }
    );

    effect();
  }

  blur(blur: number, time: number) {
    const effect = this.obs.timedBlur({ time, blur });
    effect();
  }
}
