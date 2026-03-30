import {
  Component, OnInit, signal, computed, inject
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule }  from '@angular/forms'
import { ApiService }   from '../../core/services/api.service'

export type PackTypeBackend = 'essai' | 'unique' | 'pack5' | 'pack10' | 'pack20' | 'pack30'
export type ModePaiement    = 'cash' | 'tpe'
export type AboStatut       = 'actif' | 'expiré' | 'terminé' | 'en_attente'
export type FilterMode      = 'tous' | 'actif' | 'expiré' | 'terminé' | 'essai'
export type ModalMode       = 'add' | 'edit'
export type UserRole        = 'admin' | 'personnel'

export interface AbonnementAPI {
  id                  : string
  client              : string
  client_nom          : string
  type                : PackTypeBackend
  type_label          : string
  reduction           : string
  prix_paye           : string
  mode_paiement       : ModePaiement
  est_paye            : boolean
  date_paiement       : string | null
  seances_total       : number
  seances_restantes   : number
  date_debut          : string
  date_derniere_seance: string | null
  date_expiration     : string | null
  statut              : AboStatut
  created_at          : string
}

export interface AboFormPayload {
  type           : PackTypeBackend
  mode_paiement  : ModePaiement
  est_paye       : boolean
  date_paiement  : string | null
  date_expiration: string | null
  reduction      : number
}

export interface AboFormLocal {
  client_cin     : string
  type           : PackTypeBackend
  mode_paiement  : ModePaiement
  est_paye       : boolean
  date_paiement  : string
  date_expiration: string
  reduction      : number
  useRemise      : boolean
}

export interface ClientOption {
  id         : string
  nom        : string
  prenom     : string
  cin        : string
  telephone_1: string
}

export interface PackMeta {
  key       : PackTypeBackend
  label     : string
  icon      : string
  seances   : number
  prix      : number
  prixRemise: number | null
  hasRemise : boolean
  validite  : string
  desc      : string
  color     : string
  bgClass   : string
  tagClass  : string
  popular  ?: boolean
  bestValue?: boolean
}

@Component({
  selector   : 'app-abonnements',
  standalone : true,
  imports    : [CommonModule, FormsModule],
  templateUrl: './abonnements.html',
  styleUrl   : './abonnements.css',
})
export class AbonnementsComponent implements OnInit {

  private apiService = inject(ApiService)

  // ── Rôle ──────────────────────────────────────────────────────
  userRole = signal<UserRole>('admin')
  isAdmin  = computed(() => this.userRole() === 'admin')

  // ── State ──────────────────────────────────────────────────────
  abonnements      = signal<AbonnementAPI[]>([])
  isLoading        = signal<boolean>(false)
  searchQuery      = signal<string>('')
  activeFilter     = signal<FilterMode>('tous')
  showModal        = signal<boolean>(false)
  modalMode        = signal<ModalMode>('add')
  editId           = signal<string | null>(null)
  clientsOptions   = signal<ClientOption[]>([])
  isLoadingClients = signal<boolean>(false)

  toast = signal<{ visible: boolean; message: string; type: 'success' | 'warning' | 'info' }>({
    visible: false, message: '', type: 'success'
  })
  private toastTimer: any

  aboForm: AboFormLocal = this.emptyForm()

  get searchValue(): string { return this.searchQuery() }
  set searchValue(v: string) { this.searchQuery.set(v) }

  // ── Packs alignés avec le backend ─────────────────────────────
  readonly PACKS: PackMeta[] = [
    {
      key: 'essai', label: 'Séance Essai', icon: '🆓',
      seances: 1, prix: 45, prixRemise: null, hasRemise: false,
      validite: '7 jours',
      desc    : 'Découverte sans engagement · 1 séance',
      color: '#9ba3c8', bgClass: 'pack-essai', tagClass: 'tag-essai',
    },
    {
      key: 'unique', label: 'Séance Unique', icon: '⚡',
      seances: 1, prix: 60, prixRemise: null, hasRemise: false,
      validite: '30 jours',
      desc    : 'Séance à l\'unité · Sans engagement',
      color: '#22d3ee', bgClass: 'pack-unique', tagClass: 'tag-unique',
    },
    {
      key: 'pack5', label: 'Pack Découverte', icon: '🌟',
      seances: 5, prix: 250, prixRemise: null, hasRemise: false,
      validite: '2 mois',
      desc    : 'Idéal pour débuter · 5 séances',
      color: '#f59e0b', bgClass: 'pack-5', tagClass: 'tag-5',
    },
    {
      key: 'pack10', label: 'Pack 10', icon: '🔷',
      seances: 10, prix: 550, prixRemise: 440, hasRemise: true,
      validite: '3 mois',
      desc    : 'Remise ouverture disponible · -20%',
      color: '#c084fc', bgClass: 'pack-10', tagClass: 'tag-10',
      popular: true,
    },
    {
      key: 'pack20', label: 'Pack 20', icon: '💎',
      seances: 20, prix: 920, prixRemise: 730, hasRemise: true,
      validite: '4 mois',
      desc    : 'Remise ouverture disponible · -21%',
      color: '#3b82f6', bgClass: 'pack-20', tagClass: 'tag-20',
    },
    {
      key: 'pack30', label: 'Pack 30', icon: '💪',
      seances: 30, prix: 1150, prixRemise: 960, hasRemise: true,
      validite: '5 mois',
      desc    : 'Remise ouverture disponible · -17%',
      color: '#22c55e', bgClass: 'pack-30', tagClass: 'tag-30',
      bestValue: true,
    },
  ]

  readonly MODES_PAIEMENT = [
    { key: 'cash' as ModePaiement, label: 'Espèces',        icon: '💵' },
    { key: 'tpe'  as ModePaiement, label: 'Carte bancaire', icon: '💳' },
  ]

  // ── Computed ───────────────────────────────────────────────────
  filteredAbonnements = computed(() => {
    let list = this.abonnements()
    const f  = this.activeFilter()
    const q  = this.searchQuery().toLowerCase().trim()

    if (f === 'actif')   list = list.filter(a => a.statut === 'actif')
    if (f === 'expiré')  list = list.filter(a => a.statut === 'expiré')
    if (f === 'terminé') list = list.filter(a => a.statut === 'terminé')
    if (f === 'essai')   list = list.filter(a => a.type   === 'essai')

    if (q) list = list.filter(a =>
      a.client_nom.toLowerCase().includes(q)
    )
    return list
  })

  totalAbonnements = computed(() => this.abonnements().length)
  totalActifs      = computed(() =>
    this.abonnements().filter(a => a.statut === 'actif' && a.type !== 'essai').length
  )
  totalExpirants   = computed(() =>
    this.abonnements().filter(a => a.statut === 'expiré').length
  )
  totalEssais      = computed(() =>
    this.abonnements().filter(a => a.type === 'essai').length
  )

  revenueTotal = computed(() =>
    this.abonnements()
      .filter(a => a.statut !== 'terminé')
      .reduce((sum, a) => sum + parseFloat(a.prix_paye || '0'), 0)
  )

  packCounts = computed(() => {
    const list   = this.abonnements().filter(a => a.statut === 'actif')
    const result = { essai: 0, unique: 0, pack5: 0, pack10: 0, pack20: 0, pack30: 0 }
    list.forEach(a => {
      if (a.type in result) result[a.type as PackTypeBackend]++
    })
    return result
  })

  parseFloat = parseFloat

  prixAffiche(): number {
    const pack = this.PACKS.find(p => p.key === this.aboForm.type)
    if (!pack) return 0
    if (this.aboForm.useRemise && pack.prixRemise !== null) return pack.prixRemise
    return pack.prix
  }

  // ── Init ───────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadAbonnements()
    this.loadRoleFromStorage()
  }

  loadRoleFromStorage(): void {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (user.role === 'admin' || user.role === 'personnel') {
        this.userRole.set(user.role)
      }
    } catch { }
  }

  // ── Charger abonnements ────────────────────────────────────────
  loadAbonnements(): void {
    this.isLoading.set(true)
    let allData: AbonnementAPI[] = []
    let page = 1

    const fetchPage = () => {
      this.apiService.getAllAbonnements(page).subscribe({
        next: (data: any) => {
          const results = data.results || []
          allData = [...allData, ...results]
          if (data.next) {
            page++
            fetchPage()
          } else {
            this.abonnements.set(allData)
            this.isLoading.set(false)
          }
        },
        error: () => {
          this.isLoading.set(false)
          this.showToast('❌ Erreur de chargement', 'warning')
        }
      })
    }

    fetchPage()
  }

  // ── Charger clients ────────────────────────────────────────────
  loadClients(q = ''): void {
    this.isLoadingClients.set(true)
    this.apiService.getClients(q).subscribe({  // ← corrigé
      next: (data: any) => {
        const list = Array.isArray(data) ? data : (data.results || [])
        this.clientsOptions.set(list)
        this.isLoadingClients.set(false)
      },
      error: () => this.isLoadingClients.set(false)
    })
  }
  editTarget = computed(() =>
    this.abonnements().find(a => a.id === this.editId()) ?? null
  );

  // ── Helpers ────────────────────────────────────────────────────
  readonly AVATAR_COLORS = [
    '#3b82f6','#7c3aed','#ec4899',
    '#10b981','#f59e0b','#06b6d4','#ef4444','#8b5cf6'
  ]

  getInitials(nom: string): string {
    return nom.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  }

  getAvatarColor(nom: string): string {
    return this.AVATAR_COLORS[nom.charCodeAt(0) % this.AVATAR_COLORS.length]
  }

  getPackMeta(type: PackTypeBackend): PackMeta {
    return this.PACKS.find(p => p.key === type) ?? this.PACKS[0]
  }

  getProgressPercent(a: AbonnementAPI): number {
    if (a.seances_total === 0) return 0
    return Math.round(((a.seances_total - a.seances_restantes) / a.seances_total) * 100)
  }

  getProgressColor(pct: number): string {
    if (pct >= 90) return '#f87171'
    if (pct >= 70) return '#fbbf24'
    return '#3b82f6'
  }

  getStatutLabel(s: AboStatut): string {
    const map: Record<AboStatut, string> = {
      actif     : 'Actif',
      expiré    : 'Expiré',
      terminé   : 'Terminé',
      en_attente: 'En attente',
    }
    return map[s] ?? s
  }

  getStatutClass(s: AboStatut): string {
    const map: Record<AboStatut, string> = {
      actif     : 'sp-actif',
      expiré    : 'sp-expire',
      terminé   : 'sp-termine',
      en_attente: 'sp-attente',
    }
    return map[s] ?? 'sp-termine'
  }

  getSeancesUtilisees(a: AbonnementAPI): number {
    return a.seances_total - a.seances_restantes
  }

  formatPrice(prix: number | null): string {
    return prix === null ? 'Gratuit' : prix.toLocaleString('fr-FR') + ' DT'
  }

  formatPrixPaye(prix: string): string {
    return parseFloat(prix || '0').toLocaleString('fr-FR') + ' DT'
  }

  getModeLabel(mode: ModePaiement): string {
    return mode === 'cash' ? '💵 Espèces' : '💳 Carte bancaire'
  }

  getReductionDT(a: AbonnementAPI): number {
    const meta = this.getPackMeta(a.type)
    const pct  = parseFloat(a.reduction || '0')
    return Math.round(meta.prix * pct / 100)
  }

  private emptyForm(): AboFormLocal {
    return {
      client_cin     : '',
      type           : 'pack10',
      mode_paiement  : 'cash',
      est_paye       : false,
      date_paiement  : '',
      date_expiration: '',
      reduction      : 0,
      useRemise      : false,
    }
  }

  onPackChange(type: PackTypeBackend): void {
    this.aboForm.type      = type
    this.aboForm.useRemise = false
    this.aboForm.reduction = 0
  }

  onRemiseToggle(): void {
    const pack = this.PACKS.find(p => p.key === this.aboForm.type)
    if (!pack) return
    if (this.aboForm.useRemise && pack.prixRemise !== null) {
      this.aboForm.reduction = Math.round(
        ((pack.prix - pack.prixRemise) / pack.prix) * 100
      )
    } else {
      this.aboForm.reduction = 0
    }
  }

  // ── Filtres ────────────────────────────────────────────────────
  setFilter(f: FilterMode): void { this.activeFilter.set(f) }

  // ── Modal ──────────────────────────────────────────────────────
  openAddModal(type: PackTypeBackend = 'pack10'): void {
    if (!this.isAdmin()) {
      this.showToast('Action réservée à l\'administrateur', 'warning')
      return
    }
    this.modalMode.set('add')
    this.editId.set(null)
    this.aboForm = { ...this.emptyForm(), type }
    this.loadClients()
    this.showModal.set(true)
  }

  openEditModal(id: string): void {
    if (!this.isAdmin()) {
      this.showToast('Action réservée à l\'administrateur', 'warning')
      return
    }
    const abo = this.abonnements().find(a => a.id === id)
    if (!abo) return

    this.modalMode.set('edit')
    this.editId.set(id)
    this.aboForm = {
      client_cin     : '',
      type           : abo.type,
      mode_paiement  : abo.mode_paiement || 'cash',
      est_paye       : abo.est_paye,
      date_paiement  : abo.date_paiement   || '',
      date_expiration: abo.date_expiration || '',
      reduction      : parseFloat(abo.reduction || '0'),
      useRemise      : parseFloat(abo.reduction || '0') > 0,
    }
    this.showModal.set(true)
  }

  renouvelerAbonnement(id: string): void {
    if (!this.isAdmin()) {
      this.showToast('Action réservée à l\'administrateur', 'warning')
      return
    }
    const abo = this.abonnements().find(a => a.id === id)
    if (!abo) return

    this.modalMode.set('add')
    this.editId.set(null)
    this.aboForm = {
      ...this.emptyForm(),
      type         : abo.type,
      mode_paiement: abo.mode_paiement || 'cash',
    }
    this.loadClients()
    this.showModal.set(true)
    this.showToast(`Renouvellement pour ${abo.client_nom}`, 'info')
  }

  closeModal(): void { this.showModal.set(false) }

  // ── Save ───────────────────────────────────────────────────────
  saveAbonnement(): void {
    if (this.modalMode() === 'add') {
      this.creerAbonnement()
    } else {
      this.modifierAbonnement()
    }
  }

  private creerAbonnement(): void {
    if (!this.aboForm.client_cin) {
      this.showToast('Veuillez sélectionner un client', 'warning')
      return
    }

    const payload: AboFormPayload = {
      type           : this.aboForm.type,
      mode_paiement  : this.aboForm.mode_paiement,
      est_paye       : this.aboForm.est_paye,
      date_paiement  : this.aboForm.date_paiement   || null,
      date_expiration: this.aboForm.date_expiration || null,
      reduction      : this.aboForm.reduction,
    }

    this.apiService.createAbonnement(this.aboForm.client_cin, payload).subscribe({
      next: (abo: any) => {
        this.loadAbonnements()
        this.showToast(
          `Abonnement ${this.getPackMeta(abo.type).label} créé`,
          'success'
        )
        this.closeModal()
      },
      error: (err) => {
        const msg = err.error?.error ||
                    err.error?.non_field_errors?.[0] ||
                    'Erreur lors de la création'
        this.showToast(`❌ ${msg}`, 'warning')
      }
    })
  }

  private modifierAbonnement(): void {
    const id = this.editId()
    if (!id) return

    const payload: Partial<AboFormPayload> = {
      mode_paiement  : this.aboForm.mode_paiement,
      est_paye       : this.aboForm.est_paye,
      date_paiement  : this.aboForm.date_paiement   || null,
      date_expiration: this.aboForm.date_expiration || null,
      reduction      : this.aboForm.reduction,
    }

    this.apiService.modifierAbonnement(id, payload).subscribe({
      next: () => {
        this.loadAbonnements()
        this.showToast('✅ Abonnement modifié', 'success')
        this.closeModal()
      },
      error: (err) => {
        const msg = err.error?.error || 'Erreur lors de la modification'
        this.showToast(`❌ ${msg}`, 'warning')
      }
    })
  }

  // ── Delete ─────────────────────────────────────────────────────
  

  // ── Toast ──────────────────────────────────────────────────────
  showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {
    clearTimeout(this.toastTimer)
    this.toast.set({ visible: true, message, type })
    this.toastTimer = setTimeout(
      () => this.toast.update(t => ({ ...t, visible: false })),
      3000
    )
  }
}