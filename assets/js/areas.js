const config = window.AREAS_CONFIG ?? {};
const csrfToken = config.csrfToken ?? "";

let areas = [];
let toastTimer;

const rows = document.getElementById("areaRows");
const searchInput = document.getElementById("areaSearch");
const areaBackdrop = document.getElementById("areaBackdrop");
const areaForm = document.getElementById("areaForm");

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

async function apiRequest(action, payload = null) {
  const options = { headers: { "Accept": "application/json" } };
  const url = `api/areas.php?action=${encodeURIComponent(action)}`;

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

async function loadAreas() {
  try {
    const data = await apiRequest("list");
    if (!data) return;
    areas = data.areas ?? [];
    render();
  } catch (error) {
    showToast(`No se pudieron cargar las áreas: ${error.message}`);
  }
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("es");
  const filtered = areas.filter(area => [area.name, area.status]
    .some(value => String(value ?? "").toLocaleLowerCase("es").includes(query)));

  rows.innerHTML = filtered.map(area => {
    const isActive = area.status === "activo";
    const toggleLabel = isActive ? "Desactivar" : "Activar";
    const canDelete = Number(area.asset_count) === 0;
    const actions = `<div class="row-actions">
      <button class="icon-button" type="button" data-action="edit" data-id="${escapeHtml(area.id)}" title="Editar" aria-label="Editar ${escapeHtml(area.name)}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4 15.6 5 4.8 15.8 4 20Z"/></svg></button>
      <button class="icon-button ${isActive ? "delete" : ""}" type="button" data-action="toggle" data-id="${escapeHtml(area.id)}" title="${toggleLabel}" aria-label="${toggleLabel} ${escapeHtml(area.name)}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v9"/><path d="M6.5 6.5a8 8 0 1 0 11 0"/></svg></button>
      ${canDelete ? `<button class="icon-button delete" type="button" data-action="delete" data-id="${escapeHtml(area.id)}" title="Eliminar" aria-label="Eliminar ${escapeHtml(area.name)}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg></button>` : ""}
    </div>`;

    return `<tr>
      <td><div class="asset-name">${escapeHtml(area.name)}</div><div class="asset-code">Área patrimonial</div></td>
      <td>${Number(area.asset_count) || 0}</td>
      <td>${Number(area.units) || 0}</td>
      <td><span class="status-pill status-${isActive ? "bueno" : "malo"}">${isActive ? "Activa" : "Inactiva"}</span></td>
      <td>${actions}</td>
    </tr>`;
  }).join("");

  document.getElementById("areasEmpty").hidden = filtered.length > 0;
  document.querySelector(".table-scroll table").hidden = filtered.length === 0;
  const label = `${filtered.length} ${filtered.length === 1 ? "área" : "áreas"}`;
  document.getElementById("areaCount").textContent = label;
  document.getElementById("areasFootCount").textContent = label;
}

function openAreaModal(area = null) {
  areaForm.reset();
  document.getElementById("areaId").value = area?.id ?? "";
  document.getElementById("areaModalTitle").textContent = area ? "Editar área" : "Nueva área";
  document.getElementById("areaModalSubtitle").textContent = area ? "Actualiza el nombre o estado del área." : "Registra un área para ubicar los bienes.";
  document.getElementById("saveAreaBtn").textContent = area ? "Guardar cambios" : "Crear área";
  document.getElementById("areaName").value = area?.name ?? "";
  document.getElementById("areaStatus").value = area?.status ?? "activo";
  areaBackdrop.classList.add("open");
  document.getElementById("areaName").focus();
}

function closeAreaModal() {
  areaBackdrop.classList.remove("open");
}

document.getElementById("newAreaBtn").addEventListener("click", () => openAreaModal());
document.getElementById("closeAreaModal").addEventListener("click", closeAreaModal);
document.getElementById("cancelAreaModal").addEventListener("click", closeAreaModal);
areaBackdrop.addEventListener("click", event => { if (event.target === areaBackdrop) closeAreaModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && areaBackdrop.classList.contains("open")) closeAreaModal(); });

areaForm.addEventListener("submit", async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(areaForm).entries());
  const id = Number(values.id || 0);
  const payload = { name: values.name.trim(), status: values.status };

  const button = document.getElementById("saveAreaBtn");
  button.disabled = true;
  try {
    await apiRequest(id ? "update" : "create", id ? { id, ...payload } : payload);
    closeAreaModal();
    showToast(id ? "Área actualizada." : "Área creada correctamente.");
    await loadAreas();
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
});

rows.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const area = areas.find(item => Number(item.id) === Number(button.dataset.id));
  if (!area) return;

  if (button.dataset.action === "edit") openAreaModal(area);
  if (button.dataset.action === "toggle") {
    const next = area.status === "activo" ? "desactivar" : "activar";
    if (!confirm(`¿Deseas ${next} el área "${area.name}"?`)) return;
    try {
      await apiRequest("toggle", { id: area.id });
      showToast(`Área ${next === "activar" ? "activada" : "desactivada"}.`);
      await loadAreas();
    } catch (error) {
      showToast(error.message);
    }
  }
  if (button.dataset.action === "delete") {
    if (!confirm(`¿Eliminar el área "${area.name}"?`)) return;
    try {
      await apiRequest("delete", { id: area.id });
      showToast("Área eliminada.");
      await loadAreas();
    } catch (error) {
      showToast(error.message);
    }
  }
});

searchInput.addEventListener("input", render);
loadAreas();
