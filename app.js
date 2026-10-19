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

/**
 * Escribe el mensaje de estado en la barra de información.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @param {string} texto - Mensaje para el usuario.
 * @param {'aviso'|'ok'} [evento] - Colorea el mensaje (rojo de aviso, verde de regreso).
 */
function mostrarInfo(texto, evento) {
  const info = document.getElementById('info');
  info.textContent = texto;
  info.className = evento ? `info-${evento}` : '';
}

/**
 * Dibuja o mueve el marcador del usuario y su círculo de precisión.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @param {[number, number]} punto - Latitud y longitud del usuario.
 * @param {number} accuracy - Precisión en metros, que se usa como radio del círculo.
 */
function pintarUbicacion(punto, accuracy) {
  if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
  if (circuloPrecision) mapa.removeLayer(circuloPrecision);

  marcadorUsuario = L.marker(punto).addTo(mapa).bindPopup('Estás aquí');
  circuloPrecision = L.circle(punto, { radius: accuracy, fillOpacity: 0.1 }).addTo(mapa);
}

/**
 * Pide la ubicación actual y devuelve una promesa con la posición.
 *
 * La geolocalización solo ofrece callbacks; se envuelve aquí para poder usar await.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @returns {Promise<GeolocationPosition>} Posición actual del usuario.
 */
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

/**
 * Traduce el código de error de la geolocalización a un mensaje para el usuario.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @param {GeolocationPositionError} error - Error entregado por la API.
 * @returns {string} Mensaje del código, o uno genérico si es desconocido.
 */
function mensajeDeErrorUbicacion(error) {
  return MENSAJES_ERROR_UBICACION[error.code] || 'Error desconocido.';
}

/**
 * Ubica al usuario: pinta el marcador, centra el mapa y comprueba si quedó dentro o
 * fuera del polígono (reto #7).
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @author Johan Andrés Villada (VilladaV) - reto #7
 * @returns {Promise<void>}
 */
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

/**
 * Arranca o detiene el rastreo de la ubicación en tiempo real (reto #8).
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 */
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

/**
 * Agrega un vértice al polígono en construcción.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @author Johan Andrés Villada (VilladaV) - retos #1 (tabla) y #9 (auto-intersección)
 * @param {number} lat - Latitud del vértice.
 * @param {number} lng - Longitud del vértice.
 */
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

/**
 * Agrega un vértice con la ubicación actual del usuario (reto #4).
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @returns {Promise<void>}
 */
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

/**
 * Habilita o deshabilita los botones según el estado del dibujo.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 */
function actualizarBotones() {
  document.getElementById('btnCerrar').disabled = puntos.length < 3 || poligono !== null;
  document.getElementById('btnDeshacer').disabled = puntos.length === 0 || poligono !== null;
  document.getElementById('btnExportar').disabled = poligono === null;
  document.getElementById('btnPuntoGPS').disabled = poligono !== null;
}

/**
 * Llena la tabla lateral con los vértices actuales, con 6 decimales (reto #1).
 *
 * @author Johan Andrés Villada (VilladaV)
 */
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

/**
 * Muestra u oculta el panel de vértices. Es una mejora propia de la 1.0.0, no un reto.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 */
function alternarPanel() {
  const panel = document.getElementById('panelVertices');
  const boton = document.getElementById('btnPanel');
  const oculto = panel.classList.toggle('oculto');

  boton.textContent = oculto ? 'Ver vértices' : 'Ocultar vértices';
  boton.setAttribute('aria-expanded', String(!oculto));
  // El mapa gana o pierde el ancho del panel: Leaflet tiene que recalcular su tamaño.
  requestAnimationFrame(() => mapa.invalidateSize());
}

document.getElementById('btnPanel').addEventListener('click', alternarPanel);

// En pantallas pequeñas el panel se superpone al mapa: empieza oculto.
if (window.matchMedia('(max-width: 640px)').matches) alternarPanel();

/**
 * Comprueba con turf.kinks si el trazo se cruza consigo mismo (reto #9).
 *
 * @author Johan Andrés Villada (VilladaV)
 * @returns {Object|null} Los cruces encontrados, o null si no hay ninguno.
 */
function tieneAutointerseccion() {
  if (puntos.length < 4) return null;
  const geo = aGeoJSON();
  const kinks = turf.kinks(geo);
  return kinks.features.length > 0 ? kinks : null;
}

// Reto #3: Nombre del polígono en propiedades GeoJSON
let nombrePoligono = 'Mi polígono';

/**
 * Convierte los puntos dibujados en un polígono GeoJSON cerrado, con el nombre en las
 * propiedades (reto #3).
 *
 * @author Johan Andrés Villada (VilladaV)
 * @returns {Object} Polígono GeoJSON.
 */
function aGeoJSON() {
  const anillo = puntos.map(([lat, lng]) => [lng, lat]);
  anillo.push(anillo[0]); // cerrar el anillo
  return turf.polygon([anillo], {
    nombre: nombrePoligono,
    creado: new Date().toISOString()
  });
}

/**
 * Calcula el área y el perímetro del polígono actual.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @returns {{area: number, perimetro: number}} Área en m² y perímetro en metros.
 */
function medir() {
  const geo = aGeoJSON();
  const area = turf.area(geo); // metros cuadrados
  const perimetro = turf.length(turf.polygonToLine(geo), { units: 'meters' });
  return { area, perimetro };
}

/**
 * Dice si el usuario está dentro o fuera del polígono y colorea su marcador (reto #7).
 *
 * @author Johan Andrés Villada (VilladaV)
 * @param {[number, number]} puntoUsuario - Latitud y longitud del usuario.
 */
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

/**
 * Avisa cuando el usuario cruza el borde del polígono, solo al cambiar de lado (reto #8).
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @param {[number, number]} punto - Latitud y longitud del usuario.
 */
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

/**
 * Cierra el polígono con los puntos dibujados: pide el nombre, lo pinta con las medidas,
 * lo guarda y comprueba dónde quedó el usuario.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @author Johan Andrés Villada (VilladaV) - retos #3 (nombre), #5 (guardar), #7 (dentro/fuera) y #9 (bloqueo por cruce)
 */
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

/**
 * Quita el último vértice dibujado.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @author Johan Andrés Villada (VilladaV) - retos #1 (tabla) y #9 (color de la línea)
 */
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

/**
 * Borra el dibujo y deja el mapa listo para empezar de nuevo.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @author Johan Andrés Villada (VilladaV) - retos #1 (tabla) y #5 (localStorage)
 */
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

// Reto #2: el color elegido se aplica al polígono ya cerrado.
let colorPoligono = document.getElementById('colorPoligono').value;
document.getElementById('colorPoligono').addEventListener('input', (e) => {
  colorPoligono = e.target.value;
  if (poligono) poligono.setStyle({ color: colorPoligono });
});

/**
 * Guarda el polígono cerrado en localStorage (reto #5).
 *
 * @author Johan Andrés Villada (VilladaV)
 */
function guardarEnLocalStorage() {
  const datos = {
    puntos: puntos,
    nombre: nombrePoligono,
    color: colorPoligono,
    timestamp: new Date().toISOString()
  };
  localStorage.setItem('poligonoGuardado', JSON.stringify(datos));
}

/**
 * Recupera el polígono guardado y lo vuelve a dibujar al abrir la página (reto #5).
 *
 * @author Johan Andrés Villada (VilladaV)
 * @returns {boolean} true si se recuperó un polígono.
 */
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

/**
 * Descarga el polígono actual como archivo GeoJSON.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 */
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

/**
 * Lee un archivo de texto y devuelve una promesa con su contenido.
 *
 * FileReader solo ofrece callbacks; se envuelve aquí para poder usar await.
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @param {File} archivo - Archivo que se va a leer.
 * @returns {Promise<string>} Contenido del archivo.
 */
function leerArchivo(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsText(archivo);
  });
}

/**
 * Importa un archivo GeoJSON y lo dibuja como polígono cerrado (reto #6).
 *
 * @author Juan Pablo Olave Muñoz (donpedromz)
 * @param {File} archivo - Archivo elegido por el usuario.
 * @returns {Promise<void>}
 */
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
