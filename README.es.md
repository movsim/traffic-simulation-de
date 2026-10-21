# Simulación de tránsito: primera versión en español

Esta contribución añade `onramp_es.html` e `index_es.html` para el escenario de incorporación a la autopista del proyecto [traffic-simulation.de](https://github.com/movsim/traffic-simulation-de).

Incluye controles, botones, mensajes de descarga, tiempo y detectores en español; seis paneles de ayuda; enlaces desde las páginas principales en inglés y alemán; y ajustes para textos largos en pantallas de escritorio y móviles.

La ayuda del escenario y las instrucciones están traducidas y adaptadas. Los cuatro paneles técnicos son **resúmenes en español**, con enlaces a la documentación completa en inglés; no son traducciones integrales. Los demás escenarios y juegos conservan su idioma original, indicado en sus enlaces o descripciones. Las imágenes originales de las miniaturas se conservan.

## Ejecutar localmente

Desde la raíz del repositorio, con Python 3 instalado:

```sh
python -m http.server 8000
```

Abre <http://localhost:8000/onramp_es.html>. El servidor local permite cargar los paneles de ayuda, que usan peticiones HTTP.

## Mantener la traducción

El proyecto ya genera variantes alemanas mediante `bash/engl2ger.bash`. La versión española sigue ese enfoque, sin dependencias adicionales:

```sh
python bash/engl2es.py
```

Este generador regenera las páginas españolas, seis variantes de scripts, los botones SVG y el CSS a partir de los archivos originales. También añade los enlaces de idioma si no existen. Edita los textos de interfaz en el generador y la ayuda en `info/*_es.html`. No edites a mano los archivos generados.

Los cálculos de movimiento, las reglas de incorporación y los valores de los controles se conservan. Los identificadores de carretera y las coordenadas de depuración se ocultan en la página española. El factor de cortesía se muestra sin unidades porque es adimensional. Los nombres y formatos de los archivos de datos exportados permanecen iguales.

## Comprobación manual

1. Abre la página y comprueba que los vehículos se mueven.
2. Pausa, continúa y reinicia la simulación.
3. Modifica el flujo, la velocidad de simulación y el número de carriles.
4. Pulsa seis veces el botón de información y comprueba cada tema.
5. Inicia una grabación y descarga los archivos de vehículos y detectores.
6. Cambia a inglés y alemán y vuelve a español.
7. Repite la revisión en una pantalla estrecha.

Se conservan la autoría y la licencia del proyecto original; consulta `LICENSE`.
