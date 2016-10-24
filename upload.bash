#!/bin/bash


# prepares package for upload to webserver or local use

#############################################
# (1) select projects and prepare targetdir
#############################################

startDir=$PWD
projects="ring onramp offramp roadworks routing"
# targetDir="$startDir/trafficSimulationLocalVersion_`date +20%y_%m_%d`"
targetDir="$startDir/trafficSimulationLocalVersion"
echo "preparingtarget Directory $targetDir"

if test -d $targetDir; 
  then echo "$targetDir already exists; removing old files..."
       rm -r $targetDir/*;
  else echo "creating $targetDir ...";
       mkdir $targetDir
fi
mkdir $targetDir/figs
mkdir $targetDir/js
# info, css and icons subdirs creeated by cp -r

#############################################
# (2) select files
#############################################


html_files="index.html index_ger.html navigation.html navigation_ger.html indexResponsive.html"
for proj in $projects; do
  html_files="${html_files} ${proj}.html ${proj}_ger.html";
done

js_files="dw_slider.js canvasresize.js colormanip.js models.js paths.js road.js redirect.js redirect_ger.js vehicle.js "

for proj in $projects; do
  js_files="${js_files} ${proj}.js ${proj}_gui.js ${proj}_ger.js ${proj}_gui_ger.js";
done

fig_files="blackCarCropped.gif carSmall2.png truck1Small.png backgroundParis.gif backgroundGrass.jpg obstacleImg.png oneLaneRoadRealisticCropped.png twoLanesRoadRealisticCropped.png threeLanesRoadRealisticCropped.png"


#############################################
# (3) copy everything relevant into target directory
#############################################

echo "copying all relevant files into $targetDir ..."
cp README.md $targetDir
cp $html_files $targetDir
cd $startDir/js
cp $js_files $targetDir/js
cd $startDir/figs
cp $fig_files $targetDir/figs
cd $startDir
cp -rp icons $targetDir
cp -rp info $targetDir
cp -rp css $targetDir

echo "packing target in a zip file for allowing the users local runs ..."
zip -r $targetDir.zip $targetDir
echo "created $targetDir.zip"


#############################################
# (4) test uploaded package locally in browser
#############################################

echo "Testing uploaded package:"
echo "notice: zip download of sources only works in upload target"
firefox $targetDir/index.html


#############################################
# (5) prepare for upload
#############################################

targetForUpload="$HOME/public_html/professional/trafficSimulationDe_html5"

cp -r $targetDir/* $targetDir.zip $targetForUpload

echo "upload via filezilla from $targetForUpload:"
echo "Host: traffic-simulation.de"
echo "Username: p537815"
echo "Password: schwerster Onsight gross mit Frz Grad"

