import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { Router } from '@angular/router'

@Component({
  selector    : 'app-login',
  standalone  : true,
  imports     : [FormsModule, CommonModule],
  templateUrl : './login.component.html',
  styleUrl    : './login.component.css'
})
export class LoginComponent {

  username = ''
  password = ''
  erreur   = ''
  loading  = false

  constructor(
    private http   : HttpClient,
    private router : Router
  ) {}

  login() {
    this.erreur  = ''
    this.loading = true

    this.http.post('https://ems-w82z.onrender.com/api/users/login/', {
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
        this.loading  = false
        this.erreur   = err.error?.error || 'Erreur de connexion'
      }
    })
  }
  
  
}