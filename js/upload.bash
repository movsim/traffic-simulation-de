#!/bin/bash


# define files

projects="ring onramp offramp roadworks routing";

htmlfiles=""
for proj in $projects; do
  htmlfiles="${htmlfiles} ${proj}.html ${proj}_ger.html";
done

js_files="dw_slider.js canvasresize.js colormanip.js models.js vehicle.js paths.js road.js redirect.js redirect_ger.js"

for proj in $projects; do
  js_files="${js_files} ${proj}.js ${proj}_gui.js ${proj}_ger.js ${proj}_gui_ger.js";
done

css_files="simulation_html5.css"

fig_files="figs/blackCarCropped.gif figs/carSmall2.png figs/truck1Small.png figs/backgroundParis.gif figs/backgroundGrass.jpg figs/obstacleImg.png figs/oneLaneRoadRealisticCropped.png figs/twoLanesRoadRealisticCropped.png figs/threeLanesRoadRealisticCropped.png"


# prepare target Directory

targetDir="./trafficSimulationLocalVersion"
echo "preparingtarget Directory $targetDir"

if test -d $targetDir; 
  then echo "$targetDir already exists; removing old files..."
       rm -r $targetDir/*;
  else echo "creating $targetDir ...";
       mkdir $targetDir
fi
mkdir $targetDir/figs


# make German version

echo "creating German versions of relevant .js files"
echo "projects=$projects"

cp redirect.js redirect_ger.js

for proj in $projects; do
  cp ${proj}.html ${proj}_ger.html
  cp ${proj}.js ${proj}_ger.js
  cp ${proj}_gui.js ${proj}_gui_ger.js
done
echo $PWD
engl2ger.bash *_ger.*

#exit 0

# copy everything relevant into target directory

echo "copying html, css and js files to upload directory $targetDir ..."
cp    $htmlfiles $css_files $js_files $targetDir
echo "copying fig files to $targetDir/figs ..."
cp   $fig_files $targetDir/figs



# test uploaded package locally in browser

echo "Testing uploaded package:"
firefox $targetDir/onramp_ger.html


#exit 0

# prepare for upload

echo "packing all in a zip file ..."

zip -r $targetDir.zip $targetDir
echo "created $targetDir.zip"

echo "packing addtl. README info and scripts in a separate zip file ..."

zip -r ${targetDir}_addl.zip README* *.bash
echo "created ${targetDir}_addl.zip"

targetForUpload="$HOME/public_html/professional/trafficSimulationDe_html5"

cp -r $targetDir/* $targetDir.zip $targetForUpload

echo "upload via filezilla from $targetForUpload:"
echo "Host: traffic-simulation.de"
echo "Username: p537815"
echo "Password: schwerster Onsight gross mit Frz Grad"

