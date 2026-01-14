/**
 * Table Module
 * Handles data table rendering and sorting
 */

const TableModule = {
    data: [],
    sortColumn: 'porcentaje',
    sortDirection: 'desc',

    /**
     * Initialize the table
     */
    init() {
        this.data = Config.data.stats?.departamentos || [];
        this.render();
        this.bindEvents();
        console.log('✓ Table initialized');
    },

    /**
     * Render the table body
     */
    render(filteredData = null) {
        const tableBody = document.getElementById('table-body');
        const data = filteredData || this.getSortedData();

        const formatNumber = (num) => {
            if (num === undefined || num === null) return '-';
            return new Intl.NumberFormat('es-AR').format(Math.round(num));
        };

        const getNivelLabel = (nivel) => {
            switch (nivel) {
                case 'alto': return 'Alto';
                case 'sobre_promedio': return 'Sobre prom.';
                default: return 'Normal';
            }
        };

        tableBody.innerHTML = data.map(row => `
            <tr data-nombre="${row.nombre}">
                <td>${row.nombre || '-'}</td>
                <td>${row.provincia || '-'}</td>
                <td style="color: ${Config.getColor(row.nivel)}">${row.porcentaje}%</td>
                <td>${formatNumber(row.extranjerizada_ha)}</td>
                <td>${formatNumber(row.total_ha)}</td>
                <td><span class="nivel-badge ${row.nivel}">${getNivelLabel(row.nivel)}</span></td>
            </tr>
        `).join('');
    },

    /**
     * Get sorted data
     */
    getSortedData() {
        const sorted = [...this.data];

        sorted.sort((a, b) => {
            let valA = a[this.sortColumn];
            let valB = b[this.sortColumn];

            // Handle strings
            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = (valB || '').toLowerCase();
            }

            // Handle nulls
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            // Compare
            if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    },

    /**
     * Bind table events
     */
    bindEvents() {
        // Header click for sorting
        document.querySelectorAll('#data-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.dataset.sort;

                // Toggle direction if same column
                if (column === this.sortColumn) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortColumn = column;
                    this.sortDirection = 'desc';
                }

                // Update UI
                document.querySelectorAll('#data-table th').forEach(header => {
                    header.classList.remove('sorted-asc', 'sorted-desc');
                });
                th.classList.add(`sorted-${this.sortDirection}`);

                // Re-render
                this.render();
            });
        });

        // Row click to zoom on map
        document.getElementById('table-body').addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row) {
                const nombre = row.dataset.nombre;
                if (nombre) {
                    // Switch to map tab and zoom
                    document.querySelector('[data-tab="map"]').click();
                    setTimeout(() => {
                        MapModule.zoomToFeature(nombre);
                    }, 100);
                }
            }
        });

        // Set initial sort indicator
        const initialTh = document.querySelector(`#data-table th[data-sort="${this.sortColumn}"]`);
        if (initialTh) {
            initialTh.classList.add(`sorted-${this.sortDirection}`);
        }
    },

    /**
     * Filter table by porcentaje range
     */
    filterByPorcentaje(min, max) {
        const filtered = this.data.filter(row => {
            const p = row.porcentaje || 0;
            return p >= min && p <= max;
        });
        this.render(this.sortData(filtered));
        return filtered.length;
    },

    /**
     * Apply global filter (called from Filters module)
     */
    applyFilter(filteredData) {
        this.render(this.sortData(filteredData));
    },

    /**
     * Sort given data
     */
    sortData(data) {
        return [...data].sort((a, b) => {
            let valA = a[this.sortColumn];
            let valB = b[this.sortColumn];

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = (valB || '').toLowerCase();
            }

            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }
};

window.TableModule = TableModule;
