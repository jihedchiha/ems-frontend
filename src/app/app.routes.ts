import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { Layout } from './shared/layout/layout';

export const routes: Routes = [

  // ✅ LOGIN & RESET ROUTES
  {
    path: '',
    component: LoginComponent
  },
  {
    path: 'reset-password',
    component: LoginComponent
  },

  // ✅ LAYOUT (pages protégées)
  {
    path: '',
    component: Layout,
    children: [

      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard')
            .then(m => m.Dashboard)
      },

      {
        path: 'clients',
        loadComponent: () =>
          import('./features/clients/clients')
            .then(m => m.ClientsComponent)
      },

      {
        path: 'abonnements',
        loadComponent: () =>
          import('./features/abonnements/abonnements')
            .then(m => m.AbonnementsComponent)
      },

      {
        path: 'creneaux',
        loadComponent: () =>
          import('./features/creneaux/creneaux')
            .then(m => m.CreneauxComponent)
      },

      {
        path: 'ventes',
        loadComponent: () =>
          import('./features/ventes/ventes')
            .then(m => m.VentesComponent)
      },

      {
        path: 'personnel',
        loadComponent: () =>
          import('./features/personnel/personnel')
            .then(m => m.PersonnelComponent)
      },

      {
        path: 'historique',
        loadComponent: () =>
          import('./features/historique/historique')
            .then(m => m.HistoriqueComponent)
      },
     {
        path: 'produits',
        loadComponent: () =>
        import('./features/produits/produits')
        .then(m => m.ProduitsComponent)
     }, 
    ]
  },

  {
    path: '**',
    redirectTo: 'login'
  }
];