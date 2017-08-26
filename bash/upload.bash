#!/bin/bash


# prepares package for upload to webserver or local use


#############################################
# (0) translate some js files to German
#############################################
wd=$PWD
startDir=$HOME/versionedProjects/traffic-simulation-de

$startDir/bash/engl2ger.bash

#############################################
# (1) select projects and prepare targetdir
#############################################

projects="ring onramp offramp roadworks uphill routing"
targetDir="$startDir/../trafficSimulationLocalVersion_`date +20%y_%m_%d`"
# targetDir="$startDir/trafficSimulationLocalVersion"

cd $startDir

echo "preparing target Directory $targetDir"

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


html_files="impressum.html"  #just start

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

js_files="redirect.js redirect_ger.js control_gui.js control_gui_ger.js colormanip.js models.js paths.js road.js vehicle.js canvas_gui.js vehicleDepot.js timeView.js timeView_ger.js stationaryDetector.js stationaryDetector_ger.js"

for proj in $projects; do
  js_files="${js_files} ${proj}.js ${proj}_ger.js";
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
cd $startDir

cp -rp css $targetDir
cp -rp figs $targetDir
cp -rp icons $targetDir
cp -rp info $targetDir


#echo "packing target in a zip file for allowing the users local runs ..."
#zip -r $targetDir.zip $targetDir
#echo "created $targetDir.zip"

 
#############################################
# (4) test uploaded package locally in browser
#############################################

echo "Testing uploaded package:"
#echo "notice: zip download of sources only works in upload target"
firefox $targetDir/index.html


#############################################
# (5) prepare for upload
#############################################

targetForUpload="$HOME/public_html/professional/trafficSimulationDe_html5_`date +20%y_%m_%d`"

if test -d $targetForUpload; then echo "$targetForUpload already exists";
  else mkdir $targetForUpload;
fi
#cp -r $targetDir/* $targetDir.zip $targetForUpload
cp -r $targetDir/*  $targetForUpload

echo "upload via filezilla from $targetForUpload"
echo "Host: sftp://mtreiber.de"
echo "Username: p537815"
echo "Password: schwerster Onsight gross mit Frz Grad"
echo "hint: When uploading to top-level traffic-simulation.de"
echo " just rename $targetForUpload to "
echo " $HOME/public_html/professional/trafficSimulationDe_html5"
echo " and upload (contains everything, incl info files)" 
