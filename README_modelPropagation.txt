(jun19)
Beispiel Spurwechsel-DOS-Bug beim Uphill Scenario

(1) Initialisierung der Parameter
=================================

falls Default von control_gui.js nicht passend:

MOBIL_bBiasRight_truck=0.3;  (Variable definiert in control_gui.js)
Falls Slider, werden diese ebenfalls konsistent gesetzt:
slider_MOBIL_bBiasRight_truck.value=MOBIL_bBiasRight_truck;
slider_MOBIL_bBiasRight_truckVal.innerHTML=MOBIL_bBiasRight_truck
    +" m/s<sup>2</sup>";

Bei Neuklick auf Szenario-Symbol werden die Default von control_gui.js
und ggf die Ueberschreibung in <scenario>.js neu gelesen => reset

(1a) Uphill trucks: Dann bekommen die trucks bei
uphill.banIsActive=true das Modell LCModelMandatory. Die zugehoerigen
Parameter

var control_gui.MOBIL_mandat_bSafe=42;
var MOBIL_mandat_bias=42;
...

sind auf Default von control_gui.js gelassen


(2) Aenderung  der Parameter
============================

Ueber slider, z.B. control_gui.slider_MOBIL_bBiasRight_truck
=> aendert control_gui.MOBIL_bBiasRight_truck


(3) Fixe Modellparameter
========================

Alle nicht durch Slider etc GUI-aenderbaren Parameter, z.B.
var MOBIL_mandat_bSafe=42;
var MOBIL_mandat_bias=42;
control_gui.js => // fixed model parameters w/o sliders
Ausnahme, da Grafik:
vehicle.dt_LC=4;

(4) Uebertragung der Parameter auf die Standardmodelle:
======================================================

INFO: Alle 9 Standardmodelle (4 CF, 5 LC) sind in control_gui.js definiert,
da dies vor <scenario>.js gelesen wird.

Nur Spezialmodelle (innerhalb flow-conserving bottleneck, innerhalb
Ring-Segment des Kreisverkehrs etc) speziell in  <scenario>.js
definiert


control_gui.updateModels()

=> definiert/redefiniert alle Standardmodelle, die GUI-Aenderungen der
Parameter und auch Tempolimits fliessen ein

longModelCar=new ACC(control_gui-parameters)
longModelTruck=new ACC(...)
LCModelCar=new MOBIL(control_gui-parameters)
LCModelTruck=new MOBIL(...)
LCModelMandatory=new MOBIL(...)


control_gui.updateModelsUphill()

=> defines/redefines

longModelCarUphill
longModelTruckUphill (via Multiplikatoren der IDM-car parameter)
LCModelCarUphill=LCModelCar
LCModelTruckUphill=(banIsActive) ? LCModelMandatory : LCModelTruck


(5) Ausbreitung/Deployment der Modelle auf die einzelnen Fahrzeuge
==================================================================

// globally:
road.updateModelsOfAllVehicles(longModelCar,longModelTruck,
			       LCModelCar,LCModelTruck,
			       LCModelMandatory)

//locally, e.g., model *Uphill instead of *:
road.setCFModelsInRange(uBegin,uEnd,
			longModelCarUphill,longModelTruckUphill);
road.setLCModelsInRange(uBegin,uEnd,
			LCModelCarUphill,LCModelTruckUphill);
