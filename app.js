/**
 * Polígonos sobre un mapa con geolocalización.
 *
 * @version 1.0.0
 * @author Juan Pablo Olave Muñoz (donpedromz) - base y retos 2, 4, 6 y 8
 * @author Johan Andrés Villada (VilladaV) - retos 1, 3, 5, 7 y 9
 */

const CENTRO_INICIAL = [5.0689, -75.5174]; // Manizales, por si falla la ubicación
const COLORES = { guia: '#e67e22', error: '#e74c3c' };
const OPCIONES_UBICACION = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

const mapa = L.map('mapa').setView(CENTRO_INICIAL, 15);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(mapa);

let marcadorUsuario = null;
let circuloPrecision = null;
let vigilancia = null; // id del watchPosition activo (null = sin rastreo)

function mostrarInfo(texto, evento) {
  const info = document.getElementById('info');
  info.textContent = texto;
  info.className = evento ? `info-${evento}` : '';
}

function pintarUbicacion(punto, accuracy) {
  if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
  if (circuloPrecision) mapa.removeLayer(circuloPrecision);

  marcadorUsuario = L.marker(punto).addTo(mapa).bindPopup('Estás aquí');
  circuloPrecision = L.circle(punto, { radius: accuracy, fillOpacity: 0.1 }).addTo(mapa);
}

// La geolocalización solo ofrece callbacks; la envolvemos para poder usar await.
function pedirUbicacion() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, OPCIONES_UBICACION);
  });
}

const MENSAJES_ERROR_UBICACION = {
  1: 'Permiso denegado. Activa la ubicación en el navegador.',
  2: 'No se pudo determinar la ubicación.',
  3: 'Se agotó el tiempo de espera.'
};

function mensajeDeErrorUbicacion(error) {
  return MENSAJES_ERROR_UBICACION[error.code] || 'Error desconocido.';
}

async function ubicarUsuario() {
  if (!('geolocation' in navigator)) {
    mostrarInfo('Tu navegador no soporta geolocalización.', 'aviso');
    return;
  }
  mostrarInfo('Buscando tu ubicación...');

  try {
    const pos = await pedirUbicacion();
    const { latitude, longitude, accuracy } = pos.coords;
    const punto = [latitude, longitude];

    pintarUbicacion(punto, accuracy);
    marcadorUsuario.openPopup();
    mapa.setView(punto, 17);
    mostrarInfo(`Ubicación encontrada (precisión: ${Math.round(accuracy)} m). Haz clic para dibujar.`);
    // Reto #7: comprobar dentro/fuera al ubicar
    if (poligono) comprobarDentroFuera(punto);
  } catch (err) {
    mostrarInfo(mensajeDeErrorUbicacion(err), 'aviso');
  }
}

document.getElementById('btnUbicar').addEventListener('click', ubicarUsuario);
ubicarUsuario();

// Reto #8: Rastrear la ubicación en tiempo real
function alternarRastreo() {
  const boton = document.getElementById('btnRastrear');

  if (vigilancia !== null) {
    navigator.geolocation.clearWatch(vigilancia);
    vigilancia = null;
    boton.textContent = 'Rastrear ubicación';
    mostrarInfo('Rastreo detenido.');
    return;
  }

  if (!('geolocation' in navigator)) {
    mostrarInfo('Tu navegador no soporta geolocalización.', 'aviso');
    return;
  }

  vigilancia = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const punto = [latitude, longitude];

      pintarUbicacion(punto, accuracy);
      if (poligono) {
        comprobarDentroFuera(punto);
        avisarSalidaDelPoligono(punto);
      } else {
        mostrarInfo(`Rastreando… (precisión: ${Math.round(accuracy)} m). Cierra un polígono para activar la geocerca.`);
      }
    },
    (err) => mostrarInfo(mensajeDeErrorUbicacion(err), 'aviso'),
    OPCIONES_UBICACION
  );

  boton.textContent = 'Detener rastreo';
  mostrarInfo('Rastreando tu ubicación…');
}

document.getElementById('btnRastrear').addEventListener('click', alternarRastreo);

let puntos = [];     // array de [lat, lng]
let vertices = [];   // marcadores visibles de cada vértice
let poligono = null;
const lineaGuia = L.polyline([], { color: COLORES.guia, dashArray: '6 6' }).addTo(mapa);

mapa.on('click', (e) => {
  const { lat, lng } = e.latlng;
  agregarVertice(lat, lng);
});

function agregarVertice(lat, lng) {
  if (poligono) return; // si ya está cerrado, no se agregan más puntos

  puntos.push([lat, lng]);

  const v = L.circleMarker([lat, lng], { radius: 6, color: COLORES.guia, fillOpacity: 1 }).addTo(mapa);
  vertices.push(v);

  lineaGuia.setLatLngs(puntos);

  // Reto #9: Comprobar auto-intersección en tiempo real (ya existe en main)
  if (puntos.length >= 4) {
    const kinks = tieneAutointerseccion();
    if (kinks) {
      lineaGuia.setStyle({ color: COLORES.error });
      mostrarInfo(`Auto-intersección detectada (${kinks.features.length}). El área será incorrecta.`, 'aviso');
    } else {
      lineaGuia.setStyle({ color: COLORES.guia });
    }
  }

  actualizarBotones();
  actualizarTablaVertices(); // Reto #1
  if (!tieneAutointerseccion() || puntos.length < 4) {
    mostrarInfo(`${puntos.length} vértice(s). Necesitas al menos 3 para cerrar.`);
  }
}

// Reto #4: Agregar un vértice con la ubicación actual
async function agregarPuntoGPS() {
  if (!('geolocation' in navigator)) {
    mostrarInfo('Tu navegador no soporta geolocalización.', 'aviso');
    return;
  }
  mostrarInfo('Buscando tu ubicación para agregar el vértice...');

  try {
    const pos = await pedirUbicacion();
    const { latitude, longitude, accuracy } = pos.coords;
    agregarVertice(latitude, longitude);
    // El aviso de auto-intersección importa más que el dato de precisión.
    if (!tieneAutointerseccion()) {
      mostrarInfo(`Vértice agregado desde tu ubicación (precisión: ${Math.round(accuracy)} m).`);
    }
  } catch (err) {
    mostrarInfo(mensajeDeErrorUbicacion(err), 'aviso');
  }
}

document.getElementById('btnPuntoGPS').addEventListener('click', agregarPuntoGPS);

function actualizarBotones() {
  document.getElementById('btnCerrar').disabled = puntos.length < 3 || poligono !== null;
  document.getElementById('btnDeshacer').disabled = puntos.length === 0 || poligono !== null;
  document.getElementById('btnExportar').disabled = poligono === null;
  document.getElementById('btnPuntoGPS').disabled = poligono !== null;
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
  const estado = dentro ? 'DENTRO' : 'FUERA';
  mostrarInfo(`Tu ubicación está ${estado} del polígono "${nombrePoligono}".`);
  // El color del punto lo decide el CSS según el lado en el que esté.
  if (marcadorUsuario) {
    const icono = L.divIcon({ className: 'marcador-usuario', html: `<div class="punto-usuario ${dentro ? 'dentro' : 'fuera'}"></div>`, iconSize: [12, 12] });
    marcadorUsuario.setIcon(icono);
  }
}

// Reto #8: Avisar cuando el usuario sale del polígono (geocerca)
let geocercaMedida = { poligono: null, dentro: null };

function avisarSalidaDelPoligono(punto) {
  // Si el polígono es otro, la medida anterior no cuenta.
  if (geocercaMedida.poligono !== poligono) geocercaMedida = { poligono: poligono, dentro: null };

  const geo = aGeoJSON();
  const dentro = turf.booleanPointInPolygon(turf.point([punto[1], punto[0]]), geo);
  // Avisar solo al cambiar de lado, no en cada actualización.
  if (geocercaMedida.dentro !== null && dentro !== geocercaMedida.dentro) {
    if (dentro) {
      mostrarInfo(`Volviste a entrar al polígono "${nombrePoligono}".`, 'ok');
    } else {
      mostrarInfo(`Saliste del polígono "${nombrePoligono}".`, 'aviso');
    }
  }
  geocercaMedida.dentro = dentro;
}

// Reto #3, #5, #7: nuevo cerrarPoligono que extiende el original
function cerrarPoligono() {
  // Reto #9: bloquear si hay auto-intersección (ya existe)
  const kinks = tieneAutointerseccion();
  if (kinks) {
    mostrarInfo(`El polígono se cruza consigo mismo (${kinks.features.length} intersección(es)). El área y perímetro serán incorrectos. Corrige los vértices.`, 'aviso');
    lineaGuia.setStyle({ color: COLORES.error });
    return;
  }

  // Reto #3: pedir nombre antes de cerrar (si no se pidió ya)
  if (nombrePoligono === 'Mi polígono') {
    const nombre = prompt('Nombre del polígono:', nombrePoligono);
    if (nombre && nombre.trim()) {
      nombrePoligono = nombre.trim();
    }
  }

  poligono = L.polygon(puntos, { color: colorPoligono, fillOpacity: 0.35 }).addTo(mapa);
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
  lineaGuia.setStyle({ color: COLORES.guia });
  actualizarBotones();
  actualizarTablaVertices(); // Reto #1
  mostrarInfo(`${puntos.length} vértice(s).`);
}

function limpiar() {
  puntos = [];
  vertices.forEach((v) => mapa.removeLayer(v));
  vertices = [];
  lineaGuia.setLatLngs([]);
  lineaGuia.setStyle({ color: COLORES.guia });
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

let colorPoligono = document.getElementById('colorPoligono').value;
document.getElementById('colorPoligono').addEventListener('input', (e) => {
  colorPoligono = e.target.value;
  if (poligono) poligono.setStyle({ color: colorPoligono });
});

// Reto #5: Guardar y recuperar de localStorage
function guardarEnLocalStorage() {
  const datos = {
    puntos: puntos,
    nombre: nombrePoligono,
    color: colorPoligono,
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
    colorPoligono = datos.color || colorPoligono;
    document.getElementById('colorPoligono').value = colorPoligono;

    // Recrear vértices visibles
    puntos.forEach(([lat, lng]) => {
      const v = L.circleMarker([lat, lng], { radius: 6, color: COLORES.guia, fillOpacity: 1 }).addTo(mapa);
      vertices.push(v);
    });
    lineaGuia.setLatLngs(puntos);

    // Cerrar polígono automáticamente
    poligono = L.polygon(puntos, { color: colorPoligono, fillOpacity: 0.35 }).addTo(mapa);
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

// Reto #6: Importar un archivo GeoJSON y dibujarlo en el mapa
// FileReader solo ofrece callbacks; lo envolvemos para poder usar await.
function leerArchivo(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsText(archivo);
  });
}

async function importarGeoJSON(archivo) {
  let texto;
  try {
    texto = await leerArchivo(archivo);
  } catch {
    mostrarInfo(`No se pudo leer el archivo "${archivo.name}".`, 'aviso');
    return;
  }

  let formas;
  try {
    formas = L.geoJSON(JSON.parse(texto)).getLayers();
  } catch {
    mostrarInfo(`No se pudo importar "${archivo.name}": no es un GeoJSON válido.`, 'aviso');
    return;
  }

  const forma = formas[0];
  if (!(forma instanceof L.Polygon)) {
    mostrarInfo(`No se pudo importar "${archivo.name}": no contiene ningún polígono.`, 'aviso');
    return;
  }

  const anillo = forma.getLatLngs()[0].map((p) => [p.lat, p.lng]);
  const primero = anillo[0];
  const ultimo = anillo[anillo.length - 1];
  // El anillo de un GeoJSON repite el primer punto al final.
  if (anillo.length > 3 && primero[0] === ultimo[0] && primero[1] === ultimo[1]) anillo.pop();
  if (anillo.length < 3) {
    mostrarInfo(`No se pudo importar "${archivo.name}": necesita al menos 3 vértices.`, 'aviso');
    return;
  }

  limpiar();
  const propiedades = forma.feature && forma.feature.properties;
  if (propiedades && propiedades.nombre) nombrePoligono = propiedades.nombre;
  anillo.forEach(([lat, lng]) => agregarVertice(lat, lng));
  cerrarPoligono();
}

document.getElementById('archivoGeoJSON').addEventListener('change', (e) => {
  const archivo = e.target.files[0];
  e.target.value = ''; // permite volver a elegir el mismo archivo
  if (archivo) importarGeoJSON(archivo);
});
