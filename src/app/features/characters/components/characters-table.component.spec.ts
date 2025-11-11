import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of, throwError } from 'rxjs';

import { CharactersTableComponent } from './characters-table.component';
import { RickMortyApiService } from '../../../core/services/rick-morty-api.service';

describe('CharactersTableComponent', () => {
  let component: CharactersTableComponent;
  let fixture: ComponentFixture<CharactersTableComponent>;
  let mockApiService: jasmine.SpyObj<RickMortyApiService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockActivatedRoute: any;
  let mockBreakpointObserver: jasmine.SpyObj<BreakpointObserver>;

  beforeEach(async () => {
    // Crear mocks de los servicios
    mockApiService = jasmine.createSpyObj('RickMortyApiService', ['getCharacters']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockActivatedRoute = {
      snapshot: {
        queryParams: {}
      }
    };
    mockBreakpointObserver = jasmine.createSpyObj('BreakpointObserver', ['observe']);
    mockBreakpointObserver.observe.and.returnValue(of({ matches: false, breakpoints: {} }));

    await TestBed.configureTestingModule({
      imports: [
        CharactersTableComponent,
        ReactiveFormsModule,
        BrowserAnimationsModule
      ],
      providers: [
        { provide: RickMortyApiService, useValue: mockApiService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: BreakpointObserver, useValue: mockBreakpointObserver }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CharactersTableComponent);
    component = fixture.componentInstance;
  });

  describe('Error Handling', () => {
    it('debería manejar correctamente un error en la carga de personajes', (done) => {
      const mockError = { status: 500, message: 'Internal Server Error' };
      mockApiService.getCharacters.and.returnValue(throwError(() => mockError));
      spyOn(console, 'error');
      fixture.detectChanges();
      // estado después del error
      setTimeout(() => {
        expect(component.loading()).toBe(false);
        expect(component.characters()).toEqual([]);
        expect(component.hasMore()).toBe(false);
        expect(console.error).toHaveBeenCalledWith('Error loading characters:', mockError);
        expect(mockApiService.getCharacters).toHaveBeenCalledTimes(1);

        done();
      }, 100);
    });

    it('debería mantener los personajes existentes cuando falla al cargar más páginas', (done) => {
      // Configura respuesta exitosa para la primera llama
      const mockFirstPageResponse = {
        info: { count: 826, pages: 42, next: 'page2', prev: null },
        results: [
          {
            id: 1,
            name: 'Rick Sanchez',
            status: 'Alive' as const,
            species: 'Human',
            type: '',
            gender: 'Male' as const,
            origin: { name: 'Earth', url: 'https://rickandmortyapi.com/api/location/1' },
            location: { name: 'Earth', url: 'https://rickandmortyapi.com/api/location/20' },
            image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg',
            episode: ['https://rickandmortyapi.com/api/episode/1'],
            url: 'https://rickandmortyapi.com/api/character/1',
            created: '2017-11-04T18:48:46.250Z'
          }
        ]
      };

      const mockError = { status: 500, message: 'Internal Server Error' };

      // Primera llamada exitosa, segunda llamada con error
      mockApiService.getCharacters
        .and.returnValues(
          of(mockFirstPageResponse),
          throwError(() => mockError)
        );

      spyOn(console, 'error');
      fixture.detectChanges();

      // Esperar que cargue la primera página
      setTimeout(() => {
        expect(component.characters().length).toBe(1);
        expect(component.loading()).toBe(false);
        expect(component.hasMore()).toBe(true);

        component.loadNextPage();

        // Esperar a que se maneje el error
        setTimeout(() => {
          expect(component.characters().length).toBe(1);
          expect(component.characters()[0].name).toBe('Rick Sanchez');
          expect(component.loadingMore()).toBe(false);

          expect(component.hasMore()).toBe(false);
          expect(console.error).toHaveBeenCalledWith('Error loading characters:', mockError);

          done();
        }, 100);
      }, 100);
    });

    it('debería establecer isLoadingPage en false después de un error', (done) => {
      const mockError = { status: 404, message: 'Not Found' };
      mockApiService.getCharacters.and.returnValue(throwError(() => mockError));
      spyOn(console, 'error');
      fixture.detectChanges();
      setTimeout(() => {
        expect(component.hasMore()).toBe(false);
        expect(component.loading()).toBe(false);
        component.filtersForm.patchValue({ name: 'Rick' });
        setTimeout(() => {
          // Verificar que se intentó hacer otra llamada después del filtro
          expect(mockApiService.getCharacters).toHaveBeenCalledTimes(2);

          done();
        }, 400); // Esperar el debounceTime(300) + margen
      }, 100);
    });
  });

  describe('Successful Loading', () => {
    it('debería cargar personajes exitosamente', (done) => {
      const mockResponse = {
        info: { count: 826, pages: 42, next: 'page2', prev: null },
        results: [
          {
            id: 1,
            name: 'Rick Sanchez',
            status: 'Alive' as const,
            species: 'Human',
            type: '',
            gender: 'Male' as const,
            origin: { name: 'Earth', url: 'https://rickandmortyapi.com/api/location/1' },
            location: { name: 'Earth', url: 'https://rickandmortyapi.com/api/location/20' },
            image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg',
            episode: ['https://rickandmortyapi.com/api/episode/1'],
            url: 'https://rickandmortyapi.com/api/character/1',
            created: '2017-11-04T18:48:46.250Z'
          },
          {
            id: 2,
            name: 'Morty Smith',
            status: 'Alive' as const,
            species: 'Human',
            type: '',
            gender: 'Male' as const,
            origin: { name: 'Earth', url: 'https://rickandmortyapi.com/api/location/1' },
            location: { name: 'Earth', url: 'https://rickandmortyapi.com/api/location/20' },
            image: 'https://rickandmortyapi.com/api/character/avatar/2.jpeg',
            episode: ['https://rickandmortyapi.com/api/episode/1'],
            url: 'https://rickandmortyapi.com/api/character/2',
            created: '2017-11-04T18:50:21.651Z'
          }
        ]
      };

      mockApiService.getCharacters.and.returnValue(of(mockResponse));

      fixture.detectChanges();

      setTimeout(() => {
        expect(component.loading()).toBe(false);
        expect(component.characters().length).toBe(2);
        expect(component.characters()[0].name).toBe('Rick Sanchez');
        expect(component.characters()[1].name).toBe('Morty Smith');
        expect(component.totalCount()).toBe(826);
        expect(component.totalPages()).toBe(42);
        expect(component.hasMore()).toBe(true);
        expect(component.currentPage()).toBe(1);
        done();
      }, 100);
    });
  });
});
