// ==========================================================================
// LÓGICA DE LA APLICACIÓN - INTERFAZ DE USUARIO Y CONTROLADORES
// ==========================================================================

const AppState = {
  currentUser: null,
  currentPasillo: null,
  currentMaterial: null,
  currentRegistroId: null,
  currentMaterialStatus: "Pendiente", // 'Asignado' | 'Completado' | 'Liberado'
  sessionProcessedMaterials: [],      // Materiales ya trabajados o vistos en este pasillo
  taskStartTime: null,
  timerInterval: null,
  productividadList: [],
  usuariosList: []
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initIcons();
  actualizarIndicadorConexion();
  setupEventListeners();

  // Comprobar si hay una sesión guardada en sessionStorage
  const savedUser = sessionStorage.getItem("acomodo_current_user");
  if (savedUser) {
    try {
      AppState.currentUser = JSON.parse(savedUser);
      onLoginSuccess(AppState.currentUser);
    } catch (e) {
      sessionStorage.removeItem("acomodo_current_user");
    }
  }
});

function initIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

function setupEventListeners() {
  // Login form
  const formLogin = document.getElementById("form-login");
  if (formLogin) {
    formLogin.addEventListener("submit", handleLoginSubmit);
  }

  // Logout
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", cerrarSesion);
  }

  // Config modal
  const btnConfig = document.getElementById("btn-toggle-config");
  if (btnConfig) {
    btnConfig.addEventListener("click", abrirModalConfig);
  }

  // Enter key en el display de pasillo
  const inputPasillo = document.getElementById("input-pasillo-display");
  if (inputPasillo) {
    inputPasillo.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        consultarMaterialPasillo(false);
      }
    });
  }
}

// ==========================================================================
// GESTIÓN DE VISTAS (SPA)
// ==========================================================================
function showView(viewId) {
  const views = [
    "view-login",
    "view-operador-pasillo",
    "view-operador-material",
    "view-admin"
  ];

  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === viewId) {
        el.classList.remove("hidden");
        el.classList.add("fade-in");
      } else {
        el.classList.add("hidden");
      }
    }
  });

  initIcons();
}

// ==========================================================================
// AUTENTICACIÓN
// ==========================================================================
async function handleLoginSubmit(e) {
  e.preventDefault();
  const inputUser = document.getElementById("input-usuario");
  const inputPass = document.getElementById("input-password");
  const errorBox = document.getElementById("login-error");
  const errorText = document.getElementById("login-error-text");
  const btnSpinner = document.getElementById("login-btn-spinner");
  const btnText = document.getElementById("login-btn-text");

  const usuario = inputUser.value.trim();
  const password = inputPass.value;

  if (!usuario) return;

  errorBox.classList.add("hidden");
  btnSpinner.classList.remove("hidden");
  btnText.textContent = "Verificando...";

  try {
    const res = await API.login(usuario, password);
    if (res.success && res.user) {
      AppState.currentUser = res.user;
      sessionStorage.setItem("acomodo_current_user", JSON.stringify(res.user));
      playAudioNotification("success");
      onLoginSuccess(res.user);
    } else {
      errorText.textContent = res.message || "Usuario o contraseña no válidos";
      errorBox.classList.remove("hidden");
      playAudioNotification("error");
    }
  } catch (err) {
    errorText.textContent = "Error de conexión: " + err.message;
    errorBox.classList.remove("hidden");
  } finally {
    btnSpinner.classList.add("hidden");
    btnText.textContent = "Ingresar al Sistema";
    initIcons();
  }
}

function quickLogin(user, pass) {
  document.getElementById("input-usuario").value = user;
  document.getElementById("input-password").value = pass;
  const form = document.getElementById("form-login");
  if (form) form.requestSubmit();
}

function onLoginSuccess(user) {
  // Configurar header
  const userPill = document.getElementById("user-pill");
  const btnLogout = document.getElementById("btn-logout");
  const userNameEl = document.getElementById("user-display-name");
  const userRoleEl = document.getElementById("user-role-badge");
  const userAvatarEl = document.getElementById("user-avatar");

  if (userPill) userPill.classList.remove("hidden"), userPill.classList.add("flex");
  if (btnLogout) btnLogout.classList.remove("hidden");

  if (userNameEl) userNameEl.textContent = user.nombre || user.usuario;
  if (userRoleEl) {
    userRoleEl.textContent = user.rol;
    if (user.rol.toLowerCase().includes("admin")) {
      userRoleEl.className = "text-[10px] text-purple-400 font-bold tracking-wide uppercase";
    } else {
      userRoleEl.className = "text-[10px] text-blue-400 font-bold tracking-wide uppercase";
    }
  }

  if (userAvatarEl) {
    const initials = (user.nombre || user.usuario).substring(0, 2).toUpperCase();
    userAvatarEl.textContent = initials;
  }

  showToast(`¡Bienvenido, ${user.nombre}!`, "success");

  // Ruteo por Rol
  if (user.rol.toLowerCase().includes("admin")) {
    showView("view-admin");
    cargarProductividadAdmin();
  } else {
    showView("view-operador-pasillo");
    setTimeout(() => {
      const input = document.getElementById("input-pasillo-display");
      if (input) input.focus();
    }, 200);
  }
}

function cerrarSesion() {
  if (AppState.currentMaterial && AppState.currentMaterialStatus === "Asignado") {
    API.liberarMaterial(AppState.currentMaterial.material, AppState.currentPasillo, AppState.currentUser?.usuario);
  }

  AppState.currentUser = null;
  AppState.currentPasillo = null;
  AppState.currentMaterial = null;
  AppState.currentMaterialStatus = "Pendiente";
  AppState.sessionProcessedMaterials = [];
  detenerCronometro();
  sessionStorage.removeItem("acomodo_current_user");

  document.getElementById("user-pill").classList.add("hidden");
  document.getElementById("btn-logout").classList.add("hidden");
  document.getElementById("input-usuario").value = "";
  document.getElementById("input-password").value = "";

  showView("view-login");
  showToast("Sesión cerrada y materiales liberados", "info");
}

// ==========================================================================
// FLUJO OPERADOR: TECLADO Y SELECCIÓN DE PASILLO
// ==========================================================================
function numpadPress(digit) {
  ocultarAlertaPasillo();
  const input = document.getElementById("input-pasillo-display");
  if (!input) return;
  playAudioNotification("click");
  if (input.value.length >= 4) return;
  input.value = (input.value === "0" ? "" : input.value) + digit;
}

function numpadClear() {
  ocultarAlertaPasillo();
  const input = document.getElementById("input-pasillo-display");
  if (!input) return;
  playAudioNotification("click");
  input.value = "";
}

function mostrarAlertaPasillo(texto) {
  const alertBox = document.getElementById("pasillo-alert-msg");
  const alertText = document.getElementById("pasillo-alert-text");
  if (alertBox && alertText) {
    alertText.textContent = texto || "Ese pasillo no tiene actividad por realizar";
    alertBox.classList.remove("hidden");
    initIcons();
  }
}

function ocultarAlertaPasillo() {
  const alertBox = document.getElementById("pasillo-alert-msg");
  if (alertBox) {
    alertBox.classList.add("hidden");
  }
}

/**
 * Consulta el material con menor porcentaje del pasillo
 * @param {boolean} keepSession - Si es true, excluye los materiales ya vistos en esta sesión
 */
async function consultarMaterialPasillo(keepSession = false) {
  const input = document.getElementById("input-pasillo-display");
  let pasillo = input ? input.value.trim() : "";

  if (!pasillo && AppState.currentPasillo) {
    pasillo = AppState.currentPasillo;
  }

  if (!pasillo) {
    showToast("Por favor indica el número de pasillo a surtir", "warning");
    if (input) input.focus();
    return;
  }

  ocultarAlertaPasillo();

  if (!keepSession) {
    // Si es un pasillo nuevo o búsqueda desde cero, limpiamos los excluidos
    AppState.sessionProcessedMaterials = [];
  }

  const btnSpinner = document.getElementById("pasillo-btn-spinner");
  const btnText = document.getElementById("pasillo-btn-text");

  if (btnSpinner) btnSpinner.classList.remove("hidden");
  if (btnText) btnText.textContent = "Buscando menor porcentaje...";

  try {
    const usuarioActual = AppState.currentUser ? AppState.currentUser.usuario : "";
    const res = await API.getMaterialByPasillo(pasillo, usuarioActual, AppState.sessionProcessedMaterials);

    if (res.success && res.material) {
      AppState.currentPasillo = pasillo;
      AppState.currentMaterial = res.material;
      AppState.currentMaterialStatus = "Asignado";

      // Registrar en la lista de exclusión para que la próxima llamada a "Siguiente Material"
      // busque el próximo material con menor porcentaje
      if (!AppState.sessionProcessedMaterials.includes(res.material.material)) {
        AppState.sessionProcessedMaterials.push(res.material.material);
      }

      playAudioNotification("beep");

      // Cargar datos en la tarjeta del material
      cargarTarjetaMaterial(res.material, pasillo);

      // Registrar asignación en la hoja "Productividad" del Archivo 2
      await registrarAsignacionProductividad(res.material, pasillo);

      // Mostrar pantalla del material
      showView("view-operador-material");
      iniciarCronometro();

      showToast(`Material ${res.material.material} bloqueado y asignado a ti`, "success");

    } else {
      const mensaje = res.message || "Ese pasillo no tiene actividad por realizar";
      mostrarAlertaPasillo(mensaje);
      showToast(mensaje, "warning");
      playAudioNotification("error");
      
      // Permitir escoger otro pasillo de inmediato: limpiar campo y dar foco
      if (input) {
        input.value = "";
        input.focus();
      }

      // Si estaba en la vista del material (ej. navegando), regresar a pasillos para escoger otro
      if (AppState.currentMaterial) {
        regresarAPasillos(true);
      }
    }
  } catch (err) {
    const errMsg = err.message || "Error al consultar inventario";
    mostrarAlertaPasillo(errMsg);
    showToast(errMsg, "error");
  } finally {
    if (btnSpinner) btnSpinner.classList.add("hidden");
    if (btnText) btnText.textContent = "Consultar Material Prioritario";
    initIcons();
  }
}

function cargarTarjetaMaterial(mat, pasillo) {
  document.getElementById("mat-card-pasillo").textContent = pasillo;
  document.getElementById("mat-card-codigo").textContent = mat.material || "S/C";
  document.getElementById("mat-card-descripcion").textContent = mat.descripcion || "Sin descripción";
  document.getElementById("mat-card-pickeo").textContent = mat.ubicacionPickeo || "Sin ubicación asignada";
  
  // Porcentaje tomado estrictamente de la Columna K (PORCENTAJE) de la pestaña "Base Proyecto"
  let pctDisplay = "";
  if (mat.porcentajeRaw !== undefined && mat.porcentajeRaw !== null && String(mat.porcentajeRaw).trim() !== "") {
    const rawStr = String(mat.porcentajeRaw).trim();
    pctDisplay = rawStr.includes("%") ? rawStr : `${rawStr}%`;
  } else {
    const pct = Math.round(mat.porcentaje || 0);
    pctDisplay = `${pct}%`;
  }
  document.getElementById("mat-card-porcentaje").textContent = pctDisplay;
  
  document.getElementById("mat-card-p01").textContent = mat.p01 ?? 0;
  document.getElementById("mat-card-p02").textContent = mat.p02 ?? 0;
  document.getElementById("mat-card-p03").textContent = mat.p03 ?? 0;

  // Total a Surtir tomado estrictamente de Columna D (Ctd. UMB) de la pestaña "Base Proyecto"
  const total = (mat.ctdUMB !== undefined && mat.ctdUMB !== null) 
    ? mat.ctdUMB 
    : ((mat.totalSurtir !== undefined && mat.totalSurtir !== null) 
      ? mat.totalSurtir 
      : ((Number(mat.p01) || 0) + (Number(mat.p02) || 0) + (Number(mat.p03) || 0)));
  document.getElementById("mat-card-total").textContent = total;

  if (AppState.currentUser) {
    document.getElementById("mat-operador-asignado").textContent = AppState.currentUser.nombre || AppState.currentUser.usuario;
  }

  // Estado visual
  const estadoBadge = document.getElementById("mat-estado-badge");
  if (estadoBadge) {
    estadoBadge.className = "px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200 text-xs";
    estadoBadge.textContent = "Asignado a ti";
  }
}

// ==========================================================================
// REGISTRO DE PRODUCTIVIDAD (HOJA 2: Productividad)
// ==========================================================================
async function registrarAsignacionProductividad(mat, pasillo) {
  const usuario = AppState.currentUser ? AppState.currentUser.usuario : "desconocido";
  const nombreOp = AppState.currentUser ? AppState.currentUser.nombre : "Operador";

  const totalPiezas = (mat.ctdUMB !== undefined && mat.ctdUMB !== null) 
    ? mat.ctdUMB 
    : ((mat.totalSurtir !== undefined && mat.totalSurtir !== null) 
      ? mat.totalSurtir 
      : ((Number(mat.p01) || 0) + (Number(mat.p02) || 0) + (Number(mat.p03) || 0)));

  const payload = {
    usuario: usuario,
    nombreOperador: nombreOp,
    pasillo: pasillo,
    material: mat.material,
    descripcion: mat.descripcion,
    ubicacionPickeo: mat.ubicacionPickeo,
    p01: mat.p01,
    p02: mat.p02,
    p03: mat.p03,
    ctdUMB: totalPiezas,
    totalSurtir: totalPiezas,
    totalPiezas: totalPiezas,
    porcentaje: mat.porcentaje,
    estado: "Asignado"
  };

  try {
    const res = await API.saveProductividad(payload);
    if (res.success && res.idRegistro) {
      AppState.currentRegistroId = res.idRegistro;
    }
  } catch (e) {
    console.error("Error al registrar en hoja de productividad:", e);
  }
}

async function completarTareaActual() {
  if (!AppState.currentRegistroId && !AppState.currentMaterial) {
    showToast("No hay una tarea activa para completar", "warning");
    return;
  }

  const btnSpinner = document.getElementById("complete-btn-spinner");
  const btnText = document.getElementById("complete-btn-text");

  if (btnSpinner) btnSpinner.classList.remove("hidden");
  if (btnText) btnText.textContent = "Guardando en Productividad...";

  // Calcular minutos transcurridos
  const now = new Date();
  const diffMs = AppState.taskStartTime ? (now - AppState.taskStartTime) : 0;
  const minutos = Number((diffMs / 60000).toFixed(1));

  try {
    const res = await API.finalizarTarea(
      AppState.currentRegistroId, 
      minutos, 
      AppState.currentMaterial.material, 
      AppState.currentPasillo
    );

    AppState.currentMaterialStatus = "Completado";
    detenerCronometro();
    playAudioNotification("success");
    showToast(`¡Acomodo de ${AppState.currentMaterial.material} completado en ${minutos} min!`, "success");

    // Actualizar badge visual
    const estadoBadge = document.getElementById("mat-estado-badge");
    if (estadoBadge) {
      estadoBadge.className = "px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 text-xs";
      estadoBadge.textContent = "Completado ✓";
    }

    // Ofrecer pasar al siguiente material con menor porcentaje
    setTimeout(() => {
      const seguirEnPasillo = confirm(`¿Deseas surtir el SIGUIENTE material con menor porcentaje del pasillo ${AppState.currentPasillo}?`);
      if (seguirEnPasillo) {
        consultarMaterialPasillo(true);
      } else {
        regresarAPasillos(true);
      }
    }, 400);

  } catch (err) {
    showToast("Error al guardar tarea: " + err.message, "error");
  } finally {
    if (btnSpinner) btnSpinner.classList.add("hidden");
    if (btnText) btnText.textContent = "Marcar Acomodo como Completado";
    initIcons();
  }
}

/**
 * Lógica cuando el operador presiona "Siguiente Material"
 */
function consultarSiguienteMaterial() {
  if (!AppState.currentMaterial) {
    consultarMaterialPasillo(false);
    return;
  }

  // Si el material actual sigue como "Asignado" (no completado aún), mostramos el modal de decisión
  if (AppState.currentMaterialStatus === "Asignado") {
    abrirModalSiguienteMaterial();
  } else {
    // Si ya estaba completado, cargamos directamente el siguiente con menor porcentaje
    consultarMaterialPasillo(true);
  }
}

function abrirModalSiguienteMaterial() {
  const modal = document.getElementById("modal-siguiente-material");
  const codigoEl = document.getElementById("modal-next-mat-codigo");
  const descEl = document.getElementById("modal-next-mat-desc");

  if (codigoEl && AppState.currentMaterial) codigoEl.textContent = AppState.currentMaterial.material;
  if (descEl && AppState.currentMaterial) descEl.textContent = AppState.currentMaterial.descripcion;

  if (modal) modal.classList.remove("hidden");
  initIcons();
}

function cerrarModalSiguienteMaterial() {
  const modal = document.getElementById("modal-siguiente-material");
  if (modal) modal.classList.add("hidden");
}

async function accionSiguienteMaterial(tipo) {
  cerrarModalSiguienteMaterial();

  if (tipo === "completar") {
    // 1. Completar el actual y luego traer el siguiente
    const now = new Date();
    const diffMs = AppState.taskStartTime ? (now - AppState.taskStartTime) : 0;
    const minutos = Number((diffMs / 60000).toFixed(1));

    await API.finalizarTarea(
      AppState.currentRegistroId, 
      minutos, 
      AppState.currentMaterial.material, 
      AppState.currentPasillo
    );

    AppState.currentMaterialStatus = "Completado";
    showToast(`Material ${AppState.currentMaterial.material} completado. Buscando siguiente...`, "info");
    consultarMaterialPasillo(true);

  } else if (tipo === "posponer") {
    // 2. Liberar el bloqueo para que otro operador lo tome y pasar al siguiente
    await API.liberarMaterial(
      AppState.currentMaterial.material, 
      AppState.currentPasillo, 
      AppState.currentUser?.usuario
    );

    AppState.currentMaterialStatus = "Liberado";
    showToast(`Material ${AppState.currentMaterial.material} liberado. Buscando siguiente con menor %...`, "info");
    consultarMaterialPasillo(true);
  }
}

function regresarAPasillos(forzar = false) {
  if (!forzar && AppState.currentMaterial && AppState.currentMaterialStatus === "Asignado") {
    const confirmar = confirm(`Tienes el material ${AppState.currentMaterial.material} asignado.\n¿Deseas liberarlo para que otro operador pueda surtirlo?`);
    if (confirmar) {
      API.liberarMaterial(AppState.currentMaterial.material, AppState.currentPasillo, AppState.currentUser?.usuario);
      AppState.currentMaterialStatus = "Liberado";
    } else {
      return; // Permanece en el material actual
    }
  }

  detenerCronometro();
  AppState.currentMaterial = null;
  AppState.currentMaterialStatus = "Pendiente";
  
  showView("view-operador-pasillo");
  const input = document.getElementById("input-pasillo-display");
  if (input) {
    input.value = "";
    input.focus();
  }
}

/**
 * Saltar Material: Permite al operador saltar el material actual sin trabajarlo,
 * liberándolo de inmediato en el sistema para que otro operador pueda escogerlo,
 * y consultando automáticamente el siguiente material con menor porcentaje de este pasillo.
 */
async function saltarMaterialActual() {
  if (!AppState.currentMaterial) {
    showToast("No hay material activo para saltar", "warning");
    return;
  }

  const matCode = AppState.currentMaterial.material;
  const pasillo = AppState.currentPasillo;
  const usuario = AppState.currentUser?.usuario || "";

  const confirmar = confirm(`¿Deseas saltar el material ${matCode}?\n\nSe liberará en el sistema para que otro operador pueda trabajarlo y se te mostrará el siguiente material con menor porcentaje.`);
  if (!confirmar) return;

  try {
    // 1. Liberar el material en Google Sheets / Demo para que quede disponible a otros operadores
    await API.liberarMaterial(matCode, pasillo, usuario);
    AppState.currentMaterialStatus = "Liberado";
    detenerCronometro();

    // 2. Asegurarse de que esté en la lista de exclusión de esta sesión para este operador
    if (!AppState.sessionProcessedMaterials.includes(matCode)) {
      AppState.sessionProcessedMaterials.push(matCode);
    }

    showToast(`Material ${matCode} saltado y liberado. Buscando siguiente con menor %...`, "info");
    playAudioNotification("beep");

    // 3. Consultar el siguiente material con menor porcentaje del mismo pasillo
    await consultarMaterialPasillo(true);

  } catch (err) {
    showToast("Error al saltar material: " + err.message, "error");
  }
}

/**
 * Consulta y muestra en modal todas las ubicaciones y cantidades de stock disponible
 * del material actual desde la pestaña LX03, filtrando estrictamente por tp == "P02".
 */
async function consultarUbicacionesLX03() {
  if (!AppState.currentMaterial) {
    showToast("No hay un material seleccionado", "warning");
    return;
  }

  const matCode = AppState.currentMaterial.material;
  const modal = document.getElementById("modal-ubicaciones-lx03");
  const matEl = document.getElementById("modal-lx03-material");
  const totalStockEl = document.getElementById("modal-lx03-total-stock");
  const loadingEl = document.getElementById("modal-lx03-loading");
  const contentEl = document.getElementById("modal-lx03-content");
  const tbodyEl = document.getElementById("modal-lx03-tbody");
  const emptyEl = document.getElementById("modal-lx03-empty");

  if (matEl) matEl.textContent = `${matCode} - ${AppState.currentMaterial.descripcion || ""}`;
  if (totalStockEl) totalStockEl.textContent = "...";
  if (tbodyEl) tbodyEl.innerHTML = "";

  if (loadingEl) loadingEl.classList.remove("hidden");
  if (contentEl) contentEl.classList.add("hidden");
  if (emptyEl) emptyEl.classList.add("hidden");
  if (modal) modal.classList.remove("hidden");
  initIcons();

  try {
    const res = await API.getUbicacionesLX03(matCode);

    if (loadingEl) loadingEl.classList.add("hidden");

    if (res.success && res.ubicaciones && res.ubicaciones.length > 0) {
      if (totalStockEl) totalStockEl.textContent = res.totalStockDisponible ?? 0;

      let html = "";
      res.ubicaciones.forEach(item => {
        html += `
          <tr class="hover:bg-blue-50/40 transition-colors">
            <td class="py-2.5 px-3">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                ${item.tp || "P02"}
              </span>
            </td>
            <td class="py-2.5 px-3">
              <span class="font-extrabold text-slate-900 text-sm tracking-tight">${item.ubicacion}</span>
            </td>
            <td class="py-2.5 px-3 text-right">
              <span class="font-black text-emerald-600 text-sm">${item.stockDisponible}</span>
              <span class="text-[10px] text-slate-400 font-medium"> pzas</span>
            </td>
          </tr>
        `;
      });

      if (tbodyEl) tbodyEl.innerHTML = html;
      if (contentEl) contentEl.classList.remove("hidden");
    } else {
      if (totalStockEl) totalStockEl.textContent = "0";
      if (emptyEl) {
        emptyEl.classList.remove("hidden");
        const msg = res.message || "No se encontraron ubicaciones tipo P02 para este material en LX03.";
        const msgP = emptyEl.querySelector("p");
        if (msgP) msgP.textContent = msg;
      }
    }
  } catch (err) {
    if (loadingEl) loadingEl.classList.add("hidden");
    if (emptyEl) {
      emptyEl.classList.remove("hidden");
      const msgP = emptyEl.querySelector("p");
      if (msgP) msgP.textContent = "Error al consultar LX03: " + err.message;
    }
    showToast("Error al consultar LX03: " + err.message, "error");
  } finally {
    initIcons();
  }
}

function cerrarModalUbicacionesLX03() {
  const modal = document.getElementById("modal-ubicaciones-lx03");
  if (modal) modal.classList.add("hidden");
}

// ==========================================================================
// CRONÓMETRO DE TAREA (PRODUCTIVIDAD)
// ==========================================================================
function iniciarCronometro() {
  detenerCronometro();
  AppState.taskStartTime = new Date();
  const display = document.getElementById("task-timer");
  if (display) display.textContent = "00:00";

  AppState.timerInterval = setInterval(() => {
    if (!AppState.taskStartTime) return;
    const now = new Date();
    const diffSecs = Math.floor((now - AppState.taskStartTime) / 1000);
    const m = Math.floor(diffSecs / 60).toString().padStart(2, "0");
    const s = (diffSecs % 60).toString().padStart(2, "0");
    if (display) display.textContent = `${m}:${s}`;
  }, 1000);
}

function detenerCronometro() {
  if (AppState.timerInterval) {
    clearInterval(AppState.timerInterval);
    AppState.timerInterval = null;
  }
}

function copiarMaterial() {
  const code = document.getElementById("mat-card-codigo").textContent;
  navigator.clipboard.writeText(code).then(() => {
    showToast(`Código ${code} copiado al portapapeles`, "info");
  });
}

// ==========================================================================
// VISTA ADMINISTRATIVA: DASHBOARD, MÉTRICAS Y TABLAS
// ==========================================================================
function switchAdminTab(tab) {
  const btnKpi = document.getElementById("tab-btn-kpi");
  const btnUsers = document.getElementById("tab-btn-users");
  const subviewKpi = document.getElementById("admin-subview-kpi");
  const subviewUsers = document.getElementById("admin-subview-users");

  if (tab === "kpi") {
    btnKpi.className = "px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-sm flex items-center space-x-2";
    btnUsers.className = "px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 flex items-center space-x-2";
    subviewKpi.classList.remove("hidden");
    subviewUsers.classList.add("hidden");
  } else {
    btnUsers.className = "px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-sm flex items-center space-x-2";
    btnKpi.className = "px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 flex items-center space-x-2";
    subviewUsers.classList.remove("hidden");
    subviewKpi.classList.add("hidden");
    cargarUsuariosAdmin();
  }
  initIcons();
}

async function cargarProductividadAdmin() {
  showToast("Actualizando datos de productividad...", "info");
  try {
    const res = await API.getProductividad();
    if (res.success) {
      AppState.productividadList = res.registros || [];
      
      // Actualizar KPIs
      document.getElementById("kpi-total-acomodos").textContent = res.resumen.total || AppState.productividadList.length;
      document.getElementById("kpi-total-piezas").textContent = res.resumen.totalPiezas || 0;
      document.getElementById("kpi-completados").textContent = res.resumen.completados || 0;
      
      // Contar operadores únicos
      const ops = new Set(AppState.productividadList.map(r => r.usuario));
      document.getElementById("kpi-operadores-activos").textContent = ops.size;

      renderTablaProductividad(AppState.productividadList);
    }
  } catch (e) {
    showToast("Error al cargar productividad: " + e.message, "error");
  }
}

function renderTablaProductividad(lista) {
  const tbody = document.getElementById("tbody-productividad");
  const empty = document.getElementById("empty-productividad");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!lista || lista.length === 0) {
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");

  lista.forEach(r => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition-colors";

    const isCompletado = (r.estado || "").toLowerCase() === "completado";
    const badgeClass = isCompletado 
      ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
      : "bg-amber-100 text-amber-800 border border-amber-200";

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
        ${r.fecha || ""} <br><span class="text-slate-700 font-semibold">${r.horaInicio || ""}</span>
      </td>
      <td class="py-3 px-4 font-medium text-slate-900">
        ${r.nombreOperador || r.usuario}
      </td>
      <td class="py-3 px-4 font-bold text-blue-600 font-mono">
        P-${r.pasillo || "-"}
      </td>
      <td class="py-3 px-4 font-mono font-bold text-slate-800">
        ${r.material || "-"}
      </td>
      <td class="py-3 px-4 max-w-xs truncate" title="${r.descripcion || ""}">
        ${r.descripcion || "-"}
      </td>
      <td class="py-3 px-4 font-mono font-semibold text-amber-700">
        ${r.ubicacionPickeo || "-"}
      </td>
      <td class="py-3 px-4 text-center font-mono font-medium">${r.p01 ?? 0}</td>
      <td class="py-3 px-4 text-center font-mono font-medium">${r.p02 ?? 0}</td>
      <td class="py-3 px-4 text-center font-mono font-medium">${r.p03 ?? 0}</td>
      <td class="py-3 px-4 text-center font-mono font-black text-slate-900 bg-slate-50">
        ${r.totalPiezas ?? ((Number(r.p01)||0)+(Number(r.p02)||0)+(Number(r.p03)||0))}
      </td>
      <td class="py-3 px-4 text-center font-mono font-bold text-red-600">
        ${Math.round(r.porcentaje || 0)}%
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass}">
          ${r.estado || "Asignado"}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarTablaProductividad() {
  const query = (document.getElementById("admin-filter-search")?.value || "").toLowerCase();
  const pasillo = document.getElementById("admin-filter-pasillo")?.value || "";
  const estado = document.getElementById("admin-filter-estado")?.value || "";

  const filtrados = AppState.productividadList.filter(item => {
    const matchQuery = !query || 
      (item.material && item.material.toLowerCase().includes(query)) ||
      (item.descripcion && item.descripcion.toLowerCase().includes(query)) ||
      (item.nombreOperador && item.nombreOperador.toLowerCase().includes(query)) ||
      (item.usuario && item.usuario.toLowerCase().includes(query));

    const matchPasillo = !pasillo || String(item.pasillo) === String(pasillo);
    const matchEstado = !estado || (item.estado && item.estado.toLowerCase() === estado.toLowerCase());

    return matchQuery && matchPasillo && matchEstado;
  });

  renderTablaProductividad(filtrados);
}

function descargarCSVProductividad() {
  if (!AppState.productividadList || AppState.productividadList.length === 0) {
    showToast("No hay datos para exportar", "warning");
    return;
  }

  let csv = "ID_Registro,Fecha,Hora_Inicio,Hora_Fin,Usuario,Operador,Pasillo,Material,Descripcion,Ubicacion_Pickeo,P01,P02,P03,Total_Piezas,Porcentaje,Estado,Minutos\n";

  AppState.productividadList.forEach(r => {
    const row = [
      `"${r.idRegistro || ""}"`,
      `"${r.fecha || ""}"`,
      `"${r.horaInicio || ""}"`,
      `"${r.horaFin || ""}"`,
      `"${r.usuario || ""}"`,
      `"${(r.nombreOperador || "").replace(/"/g, '""')}"`,
      `"${r.pasillo || ""}"`,
      `"${r.material || ""}"`,
      `"${(r.descripcion || "").replace(/"/g, '""')}"`,
      `"${r.ubicacionPickeo || ""}"`,
      r.p01 || 0,
      r.p02 || 0,
      r.p03 || 0,
      r.totalPiezas || 0,
      r.porcentaje || 0,
      `"${r.estado || ""}"`,
      r.minutos || 0
    ];
    csv += row.join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `productividad_acomodo_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================================================
// GESTIÓN DE USUARIOS (Hoja 2: Usuarios)
// ==========================================================================
async function cargarUsuariosAdmin() {
  try {
    const res = await API.getUsuarios();
    if (res.success && res.usuarios) {
      AppState.usuariosList = res.usuarios;
      renderTablaUsuarios(res.usuarios);
    }
  } catch (e) {
    showToast("Error al cargar usuarios: " + e.message, "error");
  }
}

function renderTablaUsuarios(usuarios) {
  const tbody = document.getElementById("tbody-usuarios");
  if (!tbody) return;
  tbody.innerHTML = "";

  usuarios.forEach(u => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50";

    const esAdmin = (u.rol || "").toLowerCase().includes("admin");
    const roleBadge = esAdmin
      ? '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">Administrativo</span>'
      : '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Operador</span>';

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold text-slate-800">${u.usuario}</td>
      <td class="py-3 px-4 font-medium text-slate-900">${u.nombre}</td>
      <td class="py-3 px-4">${roleBadge}</td>
      <td class="py-3 px-4 text-center">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          ${u.activo || "SI"}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function abrirModalNuevoUsuario() {
  document.getElementById("modal-nuevo-usuario").classList.remove("hidden");
  document.getElementById("new-user-id").focus();
}

function cerrarModalNuevoUsuario() {
  document.getElementById("modal-nuevo-usuario").classList.add("hidden");
  document.getElementById("form-nuevo-usuario").reset();
}

async function guardarNuevoUsuario(e) {
  e.preventDefault();
  const id = document.getElementById("new-user-id").value.trim();
  const nombre = document.getElementById("new-user-nombre").value.trim();
  const pass = document.getElementById("new-user-password").value.trim();
  const rol = document.getElementById("new-user-rol").value;

  try {
    const res = await API.createUsuario({ usuario: id, nombre: nombre, password: pass, rol: rol });
    if (res.success) {
      showToast("Usuario registrado exitosamente en hoja Usuarios", "success");
      cerrarModalNuevoUsuario();
      cargarUsuariosAdmin();
    } else {
      showToast(res.message || "No se pudo registrar el usuario", "error");
    }
  } catch (err) {
    showToast("Error al guardar usuario: " + err.message, "error");
  }
}

// ==========================================================================
// MODAL DE CONFIGURACIÓN Y MODO DEMO
// ==========================================================================
function abrirModalConfig() {
  const modal = document.getElementById("modal-config");
  const inputUrl = document.getElementById("modal-input-url");
  const checkDemo = document.getElementById("modal-check-demo");
  const resultBox = document.getElementById("modal-test-result");

  if (inputUrl) inputUrl.value = CONFIG.APPS_SCRIPT_WEBAPP_URL || "";
  if (checkDemo) checkDemo.checked = CONFIG.DEMO_MODE;
  if (resultBox) resultBox.classList.add("hidden");

  modal.classList.remove("hidden");
  initIcons();
}

function cerrarModalConfig() {
  document.getElementById("modal-config").classList.add("hidden");
}

async function probarConexionModal() {
  const url = document.getElementById("modal-input-url").value.trim();
  const resultBox = document.getElementById("modal-test-result");

  if (!url) {
    resultBox.className = "p-2.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200";
    resultBox.textContent = "Ingrese la URL del Web App de Apps Script para probar.";
    resultBox.classList.remove("hidden");
    return;
  }

  resultBox.className = "p-2.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200";
  resultBox.textContent = "Conectando con Google Apps Script...";
  resultBox.classList.remove("hidden");

  const res = await API.testConnection(url);
  if (res.success) {
    resultBox.className = "p-2.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200";
    resultBox.textContent = "✓ ¡Conexión exitosa! Las hojas de cálculo responden correctamente.";
  } else {
    resultBox.className = "p-2.5 rounded-lg text-xs font-medium bg-red-50 text-red-800 border border-red-200";
    resultBox.textContent = "✗ Error: " + res.message;
  }
}

function guardarConfigModal() {
  const url = document.getElementById("modal-input-url").value.trim();
  const demo = document.getElementById("modal-check-demo").checked;

  CONFIG.APPS_SCRIPT_WEBAPP_URL = url;
  CONFIG.DEMO_MODE = demo;

  localStorage.setItem("acomodo_apps_script_url", url);
  localStorage.setItem("acomodo_demo_mode", demo ? "true" : "false");

  actualizarIndicadorConexion();
  cerrarModalConfig();
  showToast("Configuración guardada", "success");
}

function restablecerDatosDemoModal() {
  const confirmar = confirm("¿Deseas restablecer todos los materiales y bitácoras de demostración a su estado original?");
  if (confirmar) {
    API.resetDemoData();
    AppState.currentMaterial = null;
    AppState.currentMaterialStatus = "Pendiente";
    AppState.sessionProcessedMaterials = [];
    detenerCronometro();
    showToast("Datos de demostración restablecidos", "success");
    cerrarModalConfig();
    if (AppState.currentUser) {
      if (AppState.currentUser.rol.toLowerCase().includes("admin")) {
        cargarProductividadAdmin();
      } else {
        regresarAPasillos(true);
      }
    }
  }
}

function actualizarIndicadorConexion() {
  const dot = document.getElementById("status-dot");
  const text = document.getElementById("status-text");

  if (!dot || !text) return;

  if (API.isLive()) {
    dot.className = "w-2 h-2 rounded-full bg-emerald-400";
    text.textContent = "Google Sheets Conectado";
    document.getElementById("btn-toggle-config").className = "flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/80";
  } else {
    dot.className = "w-2 h-2 rounded-full bg-amber-400 animate-pulse";
    text.textContent = "Modo Demo";
    document.getElementById("btn-toggle-config").className = "flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-amber-300 border border-amber-500/30";
  }
}

// ==========================================================================
// UTILIDADES: TOASTS Y SONIDO HÁPTICO
// ==========================================================================
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  const icons = {
    success: "check-circle",
    error: "alert-octagon",
    warning: "alert-triangle",
    info: "info"
  };

  const bgColors = {
    success: "bg-emerald-600 text-white",
    error: "bg-red-600 text-white",
    warning: "bg-amber-500 text-white",
    info: "bg-slate-900 text-white"
  };

  toast.className = `p-3.5 rounded-xl shadow-xl flex items-center space-x-3 pointer-events-auto transform transition-all duration-300 translate-y-2 opacity-0 text-sm font-medium ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <i data-lucide="${icons[type] || 'info'}" class="w-5 h-5 shrink-0"></i>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  initIcons();

  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  });

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function playAudioNotification(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "click") {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === "beep") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === "success") {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "error") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // Si el navegador bloquea audio sin interacción previa, ignorar
  }
}
