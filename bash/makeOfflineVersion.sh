#!/bin/bash

# Test offline usage and files minimally needed for that


#############################################
# (0) get dir names and clean target test directory
#############################################
wd=$PWD
startPath=$HOME/versionedProjects/traffic-simulation-de
targetPath=$startPath/offlineVersion
targetDir=offlineVersion
if test -d $targetPath; 
  then echo "$targetPath already exists; removing old files..."
       rm -r $targetPath/*;
  else echo "creating $targetPath ...";
       mkdir $targetPath
fi

#############################################
# (1) fill targetdir
#############################################

js_files="*.js"

main_files="*.html favicon.jpg"

img_files="backgroundGrass.jpg buttonStop3_small.png buttonGo_small.png buttonRestart_small.png trafficLightRed_affine.png trafficLightGreen_affine.png trafficLight_green.png trafficLight_red.png trafficLight_yellow.png truck1Small.png obstacleImg.png constructionVeh*[0-9].png obstacle_[56][0-9].png road*Crop*png speedLimit_*.svg Tempo*.png infoBlue.png autobahn_plus.png autobahn_minus.png colormap_grass.png blackCarCropped.gif flagUSA.png flagGerman.png icon*Fig_small.jpg iconRing_small.jpg iconRoundabout_small.jpg sign_free_282_small.png Zeichen_Steigung4_small.png truckOvertakingBan_small.gif"

cd $startPath
cp $main_files $targetPath
cp -rp $startPath/css $targetPath
cp -rp $startPath/info  $targetPath
mkdir $targetPath/js   #select only the relevant js and image files
mkdir $targetPath/figs
for f in $js_files; do cp js/$f $targetPath/js; done
for f in $img_files; do cp figs/$f $targetPath/figs; done
echo "created $targetPath"

 

#############################################
# (2) set accessing rights for internet access
#############################################

chmod o+x $targetPath
chmod o+x `find $targetPath -type d`
chmod o+r `find $targetPath -type f`


#############################################
# (3) Making an offline version
#############################################

cd $startPath
echo "making offlineVersion.zip for allowing the users local runs ..."
zip -r $targetDir.zip $targetDir
echo "created $targetDir.zip"

#############################################
# (4) check if it works
#############################################



echo "Testing uploaded package:"
echo "notice: zip download of sources only works in upload target"
echo "test, e.g., by \"chromium-browser $targetDir/index.html\""


