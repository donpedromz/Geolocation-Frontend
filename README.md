# Polígonos sobre un mapa con geolocalización

Página web que ubica al usuario en un mapa, le deja dibujar un polígono con clics, calcula su área y su perímetro y lo exporta como GeoJSON. Es el taller de la asignatura Programación Frontend / Páginas Web Dinámicas: la base de los pasos 2 a 7 con los nueve retos resueltos.

**Versión 1.0.0**

| | |
| --- | --- |
| **Autores** | Juan Pablo Olave Muñoz ([donpedromz](https://github.com/donpedromz)) y Johan Andrés Villada ([VilladaV](https://github.com/VilladaV)) |
| **Reparto del trabajo** | Base y retos 2, 4, 6 y 8: Juan Pablo. Retos 1, 3, 5, 7 y 9: Johan |
| **Herramientas** | Leaflet 1.9.4, Turf.js 7 y las teselas de OpenStreetMap |
| **Dependencias** | Ninguna: no hay `package.json` ni compilación, las librerías se cargan desde CDN |

## Cómo ejecutarlo

La geolocalización solo funciona en contexto seguro (HTTPS o `localhost`). Abrir `index.html` con doble clic no sirve: el navegador deniega la ubicación en `file://`.

La forma prevista en el taller es Live Server de VS Code: clic derecho sobre `index.html` y «Open with Live Server», que queda en `http://127.0.0.1:5500`.

Sin VS Code sirve cualquier servidor estático:

```bash
bunx serve .        # o: python3 -m http.server 8000
```

y se abre `http://localhost:8000`.

Para probarlo en el celular hace falta HTTPS. Desde la IP de la red local (`http://192.168...`) el navegador no entrega la ubicación, así que hay que publicarlo en GitHub Pages, Netlify o similar.

## Cómo se usa

| Control | Qué hace |
| --- | --- |
| Clic en el mapa | Agrega un vértice. Con menos de 3 no se puede cerrar el polígono |
| Mi ubicación | Ubica al usuario, lo centra y dice si quedó dentro o fuera del polígono |
| Agregar mi punto | Agrega un vértice en la ubicación actual (para recorrer el contorno caminando) |
| Rastrear ubicación | Sigue la posición en tiempo real y avisa al salir y al volver a entrar al polígono |
| Cerrar polígono | Pide el nombre, dibuja el polígono y muestra el área y el perímetro en el popup |
| Deshacer punto | Quita el último vértice |
| Limpiar | Borra el dibujo y lo guardado |
| Exportar GeoJSON | Descarga `poligono.geojson` (se puede comprobar arrastrándolo a geojson.io) |
| Selector de color | Color del polígono |
| Elegir archivo | Importa un `.geojson` y lo dibuja |
| Vértices | Muestra u oculta el panel con la tabla de coordenadas |

El polígono cerrado se guarda en `localStorage`, así que al recargar la página vuelve con su nombre, su color y sus medidas.

En pantallas de hasta 640px el panel de vértices se superpone al mapa y arranca cerrado; en escritorio ocupa una columna a la derecha. El mapa siempre conserva el ancho completo en móvil.

Si se deniega el permiso de ubicación, la aplicación avisa con el motivo (cada código de error tiene su mensaje) y el resto sigue funcionando: se puede dibujar a mano, importar y exportar.

## Los retos

| # | Reto | Nivel | Autor | Dónde está |
| --- | --- | --- | --- | --- |
| 1 | Mostrar en una tabla HTML las coordenadas de cada vértice, con 6 decimales | Básico | Johan | `actualizarTablaVertices()` |
| 2 | Permitir elegir el color del polígono con un `<input type="color">` | Básico | Juan Pablo | Listener de `#colorPoligono` |
| 3 | Pedir un nombre para el polígono y guardarlo en las propiedades del GeoJSON | Básico | Johan | `cerrarPoligono()` y `aGeoJSON()` |
| 4 | Agregar un vértice con la ubicación actual del usuario | Intermedio | Juan Pablo | `agregarPuntoGPS()` |
| 5 | Guardar el polígono en `localStorage` y recuperarlo al recargar | Intermedio | Johan | `guardarEnLocalStorage()` y `cargarDeLocalStorage()` |
| 6 | Importar un archivo `.geojson` y dibujarlo en el mapa | Intermedio | Juan Pablo | `importarGeoJSON()` |
| 7 | Detectar si la ubicación del usuario está dentro o fuera del polígono | Avanzado | Johan | `comprobarDentroFuera()` |
| 8 | Rastrear al usuario en tiempo real y avisar cuando salga del polígono | Avanzado | Juan Pablo | `alternarRastreo()` y `avisarSalidaDelPoligono()` |
| 9 | Advertir si el polígono se cruza consigo mismo | Avanzado | Johan | `tieneAutointerseccion()` |

Cada función de `app.js` lleva su JSDoc con lo que hace, el reto que resuelve y su autor.

Además de los retos, la versión 1.0.0 agrega el panel de vértices plegable y su comportamiento en móvil.

## Estructura

| Archivo | Qué es |
| --- | --- |
| `index.html` | Estructura y controles |
| `estilos.css` | Estilos, con los colores del DOM en `:root` |
| `app.js` | Toda la lógica, documentada con JSDoc |
| `ejemplos-geojson/` | Archivos de prueba para el reto 6 |

## Ejemplos para probar

`ejemplos-geojson/` trae diez archivos con sus resultados esperados (áreas y perímetros incluidos), entre ellos uno roto a propósito y otro sin polígonos para ver los mensajes de error de la importación. Están descritos en [`ejemplos-geojson/README.md`](ejemplos-geojson/README.md).

Cualquier GeoJSON exportado por la propia aplicación sirve también como ejemplo: al reimportarlo entra con su nombre y su área, sin preguntar nada.

## Privacidad

> ¿Qué riesgos de privacidad tiene una página que pide y guarda la ubicación de sus usuarios, y cómo los mitigaría?

Una página que pide la ubicación maneja un dato que identifica a una persona sin necesidad de su nombre: por dónde se mueve, dónde vive, a qué horas. Este taller la pide con `enableHighAccuracy`, o sea con la precisión del GPS, y guarda el polígono en `localStorage`, de modo que el rastro queda en el equipo del usuario. Los riesgos concretos son tres: que el dato se comparta sin que el usuario lo sepa (enviarlo a un servidor, a un servicio de analítica o a un tercero), que se cruce con otros datos hasta identificar a la persona, y que se conserve más tiempo del necesario sin forma de borrarlo.

En esta aplicación el dato no sale del navegador. La ubicación se usa en memoria para pintar el marcador y medir, el polígono se guarda en `localStorage`, que es del propio dispositivo y no de un servidor, y no hay backend, ni cuentas, ni analítica, ni cookies de terceros. El usuario decide: puede negar el permiso (la aplicación avisa y sigue funcionando sin ubicación), puede detener el rastreo cuando quiera, «Limpiar» borra también lo guardado y exportar el archivo es una decisión explícita.

Si esto creciera a una aplicación real lo mitigaría así: pedir el permiso solo en el momento de usar la ubicación y explicar para qué; ofrecer precisión aproximada cuando no haga falta la exacta; pedir consentimiento antes de guardar algo; retener los datos el menor tiempo posible y permitir borrarlos de verdad; no asociarlos a un identificador de usuario; y decir con claridad quién los ve y para qué, conforme a la normativa de datos personales aplicable.
