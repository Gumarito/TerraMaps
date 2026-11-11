# 📐 TerraMaps — Especificación Técnica y Arquitectura

---

## 1. 🧠 El Motor Matemático: Cuadrícula Hexagonal Uber H3

En lugar de calcular colisiones de polígonos complejos o trazar líneas vectoriales infinitas que saturan la memoria del teléfono:
* El planeta se subdivide en una cuadrícula hexagonal matemática universal mediante **Uber H3**.
* **Resolución Elegida:** **H3 Resolución 9** (Área promedio: ~0.1 km² / Radio de ~105 metros por hexágono).
* **Fórmula de Conversión:**
  ```typescript
  import { latLngToCell, gridDisk, cellToBoundary } from 'h3-js';

  // Al recibir coordenada GPS:
  const currentHexId = latLngToCell(latitude, longitude, 9);
  
  // Radio de visión o exploración cercana (K-ring = 1):
  const visibleHexagons = gridDisk(currentHexId, 1);
  ```
* **Ventaja de Rendimiento:**
  * Almacenar un hexágono desbloqueado es simplemente guardar un string de 15 caracteres (ej. `89268580cbfffff`).
  * Desbloquear una ciudad entera con miles de calles ocupa **menos de 150 KB de almacenamiento**.
  * La consulta `unlockedSet.has(currentHexId)` toma **$O(1)$** (tiempo constante, 0.001 ms).

---

## 2. 🔋 Batería Blindada (Battery-Shield State Machine)

El problema de las apps de tracking es dejar el sensor GPS encendido a 1Hz de forma permanente.
TerraMaps utiliza una **máquina de estados de 3 niveles**:

```
           ┌──────────────────────────────────────┐
           │           NIVEL 1: REPOSO            │
           │  • GPS apagado (0% consumo extra)    │
           │  • Solo escucha acelerómetro         │
           └──────────────────┬───────────────────┘
                              │
               Detecta > 15 pasos de caminata
                              │
                              ▼
           ┌──────────────────────────────────────┐
           │          NIVEL 2: MUESTREO           │
           │  • Solicita 1 coordenada GPS         │
           │  • Desbloquea hexágono H3 actual     │
           │  • Comprueba si el usuario se mueve  │
           └──────────────────┬───────────────────┘
                              │
                     ¿Velocidad > 3 km/h?
                             ╱ ╲
                      SÍ    ╱   ╲   NO (Se detuvo)
                           ▼     ▼
  ┌──────────────────────────┐   ┌──────────────────────────┐
  │   NIVEL 3: RUTA ACTIVA   │   │  VUELTA A REPOSO (NIVEL 1│
  │ • Muestreo cada 25m      │   │ • GPS se apaga de nuevo  │
  └──────────────────────────┘   └──────────────────────────┘
```

Con este algoritmo, el usuario puede dejar TerraMaps activo en segundo plano durante todo el día consumiendo **menos del 4% de batería total**.

---

## 3. 🗺️ Renderizado de la Niebla con MapLibre GL

* **Técnica:** La niebla no es un conjunto de cientos de imágenes, sino una **capa de relleno poligonal (GeoJSON Fill Layer)** con aceleración por GPU.
* Los hexágonos *bloqueados* tienen una opacidad de 0.88 con color oscuro (`#0b0f19`).
* Los hexágonos *desbloqueados* se eliminan de la capa de niebla, dejando ver el mapa base en alta definición y a todo color.
* Las fronteras de los hexágonos desbloqueados reciben un borde luminoso sutil (`glow effect`) para dar la sensación visual de un mapa de estrategia en tiempo real (RTS).

---

## 4. 👥 Capa Social & Base de Datos (Supabase Free Tier)

* **Tablas de la Base de Datos:**
  * `profiles`: `id`, `username`, `avatar_url`, `total_area_km2`, `level`, `streak_days`.
  * `unlocked_hexagons`: `user_id`, `hex_id` (Indexado B-Tree), `unlocked_at`.
  * `territory_kings`: `zone_id`, `king_user_id`, `hex_count`, `updated_at`.
  * `friendships`: `user_id_1`, `user_id_2`, `status`.
* **Seguridad (RLS):** Cada usuario solo puede insertar hexágonos propios; la lectura de estadísticas públicas está optimizada mediante vistas materializadas.
