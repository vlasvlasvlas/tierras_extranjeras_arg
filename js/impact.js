/**
 * Impact Panel Module
 * Dynamic comparison panel that updates with filtered data
 * Uses country/region surface data to find the best comparison
 */

const ImpactModule = {
    // Reference data - will be loaded from JSON
    paises: [],

    elements: {
        panel: null,
        hectares: null,
        comparison: null,
        subtext: null,
        // Hero elements
        hero: null,
        heroHectares: null,
        heroContext: null,
        heroComparisons: null,
        heroLegal: null
    },

    async init() {
        this.elements.panel = document.getElementById('impact-panel');
        this.elements.hectares = document.getElementById('impact-hectares');
        this.elements.comparison = document.getElementById('impact-comparison');
        this.elements.subtext = document.getElementById('impact-subtext');

        // Hero elements
        this.elements.hero = document.getElementById('impact-hero');
        this.elements.heroHectares = document.getElementById('hero-hectares');
        this.elements.heroContext = document.getElementById('hero-context');
        this.elements.heroComparisons = document.getElementById('hero-comparisons');
        this.elements.heroLegal = document.getElementById('hero-legal');

        if (!this.elements.panel) return;

        // Load reference data
        await this.loadReferenceData();

        console.log('✓ Impact panel initialized with', this.paises.length, 'country references');
    },

    /**
     * Load country reference data
     */
    async loadReferenceData() {
        try {
            const response = await fetch('data/web/paises_referencia.json');
            this.paises = await response.json();

            // Convert km2 to hectares (1 km2 = 100 ha)
            this.paises = this.paises.map(p => ({
                ...p,
                hectareas: p.km2 * 100
            })).sort((a, b) => b.hectareas - a.hectareas);

        } catch (error) {
            console.warn('Could not load country references:', error);
            // Fallback to hardcoded comparisons
            this.paises = [
                { nombre: 'Inglaterra', hectareas: 13000000, emoji: '🇬🇧' },
                { nombre: 'Bélgica', hectareas: 3050000, emoji: '🇧🇪' },
                { nombre: 'Israel', hectareas: 2200000, emoji: '🇮🇱' }
            ];
        }
    },

    /**
     * Update the impact panel with new hectares value
     * @param {number} hectares - Total hectares from filtered data
     * @param {string} context - Optional context (e.g., "en Salta")
     */
    update(hectares, context = 'en manos extranjeras') {
        if (!this.elements.panel) return;

        // Format hectares
        const formattedHa = this.formatHectares(hectares);
        this.elements.hectares.textContent = formattedHa;

        // Find best comparison
        const comparison = this.findBestComparison(hectares);
        const emojiEl = this.elements.comparison.querySelector('.comparison-emoji');
        const textEl = this.elements.comparison.querySelector('.comparison-text');

        if (emojiEl && textEl) {
            emojiEl.textContent = comparison.emoji;
            textEl.textContent = comparison.text;
        }

        // Update context
        this.elements.subtext.textContent = context;

        // Add pulse animation
        this.elements.panel.style.animation = 'none';
        this.elements.panel.offsetHeight; // Trigger reflow
        this.elements.panel.style.animation = 'impactPulse 2s ease-in-out infinite';
    },

    /**
     * Format hectares for display
     */
    formatHectares(hectares) {
        if (hectares >= 1000000) {
            const millions = hectares / 1000000;
            return millions >= 10
                ? `${Math.round(millions)}M ha`
                : `${millions.toFixed(1)}M ha`;
        } else if (hectares >= 1000) {
            const thousands = hectares / 1000;
            return thousands >= 100
                ? `${Math.round(thousands)}K ha`
                : `${thousands.toFixed(0)}K ha`;
        }
        return `${Math.round(hectares).toLocaleString('es-AR')} ha`;
    },

    /**
     * Find the best comparison for the given hectares
     * Uses intelligent matching: exact match, multiplier, or fraction
     */
    findBestComparison(hectares) {
        if (hectares <= 0 || this.paises.length === 0) {
            return { emoji: '📍', text: 'sin datos' };
        }

        // First, try to find a country that's close in size (within 20%)
        const closeMatch = this.paises.find(p => {
            const ratio = hectares / p.hectareas;
            return ratio >= 0.8 && ratio <= 1.2;
        });

        if (closeMatch) {
            return {
                emoji: closeMatch.emoji,
                text: `≈ ${closeMatch.nombre}`
            };
        }

        // Find the largest country smaller than our hectares
        const smallerCountries = this.paises.filter(p => p.hectareas <= hectares);

        if (smallerCountries.length > 0) {
            const bestMatch = smallerCountries[0]; // Largest of the smaller ones
            const multiplier = Math.round(hectares / bestMatch.hectareas);

            if (multiplier >= 2) {
                return {
                    emoji: bestMatch.emoji,
                    text: `= ${multiplier}x ${bestMatch.nombre}`
                };
            } else {
                return {
                    emoji: bestMatch.emoji,
                    text: `> ${bestMatch.nombre}`
                };
            }
        }

        // If we're smaller than all countries, find what we're a fraction of
        const largerCountries = this.paises.filter(p => p.hectareas > hectares);

        if (largerCountries.length > 0) {
            // Find a country where we're a nice fraction
            for (const country of largerCountries.reverse()) {
                const fraction = hectares / country.hectareas;

                // Check for nice fractions: 1/2, 1/3, 1/4, etc.
                if (fraction >= 0.45 && fraction <= 0.55) {
                    return { emoji: country.emoji, text: `= ½ de ${country.nombre}` };
                }
                if (fraction >= 0.30 && fraction <= 0.36) {
                    return { emoji: country.emoji, text: `= ⅓ de ${country.nombre}` };
                }
                if (fraction >= 0.23 && fraction <= 0.27) {
                    return { emoji: country.emoji, text: `= ¼ de ${country.nombre}` };
                }
                if (fraction >= 0.18 && fraction <= 0.22) {
                    return { emoji: country.emoji, text: `= ⅕ de ${country.nombre}` };
                }
                if (fraction >= 0.09 && fraction <= 0.11) {
                    return { emoji: country.emoji, text: `= 10% de ${country.nombre}` };
                }
            }

            // Fallback: just use multiples of smallest usable reference
            const canchaRef = this.paises.find(p => p.nombre === 'Cancha de fútbol');
            if (canchaRef) {
                const canchas = Math.round(hectares / canchaRef.hectareas);
                if (canchas >= 1) {
                    return {
                        emoji: '⚽',
                        text: `= ${canchas.toLocaleString('es-AR')} canchas`
                    };
                }
            }
        }

        // Ultimate fallback
        return { emoji: '📍', text: `${this.formatHectares(hectares)}` };
    },

    /**
     * Update from filtered data array
     */
    updateFromData(filteredData, allData) {
        const totalFiltered = filteredData.reduce((sum, d) => sum + (d.extranjerizada_ha || 0), 0);

        let context = 'en manos extranjeras';

        // Add context based on filter state
        if (filteredData.length === 1) {
            context = `en ${filteredData[0].nombre}`;
        } else if (filteredData.length < allData.length && filteredData.length > 0) {
            // Check if all from same province
            const provincias = new Set(filteredData.map(d => d.provincia));
            if (provincias.size === 1) {
                context = `en ${[...provincias][0]}`;
            } else {
                context = `en ${filteredData.length} departamentos`;
            }
        }

        this.update(totalFiltered, context);
        
        // Also update hero card
        this.updateHero(filteredData, allData);
    },

    /**
     * Update Hero Impact Card (large card above map)
     */
    updateHero(filteredData, allData) {
        if (!this.elements.hero) return;

        const totalHectares = filteredData.reduce((sum, d) => sum + (d.extranjerizada_ha || 0), 0);
        const isFiltered = filteredData.length < allData.length;

        // Format main value
        const formattedValue = this.formatHectaresLong(totalHectares);
        this.elements.heroHectares.textContent = formattedValue;

        // Update context
        let context = 'en manos de capitales extranjeros';
        if (isFiltered) {
            if (filteredData.length === 1) {
                context = `en ${filteredData[0].nombre}`;
            } else {
                const provincias = new Set(filteredData.map(d => d.provincia));
                if (provincias.size === 1) {
                    context = `en ${[...provincias][0]}`;
                } else {
                    context = `en ${filteredData.length} departamentos seleccionados`;
                }
            }
        }
        this.elements.heroContext.textContent = context;

        // Update comparisons
        if (!isFiltered) {
            // NO FILTERS: Show fixed comparisons (default view)
            this.renderHeroComparisonsFixed();
        } else {
            // WITH FILTERS: Use dynamic comparisons
            const comparisons = this.findTopComparisons(totalHectares, 4);
            this.renderHeroComparisons(comparisons);
        }

        // Update legal text
        const overLimit = filteredData.filter(d => d.porcentaje > 15).length;
        if (overLimit > 0) {
            this.elements.heroLegal.textContent = 
                `${overLimit} departamento${overLimit !== 1 ? 's' : ''} super${overLimit !== 1 ? 'an' : 'a'} el límite legal del 15% establecido por la Ley de Tierras`;
        } else {
            this.elements.heroLegal.textContent = 
                'Ningún departamento supera el límite legal del 15%';
        }
    },

    /**
     * Format hectares for long display (hero card)
     */
    formatHectaresLong(hectares) {
        if (hectares >= 1000000) {
            const millions = hectares / 1000000;
            return `${millions.toFixed(1)} millones de hectáreas`;
        } else if (hectares >= 1000) {
            const thousands = hectares / 1000;
            return `${Math.round(thousands).toLocaleString('es-AR')} mil hectáreas`;
        }
        return `${Math.round(hectares).toLocaleString('es-AR')} hectáreas`;
    },

    /**
     * Find top N best comparisons for given hectares
     */
    findTopComparisons(hectares, count = 4) {
        if (this.paises.length === 0) return [];

        const comparisons = [];

        // Find exact or close matches
        for (const pais of this.paises) {
            const ratio = hectares / pais.hectareas;
            const diff = Math.abs(ratio - 1);
            
            // Exact match (within 20%)
            if (ratio >= 0.8 && ratio <= 1.2) {
                comparisons.push({
                    emoji: pais.emoji,
                    title: `≈ ${pais.nombre}`,
                    subtitle: `${this.formatHectaresLong(pais.hectareas)}`,
                    score: 1000 - diff
                });
            }
            // Multiplier
            else if (ratio >= 2) {
                const mult = Math.round(ratio);
                if (mult <= 20) {
                    comparisons.push({
                        emoji: pais.emoji,
                        title: `= ${mult}x ${pais.nombre}`,
                        subtitle: `${this.formatHectaresLong(pais.hectareas)} c/u`,
                        score: 500 / diff
                    });
                }
            }
            // Fraction
            else if (ratio < 0.8 && ratio > 0) {
                const fraction = pais.hectareas / hectares;
                if (fraction >= 2 && fraction <= 10) {
                    const frac = Math.round(fraction);
                    comparisons.push({
                        emoji: pais.emoji,
                        title: `= 1/${frac} de ${pais.nombre}`,
                        subtitle: `${this.formatHectaresLong(pais.hectareas)}`,
                        score: 300 / Math.abs(fraction - Math.round(fraction))
                    });
                }
            }
        }

        // Sort by score and return top N
        return comparisons
            .sort((a, b) => b.score - a.score)
            .slice(0, count);
    },

    /**
     * Render FIXED comparisons (when no filters applied)
     */
    renderHeroComparisonsFixed() {
        if (!this.elements.heroComparisons) return;

        this.elements.heroComparisons.innerHTML = `
            <div class="comparison-card">
                <span class="comparison-flag">🇬🇧</span>
                <div class="comparison-content">
                    <div class="comparison-title">= Toda Inglaterra</div>
                    <div class="comparison-subtitle">13 millones de hectáreas</div>
                </div>
            </div>
            <div class="comparison-card">
                <span class="comparison-flag">🇧🇪</span>
                <div class="comparison-content">
                    <div class="comparison-title">= 4x Bélgica</div>
                    <div class="comparison-subtitle">3 millones de hectáreas c/u</div>
                </div>
            </div>
            <div class="comparison-card">
                <span class="comparison-flag">🇮🇱</span>
                <div class="comparison-content">
                    <div class="comparison-title">= 6x Israel</div>
                    <div class="comparison-subtitle">2.2 millones de hectáreas c/u</div>
                </div>
            </div>
            <div class="comparison-card">
                <span class="comparison-flag">🏟️</span>
                <div class="comparison-content">
                    <div class="comparison-title">= 18 millones de canchas de fútbol</div>
                    <div class="comparison-subtitle">0.7 hectáreas por cancha</div>
                </div>
            </div>
        `;
    },

    /**
     * Render DYNAMIC comparisons (when filters applied)
     */
    renderHeroComparisons(comparisons) {
        if (!this.elements.heroComparisons) return;

        if (comparisons.length === 0) {
            this.elements.heroComparisons.innerHTML = `
                <div class="comparison-card">
                    <span class="comparison-flag">📍</span>
                    <div class="comparison-content">
                        <div class="comparison-title">Territorio significativo</div>
                        <div class="comparison-subtitle">Sin comparaciones exactas</div>
                    </div>
                </div>
            `;
            return;
        }

        this.elements.heroComparisons.innerHTML = comparisons.map(c => `
            <div class="comparison-card">
                <span class="comparison-flag">${c.emoji}</span>
                <div class="comparison-content">
                    <div class="comparison-title">${c.title}</div>
                    <div class="comparison-subtitle">${c.subtitle}</div>
                </div>
            </div>
        `).join('');
    }
};

window.ImpactModule = ImpactModule;
