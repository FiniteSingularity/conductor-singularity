import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'main-overlay', loadComponent: () => import('./features/main-overlay/main-overlay.component').then(mod => mod.MainOverlayComponent)
  }
];
