/**
 * Data Sources Module
 * Displays downloadable data sources from config/sources.json
 */

const DataSourcesModule = {
    sources: null,

    /**
     * Initialize data sources view
     */
    async init() {
        try {
            const response = await fetch('config/sources.json');
            const data = await response.json();
            this.sources = data.sources || [];
            this.render();
            console.log('✓ Data sources loaded:', this.sources.length);
        } catch (error) {
            console.error('Error loading data sources:', error);
            this.renderError();
        }
    },

    /**
     * Render data sources
     */
    render() {
        const container = document.getElementById('data-sources-container');
        if (!container) return;

        container.innerHTML = `
            <div class="data-header">
                <h2>📂 Datos Abiertos</h2>
                <p>Todos los datos utilizados en este visor están disponibles para descarga. 
                   Puedes usar estos archivos para tus propios análisis e investigaciones.</p>
            </div>
            <div class="data-sources-grid">
                ${this.sources.map(source => this.renderSource(source)).join('')}
            </div>
        `;
    },

    /**
     * Render a single data source card
     */
    renderSource(source) {
        const filesHtml = source.files.length > 0
            ? source.files.map(file => `
                <div class="data-file">
                    <div class="data-file-info">
                        <span class="data-file-name">${file.name}</span>
                        <span class="data-file-size">${file.size}</span>
                    </div>
                    <p class="data-file-desc">${file.description}</p>
                    <a href="${file.path}" download class="data-download-btn">
                        ⬇️ Descargar
                    </a>
                </div>
            `).join('')
            : '<p class="no-files">Datos procesados internamente, no disponibles para descarga directa.</p>';

        return `
            <div class="data-source-card">
                <div class="data-source-header">
                    <h3>${source.name}</h3>
                    <span class="data-format">${source.format}</span>
                </div>
                <p class="data-source-org">${source.organization}</p>
                <p class="data-source-desc">${source.description}</p>
                
                <div class="data-source-meta">
                    <span class="data-updated">📅 Actualizado: ${source.updated}</span>
                    <span class="data-license">📜 ${source.license}</span>
                </div>
                
                <a href="${source.url}" target="_blank" class="data-source-link">
                    Ver fuente original →
                </a>
                
                ${source.files.length > 0 ? `
                    <div class="data-files-section">
                        <h4>Archivos disponibles</h4>
                        ${filesHtml}
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Render error state
     */
    renderError() {
        const container = document.getElementById('data-sources-container');
        if (!container) return;

        container.innerHTML = `
            <div class="data-error">
                <p>⚠️ No se pudieron cargar las fuentes de datos.</p>
            </div>
        `;
    }
};

window.DataSourcesModule = DataSourcesModule;
