import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'characters',
    pathMatch: 'full'
  },
  {
    path: 'characters',
    loadComponent: () => import('./features/characters/components/characters-table.component').then(m => m.CharactersTableComponent)
  },
  {
    path: '**',
    redirectTo: 'characters'
  }
];
