/**
 * Config Loader
 * Loads JSON and YAML configuration files
 */

const Config = {
    app: null,
    layers: null,
    charts: null,
    data: {
        stats: null,
        provincias: null,
        departamentos: null,
        puntos: null,
        propietarios: null
    },

    /**
     * Load all configuration files
     */
    async loadAll() {
        try {
            // Load configs in parallel
            const [appConfig, layersConfig, chartsConfig] = await Promise.all([
                this.loadJSON('config/config.json'),
                this.loadJSON('config/layers.json'),
                this.loadYAML('config/charts.yaml')
            ]);

            this.app = appConfig;
            this.layers = layersConfig;
            this.charts = chartsConfig;

            // Apply app config
            this.applyAppConfig();

            // Load data files
            await this.loadData();

            console.log('✓ Configuration loaded');
            return true;
        } catch (error) {
            console.error('Error loading configuration:', error);
            return false;
        }
    },

    /**
     * Load JSON file
     */
    async loadJSON(path) {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to load ${path}`);
        return response.json();
    },

    /**
     * Load YAML file
     */
    async loadYAML(path) {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to load ${path}`);
        const text = await response.text();
        return jsyaml.load(text);
    },

    /**
     * Load GeoJSON and stats data
     */
    async loadData() {
        const [stats, provincias, departamentos, puntos, propietarios] = await Promise.all([
            this.loadJSON('data/web/stats.json'),
            this.loadJSON('data/web/provincias.geojson'),
            this.loadJSON('data/web/departamentos.geojson'),
            this.loadJSON('data/web/puntos.geojson'),
            this.loadJSON('data/web/propietarios.json').catch(() => ({ propietarios: [] }))
        ]);

        this.data.stats = stats;
        this.data.provincias = provincias;
        this.data.departamentos = departamentos;
        this.data.puntos = puntos;
        this.data.propietarios = propietarios.propietarios || [];

        console.log('✓ Data loaded:', {
            provincias: provincias.features.length,
            departamentos: departamentos.features.length,
            puntos: puntos.features.length,
            propietarios: this.data.propietarios.length
        });
    },

    /**
     * Apply app configuration to DOM
     */
    applyAppConfig() {
        if (this.app) {
            document.getElementById('app-title').textContent = this.app.app.title;
            document.getElementById('app-subtitle').textContent = this.app.app.subtitle;
            document.title = `${this.app.app.title} - ${this.app.app.subtitle}`;

            // Apply colors as CSS variables
            if (this.app.colors) {
                const root = document.documentElement;
                const colorKeyAliases = {
                    background: 'bg',
                    sobre_promedio: 'sobre',
                    textMuted: 'text-muted'
                };
                const toCssKey = (key) => {
                    const aliased = colorKeyAliases[key] || key;
                    return aliased
                        .replace(/_/g, '-')
                        .replace(/([a-z])([A-Z])/g, '$1-$2')
                        .toLowerCase();
                };

                Object.entries(this.app.colors).forEach(([key, value]) => {
                    root.style.setProperty(`--color-${toCssKey(key)}`, value);
                });
            }
        }
    },

    /**
     * Get color for a nivel
     */
    getColor(nivel) {
        const colors = this.app?.colors || {};
        switch (nivel) {
            case 'alto': return colors.alto || '#e74c3c';
            case 'sobre_promedio': return colors.sobre_promedio || colors.sobre || '#f39c12';
            case 'sin_datos': return colors.sin_datos || '#555555';
            default: return colors.normal || '#27ae60';
        }
    },

    /**
     * Get nivel from porcentaje
     */
    getNivel(porcentaje) {
        const thresholds = this.app?.thresholds || { alto: 10, sobre_promedio: 6 };
        if (porcentaje >= thresholds.alto) return 'alto';
        if (porcentaje >= thresholds.sobre_promedio) return 'sobre_promedio';
        return 'normal';
    }
};

// Export for use in other modules
window.Config = Config;
