#!/bin/bash

#ACHTUNG Nicht im git!

# prepares package for upload to webserver or local use
# ATTENTION: Selection of actual main theme simulatin in engl2ger.bash

#############################################
# (0) get dir names and translate some html and js files to German
#############################################
wd=$PWD
startDir=$HOME/versionedProjects/traffic-simulation-de

$startDir/bash/engl2ger.bash

#############################################
# (1) select projects and prepare targetdir
#############################################

projects="ring onramp onramp_scooters offramp roadworks uphill routing routingGame roundabout rampMeteringGame intersection"
projectsTest="test1_straightRoad test2_bottleneck test3_moreComplexNetwork test4_doubleLoop test5_golfCourse weaving weaving_connect"
targetDir="$startDir/../trafficSimulationLocalVersion_`date +20%y_%m_%d`"

cd $startDir

echo "preparing target Directory $targetDir"

if test -d $targetDir; 
  then echo "$targetDir already exists; removing old files..."
       rm -r $targetDir/*;
  else echo "creating $targetDir ...";
       mkdir $targetDir
fi
mkdir $targetDir/js
mkdir $targetDir/figs
# info, and css subdirs creeated by cp -r

#############################################
# (2) select files
#############################################


html_files="impressum.html clearHighscores.html"  #just start

for proj in $projects; do
  htmlfile="${proj}.html"
  htmlfile_ger="${proj}_ger.html"

  echo  "project=${proj}, htmlfile_ger=$htmlfile_ger"
  html_files="${html_files} $htmlfile $htmlfile_ger";
done

# add the index html (just one of the projects) and the favicon
html_files="${html_files} index.html index_ger.html favicon.jpg" 

# add the BaWue files and the coffeemeter files
html_files="${html_files} onramp_BaWue_ger.html roadworks_BaWue_ger.html coffeemeterGame.html" 

# add the test files
for proj in $projectsTest; do
  htmlfile="${proj}.html"
  html_files="${html_files} $htmlfile";
done

js_files="redirect.js redirect_ger.js control_gui.js control_gui_ger.js colormanip.js models.js paths.js random.js road.js vehicle.js canvas_gui.js canvasresize.js TrafficObjects.js media.js timeView.js timeView_ger.js stationaryDetector.js stationaryDetector_ger.js TrafficLightControlEditor.js rampMeteringGameInfo.js rampMeteringGameInfo_ger.js routingGameInfo.js routingGameInfo_ger.js  seedrandom.min.js debug.js jquery-1.12.4.min.js"

for proj in $projects; do
  js_files="${js_files} ${proj}.js ${proj}_ger.js";
done

# add the BaWue files
js_files="${js_files} onramp_BaWue.js roadworks_BaWue.js"

# add the test files
for proj in $projectsTest; do
  js_files="${js_files} ${proj}.js";
done



#############################################
# (3) copy everything relevant into target directory
#############################################

echo "copying all relevant files into $targetDir ..."
echo "html_files=$html_files"
cd $startDir
cp README.md $targetDir
cp $html_files $targetDir

cd $startDir/js
cp $js_files $targetDir/js

cd $startDir/figs
# see uploadBaWue.bash for how to obtain the actually used images
img_files="backgroundGrass.jpg buttonStop3_small.png buttonGo_small.png buttonRestart_small.png trafficLightRed_affine.png trafficLightGreen_affine.png trafficLight_green.png trafficLight_red.png trafficLight_yellow.png truck1Small.png obstacleImg.png constructionVeh*[0-9].png obstacle_[56][0-9].png road*Crop*png speedLimit_*.svg infoBlue.png autobahn_plus.png autobahn_minus.png colormap_grass.png blackCarCropped.gif flagUSA.png flagGerman.png icon*Fig_small.jpg iconRing_small.jpg iconRoundabout_small.jpg iconIntersection_small.jpg sign_free_282_small.png Zeichen_Steigung4_small.png truckOvertakingBan_small.gif knobYellow.png buttonDone.png iconDownloadStart_small.png iconDownloadFinish_small.png golfer2.png roadGolf1.png roadGolf2.png"
cp $img_files $targetDir/figs

cd $startDir
cp -rp css $targetDir
cp -rp info $targetDir


#echo "packing target in a zip file for allowing the users local runs ..."
#zip -r $targetDir.zip $targetDir
#echo "created $targetDir.zip"

 
#############################################
# (4) test uploaded package locally in browser
#############################################

echo "Testing uploaded package:"
#echo "notice: zip download of sources only works in upload target"
#firefox $targetDir/index.html


#############################################
# (5) prepare for upload
#############################################

targetForUpload="$HOME/public_html/professional/trafficSimulationDe_html5_`date +20%y_%m_%d`"

if test -d $targetForUpload; then echo "$targetForUpload already exists";
  else mkdir $targetForUpload;
fi
#cp -r $targetDir/* $targetDir.zip $targetForUpload
cp -r $targetDir/*  $targetForUpload

# set accessing rights for internet access

chmod o+x $targetForUpload
chmod o+x `find $targetForUpload -type d`
chmod o+r `find $targetForUpload -type f`


echo "hint: When uploading to top-level traffic-simulation.de"
echo " just rename $targetForUpload to "
echo " $HOME/public_html/professional/trafficSimulationDe_html5"
echo " and upload (contains everything, incl info files)" 
echo ""
echo " e.g."
echo "rm -r $HOME/public_html/professional/trafficSimulationDe_html5"
echo "cp -rp $targetForUpload $HOME/public_html/professional/trafficSimulationDe_html5"


# www.mtreiber.de/trafficSimulationDe_html5_2018_10_19
