from pathlib import Path
import re
import sys
sys.dont_write_bytecode = True
from spanish_strings import SCENARIOS, UI, JS

root = Path(__file__).resolve().parents[1]

def read(name):
    data = (root / name).read_bytes()
    try:
        return data.decode('utf-8')
    except UnicodeDecodeError:
        return data.decode('latin1')

def flag_links(html):
    """Use equally sized flag icons without changing language destinations."""
    def replace(match):
        block = match[0].replace(' style="display:block"', '')
        block = re.sub(r'>(?:Español|Espa&#241;ol)</a>', '><img src="figs/flagSpain.svg" alt="Espa&#241;ol" title="Espa&#241;ol" width="27%"></a>', block)
        block = block.replace('>Deutsch</a>', '><img src="figs/flagGerman.png" alt="Deutsch" title="Deutsch" width="27%"></a>')
        return block.replace('width="45%"', 'width="27%"')
    return re.sub(r'<div id="infoFlags"[^>]*>.*?</div>', replace, html, flags=re.S)

def write(name, text):
    if name.endswith(".html"):
        text = flag_links(text)
    text = '\n'.join(line.rstrip() for line in text.splitlines()).rstrip() + '\n'
    text = re.sub(r'^[ \t]+', lambda m: m.group().expandtabs(8), text, flags=re.MULTILINE)
    (root / name).write_text(text, encoding='utf-8', newline='\n')

def translate(text, catalog):
    # Longest keys first: e.g. Total Inflow before Inflow.
    for old in sorted(catalog, key=len, reverse=True):
        text = text.replace(old, catalog[old])
    return text

icons = {
    'buttonStop3_small.png': ('stop_es.svg', 'Pausar'),
    'buttonGo_small.png': ('go_es.svg', 'Continuar'),
    'buttonRestart_small.png': ('restart_es.svg', 'Reiniciar'),
    'iconDownloadStart_small.png': ('download_start_es.svg', 'Grabar datos'),
    'iconDownloadFinish_small.png': ('download_finish_es.svg', 'Descargar'),
}
common = ['redirect', 'timeView', 'control_gui', 'stationaryDetector', 'canvas_gui', 'TrafficLightControlEditor']
scripts = common + list(SCENARIOS) + ['routingGameInfo', 'rampMeteringGameInfo']
alt = {
    'infoBlue.png': 'Ayuda: mostrar el siguiente tema', 'autobahn_plus.png': 'Añadir un carril',
    'autobahn_minus.png': 'Quitar un carril', 'iconRing_small.jpg': 'Circuito circular',
    'iconOnrampFig_small.jpg': 'Incorporación a la autopista', 'iconOfframpFig_small.jpg': 'Salida de autopista',
    'iconRoadworksFig_small.jpg': 'Obras', 'iconUphillFig_small.jpg': 'Pendiente',
    'iconRoutingFig_small.jpg': 'Rutas alternativas', 'iconRoundabout_small.jpg': 'Rotonda',
    'iconIntersection_small.jpg': 'Intersección', 'iconRampmeterFig_small.jpg': 'Control de acceso',
    'colormap_grass.png': 'Escala de colores de velocidad',
}

for scenario, title in SCENARIOS.items():
    source = scenario + ('_ger' if scenario.endswith('BaWue') else '') + '.html'
    html = read(source)
    html = re.sub(r'<a href="\w+_es.html" lang="es"[^>]*>.*?</a>', '', html)
    html = re.sub(r'lang="(?:en|de)"', 'lang="es"', html)
    if 'lang="es"' not in html:
        html = html.replace('<html>', '<html lang="es">')
    html = html.replace('charset=iso-8859-1', 'charset=utf-8')
    if scenario.endswith('Game'):
        html = html.replace('<body>', '<body class="spanish-game">')
    html = html.replace('onclick="handleClick(event)" <!-- only for slowing down vehs-->', 'onclick="handleClick(event)"')
    if scenario.endswith('BaWue'):
        html = html.replace('info/info_OnRamp_BaWue_ger.html', 'info/info_OnRamp_BaWue_es.html').replace('info/info_RoadWorks_BaWue_ger.html', 'info/info_RoadWorks_BaWue_es.html')
    html = re.sub(r'<title>.*?</title>', '<title>Microsimulación de tránsito: '+title+'</title>', html, flags=re.S)
    html = translate(html, UI).replace('v</sub>0', 'v<sub>0</sub>').replace('s</sub>0', 's<sub>0</sub>')
    html = html.replace('</head>', '<link href="css/spanish.css" rel="stylesheet">\n</head>')
    for script in scripts:
        html = re.sub(r'js/'+re.escape(script)+r'(?:_ger)?\.js', 'js/'+script+'_es.js', html)
    # Preserve EN/DE flag targets; all navigation callbacks use redirect_es.js.
    html = html.replace('<div id="infoFlags">', '<div id="infoFlags" aria-label="Idioma">\n<a href="'+scenario+'_es.html" lang="es" aria-current="page">Español</a>')
    if 'id="infoFlags"' not in html:
        html = html.replace('</body>', '<div id="infoFlags" aria-label="Idioma"><a href="'+scenario+'_es.html" aria-current="page">Español</a> <a href="'+source+'" lang="de">Deutsch</a> <a href="index_es.html">Inicio</a></div>\n</body>')
    html = html.replace('src="figs/flagUSA.png"', 'alt="English" title="English" src="figs/flagUSA.png"')
    html = html.replace('src="figs/flagGerman.png"', 'alt="Deutsch" title="Deutsch" src="figs/flagGerman.png"')
    for old, (new, label) in icons.items():
        html = html.replace('src="figs/'+old+'"', 'alt="'+label+'" title="'+label+'" src="figs/'+new+'"')
    for icon, label in alt.items():
        html = html.replace('src="figs/'+icon+'"', 'alt="'+label+'" title="'+label+'" src="figs/'+icon+'"')
    # Localize the inline intersection instructions as well as the AJAX panel.
    if scenario == 'intersection':
        html = re.sub(r'(<div id="infotext">).*?(</div>)', lambda m: m[1]+read('info/info_Intersection_es.html')+m[2], html, flags=re.S)
    # Associate every slider with its translated label, including subscript text.
    def label_slider(match):
        return match[1]+'<label for="'+match[4]+'">'+match[2]+'</label>'+match[3]
    html = re.sub(r'(<td[^>]*>)([^\n]*?)(</td>\s*<td>\s*<input id="([^"]+)" type="range")', label_slider, html)
    write(scenario+'_es.html', html)
    if scenario == 'onramp':
        write('index_es.html', html)
    for original in [source, scenario+'_ger.html'] + (['index.html', 'index_ger.html'] if scenario=='onramp' else []):
        if not (root/original).exists():
            continue
        data=(root/original).read_bytes()
        target=(scenario+'_es.html').encode()
        if target not in data:
            data=data.replace(b'<div id="infoFlags">', b'<div id="infoFlags">\n<a href="'+target+b'" lang="es" style="display:block">Espa&#241;ol</a>')
        data = flag_links(data.decode("latin1")).encode("latin1")
        (root/original).write_bytes(data)

for name in scripts:
    # Game instructions are human-translated HTML, embedded as a JS string.
    if name.endswith('GameInfo'):
        import json
        write('js/'+name+'_es.js', 'var infoString='+json.dumps(read('info/info_'+name[:-4]+'_es.html'), ensure_ascii=False)+';')
        continue
    js=read('js/'+name+'.js')
    js=translate(js, JS)
    if name=='redirect':
        for scenario in SCENARIOS:
            js=js.replace('./'+scenario+('_ger' if scenario.endswith('BaWue') else '')+'.html', './'+scenario+'_es.html')
    if name=='timeView':
        js=js.replace('"Time="', '"Tiempo="').replace('7*textsize', '9*textsize')
    if name=='stationaryDetector':
        js=js.replace('"Flow: "', '"Flujo: "').replace('"Speed: "', '"Vel.: "')
    if name in SCENARIOS:
        js=js.replace('" scale="', '" escala="').replace('drawRoadIDs=true;', 'drawRoadIDs=false;').replace('var showCoords=true;', 'var showCoords=false;')
        js=js.replace('" Fz/h"', '" veh/h"').replace('"times"', '" veces"').replace('" times"', '" veces"')
    if name=='canvas_gui':
        js=js.replace(': "free"', ': "libre"')
    if name=='control_gui':
        js=js.replace('scenarioString+".html"', 'scenarioString+"_es.html"')
        for topic in ['gui','IDM','MOBIL','BC','Numerics']:
            js=js.replace('info/info_'+topic+'.html', 'info/info_'+topic+'_es.html')
        js=js.replace('" times"', '" veces"').replace('"wrote files "', '"Se guardaron los archivos "').replace('" to default folder (Downloads)"', '" en la carpeta de descargas"')
        js=re.sub(r'(slider_MOBIL_pVal.innerHTML\s*=\s*(?:MOBIL_p|this.value))\+" m/s<sup>2</sup>"', r'\1', js)
        for old,(new,label) in icons.items():
            element='document.getElementById("download")' if 'Download' in old else 'document.getElementById("startStop")'
            js=js.replace('"figs/'+old+'";', '"figs/'+new+'";\n    '+element+'.alt="'+label+'";\n    '+element+'.title="'+label+'";')
    write('js/'+name+'_es.js',js)

for new,label in icons.values():
    write('figs/'+new, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70"><rect x="2" y="2" width="156" height="66" rx="12" fill="#135b96" stroke="white" stroke-width="3"/><text x="80" y="43" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="white">'+label+'</text></svg>')


write('css/spanish.css', '''/* Longer Spanish labels must wrap inside the existing responsive layout. */
html[lang="es"] #sliders td:first-child { overflow-wrap: anywhere; }
@media (min-aspect-ratio: 6/5) { html[lang="es"] #infoFlags { top: 90%; } }
@media (max-aspect-ratio: 6/5) { html[lang="es"] #infoFlags { top: 72vmin; } }
html[lang="es"] #infotext { text-align: left; }
html[lang="es"] #sliders table { width: 100%; table-layout: fixed; }
html[lang="es"] #sliders td:first-child { width: 44%; }
html[lang="es"] #sliders td:nth-child(2) { width: 36%; }
html[lang="es"] #sliders input[type=range] { width: 95%; }
html[lang="es"] #infotext { width: auto; box-sizing: border-box; }
html[lang="es"] canvas { max-width: 100%; box-sizing: border-box; }
html[lang="es"] .spanish-game [id^="sliders"] table { width: 100%; table-layout: fixed; }
html[lang="es"] .spanish-game [id^="sliders"] input { width: 90%; }
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
  html[lang="es"] #infotext { position: relative; top: 0; left: 0; width: 100%; }
  html[lang="es"] #editTLdiv { left: 2vw; top: 13vmin; width: 45vw; }
  html[lang="es"] .spanish-game #contents { width: 100vw; height: 60vw; }
  html[lang="es"] .spanish-game button,
  html[lang="es"] .spanish-game td { font-size: 13px; }
  html[lang="es"] .spanish-game #infoFlags { top: 61vmin; left: 72vw; width: 26vw; font-size: 12px; }
  html[lang="es"] .spanish-game #gameRoutingDiv,
  html[lang="es"] .spanish-game #gameRampMeteringDiv { left: 2vw; top: 76vmin; width: 46vw; height: auto; }
  html[lang="es"] .spanish-game #playlinksRoutingGame,
  html[lang="es"] .spanish-game #playlinksRampMeteringGame { left: 51vw; top: 76vmin; width: 47vw; height: auto; }
  html[lang="es"] .spanish-game #sliderMainRoutingGame { left: 2vw; top: 102vmin; width: 96vw; }
  html[lang="es"] .spanish-game #sliderMainRoutingGame td { font-size: 14px; }
  html[lang="es"] .spanish-game #sliderMainRoutingGame input { width: 55vw; }
  html[lang="es"] .spanish-game #impressum { top: 61vmin; left: 2vw; width: 65vw; font-size: 11px; }
  html[lang="es"] .spanish-game #slidersRoutingGame,
  html[lang="es"] .spanish-game #slidersRampMeteringGame { left: 2vw; top: 124vmin; width: 96vw; height: auto; }
  html[lang="es"] .spanish-game #infotextRoutingGame,
  html[lang="es"] .spanish-game #infotextRampMeteringGame { left: 2vw; top: 158vmin; width: 96vw; height: auto; box-sizing: border-box; font-size: 14px; padding: 12px; }
  html[lang="es"] .spanish-game #infotextRoutingGame h2,
  html[lang="es"] .spanish-game #infotextRampMeteringGame h2 { font-size: 18px; }
}
''')
