import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { PersonnelDashboardComponent } from './personnel-dashboard/personnel-dashboard.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, AdminDashboardComponent, PersonnelDashboardComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  userRole: string = '';

  ngOnInit(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.userRole = user.role || '';
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
      }
    }
  }

  mockLogin(role: string) {
    localStorage.setItem('user', JSON.stringify({ id: 1, role: role }));
    this.userRole = role;
  }
}
