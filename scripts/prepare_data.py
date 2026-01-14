#!/usr/bin/env python3
"""
Prepare GeoJSON data for web visualization.
- Extracts polygon geometries from IGN GeoPackages
- Joins with data from Tierras.gpkg (points with extranjerización data)
- Exports optimized GeoJSONs for the web viewer
"""

import json
import re
import sqlite3
import unicodedata
from pathlib import Path

# Paths
DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT_DIR = DATA_DIR / "web"
TIERRAS_GPKG = DATA_DIR / "Tierras.gpkg"
IGN_DEPTOS = DATA_DIR / "ign_departamentos.gpkg"
IGN_PROVS = DATA_DIR / "ign_provincias.gpkg"

# Ensure output directory exists
OUTPUT_DIR.mkdir(exist_ok=True)

# Simplification tolerance (in degrees, ~0.005 ≈ 500m)
SIMPLIFY_TOLERANCE = 0.005


def normalize_name(name: str) -> str:
    """Normalize name for matching (remove accents, lowercase, etc)."""
    if not name:
        return ""
    # Remove accents
    name = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('ASCII')
    # Lowercase and strip
    name = name.lower().strip()
    # Remove common prefixes
    prefixes = ['provincia de ', 'partido de ', 'departamento de ', 'departamento ']
    for prefix in prefixes:
        if name.startswith(prefix):
            name = name[len(prefix):]
    return name


def parse_html_description(description: str) -> dict:
    """Parse HTML description field to extract structured data."""
    if not description:
        return {}
    
    data = {}
    parts = re.split(r'<br\s*/?>', description, flags=re.IGNORECASE)
    
    for part in parts:
        part = part.strip()
        if ':' in part:
            key, value = part.split(':', 1)
            key = key.strip().lower()
            value = value.strip()
            
            key_map = {
                'pais': 'pais',
                'provincia': 'provincia',
                'povincia': 'provincia',
                'total hectáreas': 'total_ha',
                'total hectareas': 'total_ha',
                'hectáreas extranjerizadas': 'extranjerizada_ha',
                'hectareas extranjerizadas': 'extranjerizada_ha',
                'porcentaje extranjerización': 'porcentaje',
                'porcentaje extranjerizacion': 'porcentaje',
            }
            
            normalized_key = key_map.get(key, key.replace(' ', '_'))
            
            if normalized_key in ('total_ha', 'extranjerizada_ha'):
                value = value.replace(',', '')
                try:
                    value = float(value)
                except ValueError:
                    pass
            elif normalized_key == 'porcentaje':
                try:
                    value = int(value)
                except ValueError:
                    try:
                        value = float(value)
                    except ValueError:
                        pass
            
            data[normalized_key] = value
    
    return data


def get_nivel(porcentaje) -> str:
    """Categorize by foreignization level."""
    if porcentaje is None:
        return "sin_datos"
    if porcentaje >= 10:
        return "alto"
    elif porcentaje >= 6:
        return "sobre_promedio"
    else:
        return "normal"


def gpkg_to_geojson_geometry(wkb_bytes, simplify_tolerance: float = SIMPLIFY_TOLERANCE):
    """Convert GeoPackage geometry to GeoJSON geometry with simplification."""
    try:
        import shapely.wkb
        import shapely.geometry
        
        if wkb_bytes[:2] == b'GP':
            flags = wkb_bytes[3]
            envelope_type = (flags & 0x0E) >> 1
            envelope_sizes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
            envelope_size = envelope_sizes.get(envelope_type, 0)
            wkb_start = 8 + envelope_size
            wkb_data = wkb_bytes[wkb_start:]
        else:
            wkb_data = wkb_bytes
        
        geom = shapely.wkb.loads(wkb_data)
        
        if simplify_tolerance > 0 and geom.geom_type in ('Polygon', 'MultiPolygon'):
            geom = geom.simplify(simplify_tolerance, preserve_topology=True)
        
        return shapely.geometry.mapping(geom)
    except Exception as e:
        print(f"⚠ Error parsing geometry: {e}")
        return None


def load_tierras_data(conn: sqlite3.Connection) -> dict:
    """Load all data from Tierras.gpkg and build lookup dictionaries."""
    cursor = conn.cursor()
    
    # Load provincias
    provincias_data = {}
    cursor.execute('SELECT Name, Description FROM "Provincias.xlsx"')
    for name, description in cursor.fetchall():
        if name == 'GP':
            # Name is in description
            data = parse_html_description(description)
            # Extract province name from the parsed data or use a pattern
            prov_name = None
            for key in data:
                if 'provincia' in key.lower() or key == 'nombre':
                    prov_name = data[key]
                    break
            if not prov_name:
                # Try to find it in the original description
                match = re.search(r'(?:Provincia de |^)([^<\n]+)', description)
                if match:
                    prov_name = match.group(1).strip()
        else:
            prov_name = name
            data = parse_html_description(description)
        
        if prov_name:
            normalized = normalize_name(prov_name)
            data['nombre_original'] = prov_name
            data['nivel'] = get_nivel(data.get('porcentaje'))
            provincias_data[normalized] = data
    
    # Load departamentos from all 3 layers
    departamentos_data = {}
    layers = [
        "Departamentos con alto nivel de extranjerización de tierras",
        "Departamentos por encima del promedio nacional",
        "Departamentos dentro del promedio nacional"
    ]
    
    for layer in layers:
        cursor.execute(f'SELECT Name, Description FROM "{layer}"')
        for name, description in cursor.fetchall():
            data = parse_html_description(description)
            data['nombre_original'] = name
            data['nivel'] = get_nivel(data.get('porcentaje'))
            
            # Create lookup key from name (normalize)
            normalized = normalize_name(name)
            departamentos_data[normalized] = data
    
    return {
        'provincias': provincias_data,
        'departamentos': departamentos_data
    }


def process_ign_provincias(conn: sqlite3.Connection, tierras_data: dict) -> dict:
    """Process IGN provincias polygons and join with Tierras data."""
    print("Processing IGN provincias polygons...")
    cursor = conn.cursor()
    
    cursor.execute('SELECT fid, geom, fna, nam FROM ignprovincia')
    rows = cursor.fetchall()
    
    features = []
    matched = 0
    
    for fid, geom_bytes, fna, nam in rows:
        geometry = gpkg_to_geojson_geometry(geom_bytes) if geom_bytes else None
        if not geometry:
            continue
        
        # Try to match with Tierras data
        normalized = normalize_name(nam or fna)
        tierras = tierras_data['provincias'].get(normalized, {})
        
        if tierras:
            matched += 1
        
        props = {
            'fid': fid,
            'nombre': nam or fna,
            'nombre_completo': fna,
            'total_ha': tierras.get('total_ha'),
            'extranjerizada_ha': tierras.get('extranjerizada_ha'),
            'porcentaje': tierras.get('porcentaje'),
            'nivel': tierras.get('nivel', 'sin_datos')
        }
        
        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": geometry
        })
    
    print(f"  Found {len(features)} provincias, matched {matched} with Tierras data")
    
    return {
        "type": "FeatureCollection",
        "features": features
    }


def process_ign_departamentos(conn: sqlite3.Connection, tierras_data: dict) -> dict:
    """Process IGN departamentos polygons and join with Tierras data."""
    print("Processing IGN departamentos polygons...")
    cursor = conn.cursor()
    
    cursor.execute('SELECT fid, geom, fna, nam, in1 FROM igndepartamento')
    rows = cursor.fetchall()
    
    features = []
    matched = 0
    
    for fid, geom_bytes, fna, nam, in1 in rows:
        geometry = gpkg_to_geojson_geometry(geom_bytes) if geom_bytes else None
        if not geometry:
            continue
        
        # Try to match with Tierras data
        normalized = normalize_name(nam or fna)
        tierras = tierras_data['departamentos'].get(normalized, {})
        
        if tierras:
            matched += 1
        
        props = {
            'fid': fid,
            'nombre': nam or fna,
            'nombre_completo': fna,
            'codigo': in1,
            'provincia': tierras.get('provincia'),
            'total_ha': tierras.get('total_ha'),
            'extranjerizada_ha': tierras.get('extranjerizada_ha'),
            'porcentaje': tierras.get('porcentaje'),
            'nivel': tierras.get('nivel', 'sin_datos')
        }
        
        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": geometry
        })
    
    print(f"  Found {len(features)} departamentos, matched {matched} with Tierras data")
    
    return {
        "type": "FeatureCollection",
        "features": features
    }


def process_tierras_points(conn: sqlite3.Connection) -> dict:
    """Extract original point geometries from Tierras.gpkg for overlay."""
    print("Processing Tierras points...")
    cursor = conn.cursor()
    
    features = []
    
    # Load departamentos from all 3 layers
    layers = [
        ("Departamentos con alto nivel de extranjerización de tierras", "alto"),
        ("Departamentos por encima del promedio nacional", "sobre_promedio"),
        ("Departamentos dentro del promedio nacional", "normal")
    ]
    
    for layer, nivel_layer in layers:
        cursor.execute(f'SELECT fid, geom, Name, Description FROM "{layer}"')
        for fid, geom_bytes, name, description in cursor.fetchall():
            geometry = gpkg_to_geojson_geometry(geom_bytes, simplify_tolerance=0)
            if not geometry:
                continue
            
            data = parse_html_description(description)
            
            props = {
                'fid': fid,
                'nombre': name,
                'provincia': data.get('provincia'),
                'total_ha': data.get('total_ha'),
                'extranjerizada_ha': data.get('extranjerizada_ha'),
                'porcentaje': data.get('porcentaje'),
                'nivel': get_nivel(data.get('porcentaje'))
            }
            
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": geometry
            })
    
    print(f"  Found {len(features)} points")
    
    return {
        "type": "FeatureCollection",
        "features": features
    }


def generate_stats(provincias: dict, departamentos: dict, points: dict) -> dict:
    """Generate statistics JSON for table and charts."""
    stats = {
        "provincias": [],
        "departamentos": [],
        "summary": {}
    }
    
    # Province stats (only those with data)
    for f in provincias['features']:
        props = f['properties'].copy()
        del props['fid']  # Remove internal ID
        if props.get('porcentaje') is not None:
            stats['provincias'].append(props)
    
    # Department stats from points (have all the data)
    dept_list = []
    for f in points['features']:
        props = f['properties'].copy()
        del props['fid']
        dept_list.append(props)
    
    dept_list.sort(key=lambda x: x.get('porcentaje', 0) or 0, reverse=True)
    stats['departamentos'] = dept_list
    
    # Summary
    total_with_data = len([d for d in dept_list if d.get('porcentaje') is not None])
    alto = len([d for d in dept_list if d.get('nivel') == 'alto'])
    sobre = len([d for d in dept_list if d.get('nivel') == 'sobre_promedio'])
    normal = len([d for d in dept_list if d.get('nivel') == 'normal'])
    
    stats['summary'] = {
        "total_departamentos": total_with_data,
        "total_departamentos_ign": len(departamentos['features']),
        "alto_nivel": alto,
        "sobre_promedio": sobre,
        "normal": normal,
        "total_provincias": len(stats['provincias'])
    }
    
    return stats


def main():
    print("=" * 60)
    print("Tierras Extranjerizadas - Data Preparation v2")
    print("=" * 60)
    
    try:
        import shapely
        print("✓ Shapely available")
    except ImportError:
        print("⚠ Shapely not installed. Run: pip install shapely")
        return
    
    # Connect to databases
    tierras_conn = sqlite3.connect(TIERRAS_GPKG)
    ign_deptos_conn = sqlite3.connect(IGN_DEPTOS)
    ign_provs_conn = sqlite3.connect(IGN_PROVS)
    
    try:
        # Load Tierras data (points with extranjerización info)
        print("\nLoading Tierras data...")
        tierras_data = load_tierras_data(tierras_conn)
        print(f"  Provincias: {len(tierras_data['provincias'])}")
        print(f"  Departamentos: {len(tierras_data['departamentos'])}")
        
        # Process IGN polygons with Tierras data
        print("\nProcessing polygons from IGN...")
        provincias = process_ign_provincias(ign_provs_conn, tierras_data)
        departamentos = process_ign_departamentos(ign_deptos_conn, tierras_data)
        
        # Process original points from Tierras
        print("\nProcessing points from Tierras...")
        points = process_tierras_points(tierras_conn)
        
        # Generate stats
        stats = generate_stats(provincias, departamentos, points)
        
        # Write outputs
        print("\nWriting outputs...")
        
        with open(OUTPUT_DIR / "provincias.geojson", 'w', encoding='utf-8') as f:
            json.dump(provincias, f, ensure_ascii=False)
        print(f"  ✓ provincias.geojson ({len(provincias['features'])} features)")
        
        with open(OUTPUT_DIR / "departamentos.geojson", 'w', encoding='utf-8') as f:
            json.dump(departamentos, f, ensure_ascii=False)
        print(f"  ✓ departamentos.geojson ({len(departamentos['features'])} features)")
        
        with open(OUTPUT_DIR / "puntos.geojson", 'w', encoding='utf-8') as f:
            json.dump(points, f, ensure_ascii=False)
        print(f"  ✓ puntos.geojson ({len(points['features'])} features)")
        
        with open(OUTPUT_DIR / "stats.json", 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
        print(f"  ✓ stats.json")
        
        print("\n" + "=" * 60)
        print("Summary:")
        print(f"  Provincias (polígonos): {len(provincias['features'])}")
        print(f"  Departamentos (polígonos): {len(departamentos['features'])}")
        print(f"  Puntos con datos: {len(points['features'])}")
        print(f"    - Alto nivel (>10%): {stats['summary']['alto_nivel']}")
        print(f"    - Sobre promedio (6-10%): {stats['summary']['sobre_promedio']}")
        print(f"    - Normal (<6%): {stats['summary']['normal']}")
        print("=" * 60)
        
    finally:
        tierras_conn.close()
        ign_deptos_conn.close()
        ign_provs_conn.close()


if __name__ == "__main__":
    main()
