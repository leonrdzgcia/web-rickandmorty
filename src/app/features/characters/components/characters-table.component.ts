import { Component, OnInit, OnDestroy, AfterViewInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
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
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

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
export class CharactersTableComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly apiService = inject(RickMortyApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly destroy$ = new Subject<void>();

  // ViewChild para detectar el scroll sentinel
  @ViewChild('scrollSentinel') scrollSentinel?: ElementRef;
  @ViewChild('scrollSentinelMobile') scrollSentinelMobile?: ElementRef;

  // Signals para estado reactivo
  characters = signal<Character[]>([]);
  loading = signal<boolean>(false);
  loadingMore = signal<boolean>(false);
  totalCount = signal<number>(0);
  totalPages = signal<number>(0);
  currentPage = signal<number>(1);
  hasMore = signal<boolean>(true);
  isMobile = signal<boolean>(false);
  favorites = signal<number[]>([]);

  // Configuración de la tabla
  displayedColumns: string[] = ['favorite', 'image', 'name', 'status', 'species', 'gender', 'origin', 'location', 'created', 'episode'];
  pageSize = 20; // La API de Rick & Morty devuelve 20 resultados por página

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

  // IntersectionObserver para infinite scroll
  private intersectionObserver?: IntersectionObserver;
  private isLoadingPage = false;

  ngOnInit(): void {
    this.loadFavorites();
    this.loadInitialData();
    this.setupFiltersObserver();
    this.setupBreakpointObserver();
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  /**
   * Configura el observador de breakpoints para detectar dispositivos móviles
   */
  private setupBreakpointObserver(): void {
    this.breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.Tablet])
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        const wasMobile = this.isMobile();
        this.isMobile.set(result.matches);

        // Reconfigurar observer si cambió el tipo de dispositivo
        if (wasMobile !== result.matches) {
          this.intersectionObserver?.disconnect();
          setTimeout(() => this.setupIntersectionObserver(), 100);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.intersectionObserver?.disconnect();
  }

  /**
   * Configura el IntersectionObserver para infinite scroll
   */
  private setupIntersectionObserver(): void {
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && this.hasMore() && !this.isLoadingPage) {
          this.loadNextPage();
        }
      });
    }, options);

    // Observar el sentinel apropiado según el dispositivo
    setTimeout(() => {
      const sentinel = this.isMobile() ? this.scrollSentinelMobile : this.scrollSentinel;
      if (sentinel?.nativeElement) {
        this.intersectionObserver?.observe(sentinel.nativeElement);
      }
    }, 100);
  }

  /**
   * Carga los datos iniciales
   */
  private loadInitialData(): void {
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

    // Establecer los valores en el formulario
    this.filtersForm.patchValue(filters, { emitEvent: false });
    // Cargar la primera página
    this.loadCharacters(1);
  }

  /**
   * Actualiza los query params de la URL con los filtros actuales
   */
  private updateUrlParams(filters: any): void {
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

    // Actualizar la URL sin recargar la página
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  /**
   * Configura el observador de cambios en filtros
   */
  private setupFiltersObserver(): void {
    // Observar cambios en el formulario con debounce
    this.filtersForm.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        // Resetear a la primera página cuando cambian los filtros
        this.currentPage.set(1);
        this.characters.set([]);
        this.hasMore.set(true);
        this.updateUrlParams(this.filtersForm.value);
        this.loadCharacters(1);
      });
  }

  /**
   * Carga personajes de una página específica
   */
  private loadCharacters(page: number, append: boolean = false): void {
    if (this.isLoadingPage) return;

    this.isLoadingPage = true;

    if (page === 1) {
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }

    const filters = this.filtersForm.value;
    const apiFilters: CharacterFilters = {
      name: filters.name || undefined,
      status: filters.status || undefined,
      species: filters.species || undefined,
      gender: filters.gender || undefined,
      page: page
    };

    this.apiService.getCharacters(apiFilters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Aplicar filtro de fecha client-side
          const filteredCharacters = this.filterByDateRange(response.results);

          // Acumular o reemplazar personajes
          if (append) {
            this.characters.set([...this.characters(), ...filteredCharacters]);
          } else {
            this.characters.set(filteredCharacters);
          }

          this.totalCount.set(response.info.count);
          this.totalPages.set(response.info.pages);
          this.currentPage.set(page);
          this.hasMore.set(page < response.info.pages);

          this.loading.set(false);
          this.loadingMore.set(false);
          this.isLoadingPage = false;
        },
        error: (error) => {
          console.error('Error loading characters:', error);
          if (!append) {
            this.characters.set([]);
          }
          this.loading.set(false);
          this.loadingMore.set(false);
          this.isLoadingPage = false;
          this.hasMore.set(false);
        }
      });
  }

  /**
   * Carga la siguiente página de personajes (para infinite scroll)
   */
  loadNextPage(): void {
    if (!this.hasMore() || this.isLoadingPage) return;
    const nextPage = this.currentPage() + 1;
    this.loadCharacters(nextPage, true);
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
