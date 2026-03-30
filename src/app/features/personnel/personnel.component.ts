import { Component, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type Role = 'admin' | 'receptionniste';

export type Permission =
  | 'dashboard' | 'creneaux' | 'clients'
  | 'abonnements' | 'ventes' | 'rapports'
  | 'personnel' | 'parametres';

export interface StaffMember {
  id:           number;
  prenom:       string;
  nom:          string;
  email:        string;
  telephone:    string;
  role:         Role;
  permissions:  Permission[];
  actif:        boolean;
  date_creation: string;
  avatar_color: string;
}

export interface StaffForm {
  prenom:      string;
  nom:         string;
  email:       string;
  telephone:   string;
  role:        Role;
  permissions: Permission[];
  password:    string;
  password2:   string;
}

export interface ToastState {
  visible: boolean;
  message: string;
  type:    'success' | 'warning' | 'info';
}

@Component({
  selector: 'app-personnel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personnel.component.html',
  styleUrl: './personnel.component.css'
})
export class PersonnelComponent implements OnInit {
  
  allPermissions: { id: Permission, label: string }[] = [
    { id: 'dashboard',    label: '📊 Dashboard'    },
    { id: 'creneaux',     label: '📅 Créneaux'     },
    { id: 'clients',      label: '👥 Clients'      },
    { id: 'abonnements',  label: '🎟️ Abonnements'  },
    { id: 'ventes',       label: '💰 Ventes'       },
    { id: 'rapports',     label: '📈 Rapports'     },
    { id: 'personnel',    label: '👤 Personnel'    },
    { id: 'parametres',   label: '⚙️ Paramètres'  },
  ];

  staff = signal<StaffMember[]>([
    {
      id: 1, prenom: 'Sarah', nom: 'Admin',
      email: 'sarah@pulselab.tn', telephone: '+216 22 100 100',
      role: 'admin',
      permissions: ['dashboard','creneaux','clients','abonnements','ventes','rapports','personnel','parametres'],
      actif: true, date_creation: 'Jan 2025', avatar_color: '#3b82f6'
    },
    {
      id: 2, prenom: 'Mohamed', nom: 'Gharbi',
      email: 'm.gharbi@pulselab.tn', telephone: '+216 55 200 200',
      role: 'receptionniste',
      permissions: ['dashboard','creneaux','clients','abonnements','ventes'],
      actif: true, date_creation: 'Mar 2025', avatar_color: '#10b981'
    },
    {
      id: 3, prenom: 'Lina', nom: 'Trabelsi',
      email: 'l.trabelsi@pulselab.tn', telephone: '+216 99 300 300',
      role: 'receptionniste',
      permissions: ['dashboard','creneaux','clients','abonnements','ventes'],
      actif: true, date_creation: 'Mai 2025', avatar_color: '#7c3aed'
    },
    {
      id: 4, prenom: 'Karim', nom: 'Belhaj',
      email: 'k.belhaj@pulselab.tn', telephone: '+216 23 400 400',
      role: 'receptionniste',
      permissions: ['dashboard','creneaux','clients'],
      actif: true, date_creation: 'Août 2025', avatar_color: '#f59e0b'
    },
    {
      id: 5, prenom: 'Nour', nom: 'Hamdi',
      email: 'n.hamdi@pulselab.tn', telephone: '+216 50 500 500',
      role: 'receptionniste',
      permissions: ['dashboard','creneaux','clients','abonnements','ventes'],
      actif: false, date_creation: 'Nov 2025', avatar_color: '#ef4444'
    },
  ]);

  searchQuery = signal<string>('');
  activeFilter = signal<string>('tous');
  showModal = signal<boolean>(false);
  modalMode = signal<'add' | 'edit'>('add');
  editId = signal<number | null>(null);
  toast = signal<ToastState>({ visible: false, message: '', type: 'info' });
  
  form: StaffForm = this.getEmptyForm();
  toastTimer: any;

  // Computed
  filteredStaff = computed(() => {
    let list = this.staff();
    const q = this.searchQuery().toLowerCase();
    
    if (q) {
      list = list.filter(m => 
        m.prenom.toLowerCase().includes(q) || 
        m.nom.toLowerCase().includes(q) || 
        m.email.toLowerCase().includes(q)
      );
    }
    
    const filter = this.activeFilter();
    if (filter === 'admin') list = list.filter(m => m.role === 'admin');
    if (filter === 'receptionniste') list = list.filter(m => m.role === 'receptionniste');
    if (filter === 'actifs') list = list.filter(m => m.actif);
    if (filter === 'inactifs') list = list.filter(m => !m.actif);
    
    return list;
  });

  totalActifs = computed(() => this.staff().filter(m => m.actif).length);
  totalInactifs = computed(() => this.staff().filter(m => !m.actif).length);
  editTarget = computed(() => this.staff().find(m => m.id === this.editId()) || null);

  ngOnInit() {}

  getEmptyForm(): StaffForm {
    return {
      prenom: '', nom: '', email: '', telephone: '',
      role: 'receptionniste',
      permissions: ['dashboard','creneaux','clients','abonnements','ventes'],
      password: '', password2: ''
    };
  }

  openAddModal() {
    this.modalMode.set('add');
    this.editId.set(null);
    this.form = this.getEmptyForm();
    this.showModal.set(true);
  }

  openEditModal(id: number) {
    const member = this.staff().find(m => m.id === id);
    if (member) {
      this.modalMode.set('edit');
      this.editId.set(id);
      this.form = {
        prenom: member.prenom,
        nom: member.nom,
        email: member.email,
        telephone: member.telephone,
        role: member.role,
        permissions: [...member.permissions],
        password: '',
        password2: ''
      };
      this.showModal.set(true);
    }
  }

  closeModal() {
    this.showModal.set(false);
  }

  saveStaff() {
    if (!this.form.prenom || !this.form.nom || !this.form.email) {
      this.showToast('Veuillez remplir les champs obligatoires.', 'warning');
      return;
    }
    if (this.modalMode() === 'add') {
      if (!this.form.password || this.form.password !== this.form.password2) {
        this.showToast('Les mots de passe ne correspondent pas.', 'warning');
        return;
      }
    }

    if (this.modalMode() === 'add') {
      const colors = ['#3b82f6', '#10b981', '#7c3aed', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const newId = Math.max(0, ...this.staff().map(s => s.id)) + 1;
      const newMember: StaffMember = {
        id: newId,
        prenom: this.form.prenom,
        nom: this.form.nom,
        email: this.form.email,
        telephone: this.form.telephone,
        role: this.form.role,
        permissions: [...this.form.permissions],
        actif: true,
        date_creation: new Date().toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        avatar_color: randomColor
      };
      this.staff.update(list => [...list, newMember]);
      this.showToast('Compte créé avec succès', 'success');
    } else {
      const id = this.editId();
      if (id === 1 && this.form.role !== 'admin') {
         this.showToast('L\'admin principal doit rester admin.', 'warning');
         return;
      }
      this.staff.update(list => list.map(m => {
        if (m.id === id) {
          return {
            ...m,
            prenom: this.form.prenom,
            nom: this.form.nom,
            email: this.form.email,
            telephone: this.form.telephone,
            role: this.form.role,
            permissions: [...this.form.permissions]
          };
        }
        return m;
      }));
      this.showToast('Modifications enregistrées', 'success');
    }
    this.closeModal();
  }

  deleteStaff(id: number) {
    if (id === 1) {
      this.showToast('Impossible de supprimer l\'admin principal!', 'warning');
      return;
    }
    this.staff.update(list => list.filter(m => m.id !== id));
    this.showToast('Membre supprimé', 'success');
    this.closeModal();
  }

  toggleActif(id: number) {
    if (id === 1) {
      this.showToast('Impossible de désactiver l\'admin principal!', 'warning');
      return;
    }
    this.staff.update(list => list.map(m => {
      if (m.id === id) {
        const newStatus = !m.actif;
        this.showToast(newStatus ? 'Compte activé' : 'Compte désactivé', 'info');
        return { ...m, actif: newStatus };
      }
      return m;
    }));
  }

  resetPassword(id: number) {
    const pwd = this.generatePassword();
    this.showToast(`Nouveau mot de passe : ${pwd}`, 'info');
  }

  setFilter(f: string) {
    this.activeFilter.set(f);
  }

  selectRole(role: Role) {
    this.form.role = role;
    if (role === 'admin') {
      this.form.permissions = this.allPermissions.map(p => p.id);
    } else {
      this.form.permissions = ['dashboard', 'creneaux', 'clients', 'abonnements', 'ventes'];
    }
  }

  togglePermission(perm: Permission) {
    if (this.form.role === 'admin') return;
    
    const index = this.form.permissions.indexOf(perm);
    if (index > -1) {
      this.form.permissions.splice(index, 1);
    } else {
      this.form.permissions.push(perm);
    }
  }

  generatePassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pwd = '';
    pwd += '!';
    pwd += '1';
    for (let i = 0; i < 6; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd.split('').sort(() => 0.5 - Math.random()).join('');
  }

  getInitials(member: StaffMember): string {
    return `${member.prenom.charAt(0)}${member.nom.charAt(0)}`.toUpperCase();
  }

  getRoleMeta(role: Role): { label: string, icon: string, class: string } {
    if (role === 'admin') return { label: 'Admin', icon: '👑', class: 'role-admin' };
    return { label: 'Réceptionniste', icon: '📋', class: 'role-receptionniste' };
  }

  showToast(message: string, type: 'success' | 'warning' | 'info'): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ visible: true, message, type });
    this.toastTimer = setTimeout(
      () => this.toast.update(t => ({ ...t, visible: false })),
      3000
    );
  }
}
