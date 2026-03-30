import {
  Component, OnInit, OnDestroy, AfterViewInit,
  signal, computed, ElementRef, ViewChild, inject
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

// ── Models ─────────────────────────────────────────────────────────────────

export interface KpiCard {
  label: string;
  value: string;
  unit?: string;
  trend: string;
  trendType: 'up' | 'down' | 'neutral';
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface SeanceRow {
  id: number;
  heure_debut: string;
  heure_fin: string;
  reservations: number;
  places_total: number;
  disponibles: number;
  i_motion: number;
  i_model: number;
}

export interface ExpiringAbo {
  initials: string;
  nom: string;
  type: string;
  jours_restants: number;
  avatar_color: string;
  bar_percent: number;
}

export interface ActivityItem {
  dot_color: string;
  text: string;
  client: string;
  time: string;
  has_line: boolean;
}

export interface TopClient {
  rang: number;
  nom: string;
  abonnement: string;
  sessions: number;
  avatar_color: string;
}

export interface ChartMode {
  key: 'week' | 'month' | 'year';
  label: string;
}

export interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'warning' | 'info';
}

// ── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  private router = inject(Router);

  @ViewChild('revenueCanvas') revenueCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('donutCanvas') donutCanvasRef!: ElementRef<HTMLCanvasElement>;

  // ── State ────────────────────────────────────────────────────────────────
  currentDate = signal<Date>(new Date('2026-03-14'));
  activeChartMode = signal<'week' | 'month' | 'year'>('week');
  toast = signal<ToastState>({ visible: false, message: '', type: 'success' });
  private toastTimer: any;
  private revenueChart: any = null;
  private donutChart: any = null;
  private apiService = inject(ApiService);

  DONUT_COLORS = ['#3b82f6', '#c084fc', '#fbbf24', '#f87171', '#10b981'];
  abonnementsParTypeData: any[] = [
  ];

  // ── Chart Modes ──────────────────────────────────────────────────────────
  chartModes: ChartMode[] = [
    { key: 'week',  label: '7j'  },
    { key: 'month', label: '12m' },
    { key: 'year',  label: 'Tout'},
  ];

  CHART_DATA: Record<string, { labels: string[], data: number[] }> = {
    week: { labels: [], data: [] },
    month: { labels: [], data: [] },
    year: { labels: [], data: [] }
  };

  // ── KPIs ─────────────────────────────────────────────────────────────────
  kpiCards: KpiCard[] = [

  ];

  // ── Sessions ─────────────────────────────────────────────────────────────
  seancesJour: SeanceRow[] = [

  ];

  // ── Expiring Abos ────────────────────────────────────────────────────────
  expiringAbos: ExpiringAbo[] = [
    { initials: 'JD', nom: 'Jean Dupont', type: 'Mensuel', jours_restants: 2, avatar_color: 'linear-gradient(135deg,#ef4444,#dc2626)', bar_percent: 10 },
    { initials: 'MC', nom: 'Marie Curie', type: 'Annuel', jours_restants: 5, avatar_color: 'linear-gradient(135deg,#f59e0b,#d97706)', bar_percent: 33 },
    { initials: 'PM', nom: 'Paul Martin', type: 'Mensuel', jours_restants: 7, avatar_color: 'linear-gradient(135deg,#f59e0b,#d97706)', bar_percent: 47 },
  ];

  // ── Activity (déplacé vers /historique) ────────────────────────────────
  naviguerVersHistorique(): void {
    this.router.navigate(['/historique']);
  }

  // ── Top Clients ───────────────────────────────────────────────────────────
  topClients: TopClient[] = [
    { rang: 1, nom: 'Ahmed Mansouri', abonnement: 'Mensuel', sessions: 48, avatar_color: '#3b82f6' },
    { rang: 2, nom: 'Lina Dridi', abonnement: 'Annuel', sessions: 42, avatar_color: '#7c3aed' },
    { rang: 3, nom: 'Karim Ben Ali', abonnement: 'Mensuel', sessions: 38, avatar_color: '#10b981' },
    { rang: 4, nom: 'Yasmine Tlili', abonnement: 'Trimestriel', sessions: 31, avatar_color: '#f59e0b' },
    { rang: 5, nom: 'Omar Belhaj', abonnement: 'Mensuel', sessions: 27, avatar_color: '#ec4899' },
  ];

  // ── Computed ─────────────────────────────────────────────────────────────
  formattedDate = computed(() =>
    this.currentDate().toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
  );

  chartFooterStats = computed(() => {
    const mode = this.activeChartMode();
    if (mode === 'month') return [
      { label: 'Meilleur mois', value: 'Oct — 48 200 DHS', color: 'var(--green)' },
      { label: 'Moyenne mensuelle', value: '35 400 DHS', color: '#fff' },
      { label: 'Croissance', value: '+18% YoY', color: 'var(--blue)' },
    ];
    if (mode === 'week') return [
      { label: 'Meilleur jour', value: 'Sam — 1 800 DHS', color: 'var(--green)' },
      { label: 'Moyenne/jour', value: '1 154 DHS', color: '#fff' },
      { label: 'Vs semaine préc.', value: '+8%', color: 'var(--blue)' },
    ];
    return [
      { label: 'Meilleure année', value: '2026 — 425K DHS', color: 'var(--green)' },
      { label: 'Moyenne annuelle', value: '305 000 DHS', color: '#fff' },
      { label: 'TCAM', value: '+19% / an', color: 'var(--blue)' },
    ];
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.apiService.getDashboard().subscribe({
      next: (data) => {
        this.kpiCards = [
          { label: "Revenue Aujourd'hui", value: data.revenu_jour?.toString() || '0', unit: 'DT', trend: '-', trendType: 'neutral', icon: '💰', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.15)' },
          { label: 'Revenue ce Mois', value: data.revenu_mois?.toString() || '0', unit: 'DT', trend: '-', trendType: 'neutral', icon: '📅', color: '#10b981', bgColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.15)' },
          { label: 'Revenue Annuel', value: data.revenu_annee?.toString() || '0', unit: 'DT', trend: '-', trendType: 'neutral', icon: '📊', color: '#c084fc', bgColor: 'rgba(192,132,252,0.1)', borderColor: 'rgba(192,132,252,0.15)' },
          { label: 'Clients Actifs', value: data.clients_actifs?.toString() || '0', trend: '-', trendType: 'neutral', icon: '👥', color: '#22d3ee', bgColor: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.15)' },
          { label: 'Abonnements Actifs', value: data.clients_actifs?.toString() || '0', trend: `${data.expirations_count || 0} alerte(s)`, trendType: data.expirations_count > 0 ? 'down' : 'neutral', icon: '🎟️', color: '#fbbf24', bgColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.15)' },
          { label: "Séances Aujourd'hui", value: data.seances_aujourd_hui?.toString() || '0', trend: `Taux: ${data.taux_remplissage || 0}% remplissage`, trendType: 'neutral', icon: '⚡', color: '#f87171', bgColor: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.15)' },
        ];

        this.seancesJour = (data.seances_du_jour || []).map((s: any) => ({
          id: s.id,
          heure_debut: s.heure_debut?.substring(0, 5) || '',
          heure_fin: s.heure_fin?.substring(0, 5) || '',
          reservations: s.reservations || 0,
          places_total: s.places_total || 5,
          disponibles: s.places_disponibles || 5,
          i_motion: s.i_motion || 0,
          i_model: s.i_model || 0
        }));

        this.expiringAbos = (data.expirations_proches || []).map((e: any) => ({
          initials: this.getInitials(e.client_nom),
          nom: e.client_nom,
          type: e.type || '-',
          jours_restants: e.seances_restantes || 0,
          avatar_color: 'linear-gradient(135deg,#f59e0b,#d97706)',
          bar_percent: Math.min(((e.seances_restantes || 0) / 20) * 100, 100)
        }));

        if (data.revenus_courbe && data.revenus_courbe.length > 0) {
          const labels = data.revenus_courbe.map((r: any) => r.label);
          const amounts = data.revenus_courbe.map((r: any) => r.montant);
          this.CHART_DATA['week'] = { labels, data: amounts };
          this.CHART_DATA['month'] = { labels, data: amounts };
          this.CHART_DATA['year'] = { labels, data: amounts };

          if (this.revenueChart) {
            this.buildRevenueChart(this.activeChartMode());
          }
        }

        if (data.abonnements_par_type && data.abonnements_par_type.length > 0) {
          this.abonnementsParTypeData = data.abonnements_par_type;
          if (this.donutChart) {
            this.buildDonutChart();
          }
        }
      },
      error: (err) => {
        console.error('Erreur API Dashboard', err);
        this.showToast(`Erreur API (${err.status}): vérifiez l'URL ou la console`, 'warning');
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.buildRevenueChart(this.activeChartMode());
      this.buildDonutChart();
    }, 100);
  }

  ngOnDestroy(): void {
    this.revenueChart?.destroy();
    this.donutChart?.destroy();
    clearTimeout(this.toastTimer);
  }

  // ── Chart Builders ────────────────────────────────────────────────────────
  private buildRevenueChart(mode: 'week' | 'month' | 'year'): void {
    const Chart = (window as any)['Chart'];
    if (!Chart || !this.revenueCanvasRef) return;

    const d = this.CHART_DATA[mode];
    if (!d || !d.labels || d.labels.length === 0) return;

    const ctx = this.revenueCanvasRef.nativeElement.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, 'rgba(59,130,246,0.28)');
    grad.addColorStop(1, 'rgba(59,130,246,0)');

    this.revenueChart?.destroy();
    this.revenueChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [{
          data: d.data,
          borderColor: '#3b82f6',
          backgroundColor: grad,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#111627',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111627',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            titleColor: '#eef0fa',
            bodyColor: '#9ba3c8',
            padding: 10,
            callbacks: {
              label: (c: any) => ' ' + c.parsed.y.toLocaleString() + ' DHS'
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#525c78', font: { size: 10, family: 'JetBrains Mono' } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#525c78', font: { size: 10 }, callback: (v: any) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v } }
        }
      }
    });
  }

  private buildDonutChart(): void {
    const Chart = (window as any)['Chart'];
    if (!Chart || !this.donutCanvasRef) return;

    const labels = this.abonnementsParTypeData.map(a => a.label);
    const data = this.abonnementsParTypeData.map(a => a.pourcentage);
    const bgColors = this.abonnementsParTypeData.map((_, i) => this.getDonutColor(i));

    const ctx = this.donutCanvasRef.nativeElement.getContext('2d')!;
    this.donutChart?.destroy();
    this.donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderColor: '#111627',
          borderWidth: 3,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111627',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            titleColor: '#eef0fa',
            bodyColor: '#9ba3c8',
            padding: 8,
          }
        }
      }
    });
  }

  // ── Methods ───────────────────────────────────────────────────────────────
  setChartMode(mode: 'week' | 'month' | 'year'): void {
    this.activeChartMode.set(mode);
    this.buildRevenueChart(mode);
  }

  getDonutColor(index: number): string {
    return this.DONUT_COLORS[index % this.DONUT_COLORS.length];
  }

  getOccupancyPercent(s: SeanceRow): number {
    return Math.round((s.reservations / s.places_total) * 100);
  }

  getBarColor(s: SeanceRow): string {
    const p = this.getOccupancyPercent(s);
    if (p === 100) return 'var(--red)';
    if (p >= 60) return 'var(--amber)';
    return 'var(--green)';
  }

  getStatutLabel(s: SeanceRow): string {
    if (s.disponibles === 0) return 'Complet';
    if (s.reservations === 0) return 'Vide';
    const p = this.getOccupancyPercent(s);
    if (p >= 60) return 'Bientôt Plein';
    return 'Disponible';
  }

  getStatutClass(s: SeanceRow): string {
    if (s.disponibles === 0) return 'sp-full';
    if (s.reservations === 0) return 'sp-empty';
    const p = this.getOccupancyPercent(s);
    if (p >= 60) return 'sp-mid';
    return 'sp-ok';
  }

  getExpiryColor(jours: number): string {
    if (jours <= 3) return 'var(--red)';
    if (jours <= 7) return 'var(--amber)';
    return 'var(--green)';
  }

  getInitials(nom: string): string {
    return nom.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  naviguerVersCreneaux(seance?: SeanceRow): void {
    this.showToast(seance ? `Séance ${seance.heure_debut} ouverte` : 'Planning ouvert', 'info');
    // this.router.navigate(['/creneaux']);
  }

  ajouterReservation(seance: SeanceRow): void {
    this.showToast(`Réservation ajoutée à ${seance.heure_debut}`, 'success');
  }

  notifierClients(): void {
    this.showToast('Notifications envoyées aux 3 clients expirants', 'success');
  }

  exporterRapport(): void {
    this.showToast('Rapport exporté avec succès', 'success');
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ visible: true, message, type });
    this.toastTimer = setTimeout(() => this.toast.update(t => ({ ...t, visible: false })), 3000);
  }
}