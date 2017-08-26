#!/bin/bash


# creates German html and js files from all files containing 
# language-specific words" all html files, 
# the js/<proj>.js, and all dependent js files



#############################################
# (0) set path and select projects
#############################################

wd=$PWD
startDir=$HOME/versionedProjects/traffic-simulation-de
projects="ring onramp offramp roadworks uphill routing"
#projects="ring"

cd $startDir

#############################################
# (1) copy the English files to German targets
#############################################

#backupdir="backup`date +20%y_%m_%d`"
#if test -d $backupdir; 
#  then echo "notice: backupdir already exists"; 
#  else mkdir $backupdir; mkdir $backupdir/js
#fi
#cp js/redirect_ger.js $backupdir/js




# copy+change strings for German version of control js files

cp js/redirect.js js/redirect_ger.js
perl -i -p -e "s/\.html/_ger.html/g" js/redirect_ger.js

cp js/control_gui.js js/control_gui_ger.js
perl -i -p -e "s/\.html/_ger.html/g" js/control_gui_ger.js


# copy+change strings for project-specific German js and html files 

htmlfilesGer=""

jsfilesGer="js/timeView_ger.js js/stationaryDetector_ger.js"
cp js/timeView.js js/timeView_ger.js 
cp js/stationaryDetector.js js/stationaryDetector_ger.js 


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

  #  if test -f $htmlfile_ger; then cp $htmlfile_ger $backupdir; fi
  #  if test -f js/${proj}_ger.js; then cp js/${proj}_ger.js $backupdir/js; fi



  cp $htmlfile $htmlfile_ger
  htmlfilesGer="$htmlfilesGer $htmlfile_ger"

  # the following change cmd needs $proj$, 
  # therefore here, not at the change block
  perl -i -p -e "s/${proj}\.js/${proj}_ger.js/g" $htmlfile_ger


  cp js/${proj}.js js/${proj}_ger.js
  jsfilesGer="$jsfilesGer js/${proj}_ger.js"


done


#############################################
# change html files
#############################################

echo "changing engl->german strings in some files ..."

for file in $htmlfilesGer; do

   # change links to js files

  perl -i -p -e "s/redirect\.js/redirect_ger\.js/g" $file
  perl -i -p -e "s/control_gui\.js/control_gui_ger.js/g" $file
  perl -i -p -e "s/timeView\.js/timeView_ger.js/g" $file
  perl -i -p -e "s/stationaryDetector\.js/stationaryDetector_ger.js/g" $file

  # change text

  perl -i -p -e 's/\>Ringroad\</>Ringstrasse</g' $file
  perl -i -p -e 's/de\: Ring Road/de: Ringstrasse/g' $file
  perl -i -p -e 's/\>Onramp\</>Auffahrt</g' $file
  perl -i -p -e 's/de\: Onramp/de: Auffahrt/g' $file
  perl -i -p -e 's/\>Offramp\</>Abfahrt</g' $file
  perl -i -p -e 's/de\: Offramp/de: Abfahrt/g' $file
  perl -i -p -e 's/\>Road Works\</>Baustelle</g' $file
  perl -i -p -e 's/\>RoadWorks\</>Baustelle</g' $file
  perl -i -p -e 's/\>Uphill\</>Steigung</g' $file
  perl -i -p -e 's/de\: Road Works/de: Baustelle/g' $file
  perl -i -p -e 's/\>Resume\</>Weiter</g' $file
  perl -i -p -e 's/\>Disturb Traffic\</>St&ouml;re Verkehr</g' $file
  perl -i -p -e 's/\>Timewarp\</>Zeitraffer</g' $file
  perl -i -p -e 's/\>Density\</>Dichte</g' $file
  perl -i -p -e 's/\>Density\/lane\</>Dichte\/Spur</g' $file
  perl -i -p -e 's/\>Scale\</>Skala</g' $file

  perl -i -p -e 's/Traffic_Flow_and_General\.png\" width=\"65\%\"/Verkehrsfluss\.png\" width=\"40\%\"/g' $file
  perl -i -p -e 's/Car-Following_Behavior\.png\" width=\"60\%\"/Fahrstil-Parameter\.png\" width=\"55\%\"/g' $file
  perl -i -p -e 's/Lane-Changing_Behavior\.png\" width=\"60\%\"/Spurwechsel-Parameter\.png\" width=\"65\%\"/g' $file

  perl -i -p -e 's/Truck Fraction/LKW-Anteil/g' $file
  perl -i -p -e 's/Truck Perc/LKW-Anteil/g' $file
  perl -i -p -e 's/LC Threshold/Wechselschwelle/g' $file
  perl -i -p -e 's/Right Bias Cars/Rechtsfahren PKW/g' $file
  perl -i -p -e 's/Right Bias Trucks/Rechtsfahren LKW/g' $file
  perl -i -p -e 's/Inflow/Hauptzufluss/g' $file
  perl -i -p -e 's/Onramp Flow/Rampenzufluss/g' $file
  perl -i -p -e 's/Offramp Use/Anteil abfahrend/g' $file
  perl -i -p -e 's/Deviation Use/Anteil Umleitung/g' $file
  perl -i -p -e 's/Max Speed/Wunschgeschw./g' $file
  perl -i -p -e 's/Speed Limit/Tempolimit/g' $file
  perl -i -p -e 's/Uphill Truck Speed/V<sub>0<\/sub>\(LKW\) \@Steigung/g' $file
  perl -i -p -e 's/Uphill Truck/V<sub>0<\/sub>\(LKW\) \@Steigung/g' $file
  perl -i -p -e 's/\>Speed\<//g' $file
  perl -i -p -e 's/Time Gap/Zeitl&uuml;cke/g' $file
  perl -i -p -e 's/Min Gap/Mindestl&uuml;cke/g' $file
  perl -i -p -e 's/Max Acceleration/Max Beschleun/g' $file
  perl -i -p -e 's/Max Accel/Max Beschl/g' $file
  perl -i -p -e 's/Comf Deceleration/Komfort Verzoeg/g' $file
  perl -i -p -e 's/Comfort Decel/Komfort Verz\./g' $file
  perl -i -p -e 's/Comf Decel/Komfort Verz\./g' $file
  perl -i -p -e 's/veh\/h/Fz\/h/g' $file
done

perl -i -p -e 's/Enforce Truck Overtaking Ban/Aktiviere LKW &Uuml;berholverbot/g' uphill_ger.html

perl -i -p -e 's/Play Routing Game/Starte Navigationsspiel/g' routing_ger.html


#############################################
# change js files (incl link targets in redirect.js)
#############################################

#jsfiles="js/redirect_ger.js js/${proj}_ger.js"

echo "jsfilesGer=$jsfilesGer"
for file in "$jsfilesGer"; do

  perl -i -p -e 's/times\"/fach\"/g' $file
  perl -i -p -e 's/lane\"/Spur\"/g' $file
  perl -i -p -e 's/\" veh/\" Fz/g' $file
  perl -i -p -e 's/pixels/Pixel/g' $file


  perl -i -p -e 's/\"Resume\"/\"Weiter\"/g' $file
  perl -i -p -e 's/\"Time\=/\"Zeit=/g' $file
  perl -i -p -e 's/\"Flow/\"Fluss/g' $file
  perl -i -p -e 's/\"Speed/\"Geschw/g' $file
  perl -i -p -e 's/\"timewarp=/\"Zeitraffer=/g' $file
  perl -i -p -e 's/\"density=/\"Dichte=/g' $file
  perl -i -p -e 's/\"scale=/\"Skala=/g' $file
  perl -i -p -e 's/\"truckFrac=/\"LKW-Anteil=/g' $file
done

perl -i -p -e 's/\"Lift Truck Overtaking Ban\"/\"Hebe LKW &Uuml;berholverbot auf\"/g' js/uphill_ger.js

perl -i -p -e 's/info_routimgGame\.html/info_routimgGame_ger.html/g' js/control_gui_ger.js

cd $wd
