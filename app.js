/**
 * ============================================================================
 * MEDICORE HOSPITAL MANAGEMENT SYSTEM - FRONTEND CLIENT CONTROLLER (app.js)
 * ============================================================================
 * Handles asynchronous REST API interaction, role-based view switching,
 * form validation, dynamic DOM table updates, and modal management.
 */

// API Base URL (Relative for same-origin or configured for localhost C++ backend)
const API_BASE_URL = window.location.origin.includes('http') 
  ? window.location.origin 
  : 'http://localhost:8080';

// Global Application State
const AppState = {
  currentUser: null,
  currentView: 'dashboard',
  patients: [],
  appointments: [],
  doctors: [],
  activeStatusFilter: 'all',
  searchQuery: ''
};

// ============================================================================
// INITIALIZATION & EVENT LISTENERS
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initAuth();
  initNavigation();
  initModals();
  initFormHandlers();
  initDemoChips();
  initSearchAndFilters();
  
  // Check for existing session in localStorage
  const savedUser = localStorage.getItem('medicore_user');
  if (savedUser) {
    try {
      AppState.currentUser = JSON.parse(savedUser);
      activateUserSession(AppState.currentUser);
    } catch (e) {
      localStorage.removeItem('medicore_user');
    }
  }
});

/**
 * Clock ticker in topbar
 */
function initClock() {
  const clockEl = document.getElementById('currentClockDisplay');
  const update = () => {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = now.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }
  };
  update();
  setInterval(update, 30000);
}

// ============================================================================
// ASYNCHRONOUS BACKEND API CLIENT (Fetch API Wrapper)
// ============================================================================
async function apiRequest(endpoint, method = 'GET', data = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (AppState.currentUser && AppState.currentUser.token) {
    headers['Authorization'] = `Bearer ${AppState.currentUser.token}`;
  }

  const options = { method, headers };
  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    let jsonResult = {};
    if (contentType && contentType.includes('application/json')) {
      jsonResult = await response.json();
    } else {
      const text = await response.text();
      try { jsonResult = JSON.parse(text); } catch (_) { jsonResult = { raw: text }; }
    }

    if (!response.ok) {
      throw new Error(jsonResult.message || `API Error: ${response.status} ${response.statusText}`);
    }

    // Update backend ping indicator
    const pingEl = document.getElementById('backendPing');
    if (pingEl) pingEl.textContent = 'Active • 200 OK';

    return jsonResult;
  } catch (error) {
    console.error(`Request failed [${method} ${endpoint}]:`, error);
    showToast(error.message || 'Network error communicating with C++ backend', 'error');
    throw error;
  }
}

// ============================================================================
// AUTHENTICATION MODULE (Login / Logout / Role Scoping)
// ============================================================================
function initAuth() {
  const loginForm = document.getElementById('loginForm');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const passwordInput = document.getElementById('passwordInput');
  const logoutBtn = document.getElementById('logoutBtn');

  // Password visibility toggle
  togglePasswordBtn?.addEventListener('click', () => {
    const isPass = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPass ? 'text' : 'password');
    togglePasswordBtn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
  });

  // Handle Login Submit
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('usernameInput').value.trim();
    const password = passwordInput.value.trim();
    const role = document.getElementById('roleSelect').value;

    if (!username) {
      showFieldError('usernameInput', 'Username is required');
      return;
    }
    if (!password) {
      showFieldError('passwordInput', 'Password is required');
      return;
    }

    clearFieldErrors();
    const submitBtn = document.getElementById('loginSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';

    try {
      const response = await apiRequest('/api/login', 'POST', {
        username,
        password,
        role
      });

      if (response && response.success) {
        AppState.currentUser = response.user;
        localStorage.setItem('medicore_user', JSON.stringify(AppState.currentUser));
        showToast(`Welcome back, ${AppState.currentUser.fullName}!`, 'success');
        activateUserSession(AppState.currentUser);
      } else {
        showToast(response.message || 'Invalid credentials', 'error');
      }
    } catch (err) {
      // Handled in apiRequest
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Sign In to Portal</span> <i class="fa-solid fa-arrow-right"></i>';
    }
  });

  // Handle Logout
  logoutBtn?.addEventListener('click', () => {
    AppState.currentUser = null;
    localStorage.removeItem('medicore_user');
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('authOverlay').classList.add('active');
    document.getElementById('loginForm').reset();
    showToast('You have been logged out successfully.', 'info');
  });
}

/**
 * Configure demo account quick-fill buttons
 */
function initDemoChips() {
  document.querySelectorAll('.demo-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const role = chip.getAttribute('data-role');
      const userInput = document.getElementById('usernameInput');
      const passInput = document.getElementById('passwordInput');
      const roleSelect = document.getElementById('roleSelect');

      if (role === 'admin') {
        userInput.value = 'admin';
        passInput.value = 'admin123';
        roleSelect.value = 'admin';
      } else if (role === 'doctor') {
        userInput.value = 'dr.smith';
        passInput.value = 'doc123';
        roleSelect.value = 'doctor';
      } else if (role === 'patient') {
        userInput.value = 'john.doe';
        passInput.value = 'pat123';
        roleSelect.value = 'patient';
      }
      clearFieldErrors();
    });
  });
}

/**
 * Transition from login overlay to main dashboard workspace with role permissions
 */
function activateUserSession(user) {
  document.getElementById('authOverlay').classList.remove('active');
  document.getElementById('appContainer').style.display = 'flex';

  // Update User Identity UI
  const roleName = user.role.toUpperCase();
  document.getElementById('sidebarUserName').textContent = user.fullName || user.username;
  
  const roleBadge = document.getElementById('sidebarUserRole');
  roleBadge.textContent = roleName;
  roleBadge.className = `user-role-badge badge-${user.role.toLowerCase()}`;

  // Avatar Initials
  const initials = (user.fullName || user.username)
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  document.getElementById('sidebarAvatar').textContent = initials;

  // Filter sidebar items according to authenticated role
  applyRoleAccessPermissions(user.role.toLowerCase());

  // Set default view depending on role
  if (user.role.toLowerCase() === 'doctor') {
    switchView('doctor-portal');
  } else if (user.role.toLowerCase() === 'patient') {
    switchView('patient-portal');
  } else {
    switchView('dashboard');
  }

  // Load backend master datasets
  loadInitialData();
}

/**
 * Show / hide navigation options according to role permissions
 */
function applyRoleAccessPermissions(role) {
  const scopedNavItems = document.querySelectorAll('.nav-item.role-scoped');
  scopedNavItems.forEach(item => {
    const accessRoles = (item.getAttribute('data-access') || '').split(',');
    if (accessRoles.includes(role)) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });

  // Topbar quick action button adaptation
  const actionBtn = document.getElementById('topbarQuickActionBtn');
  const actionLabel = document.getElementById('topbarActionLabel');

  if (role === 'patient') {
    actionLabel.textContent = 'Book Appointment';
    actionBtn.onclick = () => openBookAppointmentModal();
  } else if (role === 'doctor') {
    actionLabel.textContent = 'My Consultations';
    actionBtn.onclick = () => switchView('doctor-portal');
  } else {
    actionLabel.textContent = '+ New Patient';
    actionBtn.onclick = () => openRegisterPatientModal();
  }
}

// ============================================================================
// NAVIGATION & VIEW SWITCHER
// ============================================================================
function initNavigation() {
  // Sidebar Links
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = link.getAttribute('data-view');
      if (targetView) {
        switchView(targetView);
        // Mobile sidebar close
        document.getElementById('appSidebar').classList.remove('open');
      }
    });
  });

  // View switch triggers (buttons with data-view-target)
  document.addEventListener('click', (e) => {
    const targetBtn = e.target.closest('[data-view-target]');
    if (targetBtn) {
      const view = targetBtn.getAttribute('data-view-target');
      switchView(view);
    }
  });

  // Mobile drawer toggles
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const closeBtn = document.getElementById('sidebarCloseBtn');
  const sidebar = document.getElementById('appSidebar');

  toggleBtn?.addEventListener('click', () => sidebar.classList.add('open'));
  closeBtn?.addEventListener('click', () => sidebar.classList.remove('open'));

  // Dashboard quick banner buttons
  document.getElementById('dashRegisterPatientBtn')?.addEventListener('click', () => openRegisterPatientModal());
  document.getElementById('dashBookApptBtn')?.addEventListener('click', () => openBookAppointmentModal());
  document.getElementById('patientBookSelfBtn')?.addEventListener('click', () => openBookAppointmentModal());
}

/**
 * Switch active viewport panel
 */
function switchView(viewName) {
  AppState.currentView = viewName;

  // Update Nav links active state
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    if (link.getAttribute('data-view') === viewName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Toggle View Panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const activePanel = document.getElementById(`view-${viewName}`);
  if (activePanel) {
    activePanel.classList.add('active');
  }

  // Update Page Title and Breadcrumb
  const pageTitle = document.getElementById('pageTitle');
  const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');

  const titles = {
    'dashboard': 'Dashboard Overview',
    'patients': 'Patients Directory & EMR',
    'appointments': 'Outpatient Appointments',
    'doctor-portal': 'Doctor Clinic Workspace',
    'patient-portal': 'My Medical Records'
  };

  const currentTitle = titles[viewName] || 'MediCore HMS';
  if (pageTitle) pageTitle.textContent = currentTitle;
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = currentTitle;

  // View-specific data refreshes
  if (viewName === 'dashboard') {
    renderDashboardStats();
    renderRecentAppointments();
  } else if (viewName === 'patients') {
    renderPatientsTable();
  } else if (viewName === 'appointments') {
    renderAppointmentsTable();
  } else if (viewName === 'doctor-portal') {
    renderDoctorPortalView();
  } else if (viewName === 'patient-portal') {
    renderPatientPortalView();
  }
}

// ============================================================================
// DATA LOADING & DOM RENDERING
// ============================================================================

/**
 * Loads patients, doctors, and appointments from C++ REST endpoints
 */
async function loadInitialData() {
  try {
    // 1. Fetch Doctors
    const docsRes = await apiRequest('/api/doctors');
    if (docsRes && docsRes.doctors) {
      AppState.doctors = docsRes.doctors;
      populateDoctorSelectDropdowns();
    }

    // 2. Fetch Patients
    const patientsRes = await apiRequest('/api/patients');
    if (patientsRes && patientsRes.patients) {
      AppState.patients = patientsRes.patients;
      populatePatientSelectDropdowns();
    }

    // 3. Fetch Appointments
    const apptsRes = await apiRequest('/api/appointments');
    if (apptsRes && apptsRes.appointments) {
      AppState.appointments = apptsRes.appointments;
    }

    // Render active view
    switchView(AppState.currentView);
  } catch (err) {
    console.error('Failed to load initial dataset from server:', err);
  }
}

/**
 * Render Dashboard statistics cards
 */
async function renderDashboardStats() {
  try {
    const stats = await apiRequest('/api/stats');
    if (stats) {
      document.getElementById('statTotalPatients').textContent = stats.totalPatients ?? AppState.patients.length;
      document.getElementById('statTotalAppointments').textContent = stats.totalAppointments ?? AppState.appointments.length;
      document.getElementById('statCompletedAppointments').textContent = stats.completedAppointments ?? 
        AppState.appointments.filter(a => a.status === 'Completed').length;
      document.getElementById('statTotalDoctors').textContent = stats.totalDoctors ?? AppState.doctors.length;
    }
  } catch (e) {
    // Fallback to local state calculation if stats endpoint is unavailable
    document.getElementById('statTotalPatients').textContent = AppState.patients.length;
    document.getElementById('statTotalAppointments').textContent = AppState.appointments.length;
    document.getElementById('statCompletedAppointments').textContent = 
      AppState.appointments.filter(a => a.status === 'Completed').length;
    document.getElementById('statTotalDoctors').textContent = AppState.doctors.length;
  }
}

/**
 * Render recent appointments in dashboard preview
 */
function renderRecentAppointments() {
  const tbody = document.getElementById('dashboardRecentBody');
  if (!tbody) return;

  const recent = [...AppState.appointments]
    .slice(-5)
    .reverse();

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-muted">No appointments on record.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(appt => `
    <tr>
      <td><strong>${escapeHtml(appt.appointmentId)}</strong></td>
      <td>${escapeHtml(appt.patientName)}</td>
      <td>${escapeHtml(appt.doctorName)}</td>
      <td><span class="tag">${escapeHtml(appt.department || 'General')}</span></td>
      <td>${escapeHtml(appt.appointmentDate)} • ${escapeHtml(appt.timeSlot)}</td>
      <td><span class="badge-status ${appt.status.toLowerCase()}">${escapeHtml(appt.status)}</span></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="openPatientHistoryModal('${appt.patientId}')" title="View Patient EMR">
          <i class="fa-solid fa-file-medical"></i> View Chart
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * Render Patients Directory Table
 */
function renderPatientsTable() {
  const tbody = document.getElementById('patientsTableBody');
  if (!tbody) return;

  const query = (document.getElementById('patientFilterInput')?.value || '').toLowerCase();
  const bloodFilter = document.getElementById('bloodGroupFilter')?.value || '';

  const filtered = AppState.patients.filter(p => {
    const matchesQuery = p.fullName.toLowerCase().includes(query) ||
                         p.patientId.toLowerCase().includes(query) ||
                         (p.contactNumber && p.contactNumber.includes(query));
    const matchesBlood = !bloodFilter || p.bloodGroup === bloodFilter;
    return matchesQuery && matchesBlood;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-muted">No patient records match the search filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.patientId)}</strong></td>
      <td>
        <div style="font-weight: 600; color: var(--secondary);">${escapeHtml(p.fullName)}</div>
        <small class="text-muted">Registered: ${escapeHtml(p.registeredAt || '2026-10-31')}</small>
      </td>
      <td>${escapeHtml(p.dateOfBirth)}</td>
      <td><span class="tag tag-gender">${escapeHtml(p.gender)}</span></td>
      <td><span class="tag tag-blood">${escapeHtml(p.bloodGroup)}</span></td>
      <td>${escapeHtml(p.contactNumber)}</td>
      <td>
        ${p.allergies && p.allergies !== 'None' 
          ? `<span class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(p.allergies)}</span>` 
          : '<span class="text-muted">None documented</span>'}
      </td>
      <td class="text-right">
        <button class="btn-action" onclick="openPatientHistoryModal('${p.patientId}')" title="View Medical History & EMR">
          <i class="fa-regular fa-folder-open"></i>
        </button>
        <button class="btn-action" onclick="openBookAppointmentModalForPatient('${p.patientId}')" title="Schedule Appointment">
          <i class="fa-regular fa-calendar-plus"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * Render Appointments Scheduling Table
 */
function renderAppointmentsTable() {
  const tbody = document.getElementById('appointmentsTableBody');
  if (!tbody) return;

  // Update Tab Counts
  document.getElementById('countAllAppts').textContent = AppState.appointments.length;
  document.getElementById('countScheduledAppts').textContent = 
    AppState.appointments.filter(a => a.status === 'Scheduled').length;
  document.getElementById('countCompletedAppts').textContent = 
    AppState.appointments.filter(a => a.status === 'Completed').length;
  document.getElementById('countCancelledAppts').textContent = 
    AppState.appointments.filter(a => a.status === 'Cancelled').length;

  const filtered = AppState.appointments.filter(a => {
    if (AppState.activeStatusFilter === 'all') return true;
    return a.status.toLowerCase() === AppState.activeStatusFilter.toLowerCase();
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-muted">No appointments found under status: ${AppState.activeStatusFilter}.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(a => `
    <tr>
      <td><strong>${escapeHtml(a.appointmentId)}</strong></td>
      <td>
        <strong>${escapeHtml(a.patientName)}</strong><br>
        <small class="text-muted">${escapeHtml(a.patientId)}</small>
      </td>
      <td>${escapeHtml(a.doctorName)}</td>
      <td><span class="tag">${escapeHtml(a.department || 'Clinical')}</span></td>
      <td>
        <div><i class="fa-regular fa-calendar"></i> ${escapeHtml(a.appointmentDate)}</div>
        <small class="text-muted"><i class="fa-regular fa-clock"></i> ${escapeHtml(a.timeSlot)}</small>
      </td>
      <td>${escapeHtml(a.reason)}</td>
      <td><span class="badge-status ${a.status.toLowerCase()}">${escapeHtml(a.status)}</span></td>
      <td class="text-right">
        ${a.status === 'Scheduled' ? `
          <button class="btn btn-sm btn-outline-danger" onclick="cancelAppointment('${a.appointmentId}')" title="Cancel Appointment">
            <i class="fa-solid fa-xmark"></i> Cancel
          </button>
        ` : `
          <button class="btn btn-sm btn-outline" onclick="openPatientHistoryModal('${a.patientId}')" title="View Details">
            <i class="fa-solid fa-eye"></i> Details
          </button>
        `}
      </td>
    </tr>
  `).join('');
}

/**
 * Render Doctor Clinic Workspace (Queue for the logged-in doctor)
 */
function renderDoctorPortalView() {
  const user = AppState.currentUser;
  const tbody = document.getElementById('doctorQueueBody');
  if (!tbody || !user) return;

  // Match doctor by doctorId or by name
  const currentDoc = AppState.doctors.find(d => 
    d.userId === user.id || 
    d.doctorId === user.doctorId || 
    d.fullName.toLowerCase().includes(user.username.replace('dr.', ''))
  ) || { fullName: user.fullName || 'Dr. Specialist', specialization: 'Attending Physician' };

  document.getElementById('doctorPortalName').textContent = currentDoc.fullName;
  document.getElementById('doctorPortalSpecialty').textContent = `${currentDoc.specialization} • Licensed Practitioner`;

  // Filter appointments assigned to this doctor
  const docAppts = AppState.appointments.filter(a => 
    a.doctorId === currentDoc.doctorId || 
    a.doctorName.toLowerCase().includes(currentDoc.fullName.toLowerCase())
  );

  const pending = docAppts.filter(a => a.status === 'Scheduled');
  const completed = docAppts.filter(a => a.status === 'Completed');

  document.getElementById('docPendingCount').textContent = pending.length;
  document.getElementById('docCompletedCount').textContent = completed.length;

  if (docAppts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">No appointments scheduled for you at this time.</td></tr>`;
    return;
  }

  tbody.innerHTML = docAppts.map(a => `
    <tr>
      <td><strong>${escapeHtml(a.appointmentDate)}</strong><br><small class="text-muted">${escapeHtml(a.timeSlot)}</small></td>
      <td>
        <div style="font-weight: 600;">${escapeHtml(a.patientName)}</div>
        <small class="text-muted">${escapeHtml(a.patientId)}</small>
      </td>
      <td>${escapeHtml(a.reason)}</td>
      <td><span class="badge-status ${a.status.toLowerCase()}">${escapeHtml(a.status)}</span></td>
      <td class="text-right">
        ${a.status === 'Scheduled' ? `
          <button class="btn btn-sm btn-primary" onclick="openPrescriptionModal('${a.appointmentId}', '${a.patientId}', '${escapeHtml(a.patientName)}', '${escapeHtml(a.reason)}')">
            <i class="fa-solid fa-stethoscope"></i> Attend & Prescribe
          </button>
        ` : `
          <button class="btn btn-sm btn-outline" onclick="openPatientHistoryModal('${a.patientId}')">
            <i class="fa-solid fa-file-lines"></i> View RX Record
          </button>
        `}
      </td>
    </tr>
  `).join('');
}

/**
 * Render Patient Portal View (My Medical Records & Timeline)
 */
async function renderPatientPortalView() {
  const user = AppState.currentUser;
  if (!user) return;

  // Find linked patient profile
  const patient = AppState.patients.find(p => 
    p.userId === user.id || 
    p.patientId === user.patientId || 
    p.fullName.toLowerCase().includes(user.username.replace('.', ' '))
  ) || AppState.patients[0]; // fallback to first sample patient

  if (patient) {
    document.getElementById('patientPortalName').textContent = patient.fullName;
    document.getElementById('patientPortalId').textContent = patient.patientId;
    document.getElementById('patientPortalBlood').textContent = `Blood: ${patient.bloodGroup}`;
    document.getElementById('patientPortalGender').textContent = patient.gender;

    // Fetch this patient's records
    const timelineEl = document.getElementById('patientRecordsTimeline');
    timelineEl.innerHTML = '<p class="text-muted">Loading your clinical timeline...</p>';

    try {
      const res = await apiRequest(`/api/records/${patient.patientId}`);
      const records = res.records || [];

      if (records.length === 0) {
        timelineEl.innerHTML = `
          <div class="card p-4 text-center">
            <i class="fa-solid fa-notes-medical" style="font-size: 2.5rem; color: var(--text-light); margin-bottom: 0.5rem;"></i>
            <p class="text-muted">No medical records or consultations recorded yet.</p>
          </div>
        `;
        return;
      }

      timelineEl.innerHTML = records.map(r => `
        <div class="timeline-card">
          <div class="timeline-card-header">
            <div>
              <h5><i class="fa-solid fa-user-doctor text-info"></i> ${escapeHtml(r.diagnosis || 'Clinical Consultation')}</h5>
              <small class="text-muted">Attending: ${escapeHtml(r.doctorName || 'Dr. Specialist')} • Date: ${escapeHtml(r.date || 'Recent')}</small>
            </div>
            <span class="badge-status completed"><i class="fa-solid fa-circle-check"></i> Verified Record</span>
          </div>

          ${r.vitals ? `
            <div style="background: var(--bg-subtle); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.8rem; margin: 0.5rem 0;">
              <strong>Vitals:</strong> BP: ${escapeHtml(r.vitals.bloodPressure || 'N/A')} | HR: ${escapeHtml(r.vitals.heartRate || 'N/A')} bpm | Temp: ${escapeHtml(r.vitals.temperature || 'N/A')} °F
            </div>
          ` : ''}

          ${r.prescription && r.prescription.medications && r.prescription.medications.length ? `
            <strong>Prescribed Medications:</strong>
            <ul class="meds-list">
              ${r.prescription.medications.map(m => `
                <li><strong>${escapeHtml(m.name)}</strong> - ${escapeHtml(m.dosage)} (${escapeHtml(m.frequency)}) for ${escapeHtml(m.duration)}</li>
              `).join('')}
            </ul>
          ` : ''}

          ${r.prescription && r.prescription.advice ? `
            <p style="font-size: 0.85rem; margin-top: 0.4rem;"><strong>Doctor Advice:</strong> <em>${escapeHtml(r.prescription.advice)}</em></p>
          ` : ''}
        </div>
      `).join('');
    } catch (e) {
      timelineEl.innerHTML = '<p class="text-danger">Unable to load clinical records from backend.</p>';
    }
  }
}

// ============================================================================
// MODAL CONTROLLERS & FORM SUBMISSION
// ============================================================================
function initModals() {
  // Close buttons
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-modal-close');
      closeModal(modalId);
    });
  });

  // Modal backdrop click to close
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Trigger buttons
  document.getElementById('openNewPatientModalBtn')?.addEventListener('click', openRegisterPatientModal);
  document.getElementById('openNewAppointmentModalBtn')?.addEventListener('click', openBookAppointmentModal);

  // Add medication row button in prescription modal
  document.getElementById('addMedicationRowBtn')?.addEventListener('click', () => addMedicationRow());
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function openRegisterPatientModal() {
  const form = document.getElementById('newPatientForm');
  if (form) form.reset();
  clearFieldErrors();
  openModal('registerPatientModal');
}

function openBookAppointmentModal() {
  const form = document.getElementById('bookAppointmentForm');
  if (form) form.reset();
  clearFieldErrors();

  // If logged-in user is a patient, lock the patient selection to them
  const user = AppState.currentUser;
  const pSelectGroup = document.getElementById('patientSelectGroup');
  const pSelect = document.getElementById('apptPatientSelect');

  if (user && user.role.toLowerCase() === 'patient') {
    const linkedPatient = AppState.patients.find(p => 
      p.userId === user.id || p.fullName.toLowerCase().includes(user.username.replace('.', ' '))
    ) || AppState.patients[0];
    
    if (linkedPatient) {
      pSelect.value = linkedPatient.patientId;
      pSelect.disabled = true;
    }
  } else {
    pSelect.disabled = false;
  }

  // Pre-fill tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateInput = document.getElementById('apptDate');
  if (dateInput) dateInput.value = tomorrow.toISOString().split('T')[0];

  openModal('bookAppointmentModal');
}

function openBookAppointmentModalForPatient(patientId) {
  openBookAppointmentModal();
  const select = document.getElementById('apptPatientSelect');
  if (select) select.value = patientId;
}

/**
 * Open Doctor Prescription Modal for an appointment
 */
window.openPrescriptionModal = function(appointmentId, patientId, patientName, reason) {
  document.getElementById('rxAppointmentId').value = appointmentId;
  document.getElementById('rxPatientId').value = patientId;
  document.getElementById('rxPatientName').textContent = patientName;
  document.getElementById('rxPatientIdDisplay').textContent = patientId;
  document.getElementById('rxReasonDisplay').textContent = reason || 'Consultation';

  // Clear inputs
  document.getElementById('rxDiagnosis').value = '';
  document.getElementById('rxBp').value = '120/80';
  document.getElementById('rxHr').value = '72';
  document.getElementById('rxTemp').value = '98.6';
  document.getElementById('rxWeight').value = '68';
  document.getElementById('rxAdvice').value = '';

  const medContainer = document.getElementById('medicationItemsContainer');
  medContainer.innerHTML = '';
  // Add 1 default row
  addMedicationRow('Amoxicillin', '500mg', 'Twice daily', '7 days');

  openModal('prescriptionModal');
};

function addMedicationRow(name = '', dosage = '', frequency = '', duration = '') {
  const container = document.getElementById('medicationItemsContainer');
  const row = document.createElement('div');
  row.className = 'medication-row';
  row.innerHTML = `
    <input type="text" class="med-name col-4" placeholder="Drug Name (e.g. Paracetamol)" value="${escapeHtml(name)}" required>
    <input type="text" class="med-dose col-3" placeholder="Dosage (500mg)" value="${escapeHtml(dosage)}" required>
    <input type="text" class="med-freq col-3" placeholder="Frequency (e.g. 1-0-1)" value="${escapeHtml(frequency)}">
    <input type="text" class="med-duration col-2" placeholder="Duration (5 days)" value="${escapeHtml(duration)}">
    <button type="button" class="btn-action action-danger remove-med-btn" title="Remove medication"><i class="fa-solid fa-trash-can"></i></button>
  `;

  row.querySelector('.remove-med-btn').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

/**
 * Open Patient EMR / History details modal
 */
window.openPatientHistoryModal = async function(patientId) {
  const patient = AppState.patients.find(p => p.patientId === patientId);
  if (!patient) return;

  document.getElementById('emrPatientName').textContent = patient.fullName;
  document.getElementById('emrPatientIdSub').textContent = `${patient.patientId} • ${patient.gender} • ${patient.bloodGroup}`;
  document.getElementById('emrDob').textContent = `${patient.dateOfBirth}`;
  document.getElementById('emrBlood').textContent = patient.bloodGroup;
  document.getElementById('emrPhone').textContent = patient.contactNumber;
  document.getElementById('emrEmergency').textContent = patient.emergencyContact || 'None listed';
  document.getElementById('emrAllergies').textContent = patient.allergies || 'None documented';
  document.getElementById('emrHistoryText').textContent = patient.medicalHistory || 'No prior chronic conditions recorded.';

  const emrList = document.getElementById('emrRecordsList');
  emrList.innerHTML = '<p class="text-muted">Loading consultation history...</p>';
  openModal('patientDetailsModal');

  try {
    const res = await apiRequest(`/api/records/${patientId}`);
    const records = res.records || [];

    if (records.length === 0) {
      emrList.innerHTML = '<p class="text-muted p-3">No prior consultation records logged for this patient.</p>';
      return;
    }

    emrList.innerHTML = records.map(r => `
      <div class="timeline-card">
        <div class="timeline-card-header">
          <strong>${escapeHtml(r.diagnosis || 'Consultation')}</strong>
          <span class="text-muted"><i class="fa-regular fa-calendar"></i> ${escapeHtml(r.date || 'Recent')}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Attending: ${escapeHtml(r.doctorName || 'Dr. Specialist')}</p>
        ${r.vitals ? `
          <div style="font-size: 0.8rem; background: var(--bg-subtle); padding: 0.4rem 0.6rem; border-radius: var(--radius-sm); margin: 0.4rem 0;">
            BP: ${escapeHtml(r.vitals.bloodPressure || 'N/A')} | Pulse: ${escapeHtml(r.vitals.heartRate || 'N/A')} | Temp: ${escapeHtml(r.vitals.temperature || 'N/A')}°F
          </div>
        ` : ''}
        ${r.prescription && r.prescription.medications ? `
          <ul class="meds-list">
            ${r.prescription.medications.map(m => `<li>${escapeHtml(m.name)} ${escapeHtml(m.dosage)} (${escapeHtml(m.frequency)})</li>`).join('')}
          </ul>
        ` : ''}
        ${r.prescription && r.prescription.advice ? `<p style="font-size: 0.82rem;"><em>Note: ${escapeHtml(r.prescription.advice)}</em></p>` : ''}
      </div>
    `).join('');
  } catch (e) {
    emrList.innerHTML = '<p class="text-danger">Failed to fetch patient records from server.</p>';
  }
};

// ============================================================================
// FORM SUBMIT HANDLERS
// ============================================================================
function initFormHandlers() {
  // 1. Register Patient Form
  const newPatientForm = document.getElementById('newPatientForm');
  newPatientForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors();

    const fullName = document.getElementById('pFullName').value.trim();
    const bloodGroup = document.getElementById('pBloodGroup').value;
    const dob = document.getElementById('pDob').value;
    const gender = document.getElementById('pGender').value;
    const phone = document.getElementById('pPhone').value.trim();
    const emergency = document.getElementById('pEmergency').value.trim();
    const allergies = document.getElementById('pAllergies').value.trim();
    const address = document.getElementById('pAddress').value.trim();
    const history = document.getElementById('pHistory').value.trim();

    // Validation
    let isValid = true;
    if (!fullName) { showFieldError('pFullName', 'Full name is required'); isValid = false; }
    if (!bloodGroup) { showFieldError('pBloodGroup', 'Blood group is required'); isValid = false; }
    if (!dob) { showFieldError('pDob', 'DOB is required'); isValid = false; }
    if (!gender) { showFieldError('pGender', 'Gender is required'); isValid = false; }
    if (!phone) { showFieldError('pPhone', 'Contact phone is required'); isValid = false; }

    if (!isValid) return;

    const patientPayload = {
      fullName,
      bloodGroup,
      dateOfBirth: dob,
      gender,
      contactNumber: phone,
      emergencyContact: emergency || 'N/A',
      allergies: allergies || 'None',
      address,
      medicalHistory: history || 'None'
    };

    try {
      const response = await apiRequest('/api/patients', 'POST', patientPayload);
      if (response && response.success) {
        showToast(`Patient ${fullName} registered successfully!`, 'success');
        closeModal('registerPatientModal');
        await loadInitialData();
      }
    } catch (err) {
      // Handled in apiRequest
    }
  });

  // 2. Book Appointment Form
  const bookForm = document.getElementById('bookAppointmentForm');
  bookForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors();

    const patientId = document.getElementById('apptPatientSelect').value;
    const doctorId = document.getElementById('apptDoctorSelect').value;
    const appointmentDate = document.getElementById('apptDate').value;
    const timeSlot = document.getElementById('apptTimeSlot').value;
    const reason = document.getElementById('apptReason').value.trim();

    let isValid = true;
    if (!patientId) { showFieldError('apptPatientSelect', 'Please select a patient'); isValid = false; }
    if (!doctorId) { showFieldError('apptDoctorSelect', 'Please select a doctor'); isValid = false; }
    if (!appointmentDate) { showFieldError('apptDate', 'Select appointment date'); isValid = false; }
    if (!timeSlot) { showFieldError('apptTimeSlot', 'Select a consultation slot'); isValid = false; }
    if (!reason) { showFieldError('apptReason', 'Reason for consultation is required'); isValid = false; }

    if (!isValid) return;

    // Resolve patient & doctor names
    const patientObj = AppState.patients.find(p => p.patientId === patientId);
    const doctorObj = AppState.doctors.find(d => d.doctorId === doctorId);

    const apptPayload = {
      patientId,
      patientName: patientObj ? patientObj.fullName : 'Patient',
      doctorId,
      doctorName: doctorObj ? doctorObj.fullName : 'Doctor',
      department: doctorObj ? doctorObj.department : 'General Medicine',
      appointmentDate,
      timeSlot,
      reason
    };

    try {
      const response = await apiRequest('/api/appointments', 'POST', apptPayload);
      if (response && response.success) {
        showToast('Appointment successfully confirmed and scheduled!', 'success');
        closeModal('bookAppointmentModal');
        await loadInitialData();
      }
    } catch (err) {
      // Handled
    }
  });

  // 3. Doctor Prescription Form
  const prescriptionForm = document.getElementById('prescriptionForm');
  prescriptionForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors();

    const appointmentId = document.getElementById('rxAppointmentId').value;
    const patientId = document.getElementById('rxPatientId').value;
    const diagnosis = document.getElementById('rxDiagnosis').value.trim();
    const advice = document.getElementById('rxAdvice').value.trim();

    if (!diagnosis) {
      showFieldError('rxDiagnosis', 'Clinical diagnosis is mandatory');
      return;
    }

    // Collect vitals
    const vitals = {
      bloodPressure: document.getElementById('rxBp').value.trim() || '120/80',
      heartRate: document.getElementById('rxHr').value.trim() || '72',
      temperature: document.getElementById('rxTemp').value.trim() || '98.6',
      weight: document.getElementById('rxWeight').value.trim() || '70'
    };

    // Collect medication rows
    const medications = [];
    document.querySelectorAll('#medicationItemsContainer .medication-row').forEach(row => {
      const name = row.querySelector('.med-name').value.trim();
      const dosage = row.querySelector('.med-dose').value.trim();
      const frequency = row.querySelector('.med-freq').value.trim();
      const duration = row.querySelector('.med-duration').value.trim();

      if (name) {
        medications.push({ name, dosage, frequency, duration });
      }
    });

    const rxPayload = {
      appointmentId,
      patientId,
      diagnosis,
      advice,
      vitals,
      medications
    };

    try {
      const response = await apiRequest(`/api/appointments/${appointmentId}/prescribe`, 'POST', rxPayload);
      if (response && response.success) {
        showToast('Prescription recorded and appointment marked Completed!', 'success');
        closeModal('prescriptionModal');
        await loadInitialData();
      }
    } catch (err) {
      // Handled
    }
  });
}

/**
 * Cancel an appointment
 */
window.cancelAppointment = async function(appointmentId) {
  if (!confirm('Are you sure you wish to cancel this appointment?')) return;

  try {
    const response = await apiRequest(`/api/appointments/${appointmentId}/status`, 'PUT', {
      status: 'Cancelled'
    });
    if (response && response.success) {
      showToast('Appointment status set to Cancelled.', 'info');
      await loadInitialData();
    }
  } catch (err) {
    // Handled
  }
};

// ============================================================================
// SEARCH & FILTER LOGIC
// ============================================================================
function initSearchAndFilters() {
  // Global Topbar Search
  const globalSearch = document.getElementById('globalSearchInput');
  globalSearch?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    if (AppState.currentView === 'patients') {
      const pFilter = document.getElementById('patientFilterInput');
      if (pFilter) { pFilter.value = q; renderPatientsTable(); }
    } else if (AppState.currentView === 'appointments') {
      renderAppointmentsTable();
    }
  });

  // Patients Filter Bar
  document.getElementById('patientFilterInput')?.addEventListener('input', renderPatientsTable);
  document.getElementById('bloodGroupFilter')?.addEventListener('change', renderPatientsTable);

  // Appointment Status Tabs
  document.querySelectorAll('.tabs-container .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs-container .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.activeStatusFilter = btn.getAttribute('data-status-filter') || 'all';
      renderAppointmentsTable();
    });
  });
}

// ============================================================================
// UI HELPERS & TOAST SYSTEM
// ============================================================================
function populateDoctorSelectDropdowns() {
  const select = document.getElementById('apptDoctorSelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- Choose Doctor / Department --</option>' +
    AppState.doctors.map(d => `
      <option value="${d.doctorId}">
        ${escapeHtml(d.fullName)} (${escapeHtml(d.department)} - ${escapeHtml(d.specialization)})
      </option>
    `).join('');
}

function populatePatientSelectDropdowns() {
  const select = document.getElementById('apptPatientSelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- Choose Patient --</option>' +
    AppState.patients.map(p => `
      <option value="${p.patientId}">
        ${escapeHtml(p.fullName)} (${p.patientId} - Blood: ${p.bloodGroup})
      </option>
    `).join('');
}

function showFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.style.borderColor = 'var(--danger)';
  const errorEl = input.parentElement.querySelector('.error-msg');
  if (errorEl) errorEl.textContent = message;
}

function clearFieldErrors() {
  document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
  document.querySelectorAll('input, select, textarea').forEach(el => el.style.borderColor = '');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconClass = type === 'success' ? 'fa-circle-check' :
                    type === 'error' ? 'fa-circle-exclamation' :
                    type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info';

  const title = type === 'success' ? 'Success' :
                type === 'error' ? 'Error' :
                type === 'warning' ? 'Warning' : 'Information';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(toast);

  // Auto remove after 4.5s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
