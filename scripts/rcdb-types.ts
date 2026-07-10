// Mirrors the shape of fabianrguez/rcdb-api's db/*.json dumps.
// https://github.com/fabianrguez/rcdb-api/blob/main/src/types/

export interface RcdbPicture {
  id: number
  url: string
  name: string
  copyName: string
  copyDate: string
}

export interface RcdbStats {
  length?: string
  height?: string
  speed?: string
  inversions?: string
  duration?: string
  arrangement?: string
  capacity?: string
  dimensions?: unknown[] | string
  designer?: string
  verticalAngle?: string
  gForce?: string
  drop?: string
  cost?: string
  builtBy?: string
  elements?: string[] | string
  formerNames?: string
}

export interface RcdbRollerCoaster {
  id: number
  name: string
  park: {
    id: number
    name: string
  }
  city: string
  state: string
  region: string
  status: {
    state: string
    date: {
      opened: string
      closed?: string
    }
  }
  country: string
  link: string
  make: string
  model: string
  type: string
  design: string
  stats?: RcdbStats
  mainPicture: RcdbPicture | undefined
  pictures: RcdbPicture[]
  coords: {
    lat: string | undefined
    lng: string | undefined
  }
}

export interface RcdbSocialMedia {
  twitter: string
  facebook: string
  website: string
  youtube: string
  instagram: string
  pinterest: string
}

export interface RcdbParkCoaster {
  id: number
  name: string
  type: string
  design: string
  scale: string
  date: string
  status: 'closed' | 'opened' | 'opening'
}

export interface RcdbThemePark {
  id: number
  name: string
  city: string
  state: string
  country: string
  status: {
    state: string
    from: string
    to: string
  }
  mainPicture: RcdbPicture | undefined
  pictures: RcdbPicture[]
  socialMedia: RcdbSocialMedia
  coords: {
    lat: string
    lng: string
  }
  coasters: RcdbParkCoaster[]
}
