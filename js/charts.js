/**
 * Charts Module
 * Dynamically creates charts based on YAML configuration
 */

const ChartsModule = {
    charts: {},

    /**
     * Initialize charts from config
     */
    init() {
        const container = document.getElementById('charts-container');
        const chartsConfig = Config.charts?.charts || [];

        chartsConfig.forEach((chartConfig, index) => {
            this.createChart(chartConfig, container, index);
        });

        console.log('✓ Charts initialized:', chartsConfig.length);
    },

    /**
     * Create a single chart
     */
    createChart(config, container, index) {
        // Create card
        const card = document.createElement('div');
        card.className = 'chart-card';
        card.style.animationDelay = `${index * 0.1}s`;

        card.innerHTML = `
            <div class="chart-card-header">
                <h3 class="chart-card-title">${config.title}</h3>
                ${config.description ? `<p class="chart-card-description">${config.description}</p>` : ''}
            </div>
            <div class="chart-container">
                <canvas id="chart-${config.id}"></canvas>
            </div>
        `;

        container.appendChild(card);

        // Get data
        const { labels, data, colors } = this.prepareChartData(config);

        // Create chart
        const ctx = document.getElementById(`chart-${config.id}`).getContext('2d');

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: config.type === 'doughnut' || config.type === 'pie',
                    position: config.options?.plugins?.legend?.position || 'bottom',
                    labels: {
                        color: '#eaeaea',
                        font: { family: "'Inter', sans-serif" }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 33, 62, 0.95)',
                    titleColor: '#eaeaea',
                    bodyColor: '#eaeaea',
                    borderColor: '#2a2a4a',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: (context) => {
                            const value = context.parsed.y !== undefined
                                ? context.parsed.y
                                : (context.parsed.x !== undefined ? context.parsed.x : context.parsed);

                            if (config.y_field === 'porcentaje' || config.value_field === 'porcentaje') {
                                return `${context.label}: ${value}%`;
                            }
                            if (config.y_field?.includes('_ha') || config.value_field?.includes('_ha')) {
                                return `${context.label}: ${new Intl.NumberFormat('es-AR').format(Math.round(value))} ha`;
                            }
                            return `${context.label}: ${new Intl.NumberFormat('es-AR').format(value)}`;
                        }
                    }
                }
            },
            scales: config.type === 'bar' ? {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a0a0a0', font: { size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#a0a0a0',
                        callback: (value) => {
                            if (config.y_field === 'porcentaje') return `${value}%`;
                            return value;
                        }
                    }
                }
            } : undefined
        };

        // Merge with config options
        if (config.options) {
            Object.assign(chartOptions, config.options);
            if (config.options.indexAxis === 'y' && chartOptions.scales) {
                // Swap scales for horizontal bar
                const temp = chartOptions.scales.x;
                chartOptions.scales.x = chartOptions.scales.y;
                chartOptions.scales.y = temp;
            }
        }

        this.charts[config.id] = new Chart(ctx, {
            type: config.type === 'horizontalBar' ? 'bar' : config.type,
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: config.type === 'doughnut' ? 'rgba(26, 26, 46, 0.5)' : colors,
                    borderWidth: config.type === 'doughnut' ? 2 : 0
                }]
            },
            options: chartOptions
        });
    },

    /**
     * Prepare data for chart based on config
     */
    prepareChartData(config) {
        let sourceData = [];
        let labels = [];
        let data = [];
        let colors = [];

        // Get source data
        if (config.data_source === 'departamentos') {
            sourceData = Config.data.stats?.departamentos || [];
        } else if (config.data_source === 'provincias') {
            sourceData = Config.data.stats?.provincias || [];
        } else if (config.data_source === 'propietarios') {
            sourceData = Config.data.propietarios || [];
        } else if (config.data_source === 'summary' && config.custom_data) {
            // Special case for summary charts
            const summary = Config.data.stats?.summary || {};
            labels = config.custom_data.labels;
            data = config.custom_data.fields.map(f => summary[f] || 0);
            colors = [
                Config.getColor('alto'),
                Config.getColor('sobre_promedio'),
                Config.getColor('normal')
            ];
            return { labels, data, colors };
        }

        // Sort if needed
        if (config.sort_by) {
            sourceData = [...sourceData].sort((a, b) => {
                const valA = a[config.sort_by] || 0;
                const valB = b[config.sort_by] || 0;
                return config.sort_order === 'desc' ? valB - valA : valA - valB;
            });
        }

        // Limit if needed
        if (config.limit) {
            sourceData = sourceData.slice(0, config.limit);
        }

        // Extract labels and values
        const labelField = config.x_field || config.label_field || 'nombre';
        const valueField = config.y_field || config.value_field || 'porcentaje';
        const colorField = config.color_field;

        sourceData.forEach(item => {
            labels.push(item[labelField] || '');
            data.push(item[valueField] || 0);

            if (colorField && item[colorField]) {
                colors.push(Config.getColor(item[colorField]));
            } else {
                colors.push(Config.getColor(item.nivel));
            }
        });

        return { labels, data, colors };
    },

    /**
     * Apply global filter - rebuild charts with filtered data
     */
    applyFilter(filteredData) {
        // Store filtered data temporarily
        this.filteredData = filteredData;

        // Aggregate data by province from filtered departamentos
        const provinciaStats = {};
        filteredData.forEach(d => {
            if (!d.provincia) return;
            if (!provinciaStats[d.provincia]) {
                provinciaStats[d.provincia] = {
                    nombre: d.provincia,
                    extranjerizada_ha: 0,
                    total_ha: 0,
                    count: 0
                };
            }
            provinciaStats[d.provincia].extranjerizada_ha += d.extranjerizada_ha || 0;
            provinciaStats[d.provincia].total_ha += d.total_ha || 0;
            provinciaStats[d.provincia].count++;
        });

        // Calculate porcentaje per province
        Object.values(provinciaStats).forEach(p => {
            p.porcentaje = p.total_ha > 0 ? (p.extranjerizada_ha / p.total_ha * 100) : 0;
            p.nivel = Config.getNivel(p.porcentaje);
        });

        const filteredProvinciaData = Object.values(provinciaStats);

        // Update each chart
        const chartsConfig = Config.charts?.charts || [];

        chartsConfig.forEach(config => {
            const chart = this.charts[config.id];
            if (!chart) return;

            // Handle summary charts - update with filtered counts
            if (config.data_source === 'summary') {
                if (config.custom_data) {
                    const summary = {
                        alto_nivel: filteredData.filter(d => d.nivel === 'alto').length,
                        sobre_promedio: filteredData.filter(d => d.nivel === 'sobre_promedio').length,
                        normal: filteredData.filter(d => d.nivel === 'normal' || !d.nivel).length
                    };
                    const data = config.custom_data.fields.map(f => summary[f] || 0);
                    chart.data.datasets[0].data = data;
                    chart.update('none');
                }
                return;
            }

            // Skip propietarios (they don't filter by departamentos)
            if (config.data_source === 'propietarios') return;

            let chartData;

            if (config.data_source === 'departamentos') {
                chartData = this.prepareFilteredChartData(config, filteredData);
            } else if (config.data_source === 'provincias') {
                chartData = this.prepareFilteredChartData(config, filteredProvinciaData);
            }

            if (chartData) {
                chart.data.labels = chartData.labels;
                chart.data.datasets[0].data = chartData.data;
                chart.data.datasets[0].backgroundColor = chartData.colors;
                chart.update('none');
            }
        });
    },

    /**
     * Prepare chart data from filtered source
     */
    prepareFilteredChartData(config, filteredData) {
        let sourceData = [...filteredData];
        let labels = [];
        let data = [];
        let colors = [];

        // Sort if needed
        if (config.sort_by) {
            sourceData.sort((a, b) => {
                const valA = a[config.sort_by] || 0;
                const valB = b[config.sort_by] || 0;
                return config.sort_order === 'desc' ? valB - valA : valA - valB;
            });
        }

        // Limit if needed
        if (config.limit) {
            sourceData = sourceData.slice(0, config.limit);
        }

        // Extract labels and values
        const labelField = config.x_field || config.label_field || 'nombre';
        const valueField = config.y_field || config.value_field || 'porcentaje';
        const colorField = config.color_field;

        sourceData.forEach(item => {
            labels.push(item[labelField] || '');
            data.push(item[valueField] || 0);

            if (colorField && item[colorField]) {
                colors.push(Config.getColor(item[colorField]));
            } else {
                colors.push(Config.getColor(item.nivel));
            }
        });

        return { labels, data, colors };
    }
};

window.ChartsModule = ChartsModule;
