# ⚡ Open Pulse

**Open Pulse** es una aplicación de escritorio nativa de alto rendimiento para la conversión y procesamiento de medios. Combina la velocidad y seguridad de **Rust** con una interfaz moderna en **HTML/JS**, utilizando una arquitectura de **Sidecar** para integrar FFmpeg sin dependencias externas.

> **Estado:** 🚀 Versión 1.0.0 (Release Candidate)

---

## 🏗️ Arquitectura y Diseño

A diferencia de las aplicaciones web tradicionales o wrappers de Node.js, Open Pulse está construida bajo una filosofía de **Sistemas**:

* **Rust Backend (Tauri):** Gestiona la lógica de negocio, el sistema de archivos y la seguridad de memoria.
* **FFmpeg Sidecar:** Los binarios de procesamiento de video se empaquetan *dentro* de la aplicación. El usuario final **no necesita instalar nada**. La app es totalmente portátil.
* **Gestión de Procesos:** Uso de `Arc<Mutex<Option<CommandChild>>>` para el control asíncrono de subprocesos, permitiendo cancelar conversiones en tiempo real sin congelar la interfaz y limpiando archivos corruptos automáticamente.
* **No-NodeJS:** El entorno de desarrollo y compilación es 100% **Cargo**. No se utiliza NPM ni Node.js para el runtime.

---

## 🚀 Características Principales

### 🎥 Video
* **Modo Instagram Reel:** Conversión automática a 9:16 con relleno inteligente (Blur padding).
* **Modo WhatsApp:** Compresión agresiva optimizada para mensajería rápida.
* **Generador de GIFs:** Creación de animaciones ligeras y fluidas.

### 🎵 Audio
* **Extracción de Audio:** Separación de pistas de video a audio.
* **Formatos Profesionales:** Soporte para MP3 (320kbps), M4A (AAC) y WAV (Lossless).

### 🎨 UI Cyberpunk
* **Feedback Sensorial:** Interfaz reactiva con efectos de sonido y respuestas visuales.
* **Temas Dinámicos:** La paleta de colores del sistema cambia según el contexto (Cian para Video, Neón Magenta para Audio).

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología | Descripción |
| :--- | :--- | :--- |
| **Core** | Rust 🦀 | Gestión de procesos, I/O y seguridad. |
| **Framework** | Tauri 2.0 | Puente ligero entre Rust y WebView. |
| **Motor** | FFmpeg | Binarios estáticos (Sidecar). |
| **Frontend** | Vanilla JS | ES6+, Sin frameworks pesados. |
| **Estilos** | CSS3 | CSS Variables, Flexbox/Grid, Glassmorphism. |

---

## ⚙️ Instalación y Desarrollo

Este proyecto no requiere `npm install`. Todo se gestiona a través de Cargo.

### 1. Prerrequisitos
* Tener instalado [Rust](https://rustup.rs/).
* *(Solo Linux)* Dependencias del sistema: `libwebkit2gtk-4.0-dev`, `build-essential`.

### 2. Clonar el repositorio
```bash
git clone [https://github.com/TU_USUARIO/OpenPulse.git](https://github.com/TU_USUARIO/OpenPulse.git)
cd OpenPulse
```

### 3. Ejecutar en modo desarrollo
```bash
cargo tauri dev
```

### 3. Compilar para Producción
Esto generará un instalador nativo (.exe, .dmg, .AppImage) que incluye FFmpeg en su interior.
```bash
cargo tauri build
```

---
👨‍💻 Autor
Desarrollado por suaresteban97.

Hecho con ❤️ y 🦀 Rust.