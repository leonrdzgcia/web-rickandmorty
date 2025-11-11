import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap, startWith, BehaviorSubject, combineLatest, map, tap } from 'rxjs';

import { RickMortyApiService } from '../../../core/services/rick-morty-api.service';
import { Character, CharacterFilters, CharacterStatus, CharacterGender } from '../../../core/models/character.model';

@Component({
  selector: 'app-characters-table',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './characters-table.component.html',
  styleUrls: ['./characters-table.component.scss']
})
export class CharactersTableComponent implements OnInit, OnDestroy {
  private readonly apiService = inject(RickMortyApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado reactivo
  characters = signal<Character[]>([]);
  loading = signal<boolean>(false);
  totalCount = signal<number>(0);
  totalPages = signal<number>(0);
  isMobile = signal<boolean>(false);
  favorites = signal<number[]>([]);

  // Configuración de la tabla
  displayedColumns: string[] = ['favorite', 'image', 'name', 'status', 'species', 'gender', 'origin', 'location', 'created', 'episode'];
  pageSize = 20; // La API de Rick & Morty devuelve 20 resultados por página
  currentPage = signal<number>(0);

  // Formulario de filtros
  filtersForm = new FormGroup({
    name: new FormControl<string>(''),
    status: new FormControl<CharacterStatus | ''>(''),
    species: new FormControl<string>(''),
    gender: new FormControl<CharacterGender | ''>(''),
    createdStartDate: new FormControl<Date | null>(null),
    createdEndDate: new FormControl<Date | null>(null)
  });

  // Opciones para los selects
  statusOptions: (CharacterStatus | '')[] = ['', 'Alive', 'Dead', 'unknown'];
  genderOptions: (CharacterGender | '')[] = ['', 'Female', 'Male', 'Genderless', 'unknown'];

  // Subject para manejar cambios de página
  private pageChange$ = new BehaviorSubject<number>(1);

  ngOnInit(): void {
    this.loadFavorites();
    this.loadFiltersFromUrl();
    this.setupDataStream();
    this.setupBreakpointObserver();
  }

  /**
   * Configura el observador de breakpoints para detectar dispositivos móviles
   */
  private setupBreakpointObserver(): void {
    this.breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.Tablet])
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isMobile.set(result.matches);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga los filtros desde los query params de la URL
   */
  private loadFiltersFromUrl(): void {
    const params = this.route.snapshot.queryParams;

    // Parsear los valores de los query params
    const filters: any = {
      name: params['name'] || '',
      status: params['status'] || '',
      species: params['species'] || '',
      gender: params['gender'] || '',
      createdStartDate: params['createdStartDate'] ? new Date(params['createdStartDate']) : null,
      createdEndDate: params['createdEndDate'] ? new Date(params['createdEndDate']) : null
    };

    // Actualizar la página actual si existe en la URL
    if (params['page']) {
      const page = parseInt(params['page'], 10);
      if (!isNaN(page) && page > 0) {
        this.currentPage.set(page - 1); // Angular Material usa índice base 0
        this.pageChange$.next(page);
      }
    }

    // Establecer los valores en el formulario
    this.filtersForm.patchValue(filters, { emitEvent: false });
  }

  /**
   * Actualiza los query params de la URL con los filtros actuales
   */
  private updateUrlParams(filters: any, page: number): void {
    const queryParams: any = {};

    // Solo agregar parámetros no vacíos
    if (filters.name) queryParams['name'] = filters.name;
    if (filters.status) queryParams['status'] = filters.status;
    if (filters.species) queryParams['species'] = filters.species;
    if (filters.gender) queryParams['gender'] = filters.gender;
    if (filters.createdStartDate) {
      queryParams['createdStartDate'] = new Date(filters.createdStartDate).toISOString().split('T')[0];
    }
    if (filters.createdEndDate) {
      queryParams['createdEndDate'] = new Date(filters.createdEndDate).toISOString().split('T')[0];
    }
    if (page > 1) queryParams['page'] = page;

    // Actualizar la URL sin recargar la página
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  /**
   * Configura el stream de datos reactivo combinando filtros y paginación
   */
  private setupDataStream(): void {
    // Observar cambios en el formulario con debounce
    const filters$ = this.filtersForm.valueChanges.pipe(
      startWith(this.filtersForm.value),
      debounceTime(300), // Esperar 400ms después de que el usuario deje de escribir
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      tap(() => {
        // Resetear a la primera página cuando cambian los filtros
        this.currentPage.set(0);
        this.pageChange$.next(1);
      })
    );

    // Combinar filtros y paginación
    combineLatest([filters$, this.pageChange$])
      .pipe(
        tap(([filters, page]) => {
          this.loading.set(true);
          // Actualizar URL con los filtros y página actual
          this.updateUrlParams(filters, page);
        }),
        switchMap(([filters, page]) => {
          const apiFilters: CharacterFilters = {
            name: filters.name || undefined,
            status: filters.status || undefined,
            species: filters.species || undefined,
            gender: filters.gender || undefined,
            page: page
          };
          return this.apiService.getCharacters(apiFilters);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          // Aplicar filtro de fecha client-side
          const filteredCharacters = this.filterByDateRange(response.results);
          this.characters.set(filteredCharacters);
          this.totalCount.set(response.info.count);
          this.totalPages.set(response.info.pages);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error loading characters:', error);
          this.characters.set([]);
          this.loading.set(false);
        }
      });
  }

  /**
   * Maneja el cambio de página del paginator
   */
  onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    // La API usa páginas base 1, Angular Material usa base 0
    this.pageChange$.next(event.pageIndex + 1);
  }

  /**
   * Limpia todos los filtros
   */
  clearFilters(): void {
    this.filtersForm.reset({
      name: '',
      status: '',
      species: '',
      gender: '',
      createdStartDate: null,
      createdEndDate: null
    });

    // Limpiar los query params de la URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });
  }

  /**
   * Obtiene la clase CSS para el estado del personaje
   */
  getStatusClass(status: CharacterStatus): string {
    return `status-${status.toLowerCase()}`;
  }

  /**
   * Filtra los personajes por rango de fechas (client-side)
   */
  private filterByDateRange(characters: Character[]): Character[] {
    const startDate = this.filtersForm.get('createdStartDate')?.value;
    const endDate = this.filtersForm.get('createdEndDate')?.value;

    if (!startDate && !endDate) {
      return characters;
    }

    return characters.filter(character => {
      const charDate = new Date(character.created);

      // Normalizar las fechas al inicio del día para comparación justa
      if (startDate) {
        const normalizedStart = new Date(startDate);
        normalizedStart.setHours(0, 0, 0, 0);
        if (charDate < normalizedStart) return false;
      }

      if (endDate) {
        const normalizedEnd = new Date(endDate);
        normalizedEnd.setHours(23, 59, 59, 999);
        if (charDate > normalizedEnd) return false;
      }

      return true;
    });
  }

  /**
   * Verifica si hay filtros activos
   */
  hasActiveFilters(): boolean {
    const values = this.filtersForm.value;
    return !!(values.name || values.status || values.species || values.gender || values.createdStartDate || values.createdEndDate);
  }

  /**
   * Carga los favoritos desde localStorage
   */
  private loadFavorites(): void {
    const stored = localStorage.getItem('rickmorty_favorites');
    console.log('Favoritos localStorage:', stored);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.favorites.set(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        this.favorites.set([]);
      }
    }
  }

  /**
   * Guarda los favoritos en localStorage
   */
  private saveFavorites(): void {
    const favoritesData = this.favorites();
    localStorage.setItem('rickmorty_favorites', JSON.stringify(favoritesData))
  }

  /**
   * Alterna el estado de favorito de un personaje
   */
  toggleFavorite(characterId: number): void {
    const currentFavorites = this.favorites();
    const index = currentFavorites.indexOf(characterId);

    if (index > -1) {
      const newFavorites = currentFavorites.filter(id => id !== characterId);
      this.favorites.set(newFavorites);
    } else {
      // Agregar
      this.favorites.set([...currentFavorites, characterId]);
    }

    this.saveFavorites();
  }

  /**
   * Verifica si un personaje es favorito
   */
  isFavorite(characterId: number): boolean {
    return this.favorites().includes(characterId);
  }

  /**
   * Exporta los datos actuales de la tabla a un archivo CSV
   */
  exportToCSV(): void {
    const currentCharacters = this.characters();

    if (currentCharacters.length === 0) {
      console.warn('No hay datos para exportar');
      return;
    }
    //columnas del CSV
    const headers = ['Name', 'Status', 'Species', 'Gender', 'Origin', 'Location', 'Created', 'Number of Episodes'];

    const csvContent = [
      headers.join(','), // Encabezados
      ...currentCharacters.map(character => {
        return [
          `"${character.name}"`,
          character.status,
          character.species,
          character.gender,
          `"${character.origin.name}"`,
          `"${character.location.name}"`,
          new Date(character.created).toLocaleString(),
          character.episode.length
        ].join(',');
      })
    ].join('\n');
    // Crear el archivo Blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rick-morty-characters-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
