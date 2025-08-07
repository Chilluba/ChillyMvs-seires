// src/types/tmdb.ts

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

// YTS API specific type
export interface YTSMovieTorrent {
  url: string;
  hash: string;
  quality: string; // e.g., "720p", "1080p", "2160p" (4K), "3D"
  type: string; // e.g., "web", "bluray"
  seeds: number;
  peers: number;
  size: string;
  size_bytes: number;
  date_uploaded: string;
  date_uploaded_unix: number;
}

export interface TMDBBaseMovie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string; // "YYYY-MM-DD"
  vote_average: number;
  genre_ids?: number[]; // Present in list views
  overview: string;
  media_type?: 'movie'; // Added for multi-search
}

export interface TMDBMovie extends TMDBBaseMovie {
  genres: TMDBGenre[];
  runtime: number | null; // in minutes
  tagline: string | null;
  production_companies: TMDBProductionCompany[];
  revenue?: number;
  budget?: number;
  status?: string;
  videos?: {
    results: TMDBVideo[];
  };
  imdb_id?: string; 
  torrents?: YTSMovieTorrent[]; // Array of available torrents
}

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TMDBBaseTVSeries {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string; // "YYYY-MM-DD"
  vote_average: number;
  genre_ids?: number[]; // Present in list views
  overview: string;
  media_type?: 'tv'; // Added for multi-search
}

export interface TMDBEpisode {
  id: number;
  air_date: string | null;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  vote_average: number;
  season_number: number;
  runtime: number | null;
}

export interface TMDBSeason {
  air_date: string | null; 
  episode_count: number; 
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
}

export interface TMDBTVSeries extends TMDBBaseTVSeries {
  genres: TMDBGenre[];
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: TMDBSeason[];
  last_episode_to_air: TMDBEpisode | null;
  next_episode_to_air: TMDBEpisode | null;
  tagline: string | null;
  production_companies: TMDBProductionCompany[];
  created_by?: { id: number; name: string; profile_path: string | null }[];
  status?: string;
  videos?: {
    results: TMDBVideo[];
  };
}

export interface TMDBTvSeasonDetails extends TMDBSeason {
  _id: string; 
  episodes: TMDBEpisode[];
}

interface TMDBPersonResult {
  id: number;
  name: string;
  profile_path: string | null;
  media_type: 'person';
  adult: boolean;
  popularity: number;
  known_for_department?: string;
  known_for?: Array<Partial<TMDBBaseMovie & TMDBBaseTVSeries>>; 
}

export type TMDBMultiSearchResultItem = 
  | (TMDBBaseMovie & { media_type: 'movie' }) 
  | (TMDBBaseTVSeries & { media_type: 'tv' }) 
  | TMDBPersonResult;

export type ClientTMDBMultiSearchResultItem = 
  | (TMDBBaseMovie & { media_type: 'movie' }) 
  | (TMDBBaseTVSeries & { media_type: 'tv' });


export interface TMDBMultiPaginatedResponse extends TMDBPaginatedResponse<TMDBMultiSearchResultItem> {}


export interface TMDBVideo {
  iso_639_1: string;
  iso_3166_1: string;
  name: string;
  key: string; 
  site: "YouTube" | string; 
  size: 1080 | 720 | 480 | 2160 | 1440; 
  type: "Trailer" | "Teaser" | "Clip" | "Featurette" | "Behind the Scenes" | "Bloopers";
  official: boolean;
  published_at: string; 
  id: string; 
}

export interface TMDBVideoResponse {
  id: number; 
  results: TMDBVideo[];
}

export interface TMDBDiscoverFilters {
  with_genres?: string | string[]; 
  primary_release_year?: number;   
  first_air_date_year?: number;    
  with_origin_country?: string;    
  sort_by?: string;                
}
