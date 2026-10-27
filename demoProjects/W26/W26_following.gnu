


# check consistency of parameters from analytic file of region boundaries!
# check consistency of vl value from .vlead1 file

load 'boundaries_analytic.gnu'
vl=10.


set term post eps enhanced color solid "Helvetica" 20




#########################################################
set size 1,0.6
set xlabel "t [s]"
set xrange [0:240]
set key at screen 0.85,0.51

xmin=0
xmax=100
vmin_kmh=0
vmax_kmh=60

#########################################################
set out "W26_following.s.eps"
print "plotting W26_following.s.eps"
#########################################################


set ylabel "Gap [m]"
set xrange [xmin:xmax]
#set yrange [0:100]
set auto y
plot\
     "W26_following.car2"  u 1:5 t "testcar2)"  w l ls 2,\
     "W26_following.car3"  u 1:5 t "car3)"  w l ls 3,\
     "W26_following.car4"  u 1:5 t "car4)"  w l ls 4,\
     "W26_following.car8"  u 1:5 t "car8)"  w l ls 5,\
     "W26_following.car12" u 1:5 t "car12" w l ls 6,\
     "W26_following.car16" u 1:5 t "car16" w l ls 7


#########################################################
set out "W26_following.v.eps"
print "plotting W26_following.v.eps"
#########################################################

set xrange [xmin:xmax]
set ylabel "V [km/h]"
#set yrange [vmin_kmh:vmax_kmh]
set auto y
plot\
     "W26_following.car1"  u ($1):(3.6*$3) t "v (leadcar=1)"  w l ls 1,\
     "W26_following.car2"  u ($1):(3.6*$3) t "v (testcar=2)"  w l ls 2,\
     "W26_following.car3"  u ($1):(3.6*$3) t "v (car3)"  w l ls 3,\
     "W26_following.car8"  u ($1):(3.6*$3) t "v (car8)"  w l ls 5


#########################################################
set out "W26_following.a.eps"
print "plotting W26_following.a.eps"
#########################################################

set xrange [xmin:xmax]
set ylabel "a [m/s^2]"
set auto y
set key at screen 0.85,0.37
# acc des leadcars = falsch bei v-control!

plot\
     "W26_following.car2"  u 1:4 t "a (testcar=2)"  w l ls 2,\
     "W26_following.car8"  u 1:4 t "a (car8)"  w l ls 5

#########################################################
set out "W26_following.sdv.eps"
print "plotting W26_following.sdv.eps"
#########################################################

set size 1,1
set key at screen 0.4,0.9
set xlabel "relative speed v-v_l [m/s]"
set xrange [-5:5]

set ylabel "Gap s [m]"
set yrange [0:40]

set label sprintf("v_l=%.1f",vl) at screen 0.6,0.9

dvmin=-5
dvmax=5

plot [v=vl+dvmin:vl+dvmax]\
  v-vl, sCF1cropped(v,vl) t "" w l ls 11,\
  v-vl, sCF2cropped(v,vl) t "" w l ls 11,\
  v-vl, sCLcropped(v,vl) t "" w l ls 11,\
  v-vl, sOPcropped(v,vl) t "" w l ls 11,\
  v-vl, sCRcropped(v,vl) t "" w l ls 11,\
  -dv0,sCF1(vl-dv0,vl)*(v-vl-dvmin)/(dvmax-dvmin) t "" w l ls 11,\
  "W26_following.car2"  u 6:5 t "testcar=2"  w l ls 2

#,\
#  "W26_following.car8"  u 6:5 t "car 8"  w l ls 8
#,\
#     "W26_following.car3"  u 6:5 t "car 3"  w l ls 3




quit
####################################################################

