
import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class NavbarComponent implements OnInit {

  currentDate = new Date();
  pageTitle   = 'EMS Management System';
  breadcrumb  = 'Vue générale du studio';

  // Map route → titre + breadcrumb
  private readonly PAGE_MAP: Record<string, { title: string; bread: string }> = {
    '/dashboard':    { title: 'EMS Management System',  bread: 'Vue générale du studio'          },
    '/creneaux':     { title: 'Planning des Créneaux',   bread: 'Accueil / Créneaux'              },
    '/clients':      { title: 'Gestion des Clients',     bread: 'Accueil / Clients'               },
    '/abonnements':  { title: 'Abonnements',             bread: 'Accueil / Abonnements'           },
    '/ventes':       { title: 'Ventes & Paiements',      bread: 'Accueil / Ventes'                },
    '/rapports':     { title: 'Rapports & Statistiques', bread: 'Accueil / Rapports'              },
    '/parametres':   { title: 'Paramètres',              bread: 'Accueil / Paramètres'            },
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Appliquer le titre pour la route initiale
    this.updateTitle(this.router.url);

    // Écouter les changements de route
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => this.updateTitle(e.urlAfterRedirects));
  }

  private updateTitle(url: string): void {
    const route = '/' + url.split('/')[1]; // ex: '/creneaux'
    const page  = this.PAGE_MAP[route];
    if (page) {
      this.pageTitle  = page.title;
      this.breadcrumb = page.bread;
    }
  }
}