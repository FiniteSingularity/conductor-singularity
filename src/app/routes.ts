import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "main-overlay",
    loadComponent: () =>
      import("./features/main-overlay/main-overlay.component").then(
        (mod) => mod.MainOverlayComponent
      ),
  },
  {
    path: "time-loop",
    loadComponent: () =>
      import("./features/time-loop/time-loop.component").then(
        (mod) => mod.TimeLoopComponent
      ),
  },
];
