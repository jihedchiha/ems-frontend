import {
  Component, OnInit, OnDestroy, AfterViewInit,
  signal, computed, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';

// ══════════════════════════════════════════════════════════════════
// MODELS
// ══════════════════════════════════════════════════════════════════

export interface SeanceRow {
  id:          number;
  heure_debut: string;
  heure_fin:   string;
  reservations: number;
  places_total: number;
  disponibles:  number;
  i_motion:     number;
  i_model:      number;
}

export interface ExpiringAbo {
  initials:       string;
  nom:            string;
  pack:           string;
  jours_restants: number;
  avatar_color:   string;
  bar_percent:    number;
}

export interface ActivityItem {
  dot_color: string;
  text:      string;
  client:    string;
  time:      string;
  has_line:  boolean;
}

export interface TopClient {
  rang:         number;
  nom:          string;
  pack:         string;
  sessions:     number;
  avatar_color: string;
}

export interface ChartMode {
  key:   'week' | 'month';
  label: string;
}

export interface ToastState {
  visible: boolean;
  message: string;
  type:    'success' | 'warning' | 'info';
}

export interface AboTypeCount {
  label: string;
  count: number;
  color: string;
}

// ══════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════

@Component({
  selector:    'app-personnel-dashboard',
  standalone:  true,
  imports:     [CommonModule],
  templateUrl: './personnel-dashboard.component.html',
  styleUrl:    './personnel-dashboard.components.css',
})
export class PersonnelDashboardComponent
  implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('seancesCanvas') seancesCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('donutCanvas')   donutCanvasRef!:   ElementRef<HTMLCanvasElement>;

  // ── State ──────────────────────────────────────────────────────
  currentDate      = signal<Date>(new Date('2026-03-14'));
  activeChartMode  = signal<'week' | 'month'>('week');
  toast            = signal<ToastState>({ visible: false, message: '', type: 'success' });

  private seancesChart: any = null;
  private donutChart:   any = null;
  private toastTimer:   any = null;

  // ── Chart modes ────────────────────────────────────────────────
  chartModes: ChartMode[] = [
    { key: 'week',  label: 'Cette semaine' },
    { key: 'month', label: 'Ce mois'       },
  ];

  // ── Séances par jour data ──────────────────────────────────────
  readonly CHART_DATA = {
    week: {
      labels:   ['Lun 9', 'Mar 10', 'Mer 11', 'Jeu 12', 'Ven 13', 'Sam 14'],
      seances:  [26, 22, 24, 20, 24, 18],
      presents: [22, 19, 21, 17, 20, 15],
    },
    month: {
      labels:   ['S1', 'S2', 'S3', 'S4'],
      seances:  [134, 128, 142, 96],
      presents: [112, 108, 126, 80],
    },
  };

  // ══════════════════════════════════════════════════════════════════
  // FAKE DATA
  // ══════════════════════════════════════════════════════════════════

  // ── KPIs (opérationnels uniquement — pas de revenue) ──────────
  kpis = [
    {
      label:    'Séances Aujourd\'hui',
      value:    '24',
      trend:    'Taux: 76% remplissage',
      trendType:'neutral' as const,
      icon:     '📅',
      color:    '#3b82f6',
      bgColor:  'rgba(59,130,246,0.1)',
      border:   'rgba(59,130,246,0.18)',
    },
    {
      label:    'Réservations Actives',
      value:    '38',
      trend:    '↑ +3 aujourd\'hui',
      trendType:'up' as const,
      icon:     '✅',
      color:    '#22c55e',
      bgColor:  'rgba(34,197,94,0.1)',
      border:   'rgba(34,197,94,0.18)',
    },
    {
      label:    'Séances Complètes',
      value:    '4',
      trend:    'Plus de places',
      trendType:'down' as const,
      icon:     '🔴',
      color:    '#f87171',
      bgColor:  'rgba(248,113,113,0.1)',
      border:   'rgba(248,113,113,0.18)',
    },
    {
      label:    'En Attente',
      value:    '3',
      trend:    'À confirmer',
      trendType:'neutral' as const,
      icon:     '⏳',
      color:    '#fbbf24',
      bgColor:  'rgba(251,191,36,0.1)',
      border:   'rgba(251,191,36,0.18)',
    },
    {
      label:    'Clients Actifs',
      value:    '154',
      trend:    '↑ +8 ce mois',
      trendType:'up' as const,
      icon:     '👥',
      color:    '#22d3ee',
      bgColor:  'rgba(34,211,238,0.1)',
      border:   'rgba(34,211,238,0.18)',
    },
  ];

  // ── Séances du jour ────────────────────────────────────────────
  seancesJour: SeanceRow[] = [
    { id:1,  heure_debut:'08:00', heure_fin:'08:30', reservations:5, places_total:5, disponibles:0, i_motion:3, i_model:2 },
    { id:2,  heure_debut:'08:30', heure_fin:'09:00', reservations:3, places_total:5, disponibles:2, i_motion:2, i_model:1 },
    { id:3,  heure_debut:'09:00', heure_fin:'09:30', reservations:3, places_total:5, disponibles:2, i_motion:1, i_model:2 },
    { id:4,  heure_debut:'09:30', heure_fin:'10:00', reservations:4, places_total:5, disponibles:1, i_motion:2, i_model:2 },
    { id:5,  heure_debut:'10:00', heure_fin:'10:30', reservations:5, places_total:5, disponibles:0, i_motion:3, i_model:2 },
    { id:6,  heure_debut:'10:30', heure_fin:'11:00', reservations:1, places_total:5, disponibles:4, i_motion:1, i_model:0 },
    { id:7,  heure_debut:'14:00', heure_fin:'14:30', reservations:2, places_total:5, disponibles:3, i_motion:1, i_model:1 },
    { id:8,  heure_debut:'14:30', heure_fin:'15:00', reservations:0, places_total:5, disponibles:5, i_motion:0, i_model:0 },
  ];

  // ── Abonnements par type (pas financier) ──────────────────────
  aboTypes: AboTypeCount[] = [
    { label:'Pack 20', count:57, color:'#c084fc' },
    { label:'Pack 10', count:38, color:'#22d3ee' },
    { label:'Pack 30', count:24, color:'#22c55e' },
    { label:'Essai',   count:9,  color:'#525c78' },
  ];

  // ── Expirations proches ────────────────────────────────────────
  expiringAbos: ExpiringAbo[] = [
    { initials:'JD', nom:'Jean Dupont',  pack:'Pack 20 — Standard',   jours_restants:2, avatar_color:'linear-gradient(135deg,#ef4444,#dc2626)', bar_percent:10 },
    { initials:'MC', nom:'Marie Curie',  pack:'Pack 30 — Intensif',   jours_restants:5, avatar_color:'linear-gradient(135deg,#f59e0b,#d97706)', bar_percent:33 },
    { initials:'PM', nom:'Paul Martin',  pack:'Pack 10 — Découverte', jours_restants:7, avatar_color:'linear-gradient(135deg,#f59e0b,#d97706)', bar_percent:47 },
  ];

  // ── Activité récente ───────────────────────────────────────────
  activityFeed: ActivityItem[] = [
    { dot_color:'#22c55e', text:'marqué présent — Séance 09:00', client:'Ahmed Mansouri', time:'Il y a 3 min',  has_line:true  },
    { dot_color:'#3b82f6', text:'— nouvelle réservation · 10:30', client:'Sara Ksouri',   time:'Il y a 8 min',  has_line:true  },
    { dot_color:'#fbbf24', text:'— abonnement expire dans 2 jours', client:'Jean Dupont', time:'Il y a 15 min', has_line:true  },
    { dot_color:'#f87171', text:'— réservation annulée · 08:30',  client:'Karim Ben Ali', time:'Il y a 22 min', has_line:true  },
    { dot_color:'#c084fc', text:'— nouveau client créé',          client:'Rim Saidi',     time:'Il y a 35 min', has_line:false },
  ];

  // ── Top clients ────────────────────────────────────────────────
  topClients: TopClient[] = [
    { rang:1, nom:'Ahmed Mansouri', pack:'Pack 20', sessions:48, avatar_color:'#3b82f6' },
    { rang:2, nom:'Lina Dridi',     pack:'Pack 30', sessions:42, avatar_color:'#7c3aed' },
    { rang:3, nom:'Karim Ben Ali',  pack:'Pack 20', sessions:38, avatar_color:'#10b981' },
    { rang:4, nom:'Yasmine Tlili',  pack:'Pack 10', sessions:31, avatar_color:'#f59e0b' },
    { rang:5, nom:'Omar Belhaj',    pack:'Pack 20', sessions:27, avatar_color:'#ec4899' },
  ];

  // ── Chart footer stats ─────────────────────────────────────────
  chartFooterStats = computed(() => {
    const m = this.activeChartMode();
    if (m === 'week') return [
      { label:'Meilleur jour',   value:'Lun — 26 séances', color:'var(--green)' },
      { label:'Moyenne / jour',  value:'22 séances',       color:'#fff'         },
      { label:'Taux moyen',      value:'74% remplissage',  color:'var(--blue)'  },
    ];
    return [
      { label:'Meilleure semaine', value:'S3 — 142 séances', color:'var(--green)' },
      { label:'Moyenne / semaine', value:'125 séances',      color:'#fff'         },
      { label:'Taux moyen',        value:'71% remplissage',  color:'var(--blue)'  },
    ];
  });

  formattedDate = computed(() =>
    this.currentDate().toLocaleDateString('fr-FR', {
      weekday:'long', year:'numeric', month:'long', day:'numeric',
    })
  );

  // ══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.buildSeancesChart('week');
      this.buildDonutChart();
    }, 150);
  }

  ngOnDestroy(): void {
    this.seancesChart?.destroy();
    this.donutChart?.destroy();
    clearTimeout(this.toastTimer);
  }

  // ══════════════════════════════════════════════════════════════════
  // CHARTS
  // ══════════════════════════════════════════════════════════════════

  buildSeancesChart(mode: 'week' | 'month'): void {
    const Chart = (window as any)['Chart'];
    if (!Chart || !this.seancesCanvasRef) return;

    const d   = this.CHART_DATA[mode];
    const ctx = this.seancesCanvasRef.nativeElement.getContext('2d')!;

    this.seancesChart?.destroy();
    this.seancesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: d.labels,
        datasets: [
          {
            label:           'Séances planifiées',
            data:            d.seances,
            backgroundColor: 'rgba(59,130,246,0.55)',
            borderColor:     '#3b82f6',
            borderWidth:     1,
            borderRadius:    5,
          },
          {
            label:           'Clients présents',
            data:            d.presents,
            backgroundColor: 'rgba(34,197,94,0.5)',
            borderColor:     '#22c55e',
            borderWidth:     1,
            borderRadius:    5,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color:    '#9ba3c8',
              font:     { size: 10, family: 'Outfit' },
              boxWidth: 10,
              padding:  12,
            },
          },
          tooltip: {
            backgroundColor: '#111627',
            borderColor:     'rgba(255,255,255,0.08)',
            borderWidth:     1,
            titleColor:      '#eef0fa',
            bodyColor:       '#9ba3c8',
            padding:         10,
          },
        },
        scales: {
          x: {
            grid:  { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#525c78', font: { size: 10 } },
          },
          y: {
            grid:  { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#525c78', font: { size: 10 }, stepSize: 5 },
          },
        },
      },
    });
  }

  buildDonutChart(): void {
    const Chart = (window as any)['Chart'];
    if (!Chart || !this.donutCanvasRef) return;

    const ctx = this.donutCanvasRef.nativeElement.getContext('2d')!;
    this.donutChart?.destroy();
    this.donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels:   this.aboTypes.map(a => a.label),
        datasets: [{
          data:            this.aboTypes.map(a => a.count),
          backgroundColor: this.aboTypes.map(a => a.color),
          borderColor:     '#111627',
          borderWidth:     3,
          hoverOffset:     4,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        cutout:              '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111627',
            borderColor:     'rgba(255,255,255,0.08)',
            borderWidth:     1,
            titleColor:      '#eef0fa',
            bodyColor:       '#9ba3c8',
            padding:         8,
            callbacks: {
              label: (c: any) => ` ${c.parsed} clients`,
            },
          },
        },
      },
    });
  }

  setChartMode(mode: 'week' | 'month'): void {
    this.activeChartMode.set(mode);
    this.buildSeancesChart(mode);
  }

  // ══════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════

  readonly AVATAR_COLORS = ['#3b82f6','#7c3aed','#ec4899','#10b981','#f59e0b','#06b6d4','#ef4444','#8b5cf6'];

  getInitials(nom: string): string {
    return nom.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  getAvatarColor(nom: string): string {
    return this.AVATAR_COLORS[nom.charCodeAt(0) % this.AVATAR_COLORS.length];
  }

  getOccupancyPercent(s: SeanceRow): number {
    return Math.round((s.reservations / s.places_total) * 100);
  }

  getBarColor(s: SeanceRow): string {
    const p = this.getOccupancyPercent(s);
    if (p === 100) return 'var(--red)';
    if (p >= 60)   return 'var(--amber)';
    return 'var(--green)';
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

  getExpiryColor(jours: number): string {
    if (jours <= 3) return '#f87171';
    if (jours <= 7) return '#fbbf24';
    return '#22c55e';
  }

  getTotalAbo(): number {
    return this.aboTypes.reduce((s, a) => s + a.count, 0);
  }

  getTopAbo(): AboTypeCount {
    return this.aboTypes.reduce((a, b) => a.count > b.count ? a : b);
  }

  // ══════════════════════════════════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════════════════════════════════

  naviguerCreneaux(s?: SeanceRow): void {
    this.showToast(
      s ? `Séance ${s.heure_debut} – ${s.heure_fin} ouverte` : 'Planning ouvert',
      'info'
    );
    // TODO: this.router.navigate(['/creneaux']);
  }

  ajouterReservation(s: SeanceRow): void {
    this.showToast(`Réservation ajoutée — Séance ${s.heure_debut}`, 'success');
  }

  notifierClients(): void {
    this.showToast('Notifications envoyées aux 3 clients expirants', 'success');
  }

  // ══════════════════════════════════════════════════════════════════
  // TOAST
  // ══════════════════════════════════════════════════════════════════

  showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ visible: true, message, type });
    this.toastTimer = setTimeout(
      () => this.toast.update(t => ({ ...t, visible: false })),
      3000
    );
  }
}