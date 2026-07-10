export interface AppUser {
  id: number
  name: string
}

export interface Park {
  id: number
  rcdb_id: number | null
  name: string
  city: string | null
  state: string | null
  country: string | null
  lat: number | null
  lng: number | null
  main_picture_url: string | null
}

export interface CoasterStats {
  length?: string
  height?: string
  speed?: string
  inversions?: string
  duration?: string
  arrangement?: string
  capacity?: string
  designer?: string
  verticalAngle?: string
  gForce?: string
  drop?: string
  cost?: string
  builtBy?: string
  elements?: string[] | string
  formerNames?: string
  [key: string]: unknown
}

export interface Coaster {
  id: number
  rcdb_id: number | null
  name: string
  park_id: number | null
  park?: Park
  make: string | null
  model: string | null
  type: string | null
  design: string | null
  status: string | null // raw RCDB status string, e.g. "Operating", "Closed", "SBNO"
  opened_date: string | null
  closed_date: string | null
  stats: CoasterStats | null
  main_picture_url: string | null
  lat: number | null
  lng: number | null
  rcdb_link: string | null
}

export interface UserCoaster {
  id: number
  user_id: number
  coaster_id: number
  score: number | null
  comment: string | null
  tags: string[] | null
  added_at: string
  coaster?: Coaster
}

export interface UserRanking {
  id: number
  user_id: number
  coaster_id: number
  position: number
}
