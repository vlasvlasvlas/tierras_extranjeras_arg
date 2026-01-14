/**
 * Global Filters Module
 * Manages synchronized state across Map, Table, and Charts
 */

const Filters = {
    // Current filter state
    state: {
        provincia: '',
        departamento: '',
        nivel: '',
        porcentajeMin: 0,
        porcentajeMax: 100
    },

    // Cached data
    allData: [],
    provincias: [],

    // DOM elements
    elements: {},

    /**
     * Initialize filters
     */
    init() {
        // Cache DOM elements
        this.elements = {
            provincia: document.getElementById('filter-provincia'),
            departamento: document.getElementById('filter-departamento'),
            nivel: document.getElementById('filter-nivel'),
            minSlider: document.getElementById('filter-min'),
            maxSlider: document.getElementById('filter-max'),
            valueDisplay: document.getElementById('filter-value'),
            sliderRange: document.getElementById('slider-range'),
            visibleCount: document.getElementById('visible-count'),
            totalCount: document.getElementById('total-count'),
            resetBtn: document.getElementById('filter-reset')
        };

        // Load data
        this.allData = Config.data.stats?.departamentos || [];
        this.buildProvinciasDropdown();

        // Set initial counts
        this.elements.totalCount.textContent = this.allData.length;
        this.elements.visibleCount.textContent = this.allData.length;

        // Bind events
        this.bindEvents();

        console.log('✓ Filters initialized');
    },

    /**
     * Build provincias dropdown from data
     */
    buildProvinciasDropdown() {
        // Get unique provincias
        const provinciasSet = new Set();
        this.allData.forEach(d => {
            if (d.provincia) provinciasSet.add(d.provincia);
        });

        this.provincias = Array.from(provinciasSet).sort();

        // Build options
        this.provincias.forEach(prov => {
            const option = document.createElement('option');
            option.value = prov;
            option.textContent = prov;
            this.elements.provincia.appendChild(option);
        });
    },

    /**
     * Build departamentos dropdown based on selected provincia
     */
    updateDepartamentosDropdown() {
        const select = this.elements.departamento;
        const selectedProv = this.state.provincia;

        // Clear current options
        select.innerHTML = '<option value="">Todos los departamentos</option>';

        // Filter departamentos by provincia
        let deptos = this.allData;
        if (selectedProv) {
            deptos = this.allData.filter(d => d.provincia === selectedProv);
        }

        // Sort and add options
        deptos
            .map(d => d.nombre)
            .filter(Boolean)
            .sort()
            .forEach(nombre => {
                const option = document.createElement('option');
                option.value = nombre;
                option.textContent = nombre;
                select.appendChild(option);
            });
    },

    /**
     * Bind all filter events
     */
    bindEvents() {
        // Provincia change
        this.elements.provincia.addEventListener('change', (e) => {
            this.state.provincia = e.target.value;
            this.state.departamento = '';
            this.updateDepartamentosDropdown();
            this.applyFilters();
        });

        // Departamento change
        this.elements.departamento.addEventListener('change', (e) => {
            this.state.departamento = e.target.value;
            this.applyFilters();
        });

        // Nivel change
        this.elements.nivel.addEventListener('change', (e) => {
            this.state.nivel = e.target.value;
            this.applyFilters();
        });

        // Slider events with debounce for smooth dragging
        let debounceTimer;
        const debounce = (fn, delay) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(fn, delay);
        };

        // Min slider - update UI immediately, apply filters with debounce
        this.elements.minSlider.addEventListener('input', () => {
            this.state.porcentajeMin = parseInt(this.elements.minSlider.value);
            if (this.state.porcentajeMin > this.state.porcentajeMax) {
                this.state.porcentajeMin = this.state.porcentajeMax;
                this.elements.minSlider.value = this.state.porcentajeMin;
            }
            this.updateSliderUI();
            debounce(() => this.applyFilters(), 100);
        });

        // Min slider - ensure filter applies when released (no debounce)
        this.elements.minSlider.addEventListener('change', () => {
            clearTimeout(debounceTimer);
            this.applyFilters();
        });

        // Max slider - update UI immediately, apply filters with debounce
        this.elements.maxSlider.addEventListener('input', () => {
            this.state.porcentajeMax = parseInt(this.elements.maxSlider.value);
            if (this.state.porcentajeMax < this.state.porcentajeMin) {
                this.state.porcentajeMax = this.state.porcentajeMin;
                this.elements.maxSlider.value = this.state.porcentajeMax;
            }
            this.updateSliderUI();
            debounce(() => this.applyFilters(), 100);
        });

        // Max slider - ensure filter applies when released (no debounce)
        this.elements.maxSlider.addEventListener('change', () => {
            clearTimeout(debounceTimer);
            this.applyFilters();
        });

        // Reset button
        this.elements.resetBtn.addEventListener('click', () => {
            this.reset();
        });
    },

    /**
     * Update slider UI
     */
    updateSliderUI() {
        this.elements.valueDisplay.textContent =
            `${this.state.porcentajeMin}% - ${this.state.porcentajeMax}%`;

        const range = this.elements.sliderRange;
        const minPercent = this.state.porcentajeMin;
        const maxPercent = this.state.porcentajeMax;

        range.style.left = `${minPercent}%`;
        range.style.width = `${maxPercent - minPercent}%`;
    },

    /**
     * Get filtered data based on current state
     */
    getFilteredData() {
        return this.allData.filter(d => {
            // Provincia filter
            if (this.state.provincia && d.provincia !== this.state.provincia) {
                return false;
            }

            // Departamento filter
            if (this.state.departamento && d.nombre !== this.state.departamento) {
                return false;
            }

            // Nivel filter
            if (this.state.nivel && d.nivel !== this.state.nivel) {
                return false;
            }

            // Porcentaje filter
            const p = d.porcentaje || 0;
            if (p < this.state.porcentajeMin || p > this.state.porcentajeMax) {
                return false;
            }

            return true;
        });
    },

    /**
     * Apply filters to all views
     */
    applyFilters() {
        const filteredData = this.getFilteredData();

        // Update count
        this.elements.visibleCount.textContent = filteredData.length;

        // Update Map - pass full filtered data for proper filtering
        if (window.MapModule) {
            MapModule.applyFilter(this.state, filteredData);
        }

        // Update Table
        if (window.TableModule) {
            TableModule.applyFilter(filteredData);
        }

        // Update Charts
        if (window.ChartsModule) {
            ChartsModule.applyFilter(filteredData);
        }

        // Update Impact Panel with dynamic comparison
        if (window.ImpactModule) {
            ImpactModule.updateFromData(filteredData, this.allData);
        }
    },

    /**
     * Reset all filters
     */
    reset() {
        this.state = {
            provincia: '',
            departamento: '',
            nivel: '',
            porcentajeMin: 0,
            porcentajeMax: 100
        };

        this.elements.provincia.value = '';
        this.elements.departamento.value = '';
        this.elements.nivel.value = '';
        this.elements.minSlider.value = 0;
        this.elements.maxSlider.value = 100;

        this.updateDepartamentosDropdown();
        this.updateSliderUI();
        this.applyFilters();
    },

    /**
     * Set filter from external source (e.g., search)
     */
    setFilter(key, value) {
        if (key in this.state) {
            this.state[key] = value;

            if (key === 'provincia') {
                this.elements.provincia.value = value;
                this.updateDepartamentosDropdown();
            } else if (key === 'departamento') {
                this.elements.departamento.value = value;
            }

            this.applyFilters();
        }
    }
};

window.Filters = Filters;
