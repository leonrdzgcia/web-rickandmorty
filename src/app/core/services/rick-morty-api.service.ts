import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { ApiResponse, Character, CharacterFilters } from '../models/character.model';

@Injectable({
  providedIn: 'root'
})
export class RickMortyApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = 'https://rickandmortyapi.com/api';

  /**
   * Obtiene personajes con filtros opcionales
   * @param filters Filtros para la búsqueda
   * @returns Observable con la respuesta de la API
   */
  getCharacters(filters: CharacterFilters = {}): Observable<ApiResponse<Character>> {
    let params = new HttpParams();

    // Construir parámetros dinámicamente
    if (filters.name) {
      params = params.set('name', filters.name);
    }
    if (filters.status) {
      params = params.set('status', filters.status as string);
    }
    if (filters.species) {
      params = params.set('species', filters.species);
    }
    if (filters.gender) {
      params = params.set('gender', filters.gender as string);
    }
    if (filters.page) {
      params = params.set('page', filters.page.toString());
    }

    return this.http.get<ApiResponse<Character>>(`${this.API_URL}/character`, { params }).pipe(
      catchError((error) => {
        console.error('Error fetching characters:', error);
        // Retornar respuesta vacía en caso de error (ej: no se encontraron resultados)
        return of({
          info: { count: 0, pages: 0, next: null, prev: null },
          results: []
        });
      }),
      shareReplay(1) // Cachear la última respuesta para suscriptores múltiples
    );
  }

  /**
   * Obtiene un personaje por ID
   * @param id ID del personaje
   * @returns Observable con el personaje
   */
  getCharacterById(id: number): Observable<Character | null> {
    return this.http.get<Character>(`${this.API_URL}/character/${id}`).pipe(
      catchError((error) => {
        console.error(`Error fetching character ${id}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Obtiene múltiples personajes por IDs
   * @param ids Array de IDs
   * @returns Observable con array de personajes
   */
  getMultipleCharacters(ids: number[]): Observable<Character[]> {
    if (ids.length === 0) {
      return of([]);
    }

    const idsString = ids.join(',');
    return this.http.get<Character[]>(`${this.API_URL}/character/${idsString}`).pipe(
      catchError((error) => {
        console.error('Error fetching multiple characters:', error);
        return of([]);
      })
    );
  }
}
