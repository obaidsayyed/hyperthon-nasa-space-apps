export type RegionName = 'Nagpur' | 'Wardha'

export interface RegionMeta {
  name: RegionName
  label: string
  coordinates: [number, number]
  latitude: string
  longitude: string
  description: string
}

// Regional centroids are for navigation and demo views only, not farm boundaries.
export const REGIONS: Record<RegionName, RegionMeta> = {
  Nagpur: {
    name: 'Nagpur',
    label: 'Nagpur, Maharashtra',
    coordinates: [79.0882, 21.1458],
    latitude: '21.1458',
    longitude: '79.0882',
    description: 'Vidarbha · Nagpur district',
  },
  Wardha: {
    name: 'Wardha',
    label: 'Wardha, Maharashtra',
    coordinates: [78.6022, 20.7453],
    latitude: '20.7453',
    longitude: '78.6022',
    description: 'Vidarbha · Wardha district',
  },
}
