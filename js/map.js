/**
 * Map Module
 * Handles Leaflet map initialization and layer management
 */

const MapModule = {
    map: null,
    layers: {},
    geojsonLayers: {},

    /**
     * Initialize the map
     */
    init() {
        const mapConfig = Config.app?.map || {};

        // Create map
        this.map = L.map('map', {
            center: mapConfig.center || [-38.5, -63.5],
            zoom: mapConfig.zoom || 4,
            minZoom: mapConfig.minZoom || 3,
            maxZoom: mapConfig.maxZoom || 12,
            zoomControl: true
        });

        // Store initial view for home button
        this.initialView = {
            center: mapConfig.center || [-38.5, -63.5],
            zoom: mapConfig.zoom || 4
        };

        // Add tile layer
        const tiles = mapConfig.tiles || {};
        L.tileLayer(tiles.url || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: tiles.attribution || '© OpenStreetMap © CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);

        // Load layers
        this.loadLayers();

        // Load propietarios markers
        this.loadPropietarios();

        // Setup custom controls
        this.setupControls();

        console.log('✓ Map initialized');
    },

    /**
     * Load GeoJSON layers
     */
    loadLayers() {
        // Load provincias (base polygons - semi-transparent)
        if (Config.data.provincias) {
            this.geojsonLayers.provincias = L.geoJSON(Config.data.provincias, {
                style: (feature) => this.getPolygonStyle(feature, 'provincias'),
                onEachFeature: (feature, layer) => this.bindPopup(feature, layer, 'provincias')
            }).addTo(this.map);
        }

        // Load departamentos (polygons with color by nivel)
        if (Config.data.departamentos) {
            this.geojsonLayers.departamentos = L.geoJSON(Config.data.departamentos, {
                style: (feature) => this.getPolygonStyle(feature, 'departamentos'),
                onEachFeature: (feature, layer) => this.bindPopup(feature, layer, 'departamentos')
            }).addTo(this.map);
        }

        // Load puntos (circle markers with distinct colors)
        if (Config.data.puntos) {
            this.geojsonLayers.puntos = L.geoJSON(Config.data.puntos, {
                pointToLayer: (feature, latlng) => {
                    const props = feature.properties;
                    const nivel = props.nivel || 'normal';
                    const color = Config.getColor(nivel);

                    return L.circleMarker(latlng, {
                        radius: 6,
                        fillColor: color,
                        color: color,
                        weight: 0,
                        opacity: 0,
                        fillOpacity: 0.85
                    });
                },
                onEachFeature: (feature, layer) => this.bindPointPopup(feature, layer)
            }).addTo(this.map);
        }
    },

    /**
     * Get style for polygon features
     */
    getPolygonStyle(feature, layerId) {
        const props = feature.properties;
        const nivel = props.nivel || 'sin_datos';

        // For departamentos, color by nivel
        let fillColor = '#3388ff'; // default blue
        let fillOpacity = 0.3;

        if (layerId === 'departamentos') {
            if (nivel === 'alto') {
                fillColor = Config.getColor('alto');
                fillOpacity = 0.6;
            } else if (nivel === 'sobre_promedio') {
                fillColor = Config.getColor('sobre_promedio');
                fillOpacity = 0.5;
            } else if (nivel === 'normal') {
                fillColor = Config.getColor('normal');
                fillOpacity = 0.4;
            } else {
                fillColor = '#555555';
                fillOpacity = 0.2;
            }
        } else if (layerId === 'provincias') {
            fillColor = '#666666';
            fillOpacity = 0.1;
        }

        return {
            fillColor: fillColor,
            weight: layerId === 'provincias' ? 2 : 1,
            opacity: 0.8,
            color: layerId === 'provincias' ? '#888888' : '#444444',
            fillOpacity: fillOpacity
        };
    },

    /**
     * Get style for a feature (legacy - kept for compatibility)
     */
    getStyle(feature, layerId) {
        return this.getPolygonStyle(feature, layerId);
    },

    /**
     * Bind popup to feature
     */
    bindPopup(feature, layer, layerId) {
        const props = feature.properties;

        // Highlight on hover
        layer.on('mouseover', () => {
            layer.setStyle({
                weight: 3,
                color: '#ffffff',
                fillOpacity: 0.9
            });
            layer.bringToFront();
        });

        layer.on('mouseout', () => {
            this.geojsonLayers[layerId].resetStyle(layer);
        });

        // Create popup content
        const popupContent = this.createPopupContent(props, layerId);
        layer.bindPopup(popupContent);
    },

    /**
     * Create popup HTML content
     */
    createPopupContent(props, layerId) {
        const formatNumber = (num) => {
            if (num === undefined || num === null) return '-';
            return new Intl.NumberFormat('es-AR').format(Math.round(num));
        };

        let html = `<div class="popup-title">${props.nombre || 'Sin nombre'}</div>`;

        if (layerId === 'departamentos' && props.provincia) {
            html += `<div class="popup-row">
                <span class="popup-label">Provincia:</span>
                <span class="popup-value">${props.provincia}</span>
            </div>`;
        }

        html += `
            <div class="popup-row">
                <span class="popup-label">Total hectáreas:</span>
                <span class="popup-value">${formatNumber(props.total_ha)}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">Ha. extranjerizadas:</span>
                <span class="popup-value">${formatNumber(props.extranjerizada_ha)}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">% Extranjerización:</span>
                <span class="popup-value" style="color: ${Config.getColor(props.nivel)}">${props.porcentaje}%</span>
            </div>
        `;

        return html;
    },

    /**
     * Bind popup to point features
     */
    bindPointPopup(feature, layer) {
        const props = feature.properties;

        // Highlight on hover
        layer.on('mouseover', () => {
            layer.setStyle({
                radius: 11,
                fillOpacity: 1
            });
            layer.bringToFront();
        });

        layer.on('mouseout', () => {
            layer.setStyle({
                radius: 8,
                fillOpacity: 0.85
            });
        });

        // Create popup content
        const popupContent = this.createPopupContent(props, 'puntos');
        layer.bindPopup(popupContent);
    },

    /**
     * Apply global filter state to map layers
     */
    applyFilter(filterState, filteredData) {
        // Create a Set of unique keys (nombre + provincia) for faster lookup
        const filteredKeys = new Set(
            filteredData.map(d => `${d.nombre}|${d.provincia || ''}`)
        );

        // Filter departamentos polygons
        if (this.geojsonLayers.departamentos) {
            this.geojsonLayers.departamentos.eachLayer(layer => {
                const props = layer.feature.properties;
                const key = `${props.nombre}|${props.provincia || ''}`;
                const visible = filteredKeys.has(key);

                if (visible) {
                    layer.setStyle({ fillOpacity: 0.6 });
                } else {
                    layer.setStyle({ fillOpacity: 0.05 });
                }
            });
        }

        // Filter puntos (circle markers) - check provincia directly
        if (this.geojsonLayers.puntos) {
            this.geojsonLayers.puntos.eachLayer(layer => {
                const props = layer.feature.properties;
                const key = `${props.nombre}|${props.provincia || ''}`;
                const visible = filteredKeys.has(key);

                if (visible) {
                    layer.setStyle({ fillOpacity: 0.9, opacity: 1, radius: 8 });
                } else {
                    layer.setStyle({ fillOpacity: 0.1, opacity: 0.2, radius: 4 });
                }
            });
        }

        // If single departamento selected, zoom to it
        if (filterState.departamento) {
            this.zoomToFeature(filterState.departamento);
        }
    },

    /**
     * Filter by porcentaje only (legacy support)
     */
    filterByPorcentaje(min, max) {
        const filteredNames = new Set();
        const allData = Config.data.stats?.departamentos || [];

        allData.forEach(d => {
            const p = d.porcentaje || 0;
            if (p >= min && p <= max) {
                filteredNames.add(d.nombre);
            }
        });

        this.applyFilter({ porcentajeMin: min, porcentajeMax: max }, filteredNames);
        return filteredNames.size;
    },

    /**
     * Zoom to a specific feature
     */
    zoomToFeature(nombre, layerId = 'puntos') {
        // Try puntos first (has all the data)
        if (this.geojsonLayers.puntos) {
            let found = false;
            this.geojsonLayers.puntos.eachLayer(l => {
                if (l.feature.properties.nombre === nombre) {
                    this.map.setView(l.getLatLng(), 10);
                    l.openPopup();
                    found = true;
                }
            });
            if (found) return;
        }

        // Fallback to departamentos
        const layer = this.geojsonLayers[layerId];
        if (!layer) return;

        layer.eachLayer(l => {
            if (l.feature.properties.nombre === nombre) {
                if (l.getBounds) {
                    this.map.fitBounds(l.getBounds(), { padding: [50, 50] });
                } else if (l.getLatLng) {
                    this.map.setView(l.getLatLng(), 10);
                }
                l.openPopup();
            }
        });
    },

    /**
     * Reset map view
     */
    resetView() {
        this.map.setView(this.initialView.center, this.initialView.zoom);
    },

    /**
     * Setup custom map controls
     */
    setupControls() {
        // Home button control
        const HomeControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: () => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                const button = L.DomUtil.create('a', 'map-control-btn', container);
                button.innerHTML = '🏠';
                button.title = 'Vista inicial';
                button.href = '#';
                button.onclick = (e) => {
                    e.preventDefault();
                    this.resetView();
                };
                return container;
            }
        });
        this.map.addControl(new HomeControl());

        // Fullscreen to data extent
        const ExtentControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: () => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                const button = L.DomUtil.create('a', 'map-control-btn', container);
                button.innerHTML = '📍';
                button.title = 'Ajustar a datos';
                button.href = '#';
                button.onclick = (e) => {
                    e.preventDefault();
                    if (this.geojsonLayers.puntos) {
                        this.map.fitBounds(this.geojsonLayers.puntos.getBounds(), { padding: [20, 20] });
                    }
                };
                return container;
            }
        });
        this.map.addControl(new ExtentControl());
    },

    /**
     * Load propietarios as special markers
     */
    loadPropietarios() {
        const propietarios = Config.data.propietarios || [];
        if (!propietarios.length) return;

        const markers = [];
        propietarios.forEach(p => {
            if (!p.lat || !p.lng) return;

            const marker = L.circleMarker([p.lat, p.lng], {
                radius: 12,
                fillColor: '#9b59b6',  // Purple for propietarios
                color: '#9b59b6',
                weight: 0,
                fillOpacity: 0.9
            });

            const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.lat},${p.lng}`;
            const mapsUrl = `https://www.google.com/maps?q=${p.lat},${p.lng}`;

            marker.bindPopup(`
                <div class="popup-title" style="color: #9b59b6">🏛️ ${p.nombre}</div>
                <div class="popup-row">
                    <span class="popup-label">Nacionalidad:</span>
                    <span class="popup-value">${p.nacionalidad}</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">Hectáreas:</span>
                    <span class="popup-value">${new Intl.NumberFormat('es-AR').format(p.hectareas)}</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">Ubicación:</span>
                    <span class="popup-value">${p.departamento}, ${p.provincia}</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">Tipo:</span>
                    <span class="popup-value">${p.tipo}</span>
                </div>
                ${p.offshore ? '<div class="popup-tag offshore">🏝️ Offshore</div>' : ''}
                ${p.notas ? `<div class="popup-notes">${p.notas}</div>` : ''}
                <div class="popup-actions">
                    <a href="${mapsUrl}" target="_blank" class="popup-action">📍 Google Maps</a>
                    <a href="${streetViewUrl}" target="_blank" class="popup-action">🛣️ Street View</a>
                </div>
            `);

            marker.on('mouseover', () => marker.setStyle({ radius: 16, fillOpacity: 1 }));
            marker.on('mouseout', () => marker.setStyle({ radius: 12, fillOpacity: 0.9 }));

            markers.push(marker);
        });

        if (markers.length) {
            this.geojsonLayers.propietarios = L.layerGroup(markers).addTo(this.map);
            console.log('✓ Propietarios loaded:', markers.length);
        }
    }
};

window.MapModule = MapModule;
