# Ejemplos de GeoJSON

Archivos para probar el botón de importar del taller (reto 6). Los polígonos están cerca de Manizales —salvo el que se indica— y miden unos cientos de metros, así que caben bien en el mapa.

Todos son `Feature` o `FeatureCollection` con geometría `Polygon`, menos los dos últimos apartados que existen justo para probar los errores.

## Cómo usarlos

Sirve el proyecto (`bunx serve .` o Live Server), elige un archivo con el botón de archivo de la barra de controles y mira el resultado.

| Archivo | Qué prueba | Resultado esperado |
|---|---|---|
| `cuadrado.geojson` | El caso normal: un polígono con `properties.nombre` | Se dibuja con 4 vértices, 48 771.3 m², perímetro 887.6 m y el nombre «Cuadrado de ejemplo», sin preguntar nada |
| `cancha-la-nubia.geojson` | Un polígono irregular y con propiedades de más | 4 vértices, 85 350.0 m² y nombre «Cancha La Nubia» |
| `sin-nombre.geojson` | Un archivo sin `properties` | Al cerrar **pregunta el nombre** (reto 3), igual que cuando se dibuja a mano |
| `mariposa.geojson` | Un polígono que se cruza consigo mismo | Queda **bloqueado** por el reto 9: sin polígono, línea guía roja y aviso de intersección |
| `coleccion-dos-poligonos.geojson` | Un `FeatureCollection` con dos polígonos | Se importa el **primero** («Polígono A», 9 852.9 m²) y el segundo se ignora |
| `con-agujero.geojson` | Un polígono con anillo interior (hueco) | Se importa solo el anillo exterior: 66 507.0 m², o sea el cuadrado completo, porque el modelo de la app no maneja huecos |
| `solo-un-punto.geojson` | Un GeoJSON sin polígonos | Mensaje «no contiene ningún polígono» y **no** se borra lo que hubiera dibujado |
| `corrupto.geojson` | Un archivo que no es JSON válido (roto a propósito) | Mensaje «no es un GeoJSON válido» y **no** se borra lo que hubiera dibujado |
| `lejos-de-manizales.geojson` | Un polígono en Bogotá | El mapa se desplaza hasta él y lo mide igual (103 509.6 m²) |
| `muchos-vertices.geojson` | Un polígono de 24 vértices | 24 vértices, 24 filas en la tabla (el panel hace scroll) y 55 303.0 m² |

Las áreas y los perímetros son los que reporta la aplicación (geodésicos, con Turf) al importar cada archivo.

## Ida y vuelta

Cualquier `.geojson` exportado por la propia aplicación sirve también de ejemplo: al reimportarlo entra con su nombre y su área, sin preguntar nada.
