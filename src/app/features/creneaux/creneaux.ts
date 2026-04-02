import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';

export type TailleGilet = 'S' | 'M' | 'L';
export type TypeAppareil = 'i-motion' | 'i-model';

export interface Seance {
  id: string | number;
  date: string;
  heure_debut: string;
  heure_fin: string;
  places_disponibles: number;
  est_complet: boolean;
}

export interface Reservation {
  id: number | string;
  client_nom: string;
  client_cin: string;
  client_telephone: string;
  type_appareil: TypeAppareil;
  statut: 'present' | 'absent' | 'en_attente' | 'annule';
  statut_label: string;
  seance_id: string | number;
  taille_gilet: TailleGilet;
}

export interface Client {
  id: number | string;
  nom: string;
  prenom: string;
  cin: string;
  telephone_1: string;
}

export interface Abonnement {
  id: string;
  type: string;
  statut: string;
  seances_restantes: number;
  peut_reserver: boolean;
}

@Component({
  selector: 'app-creneaux',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './creneaux.html',
  styleUrl: './creneaux.css',
})
export class CreneauxComponent implements OnInit {

  private apiService = inject(ApiService);

  // ── State ──────────────────────────────────────────────────────
  currentDate = signal<Date>(new Date());
  seances = signal<Seance[]>([]);
  reservations = signal<Reservation[]>([]);

  readonly TAILLES_PAR_APPAREIL: Record<TypeAppareil, TailleGilet[]> = {
    'i-motion': ['S', 'M', 'L'],
    'i-model': ['S', 'M', 'L'],
  };

  taillesDisponibles = signal<TailleGilet[]>(['S', 'M', 'L']);

  // ── Selections & Filters ───────────────────────────────────────
  selectedSeanceId = signal<string | number | null>(null);
  seancesFilter = signal<'toutes' | 'disponibles'>('toutes');
  reservationsSearch = signal<string>('');


  get reservationsSearchValue(): string { return this.reservationsSearch(); }
  set reservationsSearchValue(v: string) { this.reservationsSearch.set(v); }

  get modalClientSearchQueryValue(): string { return this.modalClientSearchQuery(); }
  set modalClientSearchQueryValue(v: string) {
    this.modalClientSearchQuery.set(v);
    this.searchSubject.next(v);
  }

  // ── Modal State ────────────────────────────────────────────────
  isModalOpen = signal<boolean>(false);
  modalStep = signal<number>(1);
  modalClientSearchQuery = signal<string>('');
  private searchSubject = new Subject<string>();
  modalClientSearchResults = signal<Client[]>([]);
  isSearchingClient = signal<boolean>(false);
  modalSelectedClient = signal<Client | null>(null);
  modalSelectedAbonnement = signal<Abonnement | null>(null);
  modalSelectedDevice = signal<TypeAppareil | null>(null);
  modalSelectedTaille = signal<TailleGilet>('M');

  // ── Toast ──────────────────────────────────────────────────────
  toastVisible = signal<boolean>(false);
  toastMessage = signal<string>('');
  toastType = signal<'success' | 'warning' | 'info'>('success');
  private toastTimer: any;

  showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {
    clearTimeout(this.toastTimer);
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.toastVisible.set(true);
    this.toastTimer = setTimeout(() => this.toastVisible.set(false), 3000);
  }

  // ── Computed ───────────────────────────────────────────────────
  filteredSeances = computed(() => {
    let list = this.seances();
    if (this.seancesFilter() === 'disponibles') list = list.filter(s => !s.est_complet);
    return list;
  });

  selectedSeance = computed(() =>
    this.seances().find(s => String(s.id) === String(this.selectedSeanceId())) ?? null
  );
  allReservations = computed(() => this.reservations())

  selectedSeanceReservations = computed(() => {
    const sId = this.selectedSeanceId();
    if (!sId) return [];

    return this.allReservations().filter(r =>
      String(r.seance_id ?? (r as any).seance) === String(sId)
    );
  });

  totalSeances = computed(() => this.seances().length);
  totalReservationsActives = computed(() => this.allReservations().length);
  seancesCompletes = computed(() => this.seances().filter(s => s.est_complet).length);
  reservationsEnAttente = computed(() =>
    this.allReservations().filter(r => r.statut === 'en_attente').length
  );
  tauxRemplissage = computed(() => {
    const seances = this.seances();

    if (seances.length === 0) return 0;

    let totalPlaces = 0;
    let totalOccupees = 0;

    seances.forEach(s => {
      const capacite = 3;

      totalPlaces += capacite;

      const reservationsValides = this.reservations().filter(r =>
        String(r.seance_id) === String(s.id) &&
        r.statut !== 'absent' &&
        r.statut !== 'annule'
      );

      totalOccupees += reservationsValides.length;
    });

    return Math.round((totalOccupees / totalPlaces) * 100);
  });

  occupationPercent = computed(() => {
    const s = this.selectedSeance();
    if (!s) return 0;
    return Math.round(((3 - s.places_disponibles) / 3) * 100);
  });

  ringDashArray = signal<string>('125.66');
  ringDashOffset = computed(() => {
    const pct = this.occupationPercent();
    return (125.66 - (125.66 * pct / 100)).toString();
  });

  countTotalSeance = computed(() =>
    this.selectedSeanceReservations().filter(r =>
      r.statut !== 'absent' && r.statut !== 'annule'
    ).length
  );

  countPresent = computed(() =>
    this.selectedSeanceReservations().filter(r => r.statut === 'present').length
  );

  countAbsent = computed(() =>
    this.selectedSeanceReservations().filter(r => r.statut === 'absent').length
  );

  countWaiting = computed(() =>
    this.selectedSeanceReservations().filter(r => r.statut === 'en_attente').length
  );

  quickDays = computed(() => {
    const baseDate = this.currentDate();
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      days.push({
        date: d,
        label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' }),
        isActive: d.toDateString() === baseDate.toDateString()
      });
    }
    return days;
  });

  // ── Init ───────────────────────────────────────────────────────
  ngOnInit(): void {
    console.log("🚀 [INIT] Composant chargé");
    this.loadSeancesForCurrentDate();


    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.trim().length < 2) {
          this.isSearchingClient.set(false);
          return of([]);
        }
        this.isSearchingClient.set(true);
        return this.apiService.getClients(query.trim()).pipe(
          catchError(() => of([]))
        );
      })
    ).subscribe((data: any) => {
      this.isSearchingClient.set(false);
      const results = Array.isArray(data) ? data : (data.results || data.data || []);
      this.modalClientSearchResults.set(results);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────
  formatDateForApi(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  getBarColor(seance: Seance): string {
    const pct = ((3 - seance.places_disponibles) / 3) * 100;
    if (pct === 100) return 'bg-red-500';
    if (pct >= 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  getTailleColor(taille: TailleGilet): string {
    const colors: Record<TailleGilet, string> = {
      'S': '#22d3ee',
      'M': '#3b82f6',
      'L': '#c084fc',
    };
    return colors[taille] || '#ffffff';
  }

  getAppareilColor(appareil: TypeAppareil): string {
    return appareil === 'i-motion' ? '#fbbf24' : '#22d3ee';
  }

  getResStatutLabel(statut: string): string {
    switch (statut.toLowerCase()) {
      case 'present': return 'Présent';
      case 'absent': return 'Absent';
      case 'en_attente': return 'En attente';
      case 'annule': return 'Annulé';
      default: return statut;
    }
  }

  // ── Actions ────────────────────────────────────────────────────
  loadSeancesForCurrentDate(): void {
    const dateStr = this.formatDateForApi(this.currentDate());
    console.log("📅 [LOAD SEANCES] date =", dateStr);
    this.apiService.getSeances(dateStr).subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : (data.results || []);
        const formatted: Seance[] = list.map((s: any) => ({
          id: s.id,
          date: s.date,
          heure_debut: s.heure_debut?.substring(0, 5) || '',
          heure_fin: s.heure_fin?.substring(0, 5) || '',
          places_disponibles: s.places_disponibles,
          est_complet: s.est_complet,
        }));
        this.seances.set(formatted);
        if (formatted.length > 0) {
          const currentId = this.selectedSeanceId();
          const exists = formatted.find(s => String(s.id) === String(currentId));
          if (!currentId || !exists) {
            this.selectSeance(formatted[0].id);
          } else {
            this.loadReservations(currentId);
          }
        } else {
          this.selectedSeanceId.set(null);
          this.reservations.set([]);
        }
      },
      error: err => console.error('Erreur chargement seances', err)

    });
  }

  loadReservations(seanceId: string | number): void {
    console.log("📡 [LOAD] Début chargement des réservations");
    this.apiService.getReservations(seanceId).subscribe({
      next: (data: any) => {
        console.log("✅ [API SUCCESS] Réservations reçues :", data);
        const list = Array.isArray(data) ? data : (data.results || []);
        console.log("📊 [AVANT MAP] =", list);

        const mapped: Reservation[] = list.map((r: any) => ({

          id: r.id,
          client_nom: r.client_nom || '',
          client_cin: r.client_cin || '',
          client_telephone: r.client_telephone || '',
          type_appareil: r.type_appareil,
          statut: r.statut,
          statut_label: this.getResStatutLabel(r.statut),

          // ✅ FIX CRITIQUE ICI
          seance_id: r.seance_id ?? (typeof r.seance === 'object' ? r.seance.id : r.seance) ?? seanceId,

          taille_gilet: r.taille_gilet || 'M',
        }));
        console.log("📌 [SEANCE ID FILTRE] =", seanceId);

        this.reservations.set(mapped);

        console.log('RESERVATIONS LOADED:', mapped);
        console.log("all res ", this.allReservations())
      }
    });
  }


  isSelectedSeance(id: string | number): boolean {
    return String(this.selectedSeanceId()) === String(id);
  }

  selectSeance(id: string | number): void {

    this.selectedSeanceId.set(id);
    this.reservationsSearch.set('');
    this.loadReservations(id);
    console.log("📡 [SELECT SEANCE] id =", id);
  }
  changeReservationStatus(id: string | number, statut: 'present' | 'absent'): void {
    const reservation = this.reservations().find(r => String(r.id) === String(id))
    if (!reservation) return

    const ancienStatut = reservation.statut

    // Vérifier que la transition est valide
    if (ancienStatut === statut) return

    // Mise à jour locale
    this.reservations.update(list =>
      list.map(r =>
        String(r.id) === String(id)
          ? { ...r, statut, statut_label: this.getResStatutLabel(statut) }
          : r
      )
    )

    // Mise à jour places
    this.seances.update(seances =>
      seances.map(s => {
        if (String(s.id) !== String(this.selectedSeanceId())) return s

        let delta = 0

        // en_attente → absent : libère la place
        if (ancienStatut === 'en_attente' && statut === 'absent') delta = +1

        // present → absent : libère la place
        if (ancienStatut === 'present' && statut === 'absent') delta = +1

        // absent → present : reprend une place
        if (ancienStatut === 'absent' && statut === 'present') delta = -1

        // en_attente → present : rien (place déjà prise)
        // present → present : rien

        const nouvelles = Math.max(0, s.places_disponibles + delta)
        return {
          ...s,
          places_disponibles: nouvelles,
          est_complet: nouvelles === 0
        }
      })
    )

    const request = statut === 'present'
      ? this.apiService.marquerPresent(id)
      : this.apiService.marquerAbsent(id)

    request.subscribe({
      next: () => {
        this.showToast(
          statut === 'present' ? '✅ Présent' : '❌ Absent',
          statut === 'present' ? 'success' : 'warning'
        )
        const sId = this.selectedSeanceId()
        if (sId) this.loadReservations(sId)
      },
      error: () => {
        // Rollback
        this.reservations.update(list =>
          list.map(r =>
            String(r.id) === String(id)
              ? { ...r, statut: ancienStatut, statut_label: this.getResStatutLabel(ancienStatut) }
              : r
          )
        )
        this.showToast('❌ Erreur serveur', 'warning')
      }
    })
  }


  cancelReservation(id: string | number): void {
    if (!confirm('Voulez-vous vraiment annuler cette réservation ?')) return

    const reservation = this.reservations().find(r => String(r.id) === String(id))
    if (!reservation) return

    const ancienStatut = reservation.statut

    this.apiService.annulerReservation(id).subscribe({
      next: () => {
        // Mise à jour locale
        this.reservations.update(list =>
          list.map(r =>
            String(r.id) === String(id)
              ? { ...r, statut: 'annule', statut_label: 'Annulé' }
              : r
          )
        )

        // Libérer la place SEULEMENT si en_attente ou present
        // Si absent → place déjà libérée → pas de décrémentation
        if (ancienStatut === 'en_attente' || ancienStatut === 'present') {
          this.seances.update(seances =>
            seances.map(s => {
              if (String(s.id) !== String(this.selectedSeanceId())) return s
              const nouvelles = s.places_disponibles + 1
              return {
                ...s,
                places_disponibles: nouvelles,
                est_complet: false
              }
            })
          )
        }

        this.showToast('🗑 Réservation annulée', 'warning')
        const sId = this.selectedSeanceId()
        if (sId) {
          this.loadReservations(sId)
          this.loadSeancesForCurrentDate()
        }
      },
      error: () => this.showToast('❌ Erreur lors de l\'annulation', 'warning')
    })
  }

  previousDay(): void {
    const d = new Date(this.currentDate());
    d.setDate(d.getDate() - 1);
    this.currentDate.set(d);
    this.loadSeancesForCurrentDate();
  }

  nextDay(): void {
    const d = new Date(this.currentDate());
    d.setDate(d.getDate() + 1);
    this.currentDate.set(d);
    this.loadSeancesForCurrentDate();
  }

  selectQuickDay(date: Date): void {
    this.currentDate.set(date);
    this.loadSeancesForCurrentDate();
  }

  onDateSelected(event: any): void {
    const value = event.target.value;
    if (!value) return;
    const [year, month, day] = value.split('-');
    this.currentDate.set(new Date(Number(year), Number(month) - 1, Number(day)));
    this.loadSeancesForCurrentDate();
  }

  openCalendar(input: HTMLInputElement): void {
    if (input.showPicker) input.showPicker();
    else input.click();
  }

  // ── Modal ──────────────────────────────────────────────────────
  openModal(): void {
    this.isModalOpen.set(true);
    this.modalStep.set(1);
    this.modalClientSearchQuery.set('');
    this.modalSelectedClient.set(null);
    this.modalSelectedAbonnement.set(null);
    this.modalSelectedDevice.set(null);
    this.modalSelectedTaille.set('M');
    this.taillesDisponibles.set(['S', 'M', 'L']);
  }

  closeModal(): void { this.isModalOpen.set(false); }

  nextStep(): void {
    if (this.modalStep() === 1 && !this.modalSelectedClient()) return;
    if (this.modalStep() === 2 && !this.modalSelectedDevice()) return;
    this.modalStep.update(s => s + 1);
  }

  previousStep(): void { this.modalStep.update(s => Math.max(1, s - 1)); }

  selectModalClient(client: Client): void {
    this.modalSelectedClient.set(client);
    this.apiService.getAbonnementActif(client.cin).subscribe({
      next: (abo: any) => {
        const results = Array.isArray(abo) ? abo : (abo.results || [abo]);
        const finalAbo = results[0];
        if (!finalAbo || (!finalAbo.id && !finalAbo.pk)) {
          this.showToast("❌ Aucun abonnement actif", "warning");
          return;
        }
        if (finalAbo.pk && !finalAbo.id) finalAbo.id = finalAbo.pk;
        this.modalSelectedAbonnement.set(finalAbo);
        this.nextStep();
      },
      error: () => this.showToast("❌ Pas d'abonnement actif", "warning")
    });
  }

  selectModalDevice(device: TypeAppareil): void {
    this.modalSelectedDevice.set(device);
    this.taillesDisponibles.set(this.TAILLES_PAR_APPAREIL[device]);
    this.modalSelectedTaille.set('M');
  }

  confirmReservation(): void {
    const seance = this.selectedSeance();
    const client = this.modalSelectedClient();
    const abonnement = this.modalSelectedAbonnement();
    const device = this.modalSelectedDevice();

    if (!seance || !client || !abonnement || !device) {
      this.showToast("❌ Données manquantes", "warning");
      return;
    }

    const payload = {
      seance_id: seance.id,
      abonnement_id: abonnement.id,
      type_appareil: device,
      taille_gilet: this.modalSelectedTaille()
    };

    this.apiService.creerReservation(seance.id, payload).subscribe({
      next: (res: any) => {
        const newRes: Reservation = {
          id: res.id || Date.now(),
          client_nom: `${client.prenom || ''} ${client.nom}`.trim(),
          client_cin: client.cin,
          client_telephone: client.telephone_1 || '',
          type_appareil: device,
          statut: 'en_attente',
          statut_label: 'En attente',
          seance_id: seance.id,
          taille_gilet: this.modalSelectedTaille(),
        };
        this.reservations.update(list => [...list, newRes]);
        this.seances.update(list => list.map(s =>
          String(s.id) === String(seance.id) ? { ...s, places_disponibles: s.places_disponibles - 1, est_complet: s.places_disponibles - 1 === 0 } : s
        ));
        this.closeModal();
        this.showToast("✅ Réservation créée", "success");
        this.loadReservations(seance.id);
      },
      error: (err) => {
        const msg = err.error?.error || 'Erreur lors de la réservation';
        this.showToast(`❌ ${msg}`, 'warning');
      }
    });
  }
}