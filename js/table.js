/**
 * Table Module
 * Handles data table rendering and sorting
 */

const TableModule = {
    data: [],
    currentFilteredData: [], // Store current filtered dataset
    currentPage: 1,
    rowsPerPage: 20,
    sortColumn: 'porcentaje',
    sortDirection: 'desc',

    /**
     * Initialize the table
     */
    init() {
        this.data = Config.data.stats?.departamentos || [];
        this.currentFilteredData = [...this.data]; // Initialize with all data
        this.render();
        this.bindEvents();
        console.log('✓ Table initialized');
    },

    /**
     * Render the table body
     */
    render() {
        const tableBody = document.getElementById('table-body');

        // 1. Sort the full filtered dataset first
        this.currentFilteredData = this.sortData(this.currentFilteredData);

        // 2. Pagination Logic
        const totalRows = this.currentFilteredData.length;
        const totalPages = Math.ceil(totalRows / this.rowsPerPage) || 1;

        // Ensure currentPage is valid
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = Math.min(startIndex + this.rowsPerPage, totalRows);

        // Slice data for current page
        const pageData = this.currentFilteredData.slice(startIndex, endIndex);

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

        // Render rows
        if (totalRows === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No se encontraron resultados</td></tr>';
        } else {
            tableBody.innerHTML = pageData.map(row => `
                <tr data-nombre="${row.nombre}">
                    <td>${row.nombre || '-'}</td>
                    <td>${row.provincia || '-'}</td>
                    <td style="color: ${Config.getColor(row.nivel)}">${row.porcentaje}%</td>
                    <td>${formatNumber(row.extranjerizada_ha)}</td>
                    <td>${formatNumber(row.total_ha)}</td>
                    <td><span class="nivel-badge ${row.nivel}">${getNivelLabel(row.nivel)}</span></td>
                </tr>
            `).join('');
        }

        this.updatePaginationControls(totalRows, totalPages);
    },

    /**
     * Update pagination UI
     */
    updatePaginationControls(totalRows, totalPages) {
        const pageInfo = document.getElementById('page-info');
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');

        if (pageInfo) {
            pageInfo.textContent = `Página ${this.currentPage} de ${totalPages} (${totalRows} resultados)`;
        }

        if (btnPrev) {
            btnPrev.disabled = this.currentPage === 1;
        }

        if (btnNext) {
            btnNext.disabled = this.currentPage === totalPages || totalPages === 0;
        }
    },

    nextPage() {
        const totalPages = Math.ceil(this.currentFilteredData.length / this.rowsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.render();
            this.scrollToTop();
        }
    },

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.render();
            this.scrollToTop();
        }
    },

    scrollToTop() {
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) tableContainer.scrollTop = 0;
    },

    /**
     * Get sorted data (Helper)
     */
    sortData(data) {
        return [...data].sort((a, b) => {
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

        // Pagination Events
        document.getElementById('btn-prev')?.addEventListener('click', () => this.prevPage());
        document.getElementById('btn-next')?.addEventListener('click', () => this.nextPage());

        // Set initial sort indicator
        const initialTh = document.querySelector(`#data-table th[data-sort="${this.sortColumn}"]`);
        if (initialTh) {
            initialTh.classList.add(`sorted-${this.sortDirection}`);
        }
    },

    /**
     * Apply global filter (called from Filters module)
     */
    applyFilter(filteredData) {
        this.currentFilteredData = [...filteredData]; // Store filtered data
        this.currentPage = 1; // Reset to first page
        this.render();
    }
};

window.TableModule = TableModule;
