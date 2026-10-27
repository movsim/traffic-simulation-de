# Simulación de tránsito en español

Esta contribución añade una interfaz en español a 14 escenarios del proyecto [traffic-simulation.de](https://github.com/movsim/traffic-simulation-de). La página de entrada es `index_es.html`.

| Página | Escenario |
| --- | --- |
| `ring_es.html` | Circuito circular |
| `onramp_es.html` | Incorporación a la autopista |
| `onramp_scooters_es.html` | Incorporación con motocicletas |
| `offramp_es.html` | Salida de autopista |
| `roadworks_es.html` | Obras y cierre de carril |
| `uphill_es.html` | Tramo en pendiente |
| `routing_es.html` | Rutas alternativas |
| `routingGame_es.html` | Juego de rutas |
| `rampMeteringGame_es.html` | Juego de control de acceso |
| `roundabout_es.html` | Rotonda |
| `roundaboutS71_es.html` | Rotonda S71 |
| `intersection_es.html` | Intersección |
| `onramp_BaWue_es.html` | Incorporación con control de acceso |
| `roadworks_BaWue_es.html` | Control de tránsito en obras |

Incluye controles, botones, menús, mensajes de descarga, tiempo, detectores, ayuda de escenarios e instrucciones y resultados de los dos juegos. El panel del circuito circular incluye densidad por carril, separación mínima y desaceleración cómoda. La navegación entre estos escenarios mantiene el español. Las páginas que ya tenían selector de idioma incluyen un enlace a su versión española.

La ayuda y las instrucciones están traducidas y adaptadas. Los cuatro paneles técnicos compartidos son **resúmenes en español**, con enlaces a la documentación completa en inglés; no son traducciones integrales. Las páginas experimentales, el juego del café, la documentación técnica extensa y la bibliografía externa no forman parte de esta traducción. Las miniaturas originales se conservan, incluidos sus textos incrustados, y se añaden descripciones en español.

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

Este generador regenera las páginas españolas, las variantes de scripts, los botones SVG y el CSS a partir de los archivos originales. También añade los enlaces de idioma si no existen. Edita las traducciones de interfaz en `bash/spanish_strings.py`, los ajustes de generación en `bash/engl2es.py` y la ayuda en `info/*_es.html`. Las instrucciones de los juegos se incorporan a sus scripts desde esos HTML. No edites a mano los archivos generados.

Los cálculos de movimiento, las reglas de incorporación y los valores de los controles se conservan. Los identificadores de carretera y las coordenadas de depuración se ocultan inicialmente donde el escenario los activaba para depuración; los botones de la intersección permiten mostrarlos. El factor de cortesía se muestra sin unidades porque es adimensional. Los nombres y formatos de los archivos de datos exportados permanecen iguales.

## Comprobación manual

1. Abre la página y comprueba que los vehículos se mueven.
2. Pausa, continúa y reinicia la simulación.
3. Modifica el flujo, la velocidad de simulación y el número de carriles.
4. Pulsa seis veces el botón de información y comprueba cada tema.
5. Inicia una grabación y descarga los archivos de vehículos y detectores.
6. Cambia a inglés y alemán y vuelve a español.
7. Repite la revisión en una pantalla estrecha.
8. En el circuito circular, cambia densidad, separación mínima y desaceleración cómoda; abre y cierra el control de semáforos.
9. Prueba los menús de la intersección, las reglas de prioridad de la rotonda y la prohibición de adelantamientos de camiones en la pendiente.
10. Inicia los dos juegos y comprueba que las instrucciones, el diálogo de nombre y la tabla de resultados están en español.

Se conservan la autoría y la licencia del proyecto original; consulta `LICENSE`.
