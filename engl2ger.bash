#!/bin/bash

# creates German html and js files from all files containing 
# language-specific words" all html files, 
# the js/<proj>.js, js/<proj>_gui.js files, and the js/redirect.js file



#############################################
# (0) select projects
#############################################

projects="ring onramp offramp roadworks routing"
#projects="ring"


#############################################
# (1) copy the English files to German targets
#############################################

backupdir="backup`date +20%y_%m_%d`"
if test -d $backupdir; 
  then echo "notice: backupdir already exists"; 
  else mkdir $backupdir; mkdir $backupdir/js
fi
htmlfiles=""
jsfiles="js/redirect_ger.js"

cp js/redirect_ger.js $backupdir/js
cp  js/redirect.js js/redirect_ger.js

for proj in $projects; do

  # backup

  cp ${proj}_ger.html $backupdir
  htmlfiles="$htmlfiles ${proj}_ger.html"

  cp js/${proj}_ger.js $backupdir/js
  cp js/${proj}_gui_ger.js $backupdir/js
  jsfiles="$jsfiles js/${proj}_ger.js js/${proj}_gui_ger.js"

  # copy engl->ger files and do project-specific replacements

  cp ${proj}.html ${proj}_ger.html 
  cp js/${proj}.js js/${proj}_ger.js
  cp js/${proj}_gui.js  js/${proj}_gui_ger.js

  perl -i -p -e "s/redirect\.js/redirect_ger\.js/g" ${proj}_ger.html
  perl -i -p -e "s/${proj}\.js/${proj}_ger.js/g" ${proj}_ger.html
  perl -i -p -e "s/${proj}_gui\.js/${proj}_gui_ger.js/g" ${proj}_ger.html
  perl -i -p -e "s/${proj}\.html/${proj}_ger.html/g" js/redirect_ger.js

done

#############################################
# change html files
#############################################

for file in $htmlfiles; do


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
  perl -i -p -e 's/Offramp Use/Anteil abfahrend/g' $file
  perl -i -p -e 's/Deviation Use/Anteil Umleitung/g' $file
  perl -i -p -e 's/Desired Speed/Wunschgeschw./g' $file
  perl -i -p -e 's/Time Gap/Zeitluecke/g' $file
  perl -i -p -e 's/Minimum Gap/Mindestluecke/g' $file
  perl -i -p -e 's/Max Acceleration/Max Beschleun/g' $file
  perl -i -p -e 's/Comf Deceleration/Komfort Verzoeg/g' $file
  perl -i -p -e 's/Comfort Decel/Komfort Verzoeg/g' $file
  perl -i -p -e 's/veh\/h/Fz\/h/g' $file
done


#############################################
# change js files (incl link targets in redirect.js)
#############################################

for file in "$jsfiles"; do
  perl -i -p -e 's/times\"/fach\"/g' $file
  perl -i -p -e 's/lane\"/Spur\"/g' $file
  perl -i -p -e 's/\" veh/\" Fz/g' $file
  perl -i -p -e 's/pixels/Pixel/g' $file

  perl -i -p -e 's/\"Time=/\"Zeit=/g' $file
  perl -i -p -e 's/\"timewarp=/\"Zeitraffer=/g' $file
  perl -i -p -e 's/\"density=/\"Dichte=/g' $file
  perl -i -p -e 's/\"scale=/\"Skala=/g' $file
  perl -i -p -e 's/\"truckFrac=/\"LKW-Anteil=/g' $file
done


