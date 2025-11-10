export interface Character {
  id: number;
  name: string;
  status: CharacterStatus;
  species: string;
  type: string;
  gender: CharacterGender;
  origin: Location;
  location: Location;
  image: string;
  episode: string[];
  url: string;
  created: string;
}

export type CharacterStatus = 'Alive' | 'Dead' | 'unknown';
export type CharacterGender = 'Female' | 'Male' | 'Genderless' | 'unknown';

export interface Location {
  name: string;
  url: string;
}

export interface ApiResponse<T> {
  info: Info;
  results: T[];
}

export interface Info {
  count: number;
  pages: number;
  next: string | null;
  prev: string | null;
}

export interface CharacterFilters {
  name?: string;
  status?: CharacterStatus | '';
  species?: string;
  gender?: CharacterGender | '';
  page?: number;
}
