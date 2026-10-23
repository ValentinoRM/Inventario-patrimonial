const config = window.USERS_CONFIG ?? {};
const csrfToken = config.csrfToken ?? "";
const currentUserId = Number(config.currentUserId ?? 0);

let users = [];
let toastTimer;

const rows = document.getElementById("userRows");
const searchInput = document.getElementById("userSearch");
const userBackdrop = document.getElementById("userBackdrop");
const passwordBackdrop = document.getElementById("passwordBackdrop");
const userForm = document.getElementById("userForm");
const passwordForm = document.getElementById("passwordResetForm");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function formatDateTime(value) {
  if (!value) return "Sin acceso";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-PE");
}

function roleLabel(role) {
  return role === "admin" ? "Administrador" : "Usuario";
}

function roleClass(role) {
  return role === "admin" ? "role-admin" : "role-user";
}

async function apiRequest(action, payload = null) {
  const options = { headers: { "Accept": "application/json" } };
  const url = `api/users.php?action=${encodeURIComponent(action)}`;

  if (payload) {
    options.method = "POST";
    options.headers["Content-Type"] = "application/json";
    options.headers["X-CSRF-Token"] = csrfToken;
    options.body = JSON.stringify({ ...payload, action, csrf_token: csrfToken });
  }

  const response = await fetch(url, options);
  let data = {};
  try {
    data = await response.json();
  } catch {
    throw new Error("Respuesta inválida del servidor.");
  }

  if (!response.ok || data.ok === false) {
    if (response.status === 401) {
      window.location.href = "login.php";
      return null;
    }
    throw new Error(data.error || "No se pudo completar la operación.");
  }

  return data;
}

async function loadUsers() {
  try {
    const data = await apiRequest("list");
    if (!data) return;
    users = data.users ?? [];
    render();
  } catch (error) {
    showToast(`No se pudieron cargar los usuarios: ${error.message}`);
  }
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("es");
  const filtered = users.filter(user => [user.name, user.email, user.role, user.status]
    .some(value => String(value ?? "").toLocaleLowerCase("es").includes(query)));

  rows.innerHTML = filtered.map(user => {
    const isSelf = Number(user.id) === currentUserId;
    const nextStatus = user.status === "activo" ? "inactivo" : "activo";
    const toggleLabel = user.status === "activo" ? "Desactivar" : "Activar";
    const actions = isSelf
      ? '<span class="muted-note">Tu cuenta</span>'
      : `<div class="row-actions">
          <button class="icon-button" type="button" data-action="edit" data-id="${escapeHtml(user.id)}" title="Editar" aria-label="Editar ${escapeHtml(user.name)}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4 15.6 5 4.8 15.8 4 20Z"/></svg></button>
          <button class="icon-button" type="button" data-action="password" data-id="${escapeHtml(user.id)}" title="Restablecer contraseña" aria-label="Restablecer contraseña de ${escapeHtml(user.name)}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M12 15v2"/></svg></button>
          <button class="icon-button ${nextStatus === 'inactivo' ? 'delete' : ''}" type="button" data-action="toggle" data-id="${escapeHtml(user.id)}" title="${toggleLabel}" aria-label="${toggleLabel} a ${escapeHtml(user.name)}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v9"/><path d="M6.5 6.5a8 8 0 1 0 11 0"/></svg></button>
        </div>`;

    return `<tr>
      <td><div class="asset-name">${escapeHtml(user.name || "Sin nombre")}</div><div class="asset-code">${escapeHtml(user.email)}</div></td>
      <td><span class="role-badge ${roleClass(user.role)}">${roleLabel(user.role)}</span></td>
      <td><span class="status-pill status-${user.status === "activo" ? "bueno" : "malo"}">${user.status === "activo" ? "Activo" : "Inactivo"}</span></td>
      <td>${escapeHtml(formatDateTime(user.last_login_at))}</td>
      <td>${escapeHtml(formatDate(user.created_at))}</td>
      <td>${actions}</td>
    </tr>`;
  }).join("");

  document.getElementById("usersEmpty").hidden = filtered.length > 0;
  document.querySelector(".table-scroll table").hidden = filtered.length === 0;
  const label = `${filtered.length} ${filtered.length === 1 ? "cuenta" : "cuentas"}`;
  document.getElementById("userCount").textContent = label;
  document.getElementById("usersFootCount").textContent = label;
}

function openUserModal(user = null) {
  userForm.reset();
  document.getElementById("userId").value = user?.id ?? "";
  document.getElementById("userModalTitle").textContent = user ? "Editar usuario" : "Nuevo usuario";
  document.getElementById("userModalSubtitle").textContent = user ? "Actualiza los datos de la cuenta." : "Crea una cuenta de acceso.";
  document.getElementById("saveUserBtn").textContent = user ? "Guardar cambios" : "Crear usuario";
  document.getElementById("passwordField").hidden = Boolean(user);
  document.getElementById("userPassword").required = !user;
  if (user) {
    document.getElementById("userName").value = user.name ?? "";
    document.getElementById("userEmail").value = user.email ?? "";
    document.getElementById("userRole").value = user.role ?? "user";
  }
  userBackdrop.classList.add("open");
  document.getElementById("userName").focus();
}

function closeUserModal() {
  userBackdrop.classList.remove("open");
}

function openPasswordModal(user) {
  passwordForm.reset();
  document.getElementById("passwordUserId").value = user.id;
  document.getElementById("passwordModalSubtitle").textContent = `Nueva contraseña para ${user.name || user.email}.`;
  passwordBackdrop.classList.add("open");
  document.getElementById("resetPassword").focus();
}

function closePasswordModal() {
  passwordBackdrop.classList.remove("open");
}

document.getElementById("newUserBtn").addEventListener("click", () => openUserModal());
document.getElementById("closeUserModal").addEventListener("click", closeUserModal);
document.getElementById("cancelUserModal").addEventListener("click", closeUserModal);
document.getElementById("closePasswordModal").addEventListener("click", closePasswordModal);
document.getElementById("cancelPasswordModal").addEventListener("click", closePasswordModal);
userBackdrop.addEventListener("click", event => { if (event.target === userBackdrop) closeUserModal(); });
passwordBackdrop.addEventListener("click", event => { if (event.target === passwordBackdrop) closePasswordModal(); });
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (userBackdrop.classList.contains("open")) closeUserModal();
  if (passwordBackdrop.classList.contains("open")) closePasswordModal();
});

userForm.addEventListener("submit", async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(userForm).entries());
  const id = Number(values.id || 0);
  const payload = { name: values.name.trim(), email: values.email.trim(), role: values.role };
  if (!id) payload.password = values.password;

  const button = document.getElementById("saveUserBtn");
  button.disabled = true;
  try {
    await apiRequest(id ? "update" : "create", id ? { id, ...payload } : payload);
    closeUserModal();
    showToast(id ? "Usuario actualizado." : "Usuario creado correctamente.");
    await loadUsers();
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
});

passwordForm.addEventListener("submit", async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(passwordForm).entries());
  try {
    await apiRequest("reset_password", { id: Number(values.id), password: values.password });
    closePasswordModal();
    showToast("Contraseña restablecida.");
  } catch (error) {
    showToast(error.message);
  }
});

rows.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const user = users.find(item => Number(item.id) === Number(button.dataset.id));
  if (!user) return;

  if (button.dataset.action === "edit") openUserModal(user);
  if (button.dataset.action === "password") openPasswordModal(user);
  if (button.dataset.action === "toggle") {
    const next = user.status === "activo" ? "inactivar" : "activar";
    if (!confirm(`¿Deseas ${next} la cuenta de ${user.name || user.email}?`)) return;
    try {
      await apiRequest("toggle", { id: user.id });
      showToast(`Cuenta ${next === "activar" ? "activada" : "desactivada"}.`);
      await loadUsers();
    } catch (error) {
      showToast(error.message);
    }
  }
});

searchInput.addEventListener("input", render);
loadUsers();
