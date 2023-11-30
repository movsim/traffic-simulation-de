Lieber Herr Walz,


wir koennen gerne morgen (Mittwoch) gegen 13h telefonieren.


Generell kann man Ihre Idee mit einineg Tweaks bereits im jetztigen Simulator umsetzen. Dazu muss man nur die "trucks" als bisherige Autos umdefinieren und die Autos im Sinne Ihres Scooters "verkleinern". Dies kann man in den einzelnen Simulations-Szenarios, z.B. onramp.js oder onramp_ger.js, einstellen. Beachten Sie dabei, dass aus Darstellungsgruenden meine Autos und LKW laenger und vor allem breiter sind als in Wirklichkeit: Sonst wuerde man auf den zur Entwicklung einer Verkehrsflussdynamik auf Schnellstrassen mindestens  500 m langen Strassen kaum etwas sehen.


Da Sie auf eine Stadtsituation und nicht auf Verkehrsinstabilitaeten aus sind, koennen Sie die Strassenlaenge samt Autogroesse einfach herunterskalieren. Zur Strassenlaenge reduzieren Sie z.B. in onramp.js einfach die Variable refSizePhys, z.B.


var refSizePhys=100;


Das gibt die dargestellte physikalische Dimension von der oberen zur unteren Kante des Simulationsfensters an und skaliert alles proportional, ohne die Geometrie zu veraendern.
Sie sehen am Mauszeiger, dass nun die Strasse statt fast 700 m nur noch 280 m lang ist: 2 bis 3 Bloecke in der Stadt.


Dann verkleinern Sie die Autos und die Spurbreiten in onramp.js z.B. durch


var laneWidth=3.5; // also used for on/offramps
var car_length=3.0; // scooter
var car_width=2; // for visualisation, make it a bit wider than in reality
var truck_length=4.5; // trucks->cars
var truck_width=2.5;


Wenn Sie jetzt die Simulation lokal starten (onramp.html im Browser aufrufen, sehen Sie die Aenderungen. Um etwas zu sehen, muessen Sie nun den timelapse runterregeln (Sie haben ja die Strassen gekuerzt und damit die Skalierung verkleinert!) und die Geschwindigkeit auf Stadtgeschwindigkeit runterregeln. Erhoehen Sie am besten auch die Beschleunigung auf uebliche Stadtwerte, um 1.5 m/s^2. Nun setzten Sie noch interaktiv die zwei Ampeln auf die Strasse und sie haben eine vereinfachte Stadtstrassensimulation mit 2 Kreuzungen und einer groesseren Einfahrt (wenn Sie die Einfahrt nicht wollen, einfach Rampenfluss auf Null regeln).


Mit Hilfe des Reglers "Truck Perc" (der nun den Anteil gewoehnicher Autos angibt) koennen Sie nun den Anteil ihrer neuen Scooters regeln und sehen, wie sich der Verkerhsfluss aendert!
 


Die Datei kann ich nicht schicken, da Sie von allen Ihren Adressen
verweigert wird.

 
Zur lokalen Simulation muessen Sie den Simulator von meiner github-Seite runterladen, die dortige onramp.js-Datei durch diese hier ersetzen, auf das Directory mit den html files wechseln und onramp.html lokal aufrufen.


Sie koennen natuerlich auch die deutsche Version (Endungen _ger.html, _ger.js) nehmen, die werden bei mir allerdings automatisch erzeugt.


Mit freundlichen Grüßen,


 ----------------------------------------------------------
Dr. Martin Treiber
Institute for Transport & Economics, TU Dresden
Chair of Traffic Modelling, Econometrics, and Statistics
Falkenbrunnen, Room 123 (two floors up from the entrance!)
Würzburger Str. 35, D-01062 Dresden
martin@mtreiber.de
www.mtreiber.de
phone/fax: +49 (351) 463 36794 / 36809
---------------------------------------------------------


Christoph Walz <cwalz@xyte-mobility.com> hat am 23.11.2023 14:55 CET geschrieben:
 
 
Guten Tag Herr Treiber,
 
ich habe gerade online Ihre Verkehrssimulationen gesehen und ausprobiert. Das finde ich ziemlich cool, faszinierend und informativ.
 
Ich bin Kommunikationschef eines jungen Start-ups. Wir entwickeln ein Fahrzeug mit dem Platzbedarf eines Scooters und der Sicherheit eines Kleinwagens.
 
Inwieweit wäre es möglich, mit ihrer Simulationssoftware den Pendlerverkehr in zwei Szenerien zu vergleichen?
 
Szenario 1
Status quo, Berufsverkehr in einer Metropole auf einem Stau-geplagten Streckenabschnitt.
 
Szenario 2
Die 70–80 % der Fahrzeuge, die heute mit nur einer Person an Bord unterwegs sind werden durch ein Fahrzeug unserer neuen Fahrzeugklasse ersetzt.
 
Das ist natürlich ein Edge Case. Trotzdem würden wir uns sehr freuen, darstellen zu können, welchen Effekt es haben könnte wenn sich diese neue Art von Fahrzeug für Pendler als Standard durchsetzen würde.
 
Können wir dazu mal telefonieren?
 
Beste Grüße
Christoph Walz 


---
XYTE mobility

Christoph Walz
Head of communication
+49 179 9093745

xyte-mobility.com
