/**
 * =========================================================================================
 * BACKEND GOOGLE APPS SCRIPT - SISTEMA DE PRODUCTIVIDAD Y ACOMODO DE MATERIALES
 * =========================================================================================
 * 
 * Este script se publica como "Aplicación web" (Web App) con acceso "Cualquiera" (Anyone)
 * para servir de puente seguro (API REST) entre GitHub Pages (HTML/JS) y las Hojas de Cálculo.
 * 
 * Hojas de Cálculo vinculadas:
 *  1. Inventario / Base: 1G1_AgR-dV2ZD9gDJ7i6srHwSBDF3ttNSVAgagCiRk-o (Pestaña: "Base Proyecto")
 *  2. Usuarios y Prod.: 1mji1apV0tphVU4lC0MmlOiFKGY1UmQVJ-xLr1i2yaG4 (Pestañas: "Usuarios", "Productividad")
 */

// IDs proporcionados
const ID_SHEET_BASE = "1G1_AgR-dV2ZD9gDJ7i6srHwSBDF3ttNSVAgagCiRk-o";
const ID_SHEET_PROD = "1mji1apV0tphVU4lC0MmlOiFKGY1UmQVJ-xLr1i2yaG4";

const TAB_BASE_PROYECTO = "Base Proyecto";
const TAB_USUARIOS = "Usuarios";
const TAB_PRODUCTIVIDAD = "Productividad";

// =========================================================================================
// HANDLER: GET REQUESTS (Consultas y Lecturas)
// =========================================================================================
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || "ping";

    let result = { success: false, message: "Acción no reconocida" };

    switch (action) {
      case "ping":
        result = { 
          success: true, 
          message: "Conexión exitosa con Google Apps Script de Acomodo", 
          timestamp: new Date().toISOString() 
        };
        break;

      case "login":
        result = handleLogin(params.usuario, params.password);
        break;

      case "getMaterialByPasillo":
        result = handleGetMaterialByPasillo(params.pasillo, params.usuario, params.exclude);
        break;

      case "liberarMaterial":
        result = handleLiberarMaterial(params.material, params.pasillo, params.usuario);
        break;

      case "getProductividad":
        result = handleGetProductividad(params);
        break;

      case "getUsuarios":
        result = handleGetUsuarios();
        break;

      default:
        result = { success: false, message: "Acción GET no soportada: " + action };
    }

    return respondJson(result);
  } catch (err) {
    return respondJson({ success: false, error: err.toString(), stack: err.stack });
  }
}

// =========================================================================================
// HANDLER: POST REQUESTS (Inserciones y Actualizaciones)
// =========================================================================================
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || "";
    let result = { success: false, message: "Acción POST no reconocida" };

    switch (action) {
      case "saveProductividad":
        result = handleSaveProductividad(payload);
        break;

      case "saveUsuario":
        result = handleSaveUsuario(payload);
        break;

      case "finalizarTarea":
        result = handleFinalizarTarea(payload);
        break;

      case "liberarMaterial":
        result = handleLiberarMaterial(payload.material, payload.pasillo, payload.usuario);
        break;

      default:
        result = { success: false, message: "Acción POST no soportada: " + action };
    }

    return respondJson(result);
  } catch (err) {
    return respondJson({ success: false, error: err.toString(), stack: err.stack });
  }
}

// =========================================================================================
// LOGICA DE NEGOCIO
// =========================================================================================

/**
 * 1. Login de Usuario contra la pestaña "Usuarios" del Archivo 2
 */
function handleLogin(usuarioInput, passwordInput) {
  if (!usuarioInput) {
    return { success: false, message: "Debe ingresar un usuario" };
  }

  const ss = SpreadsheetApp.openById(ID_SHEET_PROD);
  let sheet = ss.getSheetByName(TAB_USUARIOS);
  
  if (!sheet) {
    sheet = initializeUsuariosSheet(ss);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: false, message: "No hay usuarios registrados en el sistema" };
  }

  const headers = data[0].map(h => normalizeHeader(h));
  const idxUser = findColumnIndex(headers, ["usuario", "user", "id", "operador"]);
  const idxPass = findColumnIndex(headers, ["password", "contrasena", "clave", "pin"]);
  const idxNombre = findColumnIndex(headers, ["nombre", "nombrecompleto", "operador"]);
  const idxRol = findColumnIndex(headers, ["rol", "tipo", "tipodeusuario", "perfil"]);
  const idxActivo = findColumnIndex(headers, ["activo", "estatus", "estado"]);

  const cleanInputUser = String(usuarioInput).trim().toLowerCase();
  const cleanInputPass = passwordInput ? String(passwordInput).trim() : "";

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const userVal = String(row[idxUser] || "").trim().toLowerCase();
    const passVal = idxPass !== -1 ? String(row[idxPass] || "").trim() : "";
    const activoVal = idxActivo !== -1 ? String(row[idxActivo] || "").trim().toUpperCase() : "SI";

    if (userVal === cleanInputUser) {
      if (activoVal === "NO" || activoVal === "INACTIVO") {
        return { success: false, message: "El usuario está inactivo. Contacte al administrativo." };
      }

      // Validar contraseña si la columna existe en el sheet
      if (idxPass !== -1 && passVal !== "" && cleanInputPass !== "" && passVal !== cleanInputPass) {
        return { success: false, message: "Contraseña incorrecta" };
      }

      const rolVal = idxRol !== -1 ? String(row[idxRol] || "Operador").trim() : "Operador";
      const nombreVal = idxNombre !== -1 && row[idxNombre] ? String(row[idxNombre]).trim() : userVal;

      return {
        success: true,
        user: {
          usuario: String(row[idxUser]).trim(),
          nombre: nombreVal,
          rol: rolVal.toLowerCase().includes("admin") ? "Administrativo" : "Operador"
        }
      };
    }
  }

  return { success: false, message: "Usuario no encontrado" };
}

/**
 * 2. Obtener Material de un Pasillo con el MENOR PORCENTAJE (Archivo 1: Base Proyecto)
 *    - Cruza información con la hoja 'Productividad' del Archivo 2 para excluir
 *      materiales que YA FUERON TRABAJADOS / COMPLETADOS o asignados previamente.
 *    - Excluye materiales marcados como Completados (100% o estado completado).
 *    - Excluye materiales en la lista exclude de la sesión actual.
 *    - Bloquea/Asigna inmediatamente el material en Base Proyecto a nombre del operador.
 */
function handleGetMaterialByPasillo(pasilloInput, usuarioInput, excludeRaw) {
  if (pasilloInput === undefined || pasilloInput === null || String(pasilloInput).trim() === "") {
    return { success: false, message: "Debe especificar el número de pasillo" };
  }

  const cleanPasillo = String(pasilloInput).trim();
  const cleanUsuario = usuarioInput ? String(usuarioInput).trim().toLowerCase() : "";

  // 1. OBTENER MATERIALES YA TRABAJADOS DESDE LA HOJA "PRODUCTIVIDAD" (ARCHIVO 2)
  const ssProd = SpreadsheetApp.openById(ID_SHEET_PROD);
  const sheetProd = ssProd.getSheetByName(TAB_PRODUCTIVIDAD);
  const materialesTrabajados = new Set();
  const materialesActualmenteAsignados = new Set();

  if (sheetProd) {
    const prodData = sheetProd.getDataRange().getValues();
    if (prodData.length > 1) {
      const prodHeaders = prodData[0].map(h => normalizeHeader(h));
      const idxProdMat = findColumnIndex(prodHeaders, ["material", "codigo", "sku"]);
      const idxProdEstado = findColumnIndex(prodHeaders, ["estado", "estatus", "status"]);

      if (idxProdMat !== -1 && idxProdEstado !== -1) {
        for (let p = 1; p < prodData.length; p++) {
          const matCod = String(prodData[p][idxProdMat] || "").trim().toLowerCase();
          const estCod = String(prodData[p][idxProdEstado] || "").trim().toLowerCase();
          
          if (matCod) {
            if (estCod === "completado" || estCod.includes("complet")) {
              materialesTrabajados.add(matCod);
            } else if (estCod === "asignado" || estCod.includes("proceso")) {
              materialesActualmenteAsignados.add(matCod);
            }
          }
        }
      }
    }
  }

  // 2. ABRIR HOJA "BASE PROYECTO" (ARCHIVO 1)
  const ssBase = SpreadsheetApp.openById(ID_SHEET_BASE);
  const sheetBase = ssBase.getSheetByName(TAB_BASE_PROYECTO);
  if (!sheetBase) {
    return { success: false, message: "No se encontró la hoja '" + TAB_BASE_PROYECTO + "' en la base de inventario" };
  }

  const data = sheetBase.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: false, message: "La hoja de inventario no contiene registros" };
  }

  const headers = data[0].map(h => normalizeHeader(h));
  
  const idxPasillo = findColumnIndex(headers, ["pasillo", "aisle", "rack"]);
  const idxMaterial = findColumnIndex(headers, ["material", "codigo", "sku", "articulo", "clave"]);
  const idxDesc = findColumnIndex(headers, ["descripcion", "desc", "producto", "nombre"]);
  const idxPorcentaje = findColumnIndex(headers, ["porcentaje", "pct", "%", "avance", "porcentajeavance"]);
  const idxPickeo = findColumnIndex(headers, ["ubicaciondepickeo", "ubicacionpickeo", "pickeo", "ubicacion", "posicion"]);
  const idxP01 = findColumnIndex(headers, ["p01", "p1", "cantidaddep01", "cantp01"]);
  const idxP02 = findColumnIndex(headers, ["p02", "p2", "cantidaddep02", "cantp02"]);
  const idxP03 = findColumnIndex(headers, ["p03", "p3", "cantidaddep03", "cantp03"]);
  let idxEstatus = findColumnIndex(headers, ["estatus", "estado", "asignado", "status"]);

  // Si no existe columna de estatus en Base Proyecto, la añadimos para poder bloquear
  if (idxEstatus === -1) {
    idxEstatus = headers.length;
    sheetBase.getRange(1, idxEstatus + 1).setValue("Estatus");
  }

  // Lista de exclusión enviada por el frontend (para navegar al siguiente material)
  let excludeList = [];
  if (excludeRaw) {
    if (typeof excludeRaw === "string") {
      excludeList = excludeRaw.split(",").map(s => s.trim().toLowerCase());
    } else if (Array.isArray(excludeRaw)) {
      excludeList = excludeRaw.map(s => String(s).trim().toLowerCase());
    }
  }

  // 3. FILTRAR MATERIALES DEL PASILLO
  const itemsEnPasillo = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowPasillo = String(row[idxPasillo] || "").trim();

    const coincidePasillo = (rowPasillo === cleanPasillo) || 
                            (parseFloat(rowPasillo) === parseFloat(cleanPasillo) && !isNaN(parseFloat(cleanPasillo)));

    if (coincidePasillo) {
      const matCode = idxMaterial !== -1 ? String(row[idxMaterial] || "").trim() : "";
      const matCodeLower = matCode.toLowerCase();
      const estatus = idxEstatus !== -1 ? String(row[idxEstatus] || "").trim() : "";
      const estatusLower = estatus.toLowerCase();
      const porcentajeRaw = row[idxPorcentaje];
      const porcentajeNum = parsePercentage(porcentajeRaw);

      // Verificación 1: ¿Ya está completado en Base Proyecto o en Productividad?
      const yaCompletado = estatusLower.includes("complet") || 
                           porcentajeNum >= 100 || 
                           materialesTrabajados.has(matCodeLower);

      // Verificación 2: ¿Ya está asignado actualmente a alguien?
      const yaAsignado = estatusLower.includes("asignad") || 
                         materialesActualmenteAsignados.has(matCodeLower);

      // Verificación 3: ¿Está excluido en la navegación de esta sesión?
      const estaExcluido = excludeList.includes(matCodeLower);

      itemsEnPasillo.push({
        rowIndex: i + 1,
        pasillo: rowPasillo,
        material: matCode,
        descripcion: idxDesc !== -1 ? String(row[idxDesc] || "") : "",
        porcentajeRaw: porcentajeRaw,
        porcentaje: porcentajeNum,
        ubicacionPickeo: idxPickeo !== -1 ? String(row[idxPickeo] || "") : "",
        p01: idxP01 !== -1 ? parseQty(row[idxP01]) : 0,
        p02: idxP02 !== -1 ? parseQty(row[idxP02]) : 0,
        p03: idxP03 !== -1 ? parseQty(row[idxP03]) : 0,
        estatus: estatus,
        yaCompletado: yaCompletado,
        yaAsignado: yaAsignado,
        estaExcluido: estaExcluido
      });
    }
  }

  if (itemsEnPasillo.length === 0) {
    return {
      success: false,
      message: "No se encontraron materiales para el Pasillo " + cleanPasillo + ". Verifique el número ingresado."
    };
  }

  // 4. FILTRAR CANDIDATOS DISPONIBLES:
  //    - NO completados (ni en Base Proyecto ni en Productividad)
  //    - NO asignados previamente (así no se repite un material ya mandado)
  //    - NO excluidos en esta sesión
  let candidatos = itemsEnPasillo.filter(item => {
    return !item.yaCompletado && !item.yaAsignado && !item.estaExcluido;
  });

  if (candidatos.length === 0) {
    // Verificar si todos están completados
    const completadosCount = itemsEnPasillo.filter(item => item.yaCompletado).length;
    if (completadosCount === itemsEnPasillo.length) {
      return {
        success: false,
        message: "¡Excelente! Todos los materiales del Pasillo " + cleanPasillo + " ya han sido trabajados y completados."
      };
    }

    // Verificar si los restantes están asignados a otros
    const asignadosCount = itemsEnPasillo.filter(item => item.yaAsignado).length;
    if (asignadosCount > 0) {
      return {
        success: false,
        message: "Los materiales restantes del Pasillo " + cleanPasillo + " están siendo surtidos por otros operadores."
      };
    }

    return {
      success: false,
      message: "No hay más materiales pendientes para surtir en el Pasillo " + cleanPasillo + "."
    };
  }

  // 5. ORDENAR POR MENOR PORCENTAJE (ASCENDENTE)
  candidatos.sort((a, b) => a.porcentaje - b.porcentaje);

  const materialElegido = candidatos[0];

  // 6. BLOQUEAR / ASIGNAR EN BASE PROYECTO
  if (materialElegido && cleanUsuario) {
    const estatusAsignado = "Asignado - " + (usuarioInput || cleanUsuario);
    sheetBase.getRange(materialElegido.rowIndex, idxEstatus + 1).setValue(estatusAsignado);
    materialElegido.estatus = estatusAsignado;
  }

  return {
    success: true,
    material: materialElegido,
    totalMaterialesEnPasillo: itemsEnPasillo.length,
    candidatosRestantes: candidatos.length
  };
}

/**
 * 3. Liberar material (cuando el operador pospone o cancela sin completar)
 */
function handleLiberarMaterial(materialCode, pasillo, usuario) {
  if (!materialCode) return { success: false, message: "Material requerido" };

  updateBaseProyectoStatus(materialCode, pasillo, "Pendiente");

  return {
    success: true,
    message: "Material " + materialCode + " liberado para que otro operador lo pueda tomar."
  };
}

/**
 * 4. Guardar registro en la hoja "Productividad" del Archivo 2
 */
function handleSaveProductividad(payload) {
  const ss = SpreadsheetApp.openById(ID_SHEET_PROD);
  let sheet = ss.getSheetByName(TAB_PRODUCTIVIDAD);

  if (!sheet) {
    sheet = initializeProductividadSheet(ss);
  }

  const idRegistro = payload.idRegistro || "PROD-" + Utilities.formatDate(new Date(), "GMT-6", "yyyyMMdd-HHmmss") + "-" + Math.floor(Math.random() * 1000);
  const now = new Date();
  const fechaStr = Utilities.formatDate(now, "GMT-6", "yyyy-MM-dd");
  const horaStr = Utilities.formatDate(now, "GMT-6", "HH:mm:ss");

  const row = [
    idRegistro,
    fechaStr,
    horaStr,                                     // Hora Inicio / Asignación
    payload.horaFin || "",                       // Hora Fin (al completar)
    payload.usuario || "",
    payload.nombreOperador || "",
    payload.pasillo || "",
    payload.material || "",
    payload.descripcion || "",
    payload.ubicacionPickeo || "",
    parseQty(payload.p01),
    parseQty(payload.p02),
    parseQty(payload.p03),
    parseQty(payload.p01) + parseQty(payload.p02) + parseQty(payload.p03), // Total piezas
    payload.porcentaje || 0,
    payload.estado || "Asignado",                // Asignado | En Proceso | Completado
    payload.minutosTranscurridos || 0,
    payload.observaciones || ""
  ];

  sheet.appendRow(row);

  return {
    success: true,
    message: "Registro de productividad guardado exitosamente",
    idRegistro: idRegistro
  };
}

/**
 * 5. Actualizar registro al Finalizar la tarea y marcar en Base Proyecto como Completado (100%)
 */
function handleFinalizarTarea(payload) {
  const ss = SpreadsheetApp.openById(ID_SHEET_PROD);
  const sheet = ss.getSheetByName(TAB_PRODUCTIVIDAD);
  if (!sheet) return { success: false, message: "Hoja de productividad no encontrada" };

  const idRegistro = payload.idRegistro;
  if (!idRegistro) return { success: false, message: "ID de registro requerido" };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idRegistro)) {
      const now = new Date();
      const horaFin = Utilities.formatDate(now, "GMT-6", "HH:mm:ss");
      
      // Actualizar Hora_Fin (Columna 4), Estado (Columna 16), Minutos (Columna 17)
      sheet.getRange(i + 1, 4).setValue(horaFin);
      sheet.getRange(i + 1, 16).setValue("Completado");
      if (payload.minutosTranscurridos) {
        sheet.getRange(i + 1, 17).setValue(payload.minutosTranscurridos);
      }
      
      // Marcar en la Base Proyecto como "Completado" y porcentaje al 100%
      if (payload.material) {
        updateBaseProyectoCompletado(payload.material, payload.pasillo);
      }

      return { success: true, message: "Tarea completada y guardada en hoja Productividad" };
    }
  }

  return { success: false, message: "No se encontró el registro para actualizar" };
}

/**
 * Helper para actualizar el estatus y porcentaje de un material en la hoja "Base Proyecto" del Archivo 1
 */
function updateBaseProyectoStatus(materialCode, pasillo, nuevoEstatus) {
  try {
    const ss = SpreadsheetApp.openById(ID_SHEET_BASE);
    const sheet = ss.getSheetByName(TAB_BASE_PROYECTO);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    const headers = data[0].map(h => normalizeHeader(h));
    let idxEstatus = findColumnIndex(headers, ["estatus", "estado", "asignado", "status"]);
    if (idxEstatus === -1) {
      idxEstatus = headers.length;
      sheet.getRange(1, idxEstatus + 1).setValue("Estatus");
    }

    const idxMaterial = findColumnIndex(headers, ["material", "codigo", "sku", "articulo", "clave"]);
    const idxPasillo = findColumnIndex(headers, ["pasillo", "aisle", "rack"]);

    for (let i = 1; i < data.length; i++) {
      const rowMat = idxMaterial !== -1 ? String(data[i][idxMaterial] || "").trim() : "";
      const rowPas = idxPasillo !== -1 ? String(data[i][idxPasillo] || "").trim() : "";

      const coincideMat = (rowMat === String(materialCode).trim());
      const coincidePas = !pasillo || (rowPas === String(pasillo).trim());

      if (coincideMat && coincidePas) {
        sheet.getRange(i + 1, idxEstatus + 1).setValue(nuevoEstatus);
        break;
      }
    }
  } catch (err) {
    Logger.log("Error al actualizar estatus en Base Proyecto: " + err);
  }
}

function updateBaseProyectoCompletado(materialCode, pasillo) {
  try {
    const ss = SpreadsheetApp.openById(ID_SHEET_BASE);
    const sheet = ss.getSheetByName(TAB_BASE_PROYECTO);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    const headers = data[0].map(h => normalizeHeader(h));
    let idxEstatus = findColumnIndex(headers, ["estatus", "estado", "asignado", "status"]);
    const idxPorcentaje = findColumnIndex(headers, ["porcentaje", "pct", "%", "avance"]);
    const idxMaterial = findColumnIndex(headers, ["material", "codigo", "sku", "articulo", "clave"]);
    const idxPasillo = findColumnIndex(headers, ["pasillo", "aisle", "rack"]);

    if (idxEstatus === -1) {
      idxEstatus = headers.length;
      sheet.getRange(1, idxEstatus + 1).setValue("Estatus");
    }

    for (let i = 1; i < data.length; i++) {
      const rowMat = idxMaterial !== -1 ? String(data[i][idxMaterial] || "").trim() : "";
      const rowPas = idxPasillo !== -1 ? String(data[i][idxPasillo] || "").trim() : "";

      const coincideMat = (rowMat === String(materialCode).trim());
      const coincidePas = !pasillo || (rowPas === String(pasillo).trim());

      if (coincideMat && coincidePas) {
        sheet.getRange(i + 1, idxEstatus + 1).setValue("Completado");
        if (idxPorcentaje !== -1) {
          sheet.getRange(i + 1, idxPorcentaje + 1).setValue(1.0); // 100%
        }
        break;
      }
    }
  } catch (err) {
    Logger.log("Error al marcar completado en Base Proyecto: " + err);
  }
}

/**
 * 6. Consultar registros de Productividad para el Administrativo
 */
function handleGetProductividad(params) {
  const ss = SpreadsheetApp.openById(ID_SHEET_PROD);
  let sheet = ss.getSheetByName(TAB_PRODUCTIVIDAD);
  if (!sheet) {
    sheet = initializeProductividadSheet(ss);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, registros: [], resumen: { total: 0, completados: 0, piezas: 0 } };
  }

  const registros = [];
  let totalPiezas = 0;
  let completados = 0;

  for (let i = data.length - 1; i >= 1; i--) { // De más reciente a más antiguo
    const r = data[i];
    const piezas = Number(r[13]) || 0;
    const estado = String(r[15] || "");

    totalPiezas += piezas;
    if (estado.toLowerCase() === "completado") completados++;

    registros.push({
      idRegistro: r[0],
      fecha: r[1] instanceof Date ? Utilities.formatDate(r[1], "GMT-6", "yyyy-MM-dd") : String(r[1]),
      horaInicio: r[2] instanceof Date ? Utilities.formatDate(r[2], "GMT-6", "HH:mm:ss") : String(r[2]),
      horaFin: r[3] instanceof Date ? Utilities.formatDate(r[3], "GMT-6", "HH:mm:ss") : String(r[3]),
      usuario: r[4],
      nombreOperador: r[5],
      pasillo: r[6],
      material: r[7],
      descripcion: r[8],
      ubicacionPickeo: r[9],
      p01: r[10],
      p02: r[11],
      p03: r[12],
      totalPiezas: piezas,
      porcentaje: r[14],
      estado: estado,
      minutos: r[16],
      observaciones: r[17] || ""
    });
  }

  return {
    success: true,
    registros: registros,
    resumen: {
      total: registros.length,
      completados: completados,
      pendientes: registros.length - completados,
      totalPiezas: totalPiezas
    }
  };
}

/**
 * 7. Consultar Usuarios para el Administrativo
 */
function handleGetUsuarios() {
  const ss = SpreadsheetApp.openById(ID_SHEET_PROD);
  let sheet = ss.getSheetByName(TAB_USUARIOS);
  if (!sheet) {
    sheet = initializeUsuariosSheet(ss);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, usuarios: [] };

  const usuarios = [];
  for (let i = 1; i < data.length; i++) {
    usuarios.push({
      usuario: data[i][0],
      nombre: data[i][1],
      rol: data[i][3] || "Operador",
      activo: data[i][4] || "SI"
    });
  }

  return { success: true, usuarios: usuarios };
}

/**
 * 8. Crear nuevo usuario en la hoja "Usuarios"
 */
function handleSaveUsuario(payload) {
  const ss = SpreadsheetApp.openById(ID_SHEET_PROD);
  let sheet = ss.getSheetByName(TAB_USUARIOS);
  if (!sheet) sheet = initializeUsuariosSheet(ss);

  if (!payload.usuario || !payload.nombre) {
    return { success: false, message: "Usuario y Nombre son obligatorios" };
  }

  sheet.appendRow([
    payload.usuario.trim(),
    payload.nombre.trim(),
    payload.password ? payload.password.trim() : "1234",
    payload.rol || "Operador",
    "SI",
    Utilities.formatDate(new Date(), "GMT-6", "yyyy-MM-dd HH:mm")
  ]);

  return { success: true, message: "Usuario creado exitosamente" };
}

// ==========================================================================
// HELPERS & INICIALIZADORES
// ==========================================================================

function normalizeHeader(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-z0-9]/g, "");     // quita espacios y símbolos
}

function findColumnIndex(headers, candidates) {
  for (let i = 0; i < headers.length; i++) {
    for (let c = 0; c < candidates.length; c++) {
      if (headers[i] === candidates[c] || headers[i].includes(candidates[c])) {
        return i;
      }
    }
  }
  return -1;
}

function parsePercentage(val) {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") {
    return val <= 1 && val > 0 ? val * 100 : val;
  }
  const clean = String(val).replace("%", "").replace(",", ".").trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return num <= 1 && num > 0 ? num * 100 : num;
}

function parseQty(val) {
  if (val === undefined || val === null || val === "") return 0;
  const num = parseFloat(String(val).replace(/,/g, "").trim());
  return isNaN(num) ? 0 : num;
}

function initializeUsuariosSheet(ss) {
  let sheet = ss.getSheetByName(TAB_USUARIOS);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_USUARIOS);
    sheet.appendRow(["Usuario", "Nombre", "Password", "Rol", "Activo", "FechaCreacion"]);
    sheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#e2e8f0");
    
    // Usuarios predeterminados
    sheet.appendRow(["admin", "Administrador Principal", "1234", "Administrativo", "SI", new Date()]);
    sheet.appendRow(["op1", "Operador de Acomodo 1", "1234", "Operador", "SI", new Date()]);
    sheet.appendRow(["op2", "Operador de Acomodo 2", "1234", "Operador", "SI", new Date()]);
  }
  return sheet;
}

function initializeProductividadSheet(ss) {
  let sheet = ss.getSheetByName(TAB_PRODUCTIVIDAD);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_PRODUCTIVIDAD);
    sheet.appendRow([
      "ID_Registro",
      "Fecha",
      "Hora_Inicio",
      "Hora_Fin",
      "Usuario",
      "Operador_Nombre",
      "Pasillo",
      "Material",
      "Descripcion",
      "Ubicacion_Pickeo",
      "P01",
      "P02",
      "P03",
      "Total_Piezas",
      "Porcentaje_Inicial",
      "Estado",
      "Minutos_Transcurridos",
      "Observaciones"
    ]);
    sheet.getRange(1, 1, 1, 18).setFontWeight("bold").setBackground("#dbeafe");
  }
  return sheet;
}

function respondJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
