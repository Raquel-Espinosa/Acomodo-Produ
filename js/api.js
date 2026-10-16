// ==========================================================================
// API CONNECTOR - GOOGLE SHEETS & DEMO SERVICE
// ==========================================================================

const API = {
  // Datos semilla originales para restaurar si se reinicia la demo
  _initialData: {
    usuarios: [
      { usuario: "operador1", nombre: "Juan Pérez", password: "123", rol: "Operador", activo: "SI" },
      { usuario: "operador2", nombre: "María Gómez", password: "123", rol: "Operador", activo: "SI" },
      { usuario: "admin", nombre: "Carlos Supervisor", password: "admin", rol: "Administrativo", activo: "SI" }
    ],
    baseProyecto: [
      { pasillo: "1", material: "MAT-10023", descripcion: "Alimento Seco Adulto Raza Mediana 15kg", porcentaje: 12, ctdUMB: 42, ubicacionPickeo: "P1-A-04", p01: 24, p02: 12, p03: 6, estatus: "Pendiente", asignadoA: "" },
      { pasillo: "1", material: "MAT-10088", descripcion: "Snacks Premios Hueso sabor Pollo 200g", porcentaje: 45, ctdUMB: 100, ubicacionPickeo: "P1-B-12", p01: 50, p02: 30, p03: 20, estatus: "Pendiente", asignadoA: "" },
      { pasillo: "1", material: "MAT-10142", descripcion: "Shampoo Hipoalergénico Mascota 500ml", porcentaje: 80, ctdUMB: 15, ubicacionPickeo: "P1-C-02", p01: 10, p02: 5, p03: 0, estatus: "Pendiente", asignadoA: "" },
      
      { pasillo: "2", material: "MAT-20050", descripcion: "Arena Sanitaria Aglomerante Lavanda 10kg", porcentaje: 8, ctdUMB: 80, ubicacionPickeo: "P2-A-01", p01: 40, p02: 25, p03: 15, estatus: "Pendiente", asignadoA: "" },
      { pasillo: "2", material: "MAT-20091", descripcion: "Rascador para Gato 3 Niveles con Juguete", porcentaje: 35, ctdUMB: 14, ubicacionPickeo: "P2-B-08", p01: 8, p02: 4, p03: 2, estatus: "Pendiente", asignadoA: "" },
      { pasillo: "2", material: "MAT-20110", descripcion: "Collar Antipulgas Perro Grande 65cm", porcentaje: 90, ctdUMB: 30, ubicacionPickeo: "P2-C-15", p01: 15, p02: 10, p03: 5, estatus: "Pendiente", asignadoA: "" },

      { pasillo: "3", material: "MAT-30015", descripcion: "Cama Ortopédica Grande Memory Foam", porcentaje: 5, ctdUMB: 22, ubicacionPickeo: "P3-A-02", p01: 12, p02: 6, p03: 4, estatus: "Pendiente", asignadoA: "" },
      { pasillo: "3", material: "MAT-30045", descripcion: "Correa Retráctil 5 Metros Resistente", porcentaje: 28, ctdUMB: 55, ubicacionPickeo: "P3-B-04", p01: 30, p02: 15, p03: 10, estatus: "Pendiente", asignadoA: "" },

      { pasillo: "4", material: "MAT-40012", descripcion: "Transportadora Rígida IATA Mediana", porcentaje: 15, ctdUMB: 26, ubicacionPickeo: "P4-A-10", p01: 14, p02: 8, p03: 4, estatus: "Pendiente", asignadoA: "" },
      { pasillo: "5", material: "MAT-50020", descripcion: "Comedero Automático Programable 4L", porcentaje: 22, ctdUMB: 30, ubicacionPickeo: "P5-A-05", p01: 16, p02: 8, p03: 6, estatus: "Pendiente", asignadoA: "" }
    ],
    lx03: [
      { tp: "P02", material: "MAT-10023", ubicacion: "UB-01-A-10", stockDisponible: 120 },
      { tp: "P02", material: "MAT-10023", ubicacion: "UB-01-B-04", stockDisponible: 55 },
      { tp: "P01", material: "MAT-10023", ubicacion: "UB-01-A-01", stockDisponible: 80 }, // No P02 para probar filtro
      { tp: "P02", material: "MAT-10088", ubicacion: "UB-01-C-02", stockDisponible: 300 },
      { tp: "P02", material: "MAT-20050", ubicacion: "UB-02-A-15", stockDisponible: 85 },
      { tp: "P02", material: "MAT-30015", ubicacion: "UB-03-D-01", stockDisponible: 40 },
      { tp: "P02", material: "MAT-40012", ubicacion: "UB-04-A-08", stockDisponible: 60 },
      { tp: "P02", material: "MAT-50020", ubicacion: "UB-05-B-12", stockDisponible: 95 }
    ],
    productividad: []
  },

  _mockData: {
    usuarios: [],
    baseProyecto: [],
    lx03: [],
    productividad: []
  },

  /**
   * Carga persistente desde LocalStorage para que al salir y volver a entrar
   * se recuerden con exactitud los materiales completados y trabajados.
   */
  _initData() {
    // 1. Usuarios
    const savedUsers = localStorage.getItem("acomodo_mock_usuarios");
    if (savedUsers) {
      try { this._mockData.usuarios = JSON.parse(savedUsers); } catch(e) {}
    }
    if (!this._mockData.usuarios || this._mockData.usuarios.length === 0) {
      this._mockData.usuarios = JSON.parse(JSON.stringify(this._initialData.usuarios));
    }

    // 2. Base Proyecto (Inventario)
    const savedBase = localStorage.getItem("acomodo_mock_base_proyecto");
    if (savedBase) {
      try { this._mockData.baseProyecto = JSON.parse(savedBase); } catch(e) {}
    }
    if (!this._mockData.baseProyecto || this._mockData.baseProyecto.length === 0) {
      this._mockData.baseProyecto = JSON.parse(JSON.stringify(this._initialData.baseProyecto));
    }

    // 3. LX03 (Ubicaciones y Stock)
    const savedLX03 = localStorage.getItem("acomodo_mock_lx03");
    if (savedLX03) {
      try { this._mockData.lx03 = JSON.parse(savedLX03); } catch(e) {}
    }
    if (!this._mockData.lx03 || this._mockData.lx03.length === 0) {
      this._mockData.lx03 = JSON.parse(JSON.stringify(this._initialData.lx03));
    }

    // 4. Productividad
    const savedProd = localStorage.getItem("acomodo_mock_productividad");
    if (savedProd) {
      try { this._mockData.productividad = JSON.parse(savedProd); } catch(e) {}
    }
    if (!this._mockData.productividad) {
      this._mockData.productividad = [];
    }
  },

  _saveData() {
    try {
      localStorage.setItem("acomodo_mock_base_proyecto", JSON.stringify(this._mockData.baseProyecto));
      localStorage.setItem("acomodo_mock_lx03", JSON.stringify(this._mockData.lx03));
      localStorage.setItem("acomodo_mock_productividad", JSON.stringify(this._mockData.productividad));
      localStorage.setItem("acomodo_mock_usuarios", JSON.stringify(this._mockData.usuarios));
    } catch(e) {
      console.warn("No se pudo persistir en localStorage:", e);
    }
  },

  resetDemoData() {
    localStorage.removeItem("acomodo_mock_base_proyecto");
    localStorage.removeItem("acomodo_mock_lx03");
    localStorage.removeItem("acomodo_mock_productividad");
    localStorage.removeItem("acomodo_mock_usuarios");
    this._initData();
    this._saveData();
  },

  /**
   * Determina si debe llamar al endpoint real o usar datos locales
   */
  isLive() {
    return !CONFIG.DEMO_MODE && CONFIG.APPS_SCRIPT_WEBAPP_URL && CONFIG.APPS_SCRIPT_WEBAPP_URL.startsWith("http");
  },

  /**
   * Petición genérica GET a Google Apps Script
   */
  async _fetchGet(params) {
    const url = new URL(CONFIG.APPS_SCRIPT_WEBAPP_URL);
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) {
        url.searchParams.append(k, params[k]);
      }
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Error en servidor Google Apps Script: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Petición genérica POST a Google Apps Script
   */
  async _fetchPost(payload) {
    const response = await fetch(CONFIG.APPS_SCRIPT_WEBAPP_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });

    if (!response.ok) {
      throw new Error(`Error al enviar datos: ${response.statusText}`);
    }
    return await response.json();
  },

  // ========================================================================
  // MÉTODOS PÚBLICOS
  // ========================================================================

  /**
   * 1. Iniciar Sesión (Validación en hoja Usuarios del Archivo 2)
   */
  async login(usuario, password) {
    if (this.isLive()) {
      try {
        return await this._fetchGet({ action: "login", usuario, password });
      } catch (e) {
        console.warn("Falla de conexión en vivo, recurriendo a validación local:", e);
      }
    }

    // Fallback Modo Demo
    await new Promise(r => setTimeout(r, 300));
    const cleanUser = String(usuario).trim().toLowerCase();
    const cleanPass = String(password || "").trim();

    const user = this._mockData.usuarios.find(u => u.usuario.toLowerCase() === cleanUser);
    if (!user) {
      return { success: false, message: "Usuario no encontrado en la hoja de Usuarios" };
    }
    if (user.password && cleanPass && user.password !== cleanPass) {
      return { success: false, message: "Contraseña incorrecta" };
    }

    return {
      success: true,
      user: {
        usuario: user.usuario,
        nombre: user.nombre,
        rol: user.rol
      }
    };
  },

  /**
   * 2. Obtener Material con menor porcentaje para el pasillo seleccionado
   *    - EXCLUYE rigurosamente materiales que ya fueron trabajados o completados (tanto en Base como en Productividad).
   *    - EXCLUYE materiales que ya están actualmente asignados.
   *    - EXCLUYE materiales pasados en excludeList de la sesión.
   *    - PERSISTE los cambios para que al salir y volver a entrar NUNCA se repita uno trabajado.
   */
  async getMaterialByPasillo(pasillo, usuario = "", excludeList = []) {
    if (this.isLive()) {
      try {
        const excludeStr = Array.isArray(excludeList) ? excludeList.join(",") : String(excludeList || "");
        return await this._fetchGet({ 
          action: "getMaterialByPasillo", 
          pasillo, 
          usuario, 
          exclude: excludeStr 
        });
      } catch (e) {
        console.warn("Falla en vivo al obtener material, usando datos locales:", e);
      }
    }

    // Fallback Modo Demo persistente
    await new Promise(r => setTimeout(r, 300));
    const cleanPasillo = String(pasillo).trim();
    const cleanUsuario = usuario ? String(usuario).trim().toLowerCase() : "";
    const excludeNorm = (excludeList || []).map(code => String(code).trim().toLowerCase());

    // 1. Identificar materiales ya trabajados / completados o asignados en el historial de Productividad
    const materialesTrabajados = new Set();
    const materialesAsignadosProd = new Set();

    this._mockData.productividad.forEach(p => {
      const mat = String(p.material || "").trim().toLowerCase();
      const est = String(p.estado || "").trim().toLowerCase();
      if (mat) {
        if (est === "completado" || est.includes("complet")) {
          materialesTrabajados.add(mat);
        } else if (est === "asignado" || est.includes("proceso")) {
          materialesAsignadosProd.add(mat);
        }
      }
    });

    // 2. Filtrar materiales de este pasillo
    const itemsEnPasillo = this._mockData.baseProyecto.filter(item => String(item.pasillo) === cleanPasillo);

    if (itemsEnPasillo.length === 0) {
      return {
        success: false,
        message: "Ese pasillo no tiene actividad por realizar"
      };
    }

    // 3. Filtrar candidatos disponibles:
    //    - NO completado (en Base Proyecto ni en Productividad)
    //    - NO con 100%
    //    - NO asignado previamente (ni en Base Proyecto ni en Productividad)
    //    - NO excluido en la sesión actual
    const candidatos = itemsEnPasillo.filter(item => {
      const matLower = String(item.material).trim().toLowerCase();
      const estLower = String(item.estatus || "").trim().toLowerCase();

      const yaCompletado = estLower.includes("complet") || 
                           item.porcentaje >= 100 || 
                           materialesTrabajados.has(matLower);

      const yaAsignado = estLower.includes("asignad") || 
                         materialesAsignadosProd.has(matLower);

      const yaExcluido = excludeNorm.includes(matLower);

      return !yaCompletado && item.porcentaje < 100 && !yaAsignado && !yaExcluido;
    });

    if (candidatos.length === 0) {
      return {
        success: false,
        message: "Ese pasillo no tiene actividad por realizar"
      };
    }

    // 4. Ordenar por menor porcentaje (ascendente)
    candidatos.sort((a, b) => a.porcentaje - b.porcentaje);
    const materialElegido = candidatos[0];

    // 5. Bloquear y marcar como Asignado
    materialElegido.estatus = "Asignado";
    materialElegido.asignadoA = cleanUsuario || "operador";
    materialElegido.ctdUMB = materialElegido.ctdUMB !== undefined ? materialElegido.ctdUMB : ((Number(materialElegido.p01) || 0) + (Number(materialElegido.p02) || 0) + (Number(materialElegido.p03) || 0));
    materialElegido.totalSurtir = materialElegido.ctdUMB;
    this._saveData();

    return {
      success: true,
      material: materialElegido,
      totalMaterialesEnPasillo: itemsEnPasillo.length,
      candidatosRestantes: candidatos.length
    };
  },

  /**
   * 3. Liberar material (cuando el operador pospone o cambia de pasillo sin completar)
   */
  async liberarMaterial(materialCode, pasillo, usuario) {
    if (this.isLive()) {
      try {
        return await this._fetchPost({ action: "liberarMaterial", material: materialCode, pasillo, usuario });
      } catch (e) {
        console.warn("Falla al liberar material en vivo:", e);
      }
    }

    // Fallback Modo Demo persistente
    await new Promise(r => setTimeout(r, 200));
    const matLower = String(materialCode).toLowerCase();
    const item = this._mockData.baseProyecto.find(i => String(i.material).toLowerCase() === matLower);
    if (item && item.estatus === "Asignado") {
      item.estatus = "Pendiente";
      item.asignadoA = "";
    }

    // Actualizar en productividad si estaba como asignado
    const prodReg = this._mockData.productividad.find(p => String(p.material).toLowerCase() === matLower && p.estado === "Asignado");
    if (prodReg) {
      prodReg.estado = "Liberado";
    }

    this._saveData();
    return { success: true, message: "Material liberado" };
  },

  /**
   * 4. Guardar asignación o registro en la hoja "Productividad" del Archivo 2
   */
  async saveProductividad(registroData) {
    if (this.isLive()) {
      try {
        const payload = { action: "saveProductividad", ...registroData };
        return await this._fetchPost(payload);
      } catch (e) {
        console.warn("Falla al guardar en vivo, guardando en caché demo:", e);
      }
    }

    // Fallback Modo Demo persistente
    await new Promise(r => setTimeout(r, 200));
    const id = "PROD-" + Date.now();
    const now = new Date();
    const item = {
      idRegistro: id,
      fecha: now.toISOString().split("T")[0],
      horaInicio: now.toTimeString().split(" ")[0],
      horaFin: registroData.horaFin || "",
      usuario: registroData.usuario,
      nombreOperador: registroData.nombreOperador,
      pasillo: registroData.pasillo,
      material: registroData.material,
      descripcion: registroData.descripcion,
      ubicacionPickeo: registroData.ubicacionPickeo,
      p01: Number(registroData.p01) || 0,
      p02: Number(registroData.p02) || 0,
      p03: Number(registroData.p03) || 0,
      totalPiezas: (Number(registroData.p01) || 0) + (Number(registroData.p02) || 0) + (Number(registroData.p03) || 0),
      porcentaje: registroData.porcentaje,
      estado: registroData.estado || "Asignado",
      minutos: registroData.minutosTranscurridos || 0
    };

    this._mockData.productividad.unshift(item);
    this._saveData();

    return {
      success: true,
      message: "Registro guardado exitosamente en hoja Productividad",
      idRegistro: id
    };
  },

  /**
   * 5. Finalizar tarea: registra hora de fin en Productividad y marca Completado en Base Proyecto (100%)
   */
  async finalizarTarea(idRegistro, minutosTranscurridos, materialCode, pasillo) {
    if (this.isLive()) {
      try {
        return await this._fetchPost({
          action: "finalizarTarea",
          idRegistro,
          minutosTranscurridos,
          material: materialCode,
          pasillo
        });
      } catch (e) {
        console.warn("Falla al finalizar tarea en vivo:", e);
      }
    }

    // Fallback Modo Demo persistente
    await new Promise(r => setTimeout(r, 200));
    const reg = this._mockData.productividad.find(p => p.idRegistro === idRegistro);
    if (reg) {
      reg.estado = "Completado";
      reg.horaFin = new Date().toTimeString().split(" ")[0];
      reg.minutos = minutosTranscurridos;
    }

    // Marcar rigurosamente como completado en baseProyecto con 100%
    if (materialCode) {
      const matLower = String(materialCode).toLowerCase();
      const mat = this._mockData.baseProyecto.find(m => String(m.material).toLowerCase() === matLower);
      if (mat) {
        mat.estatus = "Completado";
        mat.asignadoA = "";
        mat.porcentaje = 100;
      }
    }

    this._saveData();
    return { success: true, message: "Tarea completada con éxito" };
  },

  /**
   * 6. Obtener registros de Productividad para el Administrativo
   */
  async getProductividad(filtros = {}) {
    if (this.isLive()) {
      try {
        return await this._fetchGet({ action: "getProductividad", ...filtros });
      } catch (e) {
        console.warn("Falla al obtener productividad en vivo:", e);
      }
    }

    await new Promise(r => setTimeout(r, 200));
    const registros = [...this._mockData.productividad];
    const totalPiezas = registros.reduce((acc, curr) => acc + (curr.totalPiezas || 0), 0);
    const completados = registros.filter(r => (r.estado || "").toLowerCase() === "completado").length;

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
  },

  /**
   * 7. Obtener lista de usuarios para el Administrativo
   */
  async getUsuarios() {
    if (this.isLive()) {
      try {
        return await this._fetchGet({ action: "getUsuarios" });
      } catch (e) {
        console.warn("Falla al obtener usuarios en vivo:", e);
      }
    }

    await new Promise(r => setTimeout(r, 150));
    return {
      success: true,
      usuarios: this._mockData.usuarios
    };
  },

  /**
   * 8. Crear un nuevo usuario en la hoja Usuarios
   */
  async createUsuario(usuarioData) {
    if (this.isLive()) {
      try {
        return await this._fetchPost({ action: "saveUsuario", ...usuarioData });
      } catch (e) {
        console.warn("Falla al crear usuario en vivo:", e);
      }
    }

    await new Promise(r => setTimeout(r, 200));
    this._mockData.usuarios.push({
      usuario: usuarioData.usuario,
      nombre: usuarioData.nombre,
      password: usuarioData.password || "1234",
      rol: usuarioData.rol || "Operador",
      activo: "SI"
    });

    this._saveData();
    return { success: true, message: "Usuario creado exitosamente" };
  },

  /**
   * 9. Consultar todas las ubicaciones y stock disponible del material en pestaña LX03 (solo P02)
   */
  async getUbicacionesLX03(material) {
    if (this.isLive()) {
      try {
        return await this._fetchGet({ action: "getUbicacionesLX03", material });
      } catch (e) {
        console.warn("Falla al consultar LX03 en vivo, recurriendo a datos locales:", e);
      }
    }

    // Fallback Modo Demo
    await new Promise(r => setTimeout(r, 200));
    const cleanMat = String(material || "").trim().toLowerCase();
    const cleanMatNoZero = cleanMat.replace(/^0+/, "");

    const ubicaciones = [];
    let totalStock = 0;

    (this._mockData.lx03 || []).forEach(item => {
      const tp = String(item.tp || "").trim().toUpperCase();
      const mat = String(item.material || "").trim().toLowerCase();
      const matNoZero = mat.replace(/^0+/, "");

      // Filtro estricto: solo P02 de la columna A
      if (tp === "P02" || tp.startsWith("P02")) {
        const coincide = (mat === cleanMat || (cleanMatNoZero !== "" && matNoZero === cleanMatNoZero));
        if (coincide) {
          const qty = Number(item.stockDisponible) || 0;
          totalStock += qty;
          ubicaciones.push({
            tp: item.tp,
            ubicacion: item.ubicacion || "Sin Ubicación",
            stockDisponible: qty
          });
        }
      }
    });

    return {
      success: true,
      material: material,
      ubicaciones: ubicaciones,
      totalStockDisponible: totalStock
    };
  },

  /**
   * Probar conexión con la URL de Apps Script
   */
  async testConnection(url) {
    try {
      const testUrl = new URL(url);
      testUrl.searchParams.append("action", "ping");
      const resp = await fetch(testUrl.toString());
      const data = await resp.json();
      return { success: data.success === true, message: data.message || "Conexión confirmada" };
    } catch (err) {
      return { success: false, message: "Error conectando: " + err.message };
    }
  }
};

// Inicializar datos persistentes en el arranque
API._initData();
