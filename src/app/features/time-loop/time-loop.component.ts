import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  CountdownConfig,
  CountdownEvent,
  CountdownModule,
} from "ngx-countdown";
import { ComponentStore } from "@ngrx/component-store";
import { ObsService } from "src/app/services/obs.service";
import { concatMap, tap } from "rxjs";

@Component({
  selector: "app-time-loop",
  standalone: true,
  imports: [CommonModule, CountdownModule],
  templateUrl: "time-loop.component.html",
  styleUrls: ["time-loop.component.scss"],
})
export class TimeLoopComponent extends ComponentStore<{}> implements OnInit {
  warning = false;
  active = false;
  step: "pre" | "loop-record" | "main-record" | "final" | "none" = "pre";
  preConfig: CountdownConfig = { leftTime: 2, format: "s.S" };
  loopRecordConfig: CountdownConfig = {
    leftTime: 10,
    format: "s.S",
    notify: [2],
  };
  mainRecordConfig: CountdownConfig = {
    leftTime: 20,
    format: "s.S",
    notify: [5],
  };
  finalRecordConfig: CountdownConfig = {
    leftTime: 20,
    format: "s.S",
    notify: [5],
  };

  constructor(public obs: ObsService) {
    super();
  }

  readonly timeLoopEvent = this.effect<boolean>((timeLoop$) =>
    timeLoop$.pipe(
      tap((timeLoop) => {
        this.active = timeLoop;
        this.warning = false;
        this.step = "pre";
      })
    )
  );

  ngOnInit(): void {
    this.timeLoopEvent(this.obs.timeLoop$);
  }

  handleCountdownEvent(ev: CountdownEvent) {
    if (ev.action === "done") {
      this.warning = false;
      this.step =
        this.step === "pre"
          ? "loop-record"
          : this.step === "loop-record"
          ? "main-record"
          : this.step === "main-record"
          ? "final"
          : "none";
    } else if (ev.action === "notify") {
      this.warning = true;
    }
  }
}
