#!/bin/bash

# creates German html and js files from all files containing 
# language-specific words" all html files, 
# the js/<proj>.js, js/<proj>_gui.js files, and the js/redirect.js file



#############################################
# (0) set path and select projects
#############################################

wd=$PWD
startDir=$HOME/versionedProjects/traffic-simulation-de
projects="ring onramp offramp roadworks routing"
#projects="ring"

cd $startDir

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
cp js/redirect.js js/redirect_ger.js
perl -i -p -e "s/\.html/_ger.html/g" js/redirect_ger.js

for proj in $projects; do
    
  htmlfile="${proj}.html"
  htmlfile_ger="${proj}_ger.html"

  # because ring szenario is starting point,
  # the html file is index.html instead of ring.html

  if [ "$proj" == "ring" ]; then
      htmlfile="index.html";
      htmlfile_ger="index_ger.html";
  fi
  echo  "project=${proj}, htmlfile_ger=$htmlfile_ger"

  # backup

  if test -f $htmlfile_ger; then cp $htmlfile_ger $backupdir; fi
  htmlfiles="$htmlfiles $htmlfile_ger"
  if test -f js/${proj}_ger.js; then cp js/${proj}_ger.js $backupdir/js; fi
  if test -f js/${proj}_gui_ger.js; then cp js/${proj}_gui_ger.js $backupdir/js; fi
  jsfiles="$jsfiles js/${proj}_ger.js js/${proj}_gui_ger.js"



  # copy engl->ger files and do project-specific replacements

  cp $htmlfile $htmlfile_ger
  cp js/${proj}.js js/${proj}_ger.js
  cp js/${proj}_gui.js  js/${proj}_gui_ger.js

  perl -i -p -e "s/redirect\.js/redirect_ger\.js/g" $htmlfile_ger
  perl -i -p -e "s/${proj}\.js/${proj}_ger.js/g" $htmlfile_ger
  perl -i -p -e "s/${proj}_gui\.js/${proj}_gui_ger.js/g" $htmlfile_ger

done

#############################################
# change html files
#############################################

echo "changing engl->german strings in some files ..."

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
  perl -i -p -e 's/Max Speed/Wunschgeschw./g' $file
  perl -i -p -e 's/Time Gap/Zeitluecke/g' $file
  perl -i -p -e 's/Min Gap/Mindestluecke/g' $file
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

cd $wd



