#!/bin/bash

#ACHTUNG Nicht im git!

# prepares package for upload to webserver or local use
# ATTENTION: Selection of actual main theme simulatin in engl2ger.bash

#############################################
# (0) get dir names
#############################################
wd=$PWD
startDir=$HOME/versionedProjects/traffic-simulation-de

#############################################
# (1) select projects and prepare targetdir
#############################################

projects="onramp_BaWue roadworks_BaWue"
targetDir="$startDir/../trafficSimulationBaWue_`date +20%y_%m_%d`"

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
  html_files="${html_files} ${proj}_ger.html"
done

# add the index html (just one of the projects)
#html_files="${html_files} index.html index_ger.html" 

js_files="redirect_ger.js seedrandom.min.js control_gui_ger.js timeView_ger.js media.js canvas_gui.js TrafficObjects.js colormanip.js models.js paths.js road.js vehicle.js stationaryDetector_ger.js"

for proj in $projects; do
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



# determine which image files are needed from the repos
# from imgfileList created by the following:

cd $startDir/js
if test -f imgfileList; then rm imgfileList; fi
grep jpg $js_files > imgfileList
grep png $js_files >> imgfileList
grep svg $js_files >> imgfileList
grep gif $js_files >> imgfileList
cd $startDir
grep jpg $html_files >> js/imgfileList
grep png $html_files >> js/imgfileList
grep svg $html_files >> js/imgfileList
perl -i -p -e "s/^.*figs\/(.+)\.png.+$/\1\.png/g" js/imgfileList
perl -i -p -e "s/^.*figs\/(.+)\.jpg.+$/\1\.jpg/g" js/imgfileList
perl -i -p -e "s/^.*figs\/(.+)\.svg.+$/\1\.svg/g" js/imgfileList

# extract from imgfileList the following by hand:

img_files="backgroundGrass.jpg buttonStop3_small.png buttonGo_small.png buttonRestart_small.png trafficLightRed_affine.png trafficLightGreen_affine.png truck1Small.png obstacleImg.png constructionVeh*[0-9].png road*Crop*png Tempo*svg iconOnrampFig_small.jpg iconRoadworksFig_small.jpg iconRampmeterFig_small.jpg
infoBlue.png autobahn_plus.png autobahn_minus.png colormap_grass.png blackCarCropped.gif"

mkdir $targetDir/figs
mkdir $targetDir/css

cd $startDir/figs
cp $img_files $targetDir/figs
cp ../favicon.jpg  $targetDir
cd $startDir/css
cp styleBaWue.css styleSliders.css $targetDir/css
cd $startDir


#echo "packing target in a zip file for allowing the users local runs ..."
#zip -r $targetDir.zip $targetDir
#echo "created $targetDir.zip"

 
#############################################
# (4) test uploaded package locally in browser
#############################################

echo "Testing uploaded package:"
#echo "notice: zip download of sources only works in upload target"
firefox $targetDir/roadworks_BaWue_ger.html


#############################################
# (5) prepare for upload
#############################################

targetForUpload="$HOME/public_html/professional/trafficSimulationDe_BaWue_`date +20%y_%m_%d`"

if test -d $targetForUpload; then echo "$targetForUpload already exists";
  else mkdir $targetForUpload;
fi
#cp -r $targetDir/* $targetDir.zip $targetForUpload
cp -r $targetDir/*  $targetForUpload

# set accessing rights for internet access

chmod o+x $targetForUpload
chmod o+x `find $targetForUpload -type d`
chmod o+r `find $targetForUpload -type f`


echo "upload via filezilla from $targetForUpload"
echo "hint: When uploading to top-level traffic-simulation.de"
echo " just rename $targetForUpload to "
echo " $HOME/public_html/professional/trafficSimulationDe_html5"
echo " and upload (contains everything, incl info files)" 
echo ""
echo " e.g."
echo "rm -r $HOME/public_html/professional/trafficSimulationDe_html5"
echo "cp -rp $targetForUpload $HOME/public_html/professional/trafficSimulationDe_html5"


# e.g., ~/public_html/professional/trafficSimulationDe_BaWue_2019_09_11
# => www.mtreiber.de/trafficSimulationDe_BaWue_2019_09_11
