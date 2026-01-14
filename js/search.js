/**
 * Search Module
 * Handles search functionality with autocomplete
 */

const SearchModule = {
    input: null,
    resultsContainer: null,
    searchData: [],

    /**
     * Initialize search
     */
    init() {
        this.input = document.getElementById('search-input');
        this.resultsContainer = document.getElementById('search-results');

        // Build search index
        this.buildSearchData();

        // Bind events
        this.bindEvents();

        console.log('✓ Search initialized');
    },

    /**
     * Build searchable data from departamentos and provincias
     */
    buildSearchData() {
        const departamentos = Config.data.stats?.departamentos || [];
        const provincias = Config.data.stats?.provincias || [];

        // Add departamentos
        departamentos.forEach(d => {
            this.searchData.push({
                type: 'departamento',
                nombre: d.nombre,
                provincia: d.provincia,
                porcentaje: d.porcentaje,
                nivel: d.nivel,
                searchText: `${d.nombre} ${d.provincia}`.toLowerCase()
            });
        });

        // Add provincias
        provincias.forEach(p => {
            this.searchData.push({
                type: 'provincia',
                nombre: p.nombre,
                porcentaje: p.porcentaje,
                nivel: p.nivel,
                searchText: p.nombre.toLowerCase()
            });
        });
    },

    /**
     * Bind events
     */
    bindEvents() {
        // Input event for search
        this.input.addEventListener('input', () => {
            const query = this.input.value.trim();
            if (query.length >= 2) {
                this.search(query);
            } else {
                this.hideResults();
            }
        });

        // Focus event
        this.input.addEventListener('focus', () => {
            const query = this.input.value.trim();
            if (query.length >= 2) {
                this.search(query);
            }
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.resultsContainer.contains(e.target)) {
                this.hideResults();
            }
        });

        // Keyboard navigation
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideResults();
                this.input.blur();
            } else if (e.key === 'Enter') {
                const firstResult = this.resultsContainer.querySelector('.search-result-item');
                if (firstResult) {
                    firstResult.click();
                }
            }
        });
    },

    /**
     * Perform search
     */
    search(query) {
        const normalizedQuery = query.toLowerCase();

        const results = this.searchData
            .filter(item => item.searchText.includes(normalizedQuery))
            .slice(0, 10); // Limit to 10 results

        this.showResults(results);
    },

    /**
     * Show search results
     */
    showResults(results) {
        if (results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="search-result-item">
                    <span class="search-result-name">No se encontraron resultados</span>
                </div>
            `;
        } else {
            this.resultsContainer.innerHTML = results.map(item => `
                <div class="search-result-item" 
                     data-type="${item.type}" 
                     data-nombre="${item.nombre}"
                     data-provincia="${item.provincia || ''}">
                    <div class="search-result-name">${item.nombre}</div>
                    <div class="search-result-meta">
                        ${item.type === 'departamento' ? item.provincia + ' · ' : ''}
                        <span style="color: ${Config.getColor(item.nivel)}">${item.porcentaje}%</span>
                    </div>
                </div>
            `).join('');

            // Bind click events
            this.resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const type = item.dataset.type;
                    const nombre = item.dataset.nombre;
                    const provincia = item.dataset.provincia || null;

                    if (nombre) {
                        this.selectResult(nombre, type, provincia);
                    }
                });
            });
        }

        this.resultsContainer.classList.add('active');
    },

    /**
     * Hide results
     */
    hideResults() {
        this.resultsContainer.classList.remove('active');
    },

    /**
     * Handle result selection
     */
    selectResult(nombre, type, provincia = null) {
        // Clear input
        this.input.value = nombre;
        this.hideResults();

        // Switch to map tab
        document.querySelector('[data-tab="map"]').click();

        // Zoom to feature
        setTimeout(() => {
            const layerId = type === 'provincia' ? 'provincias' : 'departamentos';
            MapModule.zoomToFeature(nombre, layerId, provincia);
        }, 100);
    }
};

window.SearchModule = SearchModule;
