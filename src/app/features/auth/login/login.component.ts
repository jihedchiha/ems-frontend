import { Component, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { Router } from '@angular/router'

type LoginView = 'login' | 'forgot' | 'reset'

@Component({
  selector    : 'app-login',
  standalone  : true,
  imports     : [FormsModule, CommonModule],
  templateUrl : './login.component.html',
  styleUrl    : './login.component.css'
})
export class LoginComponent {

  readonly BASE = 'https://ems-service-ndb1.onrender.com/api'

  // ── State général ────────────────────────────────────────────────
  view    = signal<LoginView>('login')
  loading = signal<boolean>(false)
  erreur  = signal<string>('')
  succes  = signal<string>('')

  // ── Login ────────────────────────────────────────────────────────
  username = ''
  password = ''

  // ── Mot de passe oublié ─────────────────────────────────────────
  forgotEmail = ''

  // ── Réinitialiser mot de passe ──────────────────────────────────
  resetToken       = ''
  resetNew         = ''
  resetConfirm     = ''

  constructor(
    private http   : HttpClient,
    private router : Router
  ) {}

  // ── Navigation entre vues ────────────────────────────────────────
  goTo(v: LoginView): void {
    this.view.set(v)
    this.erreur.set('')
    this.succes.set('')
  }

  // ══════════════════════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════════════════════
  login(): void {
    if (!this.username || !this.password) {
      this.erreur.set('Veuillez remplir tous les champs.')
      return
    }
    this.erreur.set('')
    this.loading.set(true)

    this.http.post(`${this.BASE}/users/login/`, {
      username : this.username,
      password : this.password
    }).subscribe({
      next: (response: any) => {
        localStorage.setItem('access',  response.access)
        localStorage.setItem('refresh', response.refresh)
        localStorage.setItem('user',    JSON.stringify(response.user))
        if (response.user.role === 'admin') {
          this.router.navigate(['/dashboard'])
        } else {
          this.router.navigate(['/clients'])
        }
      },
      error: (err) => {
        this.loading.set(false)
        this.erreur.set(err.error?.error || err.error?.detail || 'Identifiants incorrects')
      }
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // MOT DE PASSE OUBLIÉ — envoyer le token par email
  // ══════════════════════════════════════════════════════════════════
  sendForgot(): void {
    if (!this.forgotEmail.trim()) {
      this.erreur.set('Veuillez saisir votre adresse email.')
      return
    }
    this.erreur.set('')
    this.succes.set('')
    this.loading.set(true)

    this.http.post(`${this.BASE}/users/forgot-password/`, {
      email: this.forgotEmail.trim()
    }).subscribe({
      next: (res: any) => {
        this.loading.set(false)
        this.succes.set(res?.message || 'Token envoyé ! Vérifiez votre email.')
        // Passer automatiquement à la vue reset après 2s
        setTimeout(() => this.goTo('reset'), 2000)
      },
      error: (err) => {
        this.loading.set(false)
        const msg = this.extractError(err,
          'Fonctionnalité non disponible — contactez l\'administrateur.')
        this.erreur.set(msg)
      }
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // RÉINITIALISER MOT DE PASSE avec token
  // ══════════════════════════════════════════════════════════════════
  resetPassword(): void {
    this.erreur.set('')

    if (!this.resetToken.trim()) {
      this.erreur.set('Veuillez saisir le token reçu par email.')
      return
    }
    if (!this.resetNew || this.resetNew.length < 6) {
      this.erreur.set('Le nouveau mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (this.resetNew !== this.resetConfirm) {
      this.erreur.set('Les mots de passe ne correspondent pas.')
      return
    }

    this.loading.set(true)

    this.http.post(`${this.BASE}/users/reset-password/`, {
      token        : this.resetToken.trim(),
      new_password : this.resetNew
    }).subscribe({
      next: (res: any) => {
        this.loading.set(false)
        this.succes.set(res?.message || 'Mot de passe réinitialisé avec succès !')
        setTimeout(() => this.goTo('login'), 2000)
      },
      error: (err) => {
        this.loading.set(false)
        this.erreur.set(this.extractError(err, 'Token invalide ou expiré.'))
      }
    })
  }

  // ── Extraction sécurisée du message d'erreur ─────────────────────
  private extractError(err: any, fallback: string): string {
    try {
      if (!err) return fallback
      // Réponse JSON avec message d'erreur
      if (typeof err.error === 'object' && err.error !== null) {
        return err.error.error
            || err.error.detail
            || err.error.message
            || err.error.email?.[0]
            || err.error.non_field_errors?.[0]
            || fallback
      }
      // Erreur réseau (pas de connexion)
      if (err.status === 0) return 'Impossible de joindre le serveur.'
      // Backend non implémenté
      if (err.status === 404) return 'Fonctionnalité non disponible — contactez l\'administrateur.'
      if (err.status === 500) return 'Erreur serveur — réessayez plus tard.'
      return fallback
    } catch {
      return fallback
    }
  }


  /** Force visuelle du mot de passe (0-3) */
  get pwdStrength(): number {
    const p = this.resetNew
    if (!p) return 0
    if (p.length >= 12) return 3
    if (p.length >= 8)  return 2
    return 1
  }
  get pwdStrengthLabel(): string {
    return ['', 'Faible', 'Moyen', 'Fort'][this.pwdStrength]
  }
  get pwdStrengthColor(): string {
    return ['', '#ff6b6b', '#fbbf24', '#22d47c'][this.pwdStrength]
  }
}