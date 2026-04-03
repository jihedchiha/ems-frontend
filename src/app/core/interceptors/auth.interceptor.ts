// src/app/core/interceptors/auth.interceptor.ts
// ══════════════════════════════════════════════════════════════════
// Intercepteur JWT — ajoute automatiquement le token Bearer
// à TOUTES les requêtes HTTP sauf les endpoints publics
// ══════════════════════════════════════════════════════════════════

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

// ── URLs publiques qui ne nécessitent PAS de token JWT ───────────
const PUBLIC_URLS = [
  '/users/login/',
  '/users/forgot-password/',
  '/users/reset-password/',
];

function isPublicUrl(url: string): boolean {
  return PUBLIC_URLS.some(pub => url.includes(pub));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // ── Endpoints publics : passer sans token ni gestion 401 ────────
  if (isPublicUrl(req.url)) {
    return next(req);
  }

  // ── Récupérer le token ───────────────────────────────────────────
  const token = localStorage.getItem('access');

  // ── Cloner la requête avec Authorization ────────────────────────
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  // ── Envoyer et intercepter les erreurs 401 ───────────────────────
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Token expiré ou invalide → rediriger vers login
        console.warn('Token invalide ou expiré — redirection login');
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('user');
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};