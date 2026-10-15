# Sistema de Acomodo y Productividad (Google Sheets + GitHub Pages)

Aplicación web responsiva (optimizada para **PC, Tablets, Celulares y Handheld Scanners**) diseñada para la gestión, surtido y medición de productividad en el área de acomodo en almacenes y centros de distribución.

---

## 🚀 Características Principales

- **Conexión con Google Sheets:**
  - **Archivo 1 (Inventario / Base):** ID `1G1_AgR-dV2ZD9gDJ7i6srHwSBDF3ttNSVAgagCiRk-o` (Hoja: `Base Proyecto`).
  - **Archivo 2 (Usuarios & Productividad):** ID `1mji1apV0tphVU4lC0MmlOiFKGY1UmQVJ-xLr1i2yaG4` (Hojas: `Usuarios` y `Productividad`).
- **2 Roles de Usuario:**
  - 👷 **Operador:**
    - Inicio de sesión con usuario/PIN registrado en la hoja `Usuarios`.
    - Al ingresar, solicita el **número de pasillo** que desea surtir (con teclado numérico táctil optimizado para móvil).
    - Selecciona automáticamente el **material con menor porcentaje de avance** de ese pasillo.
    - Muestra claramente: **Código de Material**, **Descripción**, **Ubicación de Pickeo**, cantidades **P01**, **P02**, **P03** y **Total a surtir**.
    - Cronómetro en tiempo real para medir el tiempo de ejecución.
    - Guarda automáticamente los datos de la asignación y su finalización en la hoja `Productividad` del Archivo 2.
  - 📊 **Administrativo / Supervisor:**
    - Métricas y KPIs en tiempo real (Acomodos totales, piezas totales, tareas completadas, operadores activos).
    - Bitácora interactiva con filtros por pasillo, operador, estado y buscador de texto.
    - Catálogo y alta de nuevos usuarios directamente hacia la hoja `Usuarios`.
    - Exportación de la bitácora a formato CSV / Excel.
- **Modo Demo Integrado:** Permite probar toda la app inmediatamente en el navegador sin configuraciones previas o cuando no hay acceso a internet.

---

## 📂 Estructura del Proyecto

```text
├── index.html                   # Página principal y estructura de vistas (SPA)
├── css/
│   └── styles.css               # Estilos personalizados, teclado táctil y temas
├── js/
│   ├── config.js                # IDs de Google Sheets y endpoint de Apps Script
│   ├── api.js                   # Conector API con Google Apps Script y Modo Demo
│   └── app.js                   # Lógica de la app, cronómetro, vistas y eventos
├── google-apps-script/
│   └── Code.gs                  # Código backend para desplegar en Google Apps Script
└── README.md                    # Guía de instalación y despliegue
```

---

## 🛠️ Paso 1: Configurar el Backend en Google Apps Script

Dado que GitHub Pages es un servidor estático y Google Sheets requiere permisos para escribir datos de forma segura, el archivo `google-apps-script/Code.gs` actúa como una API Web gratuita y sin servidores.

1. Abre tu Google Drive y ve a [script.google.com](https://script.google.com) o abre el archivo de cálculo `1mji1apV0tphVU4lC0MmlOiFKGY1UmQVJ-xLr1i2yaG4` y ve a **Extensiones > Apps Script**.
2. Copia todo el contenido del archivo `google-apps-script/Code.gs` de este repositorio y pégalo en el editor de Apps Script (reemplazando cualquier código existente).
3. Haz clic en **Guardar** (icono de disquete).
4. En la esquina superior derecha, haz clic en **Implementar > Nueva implementación**.
5. Haz clic en el engranaje ⚙️ y selecciona **Aplicación web**.
6. Configura lo siguiente:
   - **Descripción:** `API Acomodo y Productividad`
   - **Ejecutar como:** `Yo (tu correo electrónico)`
   - **Quién tiene acceso:** `Cualquiera` (Anyone) *(indispensable para que la app web de GitHub Pages pueda consultar y escribir registros)*.
7. Haz clic en **Implementar** y autoriza los permisos de acceso a las hojas de cálculo cuando te lo solicite Google.
8. **Copia la URL de la aplicación web** que te entrega Google (termina en `/exec`).

---

## ⚙️ Paso 2: Vincular la URL a la Aplicación Web

Tienes dos opciones muy sencillas:

### Opción A (Desde la propia interfaz visual):
1. Abre `index.html` en tu navegador.
2. Haz clic en el botón superior de configuración (⚙️ **Modo Demo**).
3. Pega la URL obtenida en el Paso 1.
4. Desmarca la casilla de *Modo Demo*.
5. Presiona **Probar Conexión** y luego **Guardar Cambios**.

### Opción B (En el archivo de código):
Abre el archivo `js/config.js` y coloca tu URL en:
```javascript
APPS_SCRIPT_WEBAPP_URL: "https://script.google.com/macros/s/TU_ID_AQUI/exec",
DEMO_MODE: false,
```

---

## 📋 Estructura de las Hojas de Google Sheets

### 1. Archivo Base (`1G1_AgR-dV2ZD9gDJ7i6srHwSBDF3ttNSVAgagCiRk-o`)
- **Pestaña obligatoria:** `Base Proyecto`
- **Columnas sugeridas en la Fila 1:**
  - `Pasillo`
  - `Material`
  - `Descripcion`
  - `Porcentaje`
  - `Ubicacion de Pickeo`
  - `P01`
  - `P02`
  - `P03`

### 2. Archivo Usuarios y Productividad (`1mji1apV0tphVU4lC0MmlOiFKGY1UmQVJ-xLr1i2yaG4`)
- **Pestaña 1:** `Usuarios`
  - Columnas: `Usuario`, `Nombre`, `Password`, `Rol`, `Activo`, `FechaCreacion`.
  - El script crea automáticamente esta hoja con usuarios iniciales (`admin` / `op1` / `op2`) si no existe.
- **Pestaña 2:** `Productividad`
  - Columnas: `ID_Registro`, `Fecha`, `Hora_Inicio`, `Hora_Fin`, `Usuario`, `Operador_Nombre`, `Pasillo`, `Material`, `Descripcion`, `Ubicacion_Pickeo`, `P01`, `P02`, `P03`, `Total_Piezas`, `Porcentaje_Inicial`, `Estado`, `Minutos_Transcurridos`, `Observaciones`.
  - El script crea automáticamente esta estructura de encabezados en la primera asignación.

---

## 🌐 Paso 3: Subir a GitHub y Publicar en GitHub Pages

1. Abre tu terminal en la carpeta del proyecto y ejecuta:
   ```bash
   git init
   git add .
   git commit -m "feat: Sistema de acomodo y productividad v1.0"
   ```
2. Crea un repositorio nuevo en tu cuenta de [GitHub.com](https://github.com/new).
3. Conecta y sube los cambios:
   ```bash
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```
4. **Activar GitHub Pages gratis:**
   - En tu repositorio de GitHub, ve a **Settings > Pages**.
   - En **Source / Build and deployment**, selecciona `Deploy from a branch`.
   - Elige la rama `main` y la carpeta `/ (root)`.
   - Haz clic en **Save**.
   - En 1 minuto tendrás un enlace público como:  
     `https://TU_USUARIO.github.io/TU_REPOSITORIO/`

---

## 📱 Usuarios de Prueba (Modo Demo)

Para probar la aplicación inmediatamente:

| Usuario | Contraseña | Rol | Acceso |
| :--- | :--- | :--- | :--- |
| `operador1` | `123` | **Operador** | Surtido, teclado numérico y registro |
| `operador2` | `123` | **Operador** | Surtido, teclado numérico y registro |
| `admin` | `admin` | **Administrativo** | KPIs, bitácora en vivo y alta de usuarios |

---

## 🔒 Privacidad y Seguridad
- Toda la comunicación se realiza mediante HTTPS hacia los servidores de Google Apps Script.
- Las hojas de cálculo permanecen en tu cuenta de Google y tú controlas quién tiene acceso a ellas.
