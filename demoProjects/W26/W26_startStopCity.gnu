
set style line 1 lt 1 lw 1 pt 7 ps 1.5 lc rgb "#000000"
set style line 2 lt 7 lw 3 pt 5 ps 1.5 lc rgb "#dd0000"
set style line 3 lt 1 lw 1 pt 9 ps 1.5 lc rgb "#ff8800"
set style line 4 lt 3 lw 3 pt 11 ps 1.5 lc rgb "#00aa44"
set style line 5 lt 5 lw 1 pt 13 ps 1.5 lc rgb "#220099"
set style line 6 lt 5 lw 3 pt 13 ps 1.5 lc rgb "#FF00FF"

min(x,y)=(x<y) ? x : y

set term post eps enhanced color dash "Helvetica" 24
set nogrid

tmin=0
tmax=158
tmaxdata=101.  # Um bei Acceleration Kurve zu stoppen

set xrange [tmin:tmax]
set xtics 30

#########################################################
set size 1,0.6
set xlabel "Time [s]"
set key center right


#########################################################
set out "./W26_startStopCity.s.eps"
print "plotting ./W26_startStopCity.s.eps"
set ylabel "Gap [m]"
set yrange [0:45]
set ytics 10
plot\
     "W26_startStopCity.car1"  u 1:5 t "Veh 1"  w l ls 1,\
     "W26_startStopCity.car2"  u 1:5 t "Veh 2"  w l ls 6,\
     "W26_startStopCity.car5"  u 1:5 t "Veh 5"  w l ls 2,\
     "W26_startStopCity.car10"  u 1:5 t "Veh 10"  w l ls 3,\
     "W26_startStopCity.car15" u 1:5 t "Veh 15" w l ls 4,\
     "W26_startStopCity.car20" u 1:5 t "Veh 20" w l ls 5

#########################################################
set out "./W26_startStopCity.v.eps"
print "plotting ./W26_startStopCity.v.eps"
set ylabel "Speed [km/h]
set auto y
plot\
     "W26_startStopCity.car1"  u 1:(3.6*$3) t "Veh 1"  w l ls 1,\
     "W26_startStopCity.car2"  u 1:(3.6*$3) t "Veh 2"  w l ls 6,\
     "W26_startStopCity.car5"  u 1:(3.6*$3) t "Veh 5"  w l ls 2,\
     "W26_startStopCity.car10"  u 1:(3.6*$3) t "Veh 10"  w l ls 3,\
     "W26_startStopCity.car15"  u 1:(3.6*$3) t "Veh 15"  w l ls 4,\
     "W26_startStopCity.car20" u 1:(3.6*$3) t "Veh 20" w l ls 5

#########################################################
set out "./W26_startStopCity.a.eps"
print "plotting ./W26_startStopCity.a.eps"
set ylabel "Acceleration [m/s^2]"
set auto y
set ytics 1
plot\
     "W26_startStopCity.car1"  u (min($1,tmaxdata)):4 t "Veh 1"  w l ls 1,\
     "W26_startStopCity.car2"  u (min($1,tmaxdata)):4 t "Veh 2"  w l ls 6,\
     "W26_startStopCity.car5"  u (min($1,tmaxdata)):4 t "Veh 5"  w l ls 2,\
     "W26_startStopCity.car10"  u (min($1,tmaxdata)):4 t "Veh 10"  w l ls 3,\
     "W26_startStopCity.car15"  u (min($1,tmaxdata)):4 t "Veh 15"  w l ls 4,\
     "W26_startStopCity.car20" u (min($1,tmaxdata)):4 t "Veh 20" w l ls 5

#########################################################
set out "./W26_startStopCity.a12.eps"
print "plotting ./W26_startStopCity.a12.eps"
set ylabel "Acceleration [m/s^2]"
set auto y
set ytics 1
plot\
     "W26_startStopCity.car2"  u (min($1,tmaxdata)):4 t "Veh 2"  w l ls 6,\
     "W26_startStopCity.car1"  u (min($1,tmaxdata)):4 t "Veh 1"  w l ls 1

quit
####################################################################

