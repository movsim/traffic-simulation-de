#!/bin/bash


# prepares package for upload to webserver or local use

#############################################
# (1) select projects and prepare targetdir
#############################################

wd=$PWD
startDir=$HOME/versionedProjects/traffic-simulation-de
projects="ring onramp offramp roadworks routing"
# targetDir="$startDir/trafficSimulationLocalVersion_`date +20%y_%m_%d`"
targetDir="$startDir/trafficSimulationLocalVersion"
cd $startDir

echo "preparingtarget Directory $targetDir"

if test -d $targetDir; 
  then echo "$targetDir already exists; removing old files..."
       rm -r $targetDir/*;
  else echo "creating $targetDir ...";
       mkdir $targetDir
fi
mkdir $targetDir/js
# fig, info, css and icons subdirs creeated by cp -r

#############################################
# (2) select files
#############################################


html_files="impressum.html infoLinks.html infoModels.html infoScenarios.html infoFlags.html"
for proj in $projects; do
  htmlfile="${proj}.html"
  htmlfile_ger="${proj}_ger.html"
  if [ "$proj" == "ring" ]; then
      htmlfile="index.html";
      htmlfile_ger="index_ger.html";
  fi
  echo  "project=${proj}, htmlfile_ger=$htmlfile_ger"
  html_files="${html_files} $htmlfile $htmlfile_ger";
done

js_files="canvasresize.js colormanip.js dw_slider.js models.js paths.js redirect.js redirect_ger.js road.js vehicle.js "

for proj in $projects; do
  js_files="${js_files} ${proj}.js ${proj}_gui.js ${proj}_ger.js ${proj}_gui_ger.js";
done


#############################################
# (3) copy everything relevant into target directory
#############################################

echo "copying all relevant files into $targetDir ..."
echo "html_files=$html_files"
cp README.md $targetDir
cp $html_files $targetDir
cd $startDir/js
cp $js_files $targetDir/js
cd $startDir
cp -rp css $targetDir
cp -rp figs $targetDir
cp -rp icons $targetDir
cp -rp info $targetDir
cp -rp wm-html-include $targetDir

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

