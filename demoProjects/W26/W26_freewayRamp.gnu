# (pointstyle (s.u.):p 5 = closed square, p 9 = closed triangle)

set style line 99 lt 1 lw 1 linecolor rgb "#000000" # beliebige Farben:Schwarz

set style line 1 lt 1 lw 2 pt 7 ps 1.7  lc rgb "#000000" #schwarz, bullet
set style line 2 lt 1 lw 2 pt 9 ps 2.0  lc rgb "#CC0022" #rot, closedUpTriang
set style line 3 lt 1 lw 2 pt 4 ps 1.2  lc rgb "#FF3300" #orang, closedSquare
set style line 4 lt 1 lw 2 pt 4 ps 1.7  lc rgb "#FFAA00" #gelb,
set style line 5 lt 1 lw 2 pt 5 ps 1.5  lc rgb "#00DD22" #gruen,
set style line 6 lt 1 lw 2 pt 4 ps 1.7  lc rgb "#00AAAA"
set style line 7 lt 1 lw 2 pt 4 ps 2.0  lc rgb "#1100FF" #blau,
set style line 8 lt 1 lw 2 pt 8 ps 1.5  lc rgb "#220088"
set style line 9 lt 1 lw 2 pt 9 ps 1.5  lc rgb "#999999" #grau

set style line 11 lt 1 lw 6 pt 7 ps 1.9  lc rgb "#000000" 
set style line 12 lt 1 lw 6 pt 2 ps 1.5  lc rgb "#CC0022" 
set style line 13 lt 8 lw 6 pt 4 ps 1.2  lc rgb "#FF3300"
set style line 14 lt 6 lw 6 pt 4 ps 1.5  lc rgb "#FFAA00"
set style line 15 lt 1 lw 6 pt 5 ps 1.5  lc rgb "#00DD22"
set style line 16 lt 5 lw 6 pt 7 ps 1.5  lc rgb "#00AAAA"
set style line 17 lt 1 lw 6 pt 7 ps 1.5  lc rgb "#1100FF"
set style line 18 lt 4 lw 6 pt 8 ps 1.5  lc rgb "#220088"
set style line 19 lt 7 lw 6 pt 9 ps 1.5  lc rgb "#999999"

set style line 22 lt palette lw 10 pt 2 ps 1.5 

############### 3d ###########

#Gnuplot Bug: Schaltet nicht von Palette zurueck, deshalb -1=Black

set palette defined ( -1 "black", 0 "red", 20 "orange", 40 "yellow",\
      60 "green", 80 "blue",  100 "#dd00ff" ) 
set cbrange [0:140]
set pm3d; set pm3d map
#set contour surface
set cntrparam bspline 
set cntrparam levels 15
unset clabel  # dann lauter gleiche Kontourlinien; 
                     # Farbe und Typ mit "w l ls" beim splot-Kommando


#set view 20,63
#set hidden3d
set ticslevel 0; set nogrid
set lmargin at screen 0.12  # bugs with too tight clipping otherwise
set rmargin at screen 0.85
#set tmargin at screen 0.7
#set bmargin at screen 0.2



##################################
set out "W26_freewayRamp_v3d.eps"
print "plotting W26_freewayRamp_v3d.eps"
##################################

set term post eps enhanced color solid "Helvetica" 22

set nokey

set size 1,1
#set label "(a)" at screen 0.85,0.75
set label 1 "V [km/h]" at screen 0.88, 0.92

#set label 2 "Test" at screen 0.95, 0.92 textcolor "green"
xmin=-8  # km
xmax=2
xramp2=15.  # km
tmin=0   
tmax=90 # min
tshift=20.  

set xlabel "Time [min]"
set xrange [tmin:tmax]
set xtics 30
set xtics 30

set ylabel "Distance from onramp [km]" offset -0.5,0
set yrange [xmin:xmax]

set ztics 50
unset surface

splot "W26_freewayRamp.dat" u ($2*60-tshift):($1-xramp2):4 w l ls 99



set nolabel
unset colorbox
unset pm3d
unset lmargin
unset rmargin 


#set label "(b)" at 5,2400


rhomin=0.
rhomax=90.
rhomaxReal=110.
Qmin=0.
Qmax=2800.

set xlabel "Density {/Symbol r} [1/km]"
set xrange [rhomin:rhomax]
set xtics 20

set ylabel "Flow Q [1/h]" offset 1,0
set yrange [Qmin:Qmax]

###############################################################################
avgInterval=60   # sampling interval of detectors [s] 
Qfun(q)    =(q<=0.00001) ? 0 : 3600/avgInterval *q       # Q
QharmFun(invTbrutto)=(invTbrutto<0.00001)\
  ? 0 : 3600*invTbrutto                                  # QH
vharmFun(invvharm)=(invvharm<0.00001) ? 0 : 1./invvharm  # VH
rhofun(q,v)=(v<=0.00001) ? 0  : 3600/avgInterval *q/v    # Q/V
rhoharmFun(invTbrutto,invvharm)\
  =QharmFun(invTbrutto)/vharmFun(invvharm)               # QH/VH=<1/dt>*<1/v>
###############################################################################

##################################  ... normal fund rho=Q/V  vs Q
set out "W26_freewayRamp_fund.eps"
print "plotting W26_freewayRamp_fund.eps"
##################################

set key at screen 0.95,0.92
set label 1 "Density Q/V, Flow Q" at screen 0.65,0.19 front

plot\
 "W26_freewayRamp.x8000_det" u (rhofun($2, $3)):(Qfun($2)) t "-7 km" w p ls 6,\
 "W26_freewayRamp.x10000_det" u (rhofun($2, $3)):(Qfun($2)) t "-5 km" w p ls 4,\
 "W26_freewayRamp.x12000_det" u (rhofun($2, $3)):(Qfun($2)) t "-3 km" w p ls 2,\
 "W26_freewayRamp.x14000_det" u (rhofun($2, $3)):(Qfun($2)) t "-1 km" w p ls 1,\
 "W26_freewayRamp.fundW261"   u ($1):($4) t "FD" w l ls 11






# all the following (i) larger rho range, (ii) with theo FD

##################################   ... normal fund rho=Q/V  vs Q
set out "W26_freewayRamp_fund_Q_vs_QdivV.eps"
print "plotting W26_freewayRamp_fund_Q_vs_QdivV.eps"
##################################

set xrange [rhomin:rhomaxReal]  
set key at screen 0.93,0.92
set label 1 "Density Q/V, Flow Q" at screen 0.59,0.19 front

plot\
 "W26_freewayRamp.x8000_det" u (rhofun($2, $3)):(Qfun($2)) t "-7 km" w p ls 6,\
 "W26_freewayRamp.x10000_det" u (rhofun($2, $3)):(Qfun($2)) t "-5 km" w p ls 4,\
 "W26_freewayRamp.x12000_det" u (rhofun($2, $3)):(Qfun($2)) t "-3 km" w p ls 2,\
 "W26_freewayRamp.x14000_det" u (rhofun($2, $3)):(Qfun($2)) t "-1 km" w p ls 1,\
 "W26_freewayRamp.fundW261"   u ($1):($4) t "FD" w l ls 11


##################################        ...  Q/VH vs Q
set out "W26_freewayRamp_fund_Q_vs_QdivVH.eps"
print "plotting W26_freewayRamp_fund_Q_vs_QdivVH.eps"
##################################

set label 1 "Density Q/V_H, Flow Q" 
plot\
 "W26_freewayRamp.x8000_det"  u (Qfun($2)/vharmFun($4)):(Qfun($2)) t "-7 km" w p ls 6,\
 "W26_freewayRamp.x10000_det" u (Qfun($2)/vharmFun($4)):(Qfun($2)) t "-5 km" w p ls 4,\
 "W26_freewayRamp.x12000_det" u (Qfun($2)/vharmFun($4)):(Qfun($2)) t "-3 km" w p ls 2,\
 "W26_freewayRamp.x14000_det" u (Qfun($2)/vharmFun($4)):(Qfun($2)) t "-1 km" w p ls 1,\
 "W26_freewayRamp.fundW261"   u ($1):($4) t "FD" w l ls 11


##################################        ... QH/VH vs QH ,  QH=<1/dt>
set out "W26_freewayRamp_fund_QH_vs_QHdivVH.eps"
print "plotting W26_freewayRamp_fund_QH_vs_QHdivVH.eps"
##################################

set label 1 "Density Q_H/V_H, Flow Q_H" 
plot\
 "W26_freewayRamp.x8000_det"  u (rhoharmFun($5,$4)):(QharmFun($5)) t "-7 km" w p ls 6,\
 "W26_freewayRamp.x10000_det" u (rhoharmFun($5,$4)):(QharmFun($5)) t "-5 km" w p ls 4,\
 "W26_freewayRamp.x12000_det" u (rhoharmFun($5,$4)):(QharmFun($5)) t "-3 km" w p ls 2,\
 "W26_freewayRamp.x14000_det" u (rhoharmFun($5,$4)):(QharmFun($5)) t "-1 km" w p ls 1,\
 "W26_freewayRamp.fundW261"   u ($1):($4) t "FD" w l ls 11


#... using harmonic speed but harmonic flow ONLY for the density definition!
################################## 
set out "W26_freewayRamp_fund_Q_vs_QHdivVH.eps"
print "plotting W26_freewayRamp_fund_Q_vs_QHdivVH.eps"
##################################

set label 1 "Density Q_H/V_H, Flow Q" 
plot\
 "W26_freewayRamp.x8000_det"  u (rhoharmFun($5,$4)):(Qfun($2)) t "-7 km" w p ls 6,\
 "W26_freewayRamp.x10000_det" u (rhoharmFun($5,$4)):(Qfun($2)) t "-5 km" w p ls 4,\
 "W26_freewayRamp.x12000_det" u (rhoharmFun($5,$4)):(Qfun($2)) t "-3 km" w p ls 2,\
 "W26_freewayRamp.x14000_det" u (rhoharmFun($5,$4)):(Qfun($2)) t "-1 km" w p ls 1,\
 "W26_freewayRamp.fundW261"   u ($1):($4) t "FD" w l ls 11


##################################
set out "W26_freewayRamp_fundTrue.eps"
print "plotting W26_freewayRamp_fundTrue.eps"
##################################

set label 1 "Density 1/{/Symbol D}x, Flow Q" 

plot\
 "W26_freewayRamp.x8000_macro" u 3:5 t "-7 km" w p ls 6,\
 "W26_freewayRamp.x10000_macro" u 3:5 t "-5 km" w p ls 4,\
 "W26_freewayRamp.x12000_macro" u 3:5 t "-3 km" w p ls 2,\
 "W26_freewayRamp.x14000_macro" u 3:5 t "-1 km" w p ls 1,\
 "W26_freewayRamp.fundW261" u ($1):($4) t "FD" w l ls 11





##################################
set out "W26_freewayRamp_QV.eps"
print "plotting W26_freewayRamp_QV.eps"
##################################

set key at screen 0.48,0.75
set label 1 "Flow Q, Speed V"  at screen 0.65,0.19 front

Vmax=125.
set xlabel "Flow Q [1/h]"
set xrange [0:Qmax]
set xtics 500
set ylabel "Speed V [km/h]" offset 1,0
set yrange [0:Vmax]
plot\
 "W26_freewayRamp.x8000_det" u (Qfun($2)):($3) t "-7 km" w p ls 6,\
 "W26_freewayRamp.x10000_det" u (Qfun($2)):($3) t "-5 km" w p ls 4,\
 "W26_freewayRamp.x12000_det" u (Qfun($2)):($3) t "-3 km" w p ls 2,\
 "W26_freewayRamp.x14000_det" u (Qfun($2)):($3) t "-1 km" w p ls 1,\
 "W26_freewayRamp.fundW261" u ($4):($3) t "FD" w l ls 11


##################################
set out "W26_freewayRamp_QVharm.eps"
print "plotting W26_freewayRamp_QVharm.eps"
##################################

set label 1 "Flow Q, Speed V_H" 
plot\
 "W26_freewayRamp.x8000_det" u (QharmFun($5)):(vharmFun($4)) t "-7 km" w p ls 6,\
 "W26_freewayRamp.x10000_det" u (QharmFun($5)):(vharmFun($4)) t "-5 km" w p ls 4,\
 "W26_freewayRamp.x12000_det" u (QharmFun($5)):(vharmFun($4)) t "-3 km" w p ls 2,\
 "W26_freewayRamp.x14000_det" u (QharmFun($5)):(vharmFun($4)) t "-1 km" w p ls 1,\
 "W26_freewayRamp.fundW261" u ($4):($3) t "FD" w l ls 11


##################################
set out "W26_freewayRamp_QVTrue.eps"
print "plotting W26_freewayRamp_QVTrue.eps"
##################################

set label 1 "Flow Q, Speed V_{true}" 
plot\
 "W26_freewayRamp.x8000_macro" u 5:4 t "-7 km" w p ls 6,\
 "W26_freewayRamp.x10000_macro" u 5:4 t "-5 km" w p ls 4,\
 "W26_freewayRamp.x12000_macro" u 5:4 t "-3 km" w p ls 2,\
 "W26_freewayRamp.x14000_macro" u 5:4 t "-1 km" w p ls 1,\
 "W26_freewayRamp.fundW261" u ($4):($3) t "FD" w l ls 11




##################################
set out "W26_freewayRamp_rhoV.eps"
print "plotting W26_freewayRamp_rhoV.eps"
##################################

set key at screen 0.95,0.92

Vmax=125.
set xlabel "Density {/Symbol r} [1/km]"
set xrange [0:rhomax]
set xtics 20

set ylabel "Speed V [km/h]" offset 1,0
set yrange [0:Vmax]

set label 1 "Density Q/V, Speed V"  at screen 0.59,0.19 front
plot\
 "W26_freewayRamp.x8000_det" u (rhofun($2, $3)):($3) t "-7 km" w p ls 6,\
 "W26_freewayRamp.x10000_det" u (rhofun($2, $3)):($3) t "-5 km" w p ls 4,\
 "W26_freewayRamp.x12000_det" u (rhofun($2, $3)):($3) t "-3 km" w p ls 2,\
 "W26_freewayRamp.x14000_det" u (rhofun($2, $3)):($3) t "-1 km" w p ls 1,\
 "W26_freewayRamp.fundW261" u ($1):($3) t "FD" w l ls 11


##################################
set out "W26_freewayRamp_rhoVharm.eps"
print "plotting W26_freewayRamp_rhoVharm.eps"
##################################

set label 1 "Density Q_H/V_H, Speed V_H" at screen 0.59,0.19 front
plot\
 "W26_freewayRamp.x8000_det" u (rhoharmFun($5,$4)):(vharmFun($4)) t "-7 km" w p ls 6,\
 "W26_freewayRamp.x10000_det" u (rhoharmFun($5,$4)):(vharmFun($4)) t "-5 km" w p ls 4,\
 "W26_freewayRamp.x12000_det" u (rhoharmFun($5,$4)):(vharmFun($4)) t "-3 km" w p ls 2,\
 "W26_freewayRamp.x14000_det" u (rhoharmFun($5,$4)):(vharmFun($4)) t "-1 km" w p ls 1,\
 "W26_freewayRamp.fundW261" u ($1):($3) t "FD" w l ls 11


##################################
set out "W26_freewayRamp_rhoVTrue.eps"
print "plotting W26_freewayRamp_rhoVTrue.eps"
##################################

set label 1 "Density 1/{/Symbol D}x, Speed V_{true}" 
plot\
 "W26_freewayRamp.x8000_macro" u 3:4 t "-7 km" w p ls 6,\
 "W26_freewayRamp.x10000_macro" u 3:4 t "-5 km" w p ls 4,\
 "W26_freewayRamp.x12000_macro" u 3:4 t "-3 km" w p ls 2,\
 "W26_freewayRamp.x14000_macro" u 3:4 t "-1 km" w p ls 1,\
 "W26_freewayRamp.fundW261" u ($1):($3) t "FD" w l ls 11



###############################################
set out "W26_freewayRamp_v.eps"
print "plotting W26_freewayRamp_v.eps"
###############################################

set nokey
set param
set nogrid

tmin=0
tmax=90
xmin=-5.5
xmax=1.7

xD0=1
xD1=0
xD2=-1
xD3=-2
xD4=-3
xD5=-4
xD6=-5

vAvg_kmh=40.
vFun(t,x,v_kmh)=x+0.009*(v_kmh-vAvg_kmh)

set xlabel "t [min]"
set xrange [tmin:tmax]
set xtics 30


set ylabel "x [km]" offset -1,0
set yrange [xmin:xmax]
set ytics 2

unset surface; set surface; set pm3d; set pm3d map

# etliche gnuplot Bugs mit Verwendung der richtigen Linien

splot[t=tmin:tmax] \
 "W26_freewayRamp.x16000_det" u  ($1-tshift): (vFun($1, xD0, $3)-0.2):($3) w l ls 22,\
 "W26_freewayRamp.x15000_det" u  ($1-tshift): (vFun($1, xD1, $3)):($3) w l ls 22,\
 "W26_freewayRamp.x14000_det" u  ($1-tshift): (vFun($1, xD2, $3)):($3) w l ls 22,\
 "W26_freewayRamp.x13000_det" u  ($1-tshift): (vFun($1, xD3, $3)):($3) w l ls 22,\
 "W26_freewayRamp.x12000_det" u  ($1-tshift): (vFun($1, xD4, $3)):($3) w l ls 22,\
 "W26_freewayRamp.x11000_det" u  ($1-tshift): (vFun($1, xD5, $3)):($3) w l ls 22,\
 "W26_freewayRamp.x10000_det"   u  ($1-tshift): (vFun($1, xD6, $3)):($3) w l ls 22,\
  t, xD0 ,-1 w l ls 99,\
  t, xD1 ,-1 w l ls 11,\
  t, xD2 ,0 w l ls 11,\
  t, xD3 ,0 w l ls 11,\
  t, xD4 ,0 w l ls 11,\
  t, xD5 ,0 w l ls 11,\
  t, xD6 ,0 w l ls 11,\
  t, xD1-0.01 ,0 w l ls 11,\
  t, xD1+0.01 ,0 w l ls 11,\
  t, xD2-0.01 ,0 w l ls 11,\
  t, xD2+0.01 ,0 w l ls 11


unset pm3d


###############################################
set out "W26_freewayRamp_Q.eps"
print "plotting W26_freewayRamp_Q.eps"
###############################################


set nokey
set param
set nogrid

# Achtung: Def  Qfun(q) (kleines f) weiter oben

nAvg_invmin=20.
QFun(t,x,n_invmin)=x+0.009*(n_invmin-nAvg_invmin) 


plot[t=tmin:tmax] \
 "W26_freewayRamp.x16000_det" u  ($1-tshift): (QFun($1, xD0, $3)-0.2) w l ls 12,  t, xD0 w l ls 1,\
 "W26_freewayRamp.x15000_det" u  ($1-tshift): (QFun($1, xD1, $3)) w l ls 12,  t, xD1 w l ls 1,\
 "W26_freewayRamp.x14000_det" u  ($1-tshift): (QFun($1, xD2, $3)) w l ls 12,  t, xD2 w l ls 1,\
 "W26_freewayRamp.x13000_det" u  ($1-tshift): (QFun($1, xD3, $3)) w l ls 12,  t, xD3 w l ls 1,\
 "W26_freewayRamp.x12000_det" u  ($1-tshift): (QFun($1, xD4, $3)) w l ls 12,  t, xD4 w l ls 1,\
 "W26_freewayRamp.x11000_det" u  ($1-tshift): (QFun($1, xD5, $3)) w l ls 12,  t, xD5 w l ls 1,\
 "W26_freewayRamp.x10000_det"   u  ($1-tshift): (QFun($1, xD6, $3)) w l ls 12,  t, xD6 w l ls 1

