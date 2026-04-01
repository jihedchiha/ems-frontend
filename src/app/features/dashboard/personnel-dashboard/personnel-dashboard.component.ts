import {
  Component, OnInit, OnDestroy, AfterViewInit,
  signal, computed, ElementRef, ViewChild, inject
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

export interface SeanceRow {
  id:           number;
  heure_debut:  string;
  heure_fin:    string;
  reservations: number;
  places_total: number;
  disponibles:  number;
  i_motion:     number;
  i_model:      number;
}

export interface ExpiringAbo {
  initials:          string;
  nom:               string;
  type:              string;
  seances_restantes: number;
  avatar_color:      string;
  bar_percent:       number;
}

export interface ToastState {
  visible: boolean;
  message: string;
  type:    'success' | 'warning' | 'info';
}

@Component({
  selector:    'app-personnel-dashboard',
  standalone:  true,
  imports:     [CommonModule, DatePipe],
  templateUrl: './personnel-dashboard.component.html',
  styleUrl:    './personnel-dashboard.components.css',
})
export class PersonnelDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  private router     = inject(Router);
  private apiService = inject(ApiService);

  @ViewChild('donutCanvas') donutCanvasRef!: ElementRef<HTMLCanvasElement>;

  // ── State ───────────────────────────────────────────────────────
  currentDate = signal<Date>(new Date());
  toast       = signal<ToastState>({ visible: false, message: '', type: 'success' });

  isLoadingRevenus  = signal<boolean>(false);
  isLoadingAlertes  = signal<boolean>(false);
  isLoadingSeances  = signal<boolean>(false);

  chartsReady = false;
  private donutChart:  any = null;
  private toastTimer:  any = null;

  DONUT_COLORS = ['#3b82f6', '#c084fc', '#fbbf24', '#f87171', '#10b981', '#22d3ee'];

  // ── Data signals ────────────────────────────────────────────────
  revenuJour         = signal<{ abonnements: number; ventes: number; total: number }>({ abonnements: 0, ventes: 0, total: 0 });
  abonnementsParType = signal<any[]>([]);
  expiringAbos       = signal<ExpiringAbo[]>([]);
  seancesJour        = signal<SeanceRow[]>([]);

  // ── Computed ────────────────────────────────────────────────────
  isLoading = computed(() =>
    this.isLoadingRevenus() || this.isLoadingAlertes() || this.isLoadingSeances()
  );

  aboPercent = computed(() => {
    const r = this.revenuJour();
    return r.total ? Math.round((r.abonnements / r.total) * 100) : 0;
  });

  ventePercent = computed(() => {
    const r = this.revenuJour();
    return r.total ? Math.round((r.ventes / r.total) * 100) : 0;
  });

  // ── Lifecycle ───────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadRevenus();
    this.loadAlertes();
    this.loadSeancesJour();
  }

  ngAfterViewInit(): void {
    this.chartsReady = true;
    if (this.abonnementsParType().length > 0) this.buildDonutChart();
  }

  ngOnDestroy(): void {
    this.donutChart?.destroy();
    clearTimeout(this.toastTimer);
  }

  // ── API calls ───────────────────────────────────────────────────
  loadRevenus(): void {
    this.isLoadingRevenus.set(true);
    this.apiService.getDashboardRevenus('12m').subscribe({
      next: (data: any) => {
        this.isLoadingRevenus.set(false);
        const jour = data.revenu_jour || { abonnements: 0, ventes: 0, total: 0 };
        this.revenuJour.set({
          abonnements: parseFloat(jour.abonnements || '0'),
          ventes:      parseFloat(jour.ventes      || '0'),
          total:       parseFloat(jour.total        || '0'),
        });

        const parType: any[] = data.revenus_par_type || [];
        if (parType.length > 0) {
          this.abonnementsParType.set(parType);
          if (this.chartsReady) this.buildDonutChart();
        }
      },
      error: (err: any) => {
        this.isLoadingRevenus.set(false);
        this.showToast(`Erreur revenus (${err.status})`, 'warning');
      }
    });
  }

  loadAlertes(): void {
    this.isLoadingAlertes.set(true);
    this.apiService.getDashboardAlertes().subscribe({
      next: (data: any) => {
        this.isLoadingAlertes.set(false);
        this.expiringAbos.set(
          (data.expirations_proches || []).map((e: any) => ({
            initials:          this.getInitials(e.client_nom || '—'),
            nom:               e.client_nom || '—',
            type:              e.type       || '-',
            seances_restantes: e.seances_restantes || 0,
            avatar_color:      'linear-gradient(135deg,#f59e0b,#d97706)',
            bar_percent:       Math.min(((e.seances_restantes || 0) / 10) * 100, 100),
          }))
        );
      },
      error: (err: any) => {
        this.isLoadingAlertes.set(false);
        this.showToast(`Erreur alertes (${err.status})`, 'warning');
      }
    });
  }

  loadSeancesJour(): void {
    this.isLoadingSeances.set(true);
    const today = new Date().toISOString().split('T')[0];
    this.apiService.getSeances(today).subscribe({
      next: (res: any) => {
        this.isLoadingSeances.set(false);
        const data = res.results || res;
        this.seancesJour.set(data.map((s: any) => ({
          id:           s.id,
          heure_debut:  s.heure_debut?.substring(0, 5) || '',
          heure_fin:    s.heure_fin?.substring(0, 5)   || '',
          reservations: s.reservations ?? s.reservations_count ?? 0,
          places_total: s.places_total ?? s.places ?? 0,
          disponibles:  s.places_disponibles ?? s.disponibles ?? 0,
          i_motion:     s.i_motion ?? 0,
          i_model:      s.i_model  ?? 0,
        })));
      },
      error: (err: any) => {
        this.isLoadingSeances.set(false);
        this.showToast(`Erreur séances (${err.status})`, 'warning');
      }
    });
  }

  // ── Donut chart ─────────────────────────────────────────────────
  private buildDonutChart(): void {
    const Chart = (window as any)['Chart'];
    const data  = this.abonnementsParType();
    if (!Chart || !this.donutCanvasRef || !data.length) return;
    const ctx = this.donutCanvasRef.nativeElement.getContext('2d')!;
    this.donutChart?.destroy();
    this.donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels:   data.map((a: any) => a.label),
        datasets: [{
          data:            data.map((a: any) => a.pourcentage),
          backgroundColor: data.map((_: any, i: number) => this.getDonutColor(i)),
          borderColor:     '#111627', borderWidth: 3, hoverOffset: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111627', borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1, titleColor: '#eef0fa', bodyColor: '#9ba3c8', padding: 8,
            callbacks: { label: (c: any) => ` ${c.parsed}%` }
          }
        }
      }
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────
  getDonutColor(i: number): string { return this.DONUT_COLORS[i % this.DONUT_COLORS.length]; }

  getInitials(nom: string): string {
    return nom.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  formatRevenu(n: number): string {
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  }

  getExpiryColor(j: number): string {
    return j === 0 ? 'var(--red)' : j <= 2 ? 'var(--amber)' : 'var(--green)';
  }

  getOccupancyPercent(s: SeanceRow): number {
    return s.places_total ? Math.round((s.reservations / s.places_total) * 100) : 0;
  }

  getBarColor(s: SeanceRow): string {
    const p = this.getOccupancyPercent(s);
    return p === 100 ? 'var(--red)' : p >= 60 ? 'var(--amber)' : 'var(--green)';
  }

  getStatutLabel(s: SeanceRow): string {
    if (s.disponibles === 0)  return 'Complet';
    if (s.reservations === 0) return 'Vide';
    return this.getOccupancyPercent(s) >= 60 ? 'Bientôt Plein' : 'Disponible';
  }

  getStatutClass(s: SeanceRow): string {
    if (s.disponibles === 0)  return 'sp-full';
    if (s.reservations === 0) return 'sp-empty';
    return this.getOccupancyPercent(s) >= 60 ? 'sp-mid' : 'sp-ok';
  }

  naviguerVersCreneaux(): void { this.router.navigate(['/creneaux']); }
  naviguerVersAbonnements(): void { this.router.navigate(['/abonnements']); }

  ajouterReservation(s: SeanceRow): void {
    this.showToast(`Réservation ajoutée à ${s.heure_debut}`, 'success');
  }

  showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ visible: true, message, type });
    this.toastTimer = setTimeout(
      () => this.toast.update(t => ({ ...t, visible: false })),
      3000
    );
  }
}