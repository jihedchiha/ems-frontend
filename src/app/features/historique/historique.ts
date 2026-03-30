import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

export interface HistoriqueEntry {
  id: number;
  client: string;
  type: string;
  description: string;
  date: string;
  dot_color: string;
  badge_class: string;
}

@Component({
  selector: 'app-historique',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historique.html',
  styleUrl: './historique.css'
})
export class HistoriqueComponent implements OnInit {

  private apiService = inject(ApiService);

  // ── State ────────────────────────────────────────────────────────────────
  allEntries   = signal<HistoriqueEntry[]>([]);
  isLoading    = signal(true);
  hasError     = signal(false);
  searchQuery  = signal('');
  activeFilter = signal<string>('all');
  currentPage  = signal(1);
  readonly pageSize = 15;

  // ── Filters ──────────────────────────────────────────────────────────────
  filters = [
    { key: 'all',         label: 'Tout',        icon: '📋' },
    { key: 'reservation', label: 'Réservations', icon: '📅' },
    { key: 'presence',    label: 'Présences',    icon: '✅' },
    { key: 'annulation',  label: 'Annulations',  icon: '❌' },
    { key: 'abonnement',  label: 'Abonnements',  icon: '🎟️' },
    { key: 'client',      label: 'Clients',      icon: '👤' },
  ];

  // ── Computed ─────────────────────────────────────────────────────────────
  filteredEntries = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const f = this.activeFilter();
    return this.allEntries().filter(e => {
      const matchFilter = f === 'all' || e.type.toLowerCase().includes(f);
      const matchSearch = !q || e.client.toLowerCase().includes(q)
                               || e.description.toLowerCase().includes(q)
                               || e.type.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredEntries().length / this.pageSize))
  );

  pagedEntries = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredEntries().slice(start, start + this.pageSize);
  });

  pageNumbers = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  totalCount = computed(() => this.filteredEntries().length);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadHistorique();
  }

  loadHistorique(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.apiService.getHistorique().subscribe({
      next: (data) => {
        const items: any[] = Array.isArray(data) ? data : (data?.results ?? []);
        this.allEntries.set(items.map((h: any, i: number) => this.mapEntry(h, i)));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Erreur API Historique', err);
        this.isLoading.set(false);
        this.hasError.set(true);
      }
    });
  }

  private mapEntry(h: any, i: number): HistoriqueEntry {
    const type = (h.type || h.action || '').toLowerCase();
    return {
      id: h.id ?? i,
      client: h.client_nom || h.client || h.user || '—',
      type: h.type || h.action || 'Activité',
      description: h.description || h.details || this.buildDescription(type, h),
      date: h.date || h.created_at || h.timestamp || '',
      dot_color: this.getColor(type),
      badge_class: this.getBadgeClass(type),
    };
  }

  private buildDescription(type: string, h: any): string {
    if (type.includes('reservation') || type.includes('réservation')) return `Séance ${h.seance_id || ''}`.trim();
    if (type.includes('presence') || type.includes('présence')) return 'Marqué présent en séance';
    if (type.includes('annul')) return 'Réservation annulée';
    if (type.includes('abonnement') || type.includes('abo')) return h.abonnement_type || 'Abonnement mis à jour';
    if (type.includes('client') || type.includes('inscription')) return 'Nouveau client inscrit';
    return h.type || h.action || 'Activité enregistrée';
  }

  getColor(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('presence') || t.includes('présence') || t.includes('check')) return '#22c55e';
    if (t.includes('reservation') || t.includes('réservation')) return '#3b82f6';
    if (t.includes('annul')) return '#f87171';
    if (t.includes('client') || t.includes('inscription')) return '#c084fc';
    if (t.includes('abo') || t.includes('abonnement')) return '#fbbf24';
    return '#9ba3c8';
  }

  getBadgeClass(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('presence') || t.includes('présence')) return 'badge--green';
    if (t.includes('reservation') || t.includes('réservation')) return 'badge--blue';
    if (t.includes('annul')) return 'badge--red';
    if (t.includes('client') || t.includes('inscription')) return 'badge--purple';
    if (t.includes('abo') || t.includes('abonnement')) return 'badge--amber';
    return 'badge--neutral';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateStr; }
  }

  formatRelative(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
      if (diffMin < 1) return 'À l\'instant';
      if (diffMin < 60) return `Il y a ${diffMin} min`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `Il y a ${diffH}h`;
      const diffD = Math.floor(diffH / 24);
      return `Il y a ${diffD}j`;
    } catch { return dateStr; }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  setFilter(key: string): void {
    this.activeFilter.set(key);
    this.currentPage.set(1);
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }
}
