// ==========================================================================
// CONFIGURACIÓN DE CONEXIÓN CON GOOGLE SHEETS Y APPS SCRIPT
// ==========================================================================

const CONFIG = {
  // IDs de los libros de Google Sheets proporcionados
  SHEET_BASE_PROYECTO_ID: "1G1_AgR-dV2ZD9gDJ7i6srHwSBDF3ttNSVAgagCiRk-o",
  SHEET_USUARIOS_PROD_ID: "1mji1apV0tphVU4lC0MmlOiFKGY1UmQVJ-xLr1i2yaG4",

  // Nombres exactos de las hojas (pestañas)
  TAB_BASE_PROYECTO: "Base Proyecto",
  TAB_USUARIOS: "Usuarios",
  TAB_PRODUCTIVIDAD: "Productividad",

  // URL del Web App de Google Apps Script (se configura tras desplegar el archivo Code.gs)
  // Puedes pegar aquí tu URL desplegada de Google Apps Script:
  // Ejemplo: "https://script.google.com/macros/s/AKfycbx.../exec"
  APPS_SCRIPT_WEBAPP_URL: "",

  // Modo Demo: permite probar la app inmediatamente en el navegador
  // sin configurar Google Apps Script o cuando no hay conexión.
  DEMO_MODE: true,

  // Versión del sistema
  APP_VERSION: "1.0.0"
};

// Cargar configuración guardada en LocalStorage si el usuario configuró su URL desde la app
(function initConfig() {
  const savedUrl = localStorage.getItem("acomodo_apps_script_url");
  if (savedUrl && savedUrl.trim() !== "") {
    CONFIG.APPS_SCRIPT_WEBAPP_URL = savedUrl.trim();
    CONFIG.DEMO_MODE = false;
  }
  const savedDemo = localStorage.getItem("acomodo_demo_mode");
  if (savedDemo !== null) {
    CONFIG.DEMO_MODE = savedDemo === "true";
  }
})();
