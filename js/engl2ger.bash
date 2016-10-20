#!/bin/bash

if (($#==0)); then
 echo "replaces some english texts by German text in html and js files"
 echo "of traffic-simulation.de"
 echo "Usage: engl2ger.bash <files> ";
 echo ""; echo "example ring:"
 echo " cp ../ring.html ../ring_ger.html"
 echo " cp ring.js ring_ger.js"
 echo " cp ring_gui.js ring_gui_ger.js"
 echo " cp redirect.js redirect_ger.js"
 echo " engl2ger.bash ../ring_ger.html ring_ger.js ring_gui_ger.js redirect_ger.js"
 echo ""; echo "example onramp:"
 echo " cp ../onramp.html ../onramp_ger.html"
 echo " cp onramp.js onramp_ger.js"
 echo " cp onramp_gui.js onramp_gui_ger.js"
 echo " cp redirect.js redirect_ger.js"
 echo " engl2ger.bash ../onramp_ger.html onramp_ger.js onramp_gui_ger.js redirect_ger.js"
 echo ""
 #echo "redirect.js and the html files are treated always"
 exit
fi

# change link targets

projects="ring onramp offramp roadworks"
for proj in $projects; do
  perl -i -p -e "s/redirect\.js/redirect_ger\.js/g" ../${proj}_ger.html
  perl -i -p -e "s/${proj}\.js/${proj}_ger.js/g" ../${proj}_ger.html
  perl -i -p -e "s/${proj}_gui\.js/${proj}_gui_ger.js/g" ../${proj}_ger.html
  perl -i -p -e "s/${proj}\.html/${proj}_ger.html/g" redirect_ger.js
done


for file in "$@"; do
  perl -i -p -e 's/times\"/fach\"/g' $file
  perl -i -p -e 's/lane\"/Spur\"/g' $file
  perl -i -p -e 's/\" veh/\" Fz/g' $file
  perl -i -p -e 's/pixels/Pixel/g' $file

  perl -i -p -e 's/\"Time=/\"Zeit=/g' $file
  perl -i -p -e 's/\"timewarp=/\"Zeitraffer=/g' $file
  perl -i -p -e 's/\"density=/\"Dichte=/g' $file
  perl -i -p -e 's/\"scale=/\"Skala=/g' $file
  perl -i -p -e 's/\"truckFrac=/\"LKW-Anteil=/g' $file

  # html files

  perl -i -p -e 's/\>Ringroad\</>Ringstrasse</g' $file
  perl -i -p -e 's/de\: Ring Road/de: Ringstrasse/g' $file
  perl -i -p -e 's/\>Onramp\</>Auffahrt</g' $file
  perl -i -p -e 's/de\: Onramp/de: Auffahrt/g' $file
  perl -i -p -e 's/\>Offramp\</>Abfahrt</g' $file
  perl -i -p -e 's/de\: Offramp/de: Abfahrt/g' $file
  perl -i -p -e 's/\>Road Works\</>Baustelle</g' $file
  perl -i -p -e 's/de\: Road Works/de: Baustelle/g' $file
  perl -i -p -e 's/\>Resume\</>Weiter</g' $file
  perl -i -p -e 's/\>Timewarp\</>Zeitraffer</g' $file
  perl -i -p -e 's/\>Density\</>Dichte</g' $file
  perl -i -p -e 's/\>Scale\</>Skala</g' $file

  perl -i -p -e 's/Truck Fraction/LKW-Anteil/g' $file
  perl -i -p -e 's/Inflow/Hauptzufluss/g' $file
  perl -i -p -e 's/Onramp Flow/Rampenzufluss/g' $file
  perl -i -p -e 's/Offramp use/Anteil abfahrend/g' $file
  perl -i -p -e 's/Desired Speed/Wunschgeschw./g' $file
  perl -i -p -e 's/Time Gap/Zeitluecke/g' $file
  perl -i -p -e 's/Minimum Gap/Mindestluecke/g' $file
  perl -i -p -e 's/Max Acceleration/Max Beschleun/g' $file
  perl -i -p -e 's/Comf Deceleration/Komfort Verzoeg/g' $file
  perl -i -p -e 's/Comfort Decel/Komfort Verzoeg/g' $file
  perl -i -p -e 's/veh\/h/Fz\/h/g' $file

done