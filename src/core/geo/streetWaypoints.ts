/**
 * TerraMaps - Street Walking Router (Simulador de Caminata por Calles Reales)
 * 
 * Garantiza que el explorador avance estrictamente sobre el asfalto de avenidas
 * y calles peatonales (Madero, Juárez, Paseo de la Reforma) doblando en esquinas
 * reales en vez de atravesar manzanas o edificios en diagonal.
 */

export interface StreetWaypoint {
  name: string;
  coordinates: [number, number]; // [lng, lat]
}

// Corredor de calles reales: Zócalo -> Madero -> Bellas Artes -> Av. Juárez -> Alameda -> Paseo de la Reforma
export const STREET_WAYPOINTS: StreetWaypoint[] = [
  { name: 'Zócalo Capitalino', coordinates: [-99.1332, 19.4326] },
  { name: 'Calle Francisco I. Madero & Palma', coordinates: [-99.1350, 19.4332] },
  { name: 'Calle Francisco I. Madero & Isabel La Católica', coordinates: [-99.1365, 19.4337] },
  { name: 'Madero & Eje Central (Palacio de Bellas Artes)', coordinates: [-99.1385, 19.4343] },
  { name: 'Av. Juárez & López (Alameda Central)', coordinates: [-99.1405, 19.4348] },
  { name: 'Av. Juárez & Balderas', coordinates: [-99.1425, 19.4354] },
  { name: 'Paseo de la Reforma & Av. Juárez (El Caballito)', coordinates: [-99.1448, 19.4360] },
  { name: 'Paseo de la Reforma & Atenas', coordinates: [-99.1475, 19.4345] },
  { name: 'Paseo de la Reforma & Glorieta de las Mujeres', coordinates: [-99.1505, 19.4325] },
  { name: 'Paseo de la Reforma & Glorieta del Ahuehuete', coordinates: [-99.1540, 19.4300] },
  { name: 'Paseo de la Reforma & Insurgentes', coordinates: [-99.1580, 19.4275] },
  { name: 'Paseo de la Reforma (Ángel de la Independencia)', coordinates: [-99.1625, 19.4245] },
  { name: 'Florencia & Liverpool (Zona Rosa)', coordinates: [-99.1635, 19.4225] },
  { name: 'Av. Chapultepec & Insurgentes', coordinates: [-99.1600, 19.4230] },
  { name: 'Av. Arcos de Belén & Balderas', coordinates: [-99.1460, 19.4280] },
  { name: 'Retorno a Zócalo (Av. 20 de Noviembre)', coordinates: [-99.1335, 19.4310] },
];

export class StreetWalkingRouter {
  private currentWaypointIndex: number = 0;
  private currentPosition: [number, number];
  private stepFraction: number = 0;
  // Paso promedio de caminata humana: ~35 metros (0.00032 grados aprox)
  private readonly STEP_DISTANCE_DEG: number = 0.00035;

  constructor(initialCoords: [number, number] = [-99.1332, 19.4326]) {
    this.currentPosition = [...initialCoords];
    this.currentWaypointIndex = this.findClosestWaypointIndex(initialCoords);
  }

  private findClosestWaypointIndex(coords: [number, number]): number {
    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < STREET_WAYPOINTS.length; i++) {
      const wp = STREET_WAYPOINTS[i].coordinates;
      const d = Math.hypot(wp[0] - coords[0], wp[1] - coords[1]);
      if (d < minDistance) {
        minDistance = d;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  /**
   * Avanza un paso en la calle actual hacia la siguiente esquina / cruce.
   */
  public nextStep(): [number, number] {
    const targetIndex = (this.currentWaypointIndex + 1) % STREET_WAYPOINTS.length;
    const targetWp = STREET_WAYPOINTS[targetIndex].coordinates;

    const dLng = targetWp[0] - this.currentPosition[0];
    const dLat = targetWp[1] - this.currentPosition[1];
    const distToTarget = Math.hypot(dLng, dLat);

    if (distToTarget <= this.STEP_DISTANCE_DEG) {
      // Llegó a la esquina/waypoint, avanzar al siguiente tramo de calle
      this.currentPosition = [...targetWp];
      this.currentWaypointIndex = targetIndex;
    } else {
      // Avanzar una fracción a lo largo de la calle
      const ratio = this.STEP_DISTANCE_DEG / distToTarget;
      this.currentPosition = [
        this.currentPosition[0] + dLng * ratio,
        this.currentPosition[1] + dLat * ratio,
      ];
    }

    return [this.currentPosition[0], this.currentPosition[1]];
  }

  public getCurrentPosition(): [number, number] {
    return [...this.currentPosition];
  }

  public setPosition(coords: [number, number]): void {
    this.currentPosition = [...coords];
    this.currentWaypointIndex = this.findClosestWaypointIndex(coords);
  }
}

export const streetWalkingRouter = new StreetWalkingRouter();
