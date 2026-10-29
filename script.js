/* ======================================
   JAVASCRIPT - TP Nº2
   Historial de Recorrido con Geolocalización
   ====================================== */

/** @typedef {import('leaflet')} */

// ======================================
// VARIABLES GLOBALES
// ======================================

let map;                    // Instancia del mapa de Leaflet
let userMarker;            // Marcador del usuario en el mapa
let polyline;              // Línea roja del recorrido
let positionHistory = [];  // Array con todas las posiciones
let isTracking = false;    // Estado del tracking
let watchId = null;        // ID del watchPosition
let totalDistance = 0;     // Distancia acumulada en metros


// ======================================
// FUNCIÓN: Inicializar Mapa
// ======================================

/**
 * Inicializa el mapa de Leaflet con OpenStreetMap
 * Centro: Salta, Argentina [-24.7859, -65.4034]
 * Zoom: 15 (nivel ciudad)
 */
function initMap() {
    // Crear mapa centrado en Salta, Argentina
    map = L.map('map').setView([-24.7859, -65.4034], 15);

    // Cargar capa de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Crear polyline (línea) para el recorrido
    polyline = L.polyline([], {
        color: 'red',          // Color rojo
        weight: 3,             // Grosor 3px
        opacity: 0.8,          // Transparencia 80%
        dashArray: '5, 5',     // Punteada
        lineCap: 'round',      // Extremos redondeados
        lineJoin: 'round'      // Uniones redondeadas
    }).addTo(map);
}


// ======================================
// FUNCIÓN: Calcular Distancia (Haversine)
// ======================================

/**
 * Calcula la distancia entre dos puntos usando la fórmula de Haversine
 * Es la fórmula que usan GPS, Google Maps, etc.
 * 
 * @param {number} lat1 - Latitud del punto 1
 * @param {number} lon1 - Longitud del punto 1
 * @param {number} lat2 - Latitud del punto 2
 * @param {number} lon2 - Longitud del punto 2
 * @returns {number} Distancia en metros
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radio de la Tierra en metros

    // Convertir grados a radianes
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    // Aplicar fórmula de Haversine
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
}


// ======================================
// FUNCIÓN: Actualizar Interfaz (Historial)
// ======================================

/**
 * Actualiza la lista de posiciones en la interfaz
 * Muestra coordenadas, timestamps y precisión
 * Orden: más reciente primero (reverse)
 */
function updateHistoryUI() {
    const historyList = document.getElementById('historyList');

    if (positionHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-history">No hay posiciones registradas</div>';
        return;
    }

    // Crear HTML para cada posición
    historyList.innerHTML = positionHistory.map((pos, index) => `
        <div class="position-item">
            <strong>#${index + 1}</strong>
            <div class="position-coords">
                📍 ${pos.lat.toFixed(6)}, ${pos.lon.toFixed(6)}
            </div>
            <div class="position-accuracy">
                Precisión: ±${pos.accuracy.toFixed(0)}m
            </div>
            <div class="position-time">
                ${pos.time}
            </div>
        </div>
    `).reverse().join(''); // reverse() = más reciente arriba
}


// ======================================
// FUNCIÓN: Actualizar Contadores
// ======================================

/**
 * Actualiza los valores de:
 * - Cantidad de puntos registrados
 * - Distancia total (en metros o km)
 */
function updateCounters() {
    document.getElementById('pointCount').textContent = positionHistory.length;
    
    // Mostrar en metros o kilómetros según corresponda
    document.getElementById('totalDistance').textContent = 
        totalDistance < 1000 
            ? `${totalDistance.toFixed(0)} m`
            : `${(totalDistance / 1000).toFixed(2)} km`;
}


// ======================================
// FUNCIÓN: Procesar Nueva Posición
// ======================================

/**
 * Se llama cada vez que cambia la posición del usuario
 * Calcula distancia, actualiza mapa y registra en historial
 * 
 * @param {GeolocationPosition} position - Objeto con coordenadas
 */
function handlePositionUpdate(position) {
    const { latitude, longitude, accuracy } = position.coords;
    const timestamp = new Date();

    // Si no es el primer punto, calcular distancia
    if (positionHistory.length > 0) {
        const lastPos = positionHistory[positionHistory.length - 1];
        const distance = calculateDistance(
            lastPos.lat, lastPos.lon,
            latitude, longitude
        );
        
        // Solo registrar si movimiento es significativo (> 5 metros)
        // Evita ruido del GPS
        if (distance < 5) {
            return; // Ignorar pequeños cambios
        }

        totalDistance += distance; // Sumar a distancia total
    }

    // Agregar posición al historial
    positionHistory.push({
        lat: latitude,
        lon: longitude,
        accuracy: accuracy,
        time: timestamp.toLocaleTimeString('es-ES'),
        fullTime: timestamp
    });

    // Actualizar marcador del usuario
    const latLng = [latitude, longitude];

    if (userMarker) {
        // Mover marcador existente
        userMarker.setLatLng(latLng);
    } else {
        // Crear marcador nuevo (círculo azul)
        userMarker = L.circleMarker(latLng, {
            radius: 8,
            fillColor: '#667eea',
            color: '#fff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map)
        .bindPopup(`<b>Tu ubicación</b><br>Lat: ${latitude.toFixed(6)}<br>Lon: ${longitude.toFixed(6)}`);
    }

    // Actualizar polyline con todas las posiciones
    const latlngs = positionHistory.map(pos => [pos.lat, pos.lon]);
    polyline.setLatLngs(latlngs);

    // Centrar mapa en la posición actual
    map.setView(latLng, map.getZoom());

    // Actualizar interfaz
    updateHistoryUI();
    updateCounters();
}


// ======================================
// FUNCIÓN: Manejar Errores de Geolocalización
// ======================================

/**
 * Se llama si hay error obteniendo la ubicación
 * Muestra mensajes específicos según el tipo de error
 * 
 * @param {GeolocationPositionError} error
 */
function handlePositionError(error) {
    let message = '';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Permiso de geolocalización denegado. Por favor, habilita la ubicación en tu navegador.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Información de ubicación no disponible.';
            break;
        case error.TIMEOUT:
            message = 'La solicitud de ubicación agotó el tiempo de espera.';
            break;
    }
    console.error('Error de geolocalización:', message);
    document.getElementById('statusValue').textContent = '❌ Error: ' + message.substring(0, 30) + '...';
}


// ======================================
// FUNCIÓN: Iniciar Tracking
// ======================================

/**
 * Inicia el monitoreo de ubicación
 * - Obtiene posición inicial con getCurrentPosition()
 * - Monitorea cambios continuos con watchPosition()
 * - Actualiza botones y estado
 */
function startTracking() {
    if (!navigator.geolocation) {
        alert('Tu navegador no soporta geolocalización');
        return;
    }

    isTracking = true;
    
    // Cambiar estado visual
    document.getElementById('statusValue').textContent = '🟢 Tracking activo';
    document.getElementById('btnStart').classList.add('btn-disabled');
    document.getElementById('btnStart').disabled = true;
    document.getElementById('btnStop').classList.remove('btn-disabled');
    document.getElementById('btnStop').disabled = false;

    // Obtener posición inicial una sola vez
    navigator.geolocation.getCurrentPosition(
        handlePositionUpdate,  // Si funciona
        handlePositionError    // Si hay error
    );

    // Monitorear cambios de posición continuamente
    // watchPosition() llamará a handlePositionUpdate cada vez que cambie
    watchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handlePositionError,
        {
            enableHighAccuracy: true,  // Usar mejor GPS si está disponible
            timeout: 10000,            // Esperar máximo 10 segundos
            maximumAge: 0              // No usar ubicación en caché
        }
    );
}


// ======================================
// FUNCIÓN: Detener Tracking
// ======================================

/**
 * Detiene el monitoreo de ubicación
 * Los datos se mantienen en el historial
 */
function stopTracking() {
    if (watchId !== null) {
        // Detener watchPosition
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    isTracking = false;
    
    // Cambiar estado visual
    document.getElementById('statusValue').textContent = '⏸️ Tracking detenido';
    document.getElementById('btnStart').classList.remove('btn-disabled');
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnStop').classList.add('btn-disabled');
    document.getElementById('btnStop').disabled = true;
}


// ======================================
// FUNCIÓN: Limpiar Historial
// ======================================

/**
 * Limpia todos los datos:
 * - Historial de posiciones
 * - Marcador del usuario
 * - Línea roja del recorrido
 * - Distancia total
 * - Reinicia el estado
 */
function clearHistory() {
    if (positionHistory.length === 0) {
        alert('No hay historial que limpiar');
        return;
    }

    if (confirm('¿Estás seguro de que deseas borrar todo el historial de posiciones?')) {
        // Detener tracking si está activo
        stopTracking();
        
        // Limpiar datos
        positionHistory = [];
        totalDistance = 0;
        
        // Remover marcador del mapa
        if (userMarker) {
            map.removeLayer(userMarker);
            userMarker = null;
        }

        // Remover línea roja del mapa
        polyline.setLatLngs([]);
        
        // Actualizar interfaz
        document.getElementById('statusValue').textContent = '🔄 Historial limpiado';
        updateHistoryUI();
        updateCounters();

        // Cambiar mensaje después de 2 segundos
        setTimeout(() => {
            document.getElementById('statusValue').textContent = '⏸️ Inactivo';
        }, 2000);
    }
}


// ======================================
// EVENT LISTENERS - Conectar Botones
// ======================================

// Conectar botón "Iniciar Tracking"
document.getElementById('btnStart').addEventListener('click', startTracking);

// Conectar botón "Detener Tracking"
document.getElementById('btnStop').addEventListener('click', stopTracking);

// Conectar botón "Limpiar Historial"
document.getElementById('btnClear').addEventListener('click', clearHistory);

// Inicializar mapa cuando carga la página
window.addEventListener('load', initMap);
