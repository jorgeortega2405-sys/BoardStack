# BoardStack

Aplicación web desarrollada con **Node.js**, **TypeScript** y **Docker**, replicando fielmente el diseño y la arquitectura base de **BoardPDF**:
- **Layout Básico**: Estructura de tres niveles (`.page-wrapper` > `.general-content` > `.layout-content`) con variables CSS semánticas (tokens de diseño normalizados en `root.css`).
- **Layout Nav**: Barra de navegación lateral fija (`.layout-nav`) con rail vertical (`.layout-rail`) y panel deslizante (`.layout-drawer`) expandible a 325px con píldora flotante de colapso (`.layout-drawer__collapse-pill`).
- **Component Wrapper**: Contenedor modular de componentes (`.component-wrapper.component-wrapper--full.view-wrapper`) con esquinas superiores redondeadas, barra de título/acciones (`.component-top`), y scroll independiente sincronizado.
- **Fondo de Puntitos**: Rejilla de puntos SVG de alta fidelidad (`.view-backdrop--dots`) en matriz repetitiva de 24px × 24px (`dots-light.svg` y `dots-dark.svg`).

---

## Estructura del Proyecto

```
boardstack/
├── client/                     # Código TypeScript del frontend
│   ├── components/
│   │   └── layout-nav.component.ts # Controlador de la navegación lateral, drawer y temas
│   └── main.ts                 # Punto de entrada de la SPA
├── public/                     # Archivos estáticos
│   ├── css/
│   │   ├── root.css            # Tokens de diseño, tipografía, paletas de colores y resets
│   │   └── components/
│   │       ├── component-elements.css # Botones, iconos, badges y componentes atómicos
│   │       ├── component-layout.css   # Layout, rail, drawer y component-wrapper
│   │       ├── component-overlays.css # Tooltips, menús contextuales y paneles flotantes
│   │       └── component-views.css    # Fondos (view-backdrop--dots), heroes y vistas
│   ├── images/
│   │   └── patterns/           # Patrones SVG/PNG de puntitos (dots-light.svg, dots-dark.svg)
│   ├── favicon.svg             # Favicon vectorial
│   └── icons.svg               # Sprite SVG con símbolos de iconos
├── src/
│   └── server/
│       └── index.ts            # Servidor Express + TypeScript con soporte SPA y compresión
├── Dockerfile                  # Construcción multi-etapa para producción (Node.js 20)
├── docker-compose.yml          # Orquestación de Docker lista para despliegue
├── package.json                # Dependencias y scripts de construcción
├── tsconfig.json               # Configuración TypeScript del monorepo
├── tsconfig.client.json        # Configuración TypeScript para el cliente
├── tsconfig.server.json        # Configuración TypeScript para el servidor Node.js
└── vite.config.ts              # Configuración del empaquetador Vite
```

---

## Ejecución Local

### 1. Desarrollo con Vite (recarga rápida HMR)
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`.

### 2. Construcción para Producción
```bash
npm run build
```
Compila el cliente en `dist/client` y el servidor en `dist/server`.

### 3. Ejecución del Servidor Node.js
```bash
npm run start
```
El servidor Express se iniciará en `http://localhost:3000`.

---

## Ejecución con Docker

### Construir y levantar con Docker Compose
```bash
docker compose up --build -d
```
El contenedor se iniciará en segundo plano y mapeará el puerto `3000`.

Para verificar el estado y los logs:
```bash
docker compose ps
docker compose logs -f
```

Para detener el servicio:
```bash
docker compose down
```
