#!/bin/bash


# creates German html and js files from all files containing 
# language-specific words" all html files, 
# the js/<proj>.js, and all dependent js files

# !!! also sets the current main simulation shown as the index*.html files

indexProject="onramp" # !!!  sets the current main simulation 

#############################################
# (0) set path and select projects
#############################################

wd=$PWD
startDir=$HOME/versionedProjects/traffic-simulation-de
#test* projects do NOT have a translation
projects="ring onramp onramp_scooters offramp roadworks uphill routing routingGame rampMeteringGame roundabout intersection"
#test1_straightRoad test2_bottleneck test3_moreComplexNetwork test4_doubleLoop test5_golfCourse"


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
# (undo changes for BaWue files which are only in German, i.e., 
# *_ger already in engl redirect)

cp js/redirect.js js/redirect_ger.js
perl -i -p -e "s/\.html/_ger.html/g" js/redirect_ger.js
perl -i -p -e "s/_ger_ger/_ger/g" js/redirect_ger.js

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
  echo  "project=${proj}, htmlfile_ger=$htmlfile_ger"

  cp $htmlfile $htmlfile_ger
  htmlfilesGer="$htmlfilesGer $htmlfile_ger"

  # the following change cmd needs $proj$, 
  # therefore here, not at the change block

  perl -i -p -e "s/${proj}\.js/${proj}_ger.js/g" $htmlfile_ger
  perl -i -p -e "s/${proj}Info\.js/${proj}Info_ger.js/g" $htmlfile_ger

  # do not need BaWue files here, since they are originally in German
  # do not copy *Info*.js files since they are translated by hand!!
  
  cp js/${proj}.js js/${proj}_ger.js
  jsfilesGer="$jsfilesGer js/${proj}_ger.js"
done
jsfilesGer="$jsfilesGer js/control_gui_ger.js"



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

  # change <title>Titeltext</title> and slider <td>tittle</td>
  

  perl -i -p -e 's/Intersection\</Kreuzung</g' $file
  perl -i -p -e 's/Roundabout\</Kreisverkehr</g' $file
  perl -i -p -e 's/de\: Roundabout/de: Kreisverkehr/g' $file
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
  perl -i -p -e 's/Main flow/Hauptfluss/g' $file
  perl -i -p -e 's/Ramp flow/Rampenfluss/g' $file
  perl -i -p -e 's/\(info\)/\(Info\)/g' $file
  perl -i -p -e 's/\>Timewarp\</>Zeitraffer</g' $file
  perl -i -p -e 's/\>Density\</>Dichte</g' $file
  perl -i -p -e 's/\>Density\/lane\</>Dichte\/Spur</g' $file
  perl -i -p -e 's/\>Scale\</>Skala</g' $file

  perl -i -p -e 's/Traffic Flow and General/Verkehrsfl&uuml;sse und Allgemeines/g' $file
  perl -i -p -e 's/Car-Following Behavior/Fahrzeugfolge-Verhalten/g' $file
  perl -i -p -e 's/Lane-Changing Behavior/Spurwechsel-Verhalten/g' $file


  perl -i -p -e 's/Ring has Priority/normale Vorfahrtsregeln/g' $file
  perl -i -p -e 's/Arms have Priority/Rechts vor Links/g' $file
  perl -i -p -e 's/First Come First Served/gleichberechtigt/g' $file
  perl -i -p -e 's/Only Straight Ahead/nur geradeaus/g' $file
  perl -i -p -e 's/Only to the Right/nur Rechtsabbieger/g' $file
  perl -i -p -e 's/Only to the Left/nur Linksabbieger/g' $file
  perl -i -p -e 's/All Directions/alle Richtungen/g' $file



  perl -i -p -e 's/Traffic_Flow_and_General\.png\" width=\"65\%\"/Verkehrsfluss\.png\" width=\"40\%\"/g' $file
  perl -i -p -e 's/Car-Following_Behavior\.png\" width=\"60\%\"/Fahrstil-Parameter\.png\" width=\"55\%\"/g' $file
  perl -i -p -e 's/Lane-Changing_Behavior\.png\" width=\"60\%\"/Spurwechsel-Parameter\.png\" width=\"65\%\"/g' $file



  # change further text in German html

  perl -i -p -e 's/Play Ramp-Metering Game/Gehe zu Zufluss-dosierungs-Spiel/g' $file
  perl -i -p -e 's/Traffic Rules/Verkehrsregeln/g' $file
  perl -i -p -e 's/Horizontal Priority/Haupt\/Nebenstra&szlig;e/g' $file
  perl -i -p -e 's/Right Priority/Rechts vor Links/g' $file
  perl -i -p -e 's/Signalized/Ampelsteuerung/g' $file
  perl -i -p -e 's/Number of Lanes/Zahl der Spuren/g' $file
  perl -i -p -e 's/1 main\, 1 secondary lane/Haupt\/Nebenstra&szlig;e je eine Spur/g' $file
  perl -i -p -e 's/2 main\, 1 secondary lanes/Haupt\/Nebenstra&szlig;e 2\/1 Spuren/g' $file
  perl -i -p -e 's/3 main\, 1 secondary lanes/Haupt\/Nebenstra&szlig;e 3\/1 Spuren/g' $file
  perl -i -p -e 's/3 main\, 2 secondary lanes/Haupt\/Nebenstra&szlig;e 3\/2 Spuren/g' $file
  perl -i -p -e 's/3 main\, 3 secondary lanes/Haupt\/Nebenstra&szlig;e 3\/3 Spuren/g' $file
  perl -i -p -e 's///g' $file
  perl -i -p -e 's///g' $file
  perl -i -p -e 's///g' $file
  perl -i -p -e 's///g' $file
  perl -i -p -e 's///g' $file
  perl -i -p -e 's///g' $file
  perl -i -p -e 's///g' $file
  perl -i -p -e 's///g' $file
  perl -i -p -e 's///g' $file
  
  perl -i -p -e 's/Truck Fraction/LKW-Anteil/g' $file
  perl -i -p -e 's/Truck Perc/LKW-Anteil/g' $file
  perl -i -p -e 's/Scooter Fraction/Scooter-Anteil/g' $file
  perl -i -p -e 's/Scooter Perc/Scooter-Anteil/g' $file
  perl -i -p -e 's/Politeness/H&ouml;flichkeitsfaktor/g' $file
  perl -i -p -e 's/LC Threshold/Wechselschwelle/g' $file
  perl -i -p -e 's/Right Bias Cars/Rechtsfahren PKW/g' $file
  perl -i -p -e 's/Right Bias Trucks/Rechtsfahren LKW/g' $file
  perl -i -p -e 's/Total Inflow/Gesamtnachfrage/g' $file
  perl -i -p -e 's/Mainroad Perc/Hauptstra&szlig;enanteil/g' $file
  perl -i -p -e 's/Percentage Right/Rechtsabbieger/g' $file
  perl -i -p -e 's/Percentage Left/Linksabbieger/g' $file
  perl -i -p -e 's/Secondary Inflow/Nebenzufluss/g' $file 
  perl -i -p -e 's/Main Inflow/Hauptzufluss/g' $file 
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
  perl -i -p -e 's/\"times\"/\"-fach\"/g' $file

done

perl -i -p -e 's/Enforce Truck Overtaking Ban/Aktiviere LKW &Uuml;berholverbot/g' uphill_ger.html js/control_gui_ger.js
perl -i -p -e 's/\"Lift Truck Overtaking Ban\"/\"Hebe LKW &Uuml;berholverbot auf\"/g' js/control_gui_ger.js

perl -i -p -e 's/Play Routing Game/Starte Navigationsspiel/g' routing_ger.html routingGame_ger.html

perl -i -p -e 's/Play Ramp-Metering Game/Starte Zufluss-dosierungs-Spiel/g' onramp_ger.html rampMeteringGame_ger.html

# Targets for link to "traffic-simulation.de"

perl -i -p -e 's/routing\.html/routing_ger.html/g' routingGame_ger.html
perl -i -p -e 's/onramp\.html/onramp_ger.html/g' rampMeteringGame_ger.html

# Targets for link to other games

perl -i -p -e 's/rampMeteringGame\.html/rampMeteringGame_ger\.html/g' routingGame_ger.html
perl -i -p -e 's/routingGame\.html/routingGame_ger\.html/g' rampMeteringGame_ger.html

# special treatment of game html files

for file in rampMeteringGame_ger.html routingGame_ger.html; do
  perl -i -p -e 's/Clear Highscores/L&ouml;sche Highscores/g' $file
  perl -i -p -e 's/Go to Ramp-Metering Game/Gehe zu Zufluss-dosierungs-Spiel/g' $file
  perl -i -p -e 's/Go to Routing Game/Gehe zu Navi-gations-Spiel/g' $file
  perl -i -p -e 's/Time-lapse factor/Timelapse-Faktor/g' $file
done

#############################################
# copy current main-topic project to already translated index*.html
#############################################

cp ${indexProject}.html index.html
cp ${indexProject}_ger.html index_ger.html

#cp index.html index_ger.html
#perl -i -p -e "s/(.+)PROJ(.+)\.js/\1PROJ\2_ger.js/g" index_ger.html


#############################################
# change js files (incl link targets in redirect.js)
#############################################

#jsfiles="js/redirect_ger.js js/${proj}_ger.js"

echo "jsfilesGer=$jsfilesGer"
for file in "$jsfilesGer"; do

  perl -i -p -e 's/lane\"/Spur\"/g' $file
  perl -i -p -e 's/\" veh/\" Fz/g' $file
  perl -i -p -e 's/pixels/Pixel/g' $file
  perl -i -p -e 's/\"times\"/\"-fach\"/g' $file


  perl -i -p -e 's/\"Resume\"/\"Weiter\"/g' $file
  perl -i -p -e 's/\"Time\=/\"Zeit=/g' $file
  perl -i -p -e 's/\"Flow/\"Fluss/g' $file
  perl -i -p -e 's/\"Speed/\"Geschw/g' $file
  perl -i -p -e 's/\"timewarp=/\"Zeitraffer=/g' $file
  perl -i -p -e 's/\"density=/\"Dichte=/g' $file
  perl -i -p -e 's/\"scale=/\"Skala=/g' $file
done


perl -i -p -e 's/info_routingGame\.html/info_routingGame_ger.html/g' js/control_gui_ger.js js/routingGame_ger.js

cd $wd
