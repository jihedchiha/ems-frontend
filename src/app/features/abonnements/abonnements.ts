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
}

export interface ClientOption {
  id         : string
  nom        : string
  prenom     : string
  cin        : string
  telephone_1: string
}

export interface PackMeta {
  key      : PackTypeBackend
  label    : string
  icon     : string
  seances  : number
  prix     : number
  validite : string
  desc     : string
  color    : string
  bgClass  : string
  tagClass : string
  popular ?: boolean
  bestValue?: boolean
}

// ── Pack Form pour création / édition ────────────────────────────
export interface PackFormLocal {
  key    : PackTypeBackend | ''
  label  : string
  icon   : string
  seances: number | null
  prix   : number | null
  validite: string
  desc   : string
}

// ── Remises rapides disponibles ───────────────────────────────────
export const QUICK_DISCOUNTS = [10, 20, 30, 50] as const
export type QuickDiscount = typeof QUICK_DISCOUNTS[number]

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
  userRole     = signal<UserRole>('admin')
  isAdmin      = computed(() => this.userRole() === 'admin')
  canManageAbo = computed(() => this.userRole() === 'admin' || this.userRole() === 'personnel')

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

  // ── Pack Modal State ───────────────────────────────────────────
  showPackModal   = signal<boolean>(false)
  packModalMode   = signal<'add' | 'edit'>('add')
  packForm        : PackFormLocal = this.emptyPackForm()



  toast = signal<{ visible: boolean; message: string; type: 'success' | 'warning' | 'info' }>({
    visible: false, message: '', type: 'success'
  })
  private toastTimer: any

  aboForm: AboFormLocal = this.emptyAboForm()

  readonly QUICK_DISCOUNTS = QUICK_DISCOUNTS

  get searchValue(): string { return this.searchQuery() }
  set searchValue(v: string) { this.searchQuery.set(v) }

  // ── Packs (mutable pour permettre ajout/modif en local) ───────
  packs = signal<PackMeta[]>([
    {
      key: 'essai', label: 'Séance Essai', icon: '🆓',
      seances: 1, prix: 45,
      validite: '7 jours',
      desc    : 'Découverte sans engagement · 1 séance',
      color: '#9ba3c8', bgClass: 'pack-essai', tagClass: 'tag-essai',
    },
    {
      key: 'unique', label: 'Séance Unique', icon: '⚡',
      seances: 1, prix: 60,
      validite: '30 jours',
      desc    : 'Séance à l\'unité · Sans engagement',
      color: '#22d3ee', bgClass: 'pack-unique', tagClass: 'tag-unique',
    },
    {
      key: 'pack5', label: 'Pack Découverte', icon: '🌟',
      seances: 5, prix: 250,
      validite: '2 mois',
      desc    : 'Idéal pour débuter · 5 séances',
      color: '#f59e0b', bgClass: 'pack-5', tagClass: 'tag-5',
    },
    {
      key: 'pack10', label: 'Pack 10', icon: '🔷',
      seances: 10, prix: 550,
      validite: '3 mois',
      desc    : '10 séances · Populaire',
      color: '#c084fc', bgClass: 'pack-10', tagClass: 'tag-10',
      popular: true,
    },
    {
      key: 'pack20', label: 'Pack 20', icon: '💎',
      seances: 20, prix: 920,
      validite: '4 mois',
      desc    : '20 séances · Best seller',
      color: '#3b82f6', bgClass: 'pack-20', tagClass: 'tag-20',
    },
    {
      key: 'pack30', label: 'Pack 30', icon: '💪',
      seances: 30, prix: 1200,
      validite: '5 mois',
      desc    : '30 séances · Meilleure valeur',
      color: '#22c55e', bgClass: 'pack-30', tagClass: 'tag-30',
      bestValue: true,
    },
  ])

  // Gardé en lecture seule pour accès direct dans le template
  get PACKS(): PackMeta[] { return this.packs() }

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

  // Prix final affiché dans le formulaire d'abonnement
  prixAffiche(): number {
    const pack = this.packs().find(p => p.key === this.aboForm.type)
    if (!pack) return 0
    if (this.aboForm.reduction > 0) {
      return Math.round(pack.prix * (1 - this.aboForm.reduction / 100))
    }
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
    this.apiService.getClients(q).subscribe({
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
  )

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
    return this.packs().find(p => p.key === type) ?? this.packs()[0]
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

  // ── Forms vides ────────────────────────────────────────────────
  private emptyAboForm(): AboFormLocal {
    return {
      client_cin     : '',
      type           : 'pack10',
      mode_paiement  : 'cash',
      est_paye       : false,
      date_paiement  : '',
      date_expiration: '',
      reduction      : 0,
    }
  }

  private emptyPackForm(): PackFormLocal {
    return {
      key     : '',
      label   : '',
      icon    : '📦',
      seances : null,
      prix    : null,
      validite: '',
      desc    : '',
    }
  }

  // ── Remise rapide ──────────────────────────────────────────────
  onPackChange(type: PackTypeBackend): void {
    this.aboForm.type      = type
    this.aboForm.reduction = 0
  }

  /** Sélectionne ou désélectionne une remise rapide */
  selectQuickDiscount(pct: QuickDiscount): void {
    if (this.aboForm.reduction === pct) {
      this.aboForm.reduction = 0   // désactiver si déjà sélectionnée
    } else {
      this.aboForm.reduction = pct
    }
  }

  // ── Filtres ────────────────────────────────────────────────────
  setFilter(f: FilterMode): void { this.activeFilter.set(f) }

  // ── Modal Abonnement ───────────────────────────────────────────
  openAddModal(type: PackTypeBackend = 'pack10'): void {
    if (!this.canManageAbo()) {
      this.showToast('Action non autorisée', 'warning')
      return
    }
    this.formError.set('')
    this.modalMode.set('add')
    this.editId.set(null)
    this.aboForm = { ...this.emptyAboForm(), type }
    this.loadClients()
    this.clientSearchQuery = ''
    this.selectedClient = null
    this.showClientDropdown = false
    this.showModal.set(true)
  }

  openEditModal(id: string): void {
    if (!this.canManageAbo()) {
      this.showToast('Action non autorisée', 'warning')
      return
    }
    const abo = this.abonnements().find(a => a.id === id)
    if (!abo) return

    this.formError.set('')
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
    }
    this.showModal.set(true)
  }

  renouvelerAbonnement(id: string): void {
    if (!this.canManageAbo()) {
      this.showToast('Action non autorisée', 'warning')
      return
    }
    const abo = this.abonnements().find(a => a.id === id)
    if (!abo) return

    this.formError.set('')
    this.modalMode.set('add')
    this.editId.set(null)
    this.aboForm = {
      ...this.emptyAboForm(),
      type         : abo.type,
      mode_paiement: abo.mode_paiement || 'cash',
    }
    this.loadClients()
    this.showModal.set(true)
    this.showToast(`Renouvellement pour ${abo.client_nom}`, 'info')
  }

  closeModal(): void { this.showModal.set(false) }

  // ── Modal Pack ─────────────────────────────────────────────────
  openAddPackModal(): void {
    if (!this.isAdmin()) {
      this.showToast('Action réservée à l\'administrateur', 'warning')
      return
    }
  
    this.formError.set(null)
    this.packModalMode.set('add')
    this.packForm = this.emptyPackForm()
    this.showPackModal.set(true)
  }

  openEditPackModal(pack: PackMeta): void {
    if (!this.isAdmin()) {
      this.showToast('Action réservée à l\'administrateur', 'warning')
      return
    }
  
    this.formError.set(null)
    this.packModalMode.set('edit')
    this.packForm = {
      key     : pack.key,
      label   : pack.label,
      icon    : pack.icon,
      seances : pack.seances,
      prix    : pack.prix,
      validite: pack.validite,
      desc    : pack.desc,
    }
    this.showPackModal.set(true)
  }

  closePackModal(): void { this.showPackModal.set(false) }

  savePackForm(): void {
    this.formError.set(null)
    const f = this.packForm
    if (!f.label.trim()) {
      this.formError.set('Veuillez saisir un nom de pack')
      return
    }
    if (!f.seances || f.seances <= 0) {
      this.formError.set('Veuillez saisir un nombre de séances valide')
      return
    }
    if (!f.prix || f.prix <= 0) {
      this.formError.set('Veuillez saisir un prix valide')
      return
    }

    if (this.packModalMode() === 'edit' && f.key) {
      // Mise à jour du pack existant
      this.packs.update(list =>
        list.map(p => p.key === f.key ? {
          ...p,
          label   : f.label.trim(),
          icon    : f.icon || '📦',
          seances : f.seances!,
          prix    : f.prix!,
          validite: f.validite.trim() || p.validite,
          desc    : f.desc.trim() || p.desc,
        } : p)
      )
      this.showToast(`✅ Pack "${f.label}" modifié`, 'success')
    } else {
      // Création d'un nouveau pack — ajouté localement
      // NOTE: en production, envoyer via API puis recharger
      const newPack: PackMeta = {
        key     : (f.label.toLowerCase().replace(/\s+/g, '_')) as PackTypeBackend,
        label   : f.label.trim(),
        icon    : f.icon || '📦',
        seances : f.seances!,
        prix    : f.prix!,
        validite: f.validite.trim() || '3 mois',
        desc    : f.desc.trim() || `${f.seances} séances · ${f.label}`,
        color   : '#a78bfa',
        bgClass : 'pack-custom',
        tagClass: 'tag-custom',
      }
      this.packs.update(list => [...list, newPack])
      this.showToast(`✅ Pack "${newPack.label}" créé`, 'success')
    }

    this.closePackModal()
  }

  // ── Save Abonnement ────────────────────────────────────────────
  saveAbonnement(): void {
    if (this.modalMode() === 'add') {
      this.creerAbonnement()
    } else {
      this.modifierAbonnement()
    }
  }

  formError = signal<string | null>(null)
  
  private creerAbonnement(): void {
  this.formError.set(null)

  if (!this.aboForm.client_cin) {
    this.formError.set('Veuillez sélectionner un client')
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
      this.formError.set(this.extractErrorMessage(err))
    }
  })
}

private extractErrorMessage(err: any): string {
  if (!err?.error) return 'Erreur inconnue'

  if (err.error.error) return err.error.error

  if (err.error.non_field_errors?.length) {
    return err.error.non_field_errors[0]
  }

  const firstKey = Object.keys(err.error)[0]
  if (firstKey && err.error[firstKey]?.length) {
    return err.error[firstKey][0]
  }

  return 'Erreur serveur'
}

  private modifierAbonnement(): void {
  this.formError.set(null)

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
      this.showToast('Abonnement modifié avec succès', 'success')
      this.closeModal()
    },

    error: (err) => {
      this.formError.set(this.extractErrorMessage(err))
    }
  })
}

  // ── Delete ─────────────────────────────────────────────────────
  deleteAbonnement(id: string, clientNom: string): void {
  if (!this.canManageAbo()) {
    this.showToast('Action non autorisée', 'warning')
    return
  }
  if (!confirm( `Supprimer l'abonnement de ${clientNom} ? Cette action est irréversible.`)) return

  this.apiService.deleteAbonnement(id).subscribe({
    next: () => {
      this.abonnements.update(list => list.filter(a => a.id !== id))
      this.showToast(`✅ Abonnement de ${clientNom} supprimé`, 'success')
    },
    error: (err) => {
      const msg = err.error?.error || 'Erreur lors de la suppression'
      this.showToast(`❌ ${msg}`, 'warning')
    }
  })
}

  // ── Toast ──────────────────────────────────────────────────────
 showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {
    clearTimeout(this.toastTimer)
    this.toast.set({ visible: true, message, type })
    this.toastTimer = setTimeout(
      () => this.toast.update(t => ({ ...t, visible: false })),
      3000
    )
  }

  // ── Client search ──────────────────────────────────────────────
  clientSearchQuery  = ''
  showClientDropdown = false
  selectedClient     : ClientOption | null = null

  filteredClients = computed(() => {
    const q = this.clientSearchQuery.toLowerCase().trim()
    if (!q) return this.clientsOptions()
    return this.clientsOptions().filter(c =>
      c.nom.toLowerCase().includes(q) ||
      c.prenom.toLowerCase().includes(q) ||
      c.cin.toLowerCase().includes(q) ||
      (c.telephone_1 || '').includes(q)
    )
  })

  onClientSearch(q: string): void {
    this.clientSearchQuery = q
    this.showClientDropdown = true
    this.selectedClient = null
    this.aboForm.client_cin = ''
    if (q.length >= 2) this.loadClients(q)
  }

  selectClient(c: ClientOption): void {
    this.selectedClient = c
    this.aboForm.client_cin = c.cin
    this.clientSearchQuery = c.prenom + ' ' + c.nom
    this.showClientDropdown = false
  }

  clearClientSearch(): void {
    this.clientSearchQuery = ''
    this.selectedClient = null
    this.aboForm.client_cin = ''
    this.showClientDropdown = false
  }
}