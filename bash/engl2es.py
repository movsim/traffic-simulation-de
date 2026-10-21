from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
def read(name):
    data = (root / name).read_bytes()
    try:
        return data.decode('utf-8')
    except UnicodeDecodeError:
        return data.decode('latin1')
def write(name, text):
    (root / name).parent.mkdir(parents=True, exist_ok=True)
    text = '\n'.join(line.rstrip() for line in text.splitlines()).rstrip() + '\n'
    text = re.sub(r'^[ \t]+', lambda match: match.group().expandtabs(8), text, flags=re.MULTILINE)
    (root / name).write_text(text, encoding='utf-8', newline='\n')

# Follow the project's existing generated German variants; retain the engine.
translations = {
 'Microsimulation of Traffic Flow: Onramp': 'Microsimulación de tránsito: incorporación',
 'Play Ramp-Metering Game': 'Juego de control de acceso (inglés)',
 '>Tests<': '>Pruebas (inglés)<',
 'Your browser does not support the HTML5 canvas tag.': 'Tu navegador no admite el elemento canvas de HTML5.',
 'Offline: sources at GitHub': 'Código fuente en GitHub',
 'Book "Traffic Flow Dynamics"': 'Libro "Traffic Flow Dynamics" (inglés)',
 'Buch "Verkehrsdynamik"': 'Libro "Verkehrsdynamik" (alemán)',
 'Traffic Flow and General': 'Flujo de tránsito y ajustes generales',
 'Car-Following Behavior': 'Seguimiento de vehículos',
 'Lane-Changing Behavior': 'Cambios de carril',
 '>Inflow<': '>Flujo de entrada<',
 'Onramp Flow': 'Flujo de incorporación',
 'Truck Perc': 'Porcentaje de camiones',
 'Timelapse': 'Velocidad de simulación',
 'Max Speed v</sub>0': 'Velocidad deseada v<sub>0</sub>',
 'Time Gap T': 'Intervalo de seguridad T',
 'Max Accel a': 'Aceleración máxima a',
 'Politeness': 'Factor de cortesía',
 'LC Threshold': 'Umbral de cambio',
 'Right Bias Cars': 'Preferencia por la derecha (autos)',
 'Right Bias Trucks': 'Preferencia por la derecha (camiones)',
}
html = read('onramp.html').replace('lang="en"', 'lang="es"').replace('charset=iso-8859-1', 'charset=utf-8')
html = html.replace('<a href="onramp_es.html" lang="es" style="display:block">Espa&#241;ol</a>', '')
for old, new in translations.items():
    assert old in html, old
    html = html.replace(old, new)
for name in ['redirect', 'timeView', 'control_gui', 'stationaryDetector', 'onramp', 'canvas_gui']:
    html = html.replace('js/' + name + '.js', 'js/' + name + '_es.js')
html = html.replace('<div id="header">', '<div id="header">Incorporación a la autopista')
html = html.replace('</head>', '    <link href="css/spanish.css" rel="stylesheet">\n</head>')
html = html.replace('<div id="infoFlags">', '<div id="infoFlags" aria-label="Idioma">\n<a href="onramp_es.html" lang="es" aria-current="page">Español</a>')
html = html.replace('src="figs/flagUSA.png"', 'alt="English" title="English" src="figs/flagUSA.png"').replace('src="figs/flagGerman.png"', 'alt="Deutsch" title="Deutsch" src="figs/flagGerman.png"')
icons = {'buttonStop3_small.png': ('stop_es.svg', 'Pausar'), 'buttonGo_small.png': ('go_es.svg', 'Continuar'), 'buttonRestart_small.png': ('restart_es.svg', 'Reiniciar'), 'iconDownloadStart_small.png': ('download_start_es.svg', 'Grabar datos'), 'iconDownloadFinish_small.png': ('download_finish_es.svg', 'Descargar')}
for old,(new,label) in icons.items():
    html = html.replace('src="figs/'+old+'"', 'alt="'+label+'" title="'+label+'" src="figs/'+new+'"')
for icon,label in {'infoBlue.png':'Ayuda: mostrar el siguiente tema', 'autobahn_plus.png':'Añadir un carril', 'autobahn_minus.png':'Quitar un carril', 'iconRing_small.jpg':'Circuito circular (inglés)', 'iconOnrampFig_small.jpg':'Incorporación a la autopista', 'iconOfframpFig_small.jpg':'Salida de autopista (inglés)', 'iconRoadworksFig_small.jpg':'Obras (inglés)', 'iconUphillFig_small.jpg':'Pendiente (inglés)', 'iconRoutingFig_small.jpg':'Rutas alternativas (inglés)', 'iconRoundabout_small.jpg':'Rotonda (inglés)', 'iconIntersection_small.jpg':'Intersección (inglés)', 'iconRampmeterFig_small.jpg':'Control de acceso (alemán)', 'colormap_grass.png':'Escala de colores de velocidad'}.items():
    html = html.replace('src="figs/'+icon+'"', 'alt="'+label+'" title="'+label+'" src="figs/'+icon+'"')
html = re.sub(r'(<td[^>]*>)([^<]+)(</td>\s*<td> <input id="([^"]+)" type="range")', r'\1<label for="\4">\2</label>\3', html)
html = html.replace('id="slider_IDM_v0"', 'aria-label="Velocidad deseada" id="slider_IDM_v0"')
write('onramp_es.html', html)
write('index_es.html', html)
for source in ['index.html','onramp.html','index_ger.html','onramp_ger.html']:
    data=(root/source).read_bytes()
    if b'href="onramp_es.html"' not in data:
        data=data.replace(b'<div id="infoFlags">', b'<div id="infoFlags">\n<a href="onramp_es.html" lang="es" style="display:block">Espa&#241;ol</a>')
    (root/source).write_bytes(data)

for name in ['redirect','timeView','control_gui','stationaryDetector','onramp','canvas_gui']:
    js=read('js/'+name+'.js')
    if name=='redirect': js=js.replace('"./onramp.html"','"./onramp_es.html"')
    if name=='timeView': js=js.replace('"Time="','"Tiempo="').replace('7*textsize','9*textsize')
    if name=='stationaryDetector': js=js.replace('"Flow: "','"Flujo: "').replace('"Speed: "','"Vel.: "')
    if name=='onramp':
        js=js.replace('" scale="','" escala="')
        js=js.replace('drawRoadIDs=true;', 'drawRoadIDs=false;').replace('var showCoords=true;', 'var showCoords=false;')
    if name=='canvas_gui': js=js.replace(': "free"', ': "libre"')
    if name=='control_gui':
        js=js.replace('scenarioString+".html"','scenarioString+"_es.html"')
        for topic in ['gui','IDM','MOBIL','BC','Numerics']:
            js=js.replace('info/info_'+topic+'.html','info/info_'+topic+'_es.html')
        js=js.replace('" times"','" veces"').replace('"wrote files "','"Se guardaron los archivos "').replace('" to default folder (Downloads)"','" en la carpeta de descargas"')
        # Politeness is dimensionless; preserve the numerical value and callback.
        js=re.sub(r'(slider_MOBIL_pVal.innerHTML\s*=\s*(?:MOBIL_p|this.value))\+" m/s<sup>2</sup>"', r'\1', js)
        for old,(new,label) in icons.items():
            element='document.getElementById("download")' if 'Download' in old else 'document.getElementById("startStop")'
            js=js.replace('"figs/'+old+'";', '"figs/'+new+'";\n    '+element+'.alt="'+label+'";\n    '+element+'.title="'+label+'";')
    write('js/'+name+'_es.js',js)
for new,label in icons.values():
    write('figs/'+new, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70"><rect x="2" y="2" width="156" height="66" rx="12" fill="#135b96" stroke="white" stroke-width="3"/><text x="80" y="43" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="white">'+label+'</text></svg>\n')
write('css/spanish.css', '''/* Longer Spanish labels must wrap inside the existing responsive layout. */
html[lang="es"] #sliders td:first-child { overflow-wrap: anywhere; }
html[lang="es"] #infoFlags > a:first-child { display: block; }
@media (min-aspect-ratio: 6/5) { html[lang="es"] #infoFlags { top: 90%; } }
@media (max-aspect-ratio: 6/5) { html[lang="es"] #infoFlags { top: 72vmin; } }
html[lang="es"] #infotext { text-align: left; }
html[lang="es"] #sliders table { width: 100%; table-layout: fixed; }
html[lang="es"] #sliders td:first-child { width: 44%; }
html[lang="es"] #sliders td:nth-child(2) { width: 36%; }
html[lang="es"] #sliders input[type=range] { width: 95%; }
html[lang="es"] #infotext { width: auto; box-sizing: border-box; }
@media (min-aspect-ratio: 6/5) {
  html[lang="es"] #contents { width: 70vw; }
  html[lang="es"] #sliders, html[lang="es"] #scenarios { left: 71vw; width: 28vw; }
  html[lang="es"] #laneMinusDiv { left: 41vw; }
  html[lang="es"] #lanePlusDiv { left: 47vw; }
  html[lang="es"] #startStopDiv { left: 53vw; }
  html[lang="es"] #restartDiv { left: 59vw; }
  html[lang="es"] #infoDiv { left: 65vw; width: 5vw; }
  html[lang="es"] #colorBox { left: 59vw; width: 10vw; }
  html[lang="es"] #infoFlags { left: 59vw; width: 10vw; }
  html[lang="es"] #downloadDiv { left: 53vw; width: 5vw; }
}
@media (max-aspect-ratio: 6/5) {
  html[lang="es"] #scenarios { left: 1vw; top: 82vmin; width: 98vw; }
  html[lang="es"] #sliders { left: 1vw; top: 128vmin; width: 98vw; }
}
''')
