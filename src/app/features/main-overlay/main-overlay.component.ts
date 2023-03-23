import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { filter, firstValueFrom, mergeScan, take } from 'rxjs';
import { ObsService } from 'src/app/services/obs.service';
import { TauService } from 'src/app/services/tau.service';
import { ChannelPointRedemptionAdd, TauEvent } from 'tau-js-client-forked';

export interface EmoteData {
  id: string;
  positions: [number, number][]
}

export interface EmoteMessage {
  text: string;
  emotes: EmoteData[] | null;
}

export interface MatrixMessageRow {
  mc_type: string;
  value: string
}


@Component({
  standalone: true,
  selector: 'app-main-overlay',
  templateUrl: 'main-overlay.component.html',
  styleUrls: ['main-overlay.component.scss'],
})
export class MainOverlayComponent implements OnInit{
  constructor(private tau: TauService, private obs: ObsService, private http: HttpClient) {

  }

  ngOnInit(): void {
    this.tau.unqueuedEvent$.pipe(
      filter((event): event is ChannelPointRedemptionAdd => event !== null && event instanceof ChannelPointRedemptionAdd)
    ).subscribe(event => {
      this.sendToMatrix(event).then();
    });
  }

  async sendToMatrix(event: ChannelPointRedemptionAdd) {
    const userData: any = await firstValueFrom(this.tau.userDetails(event.eventData.userId).pipe(take(1)));
    const message: EmoteMessage = {
      text: event.eventData.userInput,
      emotes: event.eventData.userInputEmotes
    };

    const emoteData = message.emotes;
    console.log(message);
    const profileImage = userData.data[0].profile_image_url.replace('300x300', '28x28');

    const emotes = emoteData ? emoteData.reduce((acc, val) => {
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
              mc_type: 'string',
              value: Array.from(message.text)
                .slice(0, val.position[0])
                .join(''),
            });
          }
          current.push({
            mc_type: 'emote',
            value: val.id,
          });
          if (i < emotes.length - 1) {
            const nextStart = emotes[i + 1].position[0];
            const subStrLng = nextStart - val.position[1] - 1;
            current.push({
              mc_type: 'string',
              value: Array.from(message.text)
                .slice(val.position[1] + 1, nextStart)
                .join(''),
            });
          } else if (val.position[1] != message.text.length - 1) {
            current.push({
              mc_type: 'string',
              value: Array.from(message.text)
                .slice(val.position[1] + 1)
                .join(''),
            });
          }
          return [...acc, ...current];
        }, [])
      : [
          {
            mc_type: 'string',
            value: message.text,
          },
        ];
      const profileImg = {
        mc_type: 'image',
        value: profileImage
      };
    payload = [profileImg, ...payload, profileImg];
    this.http.post('http://192.168.1.116:5000', payload).subscribe((resp) => {
      console.log(resp);
    });
  }
}
