/**
 * Main App Module
 * Initializes all modules and handles tab navigation
 */

const App = {
    currentTab: 'map',

    /**
     * Initialize the application
     */
    async init() {
        console.log('🗺️ Tierras Extranjerizadas - Initializing...');

        try {
            // Load configuration and data
            const configLoaded = await Config.loadAll();
            if (!configLoaded) {
                throw new Error('Failed to load configuration');
            }

            // Initialize modules in order
            MapModule.init();
            TableModule.init();
            ChartsModule.init();
            Filters.init();  // Global filters (replaces old FilterModule)
            SearchModule.init();
            DataSourcesModule.init();  // Data sources view

            // Initialize Impact module (async load of country data)
            if (window.ImpactModule) {
                await ImpactModule.init();
                // Trigger initial update with all data
                const allFeatures = Config.data.puntos.features.map(f => f.properties);
                ImpactModule.updateFromData(allFeatures, allFeatures);
                // Also initialize hero card
                ImpactModule.updateHero(allFeatures, allFeatures);
            }

            // Setup tab navigation
            this.setupTabs();

            // Setup layer controls
            this.setupLayerControls();

            console.log('✅ Application initialized successfully');
        } catch (error) {
            console.error('❌ Application initialization failed:', error);
            this.showError('Error al cargar la aplicación. Por favor recargue la página.');
        }
    },

    /**
     * Setup tab navigation
     */
    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        const views = document.querySelectorAll('.view');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;

                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Show corresponding view
                views.forEach(v => v.classList.remove('active'));
                document.getElementById(`${targetTab}-view`).classList.add('active');

                this.currentTab = targetTab;

                // Trigger map resize when switching to map
                if (targetTab === 'map' && MapModule.map) {
                    setTimeout(() => {
                        MapModule.map.invalidateSize();
                    }, 100);
                }
            });
        });
    },

    /**
     * Setup layer visibility controls
     */
    setupLayerControls() {
        const legend = document.getElementById('legend');
        if (!legend) return;

        // Add layer toggles to legend
        const layerControls = document.createElement('div');
        layerControls.className = 'layer-controls';
        layerControls.innerHTML = `
            <div class="legend-title" style="margin-top: 1rem;">Capas</div>
            <label class="layer-toggle" style="margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
                <input type="checkbox" id="layer-propietarios" checked>
                <span style="color: #9b59b6;">🏛️ Propietarios destacados</span>
            </label>
            <label class="layer-toggle">
                <input type="checkbox" id="layer-puntos" checked>
                <span>Puntos de datos</span>
            </label>
            <label class="layer-toggle">
                <input type="checkbox" id="layer-departamentos" checked>
                <span>Departamentos</span>
            </label>
            <label class="layer-toggle">
                <input type="checkbox" id="layer-provincias" checked>
                <span>Provincias</span>
            </label>
        `;
        legend.appendChild(layerControls);

        // Bind events
        document.getElementById('layer-provincias').addEventListener('change', (e) => {
            this.toggleLayer('provincias', e.target.checked);
        });
        document.getElementById('layer-departamentos').addEventListener('change', (e) => {
            this.toggleLayer('departamentos', e.target.checked);
        });
        document.getElementById('layer-puntos').addEventListener('change', (e) => {
            this.toggleLayer('puntos', e.target.checked);
        });
        document.getElementById('layer-propietarios').addEventListener('change', (e) => {
            this.toggleLayer('propietarios', e.target.checked);
        });
    },

    /**
     * Toggle layer visibility
     */
    toggleLayer(layerId, visible) {
        const layer = MapModule.geojsonLayers[layerId];
        if (!layer) return;

        if (visible) {
            MapModule.map.addLayer(layer);
        } else {
            MapModule.map.removeLayer(layer);
        }
    },

    /**
     * Show error message
     */
    showError(message) {
        const main = document.querySelector('.main-content');
        main.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 50vh; text-align: center; padding: 2rem;">
                <div>
                    <p style="font-size: 3rem; margin-bottom: 1rem;">⚠️</p>
                    <p style="color: #e74c3c; font-size: 1.1rem;">${message}</p>
                </div>
            </div>
        `;
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;
