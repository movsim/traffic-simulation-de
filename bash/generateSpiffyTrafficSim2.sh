#! /bin/bash

# http://www.imagemagick.org/script/convert.php
# Siehe auch ./convert_funnyText

# An folgenden Block kann gefrickelt werden 

#============================================
color2="#002c48"
color1="#6699aa"

#convert -list font
#convert -list font | grep Font

#font="Courier-BoldOblique"
#font="Times-BoldItalic"
#font="Helvetica-BoldOblique"

#font="FreeSerif-BoldItalic"


#font="Bitstream-Charter-Bold-Italic"
#font="DejaVu-Sans-Condensed-Bold-Oblique"

#font="Garuda-BoldOblique"

#font="NanumGothic-Regular"
#font="Palatino-BoldItalic"
#font="AvantGarde-DemiOblique"
#font="NewCenturySchlbk-BoldItalic"
font="Bookman-DemiItalic"

#============================================

if (($#<3)); then
 echo "Usage: generateSpiffyTrafficSim2.sh textheight lengthMultiplicator \"titleText\""
 echo "textheight in pixels; lengthMultiplicator=100 for normal avg. letterwidth"
 echo "lengthMultiplicator longer if text such as ''mmm'', shorter for ''ttt''"
echo "Example: generateSpiffyTrafficSim2.sh 55 100 \"Traffic Flow\""
 exit
fi


textheight=$1
multiplicator=$2
shift 2
titleText=$@
outnameBase="$titleText"
echo "outnameBase=$outnameBase"

# string search replace ${string/pattern/replacement}

filename="bash.string.txt"
outnameBase=${titleText// /_}
outname="${outnameBase}.png"
echo "generating $outname ..."


titleLength=`echo $titleText | wc -c`
titleLength=$(($titleLength-1))
width=$(($titleLength*$textheight*12/20*${multiplicator}/100))
height=$(($textheight*31/26))
xpos1=$(($textheight*10/100))
xpos12=$(($textheight*9/100))
xpos14=$(($textheight*8/100))
xpos16=$(($textheight*7/100))
xpos18=$(($textheight*6/100))
xpos2=$(($textheight*5/100))
xposShadow=$(($textheight*16/100))
xposShadow2=$(($textheight*13/100))
ypos1=$(($textheight*80/100))
ypos12=$(($textheight*81/100))
ypos14=$(($textheight*82/100))
ypos16=$(($textheight*83/100))
ypos18=$(($textheight*84/100))
ypos2=$(($textheight*85/100))
yposShadow=$(($textheight*90/100))
yposShadow2=$(($textheight*95/100))
smoothPix=$(($textheight/25))
lw=$(($textheight/100+1))


echo "titleLength=$titleLength"
echo "width=$width"
echo "height=$height"
echo "xpos=$xpos"
echo "xposShadow=$xposShadow"
echo "ypos=$ypos"
echo "yposShadow=$yposShadow"
echo "smoothPix=$smoothPix"
echo "lw=$lw"
echo "multiplicator=$multiplicator"


convert -size ${width}x${height} xc:transparent -font $font -pointsize ${textheight}\
  -draw "text ${xposShadow},${yposShadow} '${titleText}'" -channel RGBA -gaussian ${smoothPix}x6\
  -draw "text ${xposShadow2},${yposShadow2} '${titleText}'" -channel RGBA -gaussian ${smoothPix}x6\
  -fill "${color1}" -annotate +"${xpos1}"+"${ypos1}" "${titleText}"\
  -fill "${color1}" -annotate +"${xpos12}"+"${ypos12}" "${titleText}"\
  -fill "${color1}" -annotate +"${xpos14}"+"${ypos14}" "${titleText}"\
  -fill "${color1}" -annotate +"${xpos16}"+"${ypos16}" "${titleText}"\
  -fill "${color1}" -annotate +"${xpos18}"+"${ypos18}" "${titleText}"\
  -fill "${color2}" -annotate +"${xpos2}"+"${ypos2}" "${titleText}"\
  $outname


# -draw "text ${xposShadow},${yposShadow} '${titleText}'" -channel RGBA -gaussian ${smoothPix}x6\
# -fill "${color1}" -stroke "${color2}" -strokewidth ${lw}\
# -draw "text ${xpos},${ypos} '${titleText}'" $outname

echo "generated  $outname"
