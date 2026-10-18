const CENTRO_INICIAL = [5.0689, -75.5174]; // Manizales, por si falla la ubicación

const mapa = L.map('mapa').setView(CENTRO_INICIAL, 15);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(mapa);

let marcadorUsuario = null;
let circuloPrecision = null;

function mostrarInfo(texto) {
  document.getElementById('info').textContent = texto;
}

function ubicarUsuario() {
  if (!('geolocation' in navigator)) {
    mostrarInfo('Tu navegador no soporta geolocalización.');
    return;
  }
  mostrarInfo('Buscando tu ubicación...');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const punto = [latitude, longitude];

      if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
      if (circuloPrecision) mapa.removeLayer(circuloPrecision);

      marcadorUsuario = L.marker(punto).addTo(mapa).bindPopup('Estás aquí').openPopup();
      circuloPrecision = L.circle(punto, { radius: accuracy, fillOpacity: 0.1 }).addTo(mapa);
      mapa.setView(punto, 17);
      mostrarInfo(`Ubicación encontrada (precisión: ${Math.round(accuracy)} m). Haz clic para dibujar.`);
      // Reto #7: comprobar dentro/fuera al ubicar
      if (poligono) comprobarDentroFuera(punto);
    },
    (err) => {
      const mensajes = {
        1: 'Permiso denegado. Activa la ubicación en el navegador.',
        2: 'No se pudo determinar la ubicación.',
        3: 'Se agotó el tiempo de espera.'
      };
      mostrarInfo(mensajes[err.code] || 'Error desconocido.');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

document.getElementById('btnUbicar').addEventListener('click', ubicarUsuario);
ubicarUsuario();

let puntos = [];     // array de [lat, lng]
let vertices = [];   // marcadores visibles de cada vértice
let poligono = null;
const lineaGuia = L.polyline([], { color: '#e67e22', dashArray: '6 6' }).addTo(mapa);

mapa.on('click', (e) => {
  if (poligono) return; // si ya está cerrado, no se agregan más puntos

  const { lat, lng } = e.latlng;
  puntos.push([lat, lng]);

  const v = L.circleMarker([lat, lng], { radius: 6, color: '#e67e22', fillOpacity: 1 }).addTo(mapa);
  vertices.push(v);

  lineaGuia.setLatLngs(puntos);
  
  // Reto #9: Comprobar auto-intersección en tiempo real (ya existe en main)
  if (puntos.length >= 4) {
    const kinks = tieneAutointerseccion();
    if (kinks) {
      lineaGuia.setStyle({ color: '#e74c3c' });
      mostrarInfo(`⚠️ Auto-intersección detectada (${kinks.features.length}). El área será incorrecta.`);
    } else {
      lineaGuia.setStyle({ color: '#e67e22' });
    }
  }
  
  actualizarBotones();
  actualizarTablaVertices(); // Reto #1
  if (!tieneAutointerseccion() || puntos.length < 4) {
    mostrarInfo(`${puntos.length} vértice(s). Necesitas al menos 3 para cerrar.`);
  }
});

function actualizarBotones() {
  document.getElementById('btnCerrar').disabled = puntos.length < 3 || poligono !== null;
  document.getElementById('btnDeshacer').disabled = puntos.length === 0 || poligono !== null;
  document.getElementById('btnExportar').disabled = poligono === null;
}

// Reto #1: Actualizar tabla de vértices con 6 decimales
function actualizarTablaVertices() {
  const tbody = document.getElementById('tbodyVertices');
  const mensajeVacio = document.getElementById('sinVertices');
  
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (puntos.length === 0) {
    if (mensajeVacio) mensajeVacio.classList.remove('oculto');
    return;
  }
  
  if (mensajeVacio) mensajeVacio.classList.add('oculto');
  
  puntos.forEach(([lat, lng], i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${lat.toFixed(6)}</td>
      <td>${lng.toFixed(6)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Reto #9: Auto-intersección con turf.kinks (ya existe en main)
function tieneAutointerseccion() {
  if (puntos.length < 4) return null;
  const geo = aGeoJSON();
  const kinks = turf.kinks(geo);
  return kinks.features.length > 0 ? kinks : null;
}

// Reto #3: Nombre del polígono en propiedades GeoJSON
let nombrePoligono = 'Mi polígono';
function pedirNombre() {
  const nombre = prompt('Nombre del polígono:', nombrePoligono);
  if (nombre && nombre.trim()) {
    nombrePoligono = nombre.trim();
    if (poligono) {
      // Actualizar popup si ya existe
      const geo = aGeoJSON();
      const { area, perimetro } = medir();
      poligono.bindPopup(`<strong>${nombrePoligono}</strong><br>Área: ${area.toFixed(1)} m²<br>Perímetro: ${perimetro.toFixed(1)} m`).openPopup();
    }
    mostrarInfo(`Nombre guardado: ${nombrePoligono}`);
  }
}
// El listener original del btnCerrar se mantiene; añadimos la lógica de nombre al cerrar
const originalCerrarPoligono = cerrarPoligono;

// Reto #3: aGeoJSON incluye nombre
function aGeoJSON() {
  const anillo = puntos.map(([lat, lng]) => [lng, lat]);
  anillo.push(anillo[0]); // cerrar el anillo
  return turf.polygon([anillo], { 
    nombre: nombrePoligono, 
    creado: new Date().toISOString() 
  });
}

function medir() {
  const geo = aGeoJSON();
  const area = turf.area(geo); // metros cuadrados
  const perimetro = turf.length(turf.polygonToLine(geo), { units: 'meters' });
  return { area, perimetro };
}

// Reto #7: Comprobar si usuario está dentro/fuera del polígono
function comprobarDentroFuera(puntoUsuario) {
  if (!poligono) return;
  const geo = aGeoJSON();
  const point = turf.point([puntoUsuario[1], puntoUsuario[0]]); // [lng, lat]
  const dentro = turf.booleanPointInPolygon(point, geo);
  const estado = dentro ? 'DENTRO ✅' : 'FUERA ❌';
  const color = dentro ? '#27ae60' : '#e74c3c';
  mostrarInfo(`Tu ubicación está ${estado} del polígono "${nombrePoligono}".`);
  // Cambiar color del marcador temporalmente
  if (marcadorUsuario) {
    const icono = L.divIcon({ className: 'custom-marker', html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid white;"></div>`, iconSize: [12, 12] });
    marcadorUsuario.setIcon(icono);
  }
}

// Reto #3, #5, #7: nuevo cerrarPoligono que extiende el original
function cerrarPoligono() {
  // Reto #9: bloquear si hay auto-intersección (ya existe)
  const kinks = tieneAutointerseccion();
  if (kinks) {
    mostrarInfo(`⚠️ El polígono se cruza consigo mismo (${kinks.features.length} intersección(es)). El área y perímetro serán incorrectos. Corrige los vértices.`);
    lineaGuia.setStyle({ color: '#e74c3c' });
    return;
  }

  // Reto #3: pedir nombre antes de cerrar (si no se pidió ya)
  if (nombrePoligono === 'Mi polígono') {
    const nombre = prompt('Nombre del polígono:', nombrePoligono);
    if (nombre && nombre.trim()) {
      nombrePoligono = nombre.trim();
    }
  }

  poligono = L.polygon(puntos, { color: '#27ae60', fillOpacity: 0.35 }).addTo(mapa);
  lineaGuia.setLatLngs([]);
  mapa.fitBounds(poligono.getBounds());

  const { area, perimetro } = medir();
  poligono.bindPopup(`<strong>${nombrePoligono}</strong><br>Área: ${area.toFixed(1)} m²<br>Perímetro: ${perimetro.toFixed(1)} m`).openPopup();
  mostrarInfo(`Polígono cerrado. Área: ${area.toFixed(1)} m² (${(area / 10000).toFixed(3)} ha).`);
  
  // Reto #5: guardar en localStorage al cerrar
  guardarEnLocalStorage();
  actualizarBotones();
  
  // Reto #7: comprobar dentro/fuera tras cerrar
  if (marcadorUsuario) {
    const pos = marcadorUsuario.getLatLng();
    comprobarDentroFuera([pos.lat, pos.lng]);
  }
}

// Sobrescribir el listener del botón cerrar
document.getElementById('btnCerrar').onclick = null;
document.getElementById('btnCerrar').addEventListener('click', cerrarPoligono);

function deshacerPunto() {
  puntos.pop();
  mapa.removeLayer(vertices.pop());
  lineaGuia.setLatLngs(puntos);
  // Reto #9: resetear color línea guía (ya existe)
  lineaGuia.setStyle({ color: '#e67e22' });
  actualizarBotones();
  actualizarTablaVertices(); // Reto #1
  mostrarInfo(`${puntos.length} vértice(s).`);
}

function limpiar() {
  puntos = [];
  vertices.forEach((v) => mapa.removeLayer(v));
  vertices = [];
  lineaGuia.setLatLngs([]);
  lineaGuia.setStyle({ color: '#e67e22' });
  if (poligono) {
    mapa.removeLayer(poligono);
    poligono = null;
  }
  // Reto #5: limpiar localStorage
  localStorage.removeItem('poligonoGuardado');
  nombrePoligono = 'Mi polígono';
  actualizarBotones();
  actualizarTablaVertices(); // Reto #1
  mostrarInfo('Mapa limpio. Haz clic para empezar de nuevo.');
}

document.getElementById('btnDeshacer').addEventListener('click', deshacerPunto);
document.getElementById('btnLimpiar').addEventListener('click', limpiar);

// Reto #5: Guardar y recuperar de localStorage
function guardarEnLocalStorage() {
  const datos = {
    puntos: puntos,
    nombre: nombrePoligono,
    timestamp: new Date().toISOString()
  };
  localStorage.setItem('poligonoGuardado', JSON.stringify(datos));
}

function cargarDeLocalStorage() {
  const guardado = localStorage.getItem('poligonoGuardado');
  if (!guardado) return false;
  try {
    const datos = JSON.parse(guardado);
    if (!Array.isArray(datos.puntos) || datos.puntos.length < 3) return false;
    puntos = datos.puntos;
    nombrePoligono = datos.nombre || 'Mi polígono';
    
    // Recrear vértices visibles
    puntos.forEach(([lat, lng]) => {
      const v = L.circleMarker([lat, lng], { radius: 6, color: '#e67e22', fillOpacity: 1 }).addTo(mapa);
      vertices.push(v);
    });
    lineaGuia.setLatLngs(puntos);
    
    // Cerrar polígono automáticamente
    poligono = L.polygon(puntos, { color: '#27ae60', fillOpacity: 0.35 }).addTo(mapa);
    mapa.fitBounds(poligono.getBounds());
    
    const { area, perimetro } = medir();
    poligono.bindPopup(`<strong>${nombrePoligono}</strong><br>Área: ${area.toFixed(1)} m²<br>Perímetro: ${perimetro.toFixed(1)} m`).openPopup();
    mostrarInfo(`Polígono "${nombrePoligono}" recuperado (${puntos.length} vértices). Área: ${area.toFixed(1)} m².`);
    actualizarBotones();
    return true;
  } catch (e) {
    console.error('Error al cargar localStorage:', e);
    localStorage.removeItem('poligonoGuardado');
    return false;
  }
}

// Cargar al iniciar
cargarDeLocalStorage();
actualizarTablaVertices(); // Reto #1: actualizar tabla al cargar

function exportar() {
  const texto = JSON.stringify(aGeoJSON(), null, 2);
  const blob = new Blob([texto], { type: 'application/geo+json' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = 'poligono.geojson';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

document.getElementById('btnExportar').addEventListener('click', exportar);