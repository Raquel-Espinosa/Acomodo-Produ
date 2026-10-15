// ==========================================================================
// API CONNECTOR - GOOGLE SHEETS & DEMO SERVICE
// ==========================================================================

const API = {
  /**
   * Datos de prueba para Modo Demo (permite que la app funcione inmediatamente
   * antes de enlazar el script de Google Apps Script)
   */
  _mockData: {
    usuarios: [
      { usuario: "operador1", nombre: "Juan Pérez", password: "123", rol: "Operador", activo: "SI" },
      { usuario: "operador2", nombre: "María Gómez", password: "123", rol: "Operador", activo: "SI" },
      { usuario: "admin", nombre: "Carlos Supervisor", password: "admin", rol: "Administrativo", activo: "SI" }
    ],
    baseProyecto: [
      { pasillo: "1", material: "MAT-10023", descripcion: "Alimento Seco Adulto Raza Mediana 15kg", porcentaje: 12, ubicacionPickeo: "P1-A-04", p01: 24, p02: 12, p03: 6, estatus: "Pendiente", asignadoA: "" },
      { pasillo: "1", material: "MAT-10088", descripcion: "Snacks Premios Hueso sabor Pollo 200g", porcentaje: 45, ubicacionPickeo: "P1-B-12", p01: 50, p02: 30, p03: 20, estatus: "Pendiente", asignadoA: "" },
      { pasillo: "1", material: "MAT-10142", descripcion: "Shampoo Hipoalergénico Mascota 500ml", porcentaje: 80, ubicacionPickeo: "P1-C-02", p01: 10, p02: 5, p03: 0, estatus: "Pendiente", asignadoA: "" },
      
      { pasillo: "2", material: "MAT-20050", descripcion: "Arena Sanitaria Aglomerante Lavanda 10kg", porcentaje: 8, ubicacionPickeo: "P2-A-01", p01: 40, p02: 25, p03: 15, estatus: "Pendiente", asignadoA: "" },
      { pasillo: "2", material: "MAT-20091", descripcion: "Rascador para Gato 3 Niveles con Juguete", porcentaje: 35, ubicacionPickeo: "P2-B-08", p01: 8, p02: 4, p03: 2, estatus: "Pendiente", asignadoA: "" },
      { pasillo: "2", material: "MAT-20110", descripcion: "Collar Antipulgas Perro Grande 65cm", porcentaje: 90, ubicacionPickeo: "P2-C-15", p01: 15, p02: 10, p03: 5, estatus: "Pendiente", asignadoA: "" },

      { pasillo: "3", material: "MAT-30015", descripcion: "Cama Ortopédica Grande Memory Foam", porcentaje: 5, ubicacionPickeo: "P3-A-02", p01: 12, p02: 6, p03: 4, estatus: "Pendiente", asignadoA: "" },
      { pasillo: "3", material: "MAT-30045", descripcion: "Correa Retráctil 5 Metros Resistente", porcentaje: 28, ubicacionPickeo: "P3-B-04", p01: 30, p02: 15, p03: 10, estatus: "Pendiente", asignadoA: "" },

      { pasillo: "4", material: "MAT-40012", descripcion: "Transportadora Rígida IATA Mediana", porcentaje: 15, ubicacionPickeo: "P4-A-10", p01: 14, p02: 8, p03: 4, estatus: "Pendiente", asignadoA: "" },
      { pasillo: "5", material: "MAT-50020", descripcion: "Comedero Automático Programable 4L", porcentaje: 22, ubicacionPickeo: "P5-A-05", p01: 16, p02: 8, p03: 6, estatus: "Pendiente", asignadoA: "" }
    ],
    productividad: [
      {
        idRegistro: "PROD-20261015-091522-101",
        fecha: "2026-10-15",
        horaInicio: "09:15:22",
        horaFin: "09:32:10",
        usuario: "operador1",
        nombreOperador: "Juan Pérez",
        pasillo: "1",
        material: "MAT-10023",
        descripcion: "Alimento Seco Adulto Raza Mediana 15kg",
        ubicacionPickeo: "P1-A-04",
        p01: 24, p02: 12, p03: 6, totalPiezas: 42,
        porcentaje: 12,
        estado: "Completado",
        minutos: 16.8
      }
    ]
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
    await new Promise(r => setTimeout(r, 350));
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
   *    - Excluye materiales completados
   *    - Excluye materiales ya asignados a otro operador (bloqueo en tiempo real)
   *    - Excluye materiales en la lista de exclusión (para navegar al siguiente con menor porcentaje)
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

    // Fallback Modo Demo
    await new Promise(r => setTimeout(r, 350));
    const cleanPasillo = String(pasillo).trim();
    const cleanUsuario = usuario ? String(usuario).trim().toLowerCase() : "";
    const excludeNorm = (excludeList || []).map(code => String(code).trim().toLowerCase());

    // 1. Filtrar por pasillo
    const itemsEnPasillo = this._mockData.baseProyecto.filter(item => String(item.pasillo) === cleanPasillo);

    if (itemsEnPasillo.length === 0) {
      return {
        success: false,
        message: `No se encontraron materiales para el Pasillo ${cleanPasillo}. Verifique el número de pasillo.`
      };
    }

    // 2. Filtrar candidatos disponibles:
    //    - No completados
    //    - No excluidos en la sesión de navegación del operador
    //    - No asignados a OTRO operador
    const candidatos = itemsEnPasillo.filter(item => {
      const isCompletado = (item.estatus || "").toLowerCase().includes("complet") || (item.porcentaje >= 100);
      const isExcluido = excludeNorm.includes(String(item.material).trim().toLowerCase());
      const isAsignadoAOtro = (item.estatus === "Asignado") && (item.asignadoA && item.asignadoA.toLowerCase() !== cleanUsuario);

      return !isCompletado && !isExcluido && !isAsignadoAOtro;
    });

    if (candidatos.length === 0) {
      // Verificar si es porque otros operadores los tienen tomados
      const tomadosPorOtros = itemsEnPasillo.filter(i => (i.estatus === "Asignado") && (i.asignadoA && i.asignadoA.toLowerCase() !== cleanUsuario));
      if (tomadosPorOtros.length > 0) {
        return {
          success: false,
          message: `Todos los materiales disponibles en el Pasillo ${cleanPasillo} están siendo surtidos por otros operadores.`
        };
      }
      return {
        success: false,
        message: `No hay más materiales pendientes para surtir en el Pasillo ${cleanPasillo}. ¡Pasillo completado!`
      };
    }

    // 3. Ordenar por menor porcentaje (ascendente)
    candidatos.sort((a, b) => a.porcentaje - b.porcentaje);
    const materialElegido = candidatos[0];

    // 4. Bloquear y marcar como Asignado a este operador
    materialElegido.estatus = "Asignado";
    materialElegido.asignadoA = cleanUsuario || "operador";

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

    // Fallback Modo Demo
    await new Promise(r => setTimeout(r, 200));
    const item = this._mockData.baseProyecto.find(i => String(i.material).toLowerCase() === String(materialCode).toLowerCase());
    if (item && item.estatus === "Asignado") {
      item.estatus = "Pendiente";
      item.asignadoA = "";
    }
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

    // Fallback Modo Demo
    await new Promise(r => setTimeout(r, 250));
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

    return {
      success: true,
      message: "Registro guardado exitosamente en hoja Productividad",
      idRegistro: id
    };
  },

  /**
   * 5. Finalizar tarea: registra hora de fin en Productividad y marca Completado en Base Proyecto
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

    // Fallback Modo Demo
    await new Promise(r => setTimeout(r, 250));
    const reg = this._mockData.productividad.find(p => p.idRegistro === idRegistro);
    if (reg) {
      reg.estado = "Completado";
      reg.horaFin = new Date().toTimeString().split(" ")[0];
      reg.minutos = minutosTranscurridos;
    }

    // Marcar como completado en baseProyecto
    if (materialCode) {
      const mat = this._mockData.baseProyecto.find(m => String(m.material).toLowerCase() === String(materialCode).toLowerCase());
      if (mat) {
        mat.estatus = "Completado";
        mat.asignadoA = "";
        mat.porcentaje = 100;
      }
    }

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

    await new Promise(r => setTimeout(r, 250));
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

    await new Promise(r => setTimeout(r, 200));
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

    await new Promise(r => setTimeout(r, 250));
    this._mockData.usuarios.push({
      usuario: usuarioData.usuario,
      nombre: usuarioData.nombre,
      password: usuarioData.password || "1234",
      rol: usuarioData.rol || "Operador",
      activo: "SI"
    });

    return { success: true, message: "Usuario creado exitosamente" };
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
