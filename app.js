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
  
  // Comprobar auto-intersección en tiempo real
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
  if (!tieneAutointerseccion() || puntos.length < 4) {
    mostrarInfo(`${puntos.length} vértice(s). Necesitas al menos 3 para cerrar.`);
  }
});

function actualizarBotones() {
  document.getElementById('btnCerrar').disabled = puntos.length < 3 || poligono !== null;
  document.getElementById('btnDeshacer').disabled = puntos.length === 0 || poligono !== null;
  document.getElementById('btnExportar').disabled = poligono === null;
}

function aGeoJSON() {
  const anillo = puntos.map(([lat, lng]) => [lng, lat]);
  anillo.push(anillo[0]); // cerrar el anillo
  return turf.polygon([anillo], { nombre: 'Mi polígono', creado: new Date().toISOString() });
}

function medir() {
  const geo = aGeoJSON();
  const area = turf.area(geo); // metros cuadrados
  const perimetro = turf.length(turf.polygonToLine(geo), { units: 'meters' });
  return { area, perimetro };
}

function tieneAutointerseccion() {
  const geo = aGeoJSON();
  const kinks = turf.kinks(geo);
  return kinks.features.length > 0 ? kinks : null;
}

function cerrarPoligono() {
  const kinks = tieneAutointerseccion();
  if (kinks) {
    mostrarInfo(`⚠️ El polígono se cruza consigo mismo (${kinks.features.length} intersección(es)). El área y perímetro serán incorrectos. Corrige los vértices.`);
    // Resaltar visualmente la línea guía en rojo
    lineaGuia.setStyle({ color: '#e74c3c' });
    return; // No cierra hasta que se corrija
  }

  poligono = L.polygon(puntos, { color: '#27ae60', fillOpacity: 0.35 }).addTo(mapa);
  lineaGuia.setLatLngs([]);
  mapa.fitBounds(poligono.getBounds());

  const { area, perimetro } = medir();
  poligono.bindPopup(`Área: ${area.toFixed(1)} m²<br>Perímetro: ${perimetro.toFixed(1)} m`).openPopup();
  mostrarInfo(`Polígono cerrado. Área: ${area.toFixed(1)} m² (${(area / 10000).toFixed(3)} ha).`);
  actualizarBotones();
}

document.getElementById('btnCerrar').addEventListener('click', cerrarPoligono);

function deshacerPunto() {
  puntos.pop();
  mapa.removeLayer(vertices.pop());
  lineaGuia.setLatLngs(puntos);
  // Resetear color de la línea guía
  lineaGuia.setStyle({ color: '#e67e22' });
  actualizarBotones();
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
  actualizarBotones();
  mostrarInfo('Mapa limpio. Haz clic para empezar de nuevo.');
}

document.getElementById('btnDeshacer').addEventListener('click', deshacerPunto);
document.getElementById('btnLimpiar').addEventListener('click', limpiar);

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
