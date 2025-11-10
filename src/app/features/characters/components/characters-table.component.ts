import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
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
    MatChipsModule
  ],
  templateUrl: './characters-table.component.html',
  styleUrls: ['./characters-table.component.scss']
})
export class CharactersTableComponent implements OnInit, OnDestroy {
  private readonly apiService = inject(RickMortyApiService);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado reactivo
  characters = signal<Character[]>([]);
  loading = signal<boolean>(false);
  totalCount = signal<number>(0);
  totalPages = signal<number>(0);

  // Configuración de la tabla
  displayedColumns: string[] = ['image', 'name', 'status', 'species', 'gender', 'origin', 'location'];
  pageSize = 20; // La API de Rick & Morty devuelve 20 resultados por página
  currentPage = signal<number>(0);

  // Formulario de filtros
  filtersForm = new FormGroup({
    name: new FormControl<string>(''),
    status: new FormControl<CharacterStatus | ''>(''),
    species: new FormControl<string>(''),
    gender: new FormControl<CharacterGender | ''>('')
  });

  // Opciones para los selects
  statusOptions: (CharacterStatus | '')[] = ['', 'Alive', 'Dead', 'unknown'];
  genderOptions: (CharacterGender | '')[] = ['', 'Female', 'Male', 'Genderless', 'unknown'];

  // Subject para manejar cambios de página
  private pageChange$ = new BehaviorSubject<number>(1);

  ngOnInit(): void {
    this.setupDataStream();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Configura el stream de datos reactivo combinando filtros y paginación
   */
  private setupDataStream(): void {
    // Observar cambios en el formulario con debounce
    const filters$ = this.filtersForm.valueChanges.pipe(
      startWith(this.filtersForm.value),
      debounceTime(400), // Esperar 400ms después de que el usuario deje de escribir
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
        tap(() => this.loading.set(true)),
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
          this.characters.set(response.results);
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
      gender: ''
    });
  }

  /**
   * Obtiene la clase CSS para el estado del personaje
   */
  getStatusClass(status: CharacterStatus): string {
    return `status-${status.toLowerCase()}`;
  }

  /**
   * Verifica si hay filtros activos
   */
  hasActiveFilters(): boolean {
    const values = this.filtersForm.value;
    return !!(values.name || values.status || values.species || values.gender);
  }
}
