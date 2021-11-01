

set style line 1 lt 1 lw 2 pt 7 ps 1.9  lc rgb "#000000" #schwarz,solid,bullet
set style line 2 lt 1 lw 2 pt 4 ps 1.5  lc rgb "#CC0022" #rot, solid Kreuz
set style line 3 lt 8 lw 2 pt 4 ps 1.2  lc rgb "#FF3300" #orange, openSquare
set style line 4 lt 6 lw 2 pt 4 ps 1.5  lc rgb "#FFAA00" #gelb, openSquare
set style line 5 lt 1 lw 2 pt 5 ps 1.5  lc rgb "#00DD22" #gruen, closedBox
set style line 6 lt 5 lw 2 pt 4 ps 1.5  lc rgb "#00AAAA" #offenes Quadrat
set style line 7 lt 3 lw 2 pt 4 ps 2.0  lc rgb "#1100FF" #blau,dottedSquare
set style line 8 lt 4 lw 2 pt 8 ps 1.5  lc rgb "#220088"
set style line 9 lt 7 lw 2 pt 9 ps 1.5  lc rgb "#999999" #aufrClosedTriang. 

set style line 11 lt 1 lw 4 pt 7 ps 1.9  lc rgb "#000000" 
set style line 12 lt 1 lw 4 pt 2 ps 1.5  lc rgb "#CC0022" 
set style line 13 lt 8 lw 4 pt 4 ps 1.2  lc rgb "#FF3300"
set style line 14 lt 6 lw 4 pt 4 ps 1.5  lc rgb "#FFAA00"
set style line 15 lt 1 lw 4 pt 5 ps 1.5  lc rgb "#00DD22"
set style line 16 lt 5 lw 4 pt 7 ps 1.5  lc rgb "#00AAAA"
set style line 17 lt 1 lw 4 pt 7 ps 1.5  lc rgb "#1100FF"
set style line 18 lt 4 lw 4 pt 8 ps 1.5  lc rgb "#220088"
set style line 19 lt 7 lw 4 pt 9 ps 1.5  lc rgb "#999999"

#Sinnvolle point typen (pt)
# 1=Plus,2=Kreuz,4=openQuare,5=closedSquare, 6=openCirc,7=closedCirc,
# 9-11=triangles, 12-13=Rauten


##############################################################
# Beispiele fuer Funktionen 
##############################################################

max(x,y)    = (x>y) ? x : y
min(x,y)    = (x>y) ? y : x
mod(x,interval)=x-(floor(x/interval)*interval) # x%interval for reals

r=10   # roundabout radius
w=4    # width of 1 lane

r1=(r/sqrt(2)-0.5*w)/(1-0.5*sqrt(2))
lArm=3*r

# central ring of roundabout:

x1(s,t)=(r+t)*cos(s/r)
y1(s,t)=(r+t)*sin(s/r)

# arms 2 and 3 (ingoing/outgoing east arms)

sc2=lArm-0.25*pi*r1
xc2=(r+r1)/sqrt(2)
yc2=(r+r1)/sqrt(2)
x02=xc2+lArm-0.25*pi*r1

x2(s,t)=(s<sc2) ? x02-s : xc2-(r1-t)*sin((s-sc2)/r1)
y2(s,t)=(s<sc2) ? 0.5*w+t : yc2-(r1-t)*cos((s-sc2)/r1)

x3(s,t)=x2(lArm-s,t)
y3(s,t)=-y2(lArm-s,t)

x4(s,t)=y2(s,t)
y4(s,t)=-x2(s,t)

x5(s,t)=y3(lArm-s,t)
y5(s,t)=-x3(lArm-s,t)

x6(s,t)=-x2(s,t)
y6(s,t)=-y2(s,t)

x7(s,t)=-x3(s,t)
y7(s,t)=-y3(s,t)

x8(s,t)=-x4(s,t)
y8(s,t)=-y4(s,t)

x9(s,t)=-x5(s,t)
y9(s,t)=-y5(s,t)


#################################################

set term png
set out "README_roundabouts.png"
print "plotting README_roundabouts.png"

set size 0.80,1
set xrange [-40:40]
set yrange [-40:40]

plot[t=0:1]\
  x1(t*2*pi*r, w/2), y1(t*2*pi*r, w/2) w l ls 11,\
  x1(t*2*pi*r,-w/2), y1(t*2*pi*r,-w/2) w l ls  1,\
  x2(t*lArm, w/2), y2(t*lArm, w/2) w l ls 12,\
  x2(t*lArm,-w/2), y2(t*lArm,-w/2) w l ls  2,\
  x3(t*lArm, w/2), y3(t*lArm, w/2) w l ls 12,\
  x3(t*lArm,-w/2), y3(t*lArm,-w/2) w l ls  2,\
  x4(t*lArm, w/2), y4(t*lArm, w/2) w l ls 13,\
  x4(t*lArm,-w/2), y4(t*lArm,-w/2) w l ls  3,\
  x5(t*lArm, w/2), y5(t*lArm, w/2) w l ls 13,\
  x5(t*lArm,-w/2), y5(t*lArm,-w/2) w l ls  3,\
  x6(t*lArm, w/2), y6(t*lArm, w/2) w l ls 15,\
  x6(t*lArm,-w/2), y6(t*lArm,-w/2) w l ls  5,\
  x7(t*lArm, w/2), y7(t*lArm, w/2) w l ls 15,\
  x7(t*lArm,-w/2), y7(t*lArm,-w/2) w l ls  5,\
  x8(t*lArm, w/2), y8(t*lArm, w/2) w l ls 16,\
  x8(t*lArm,-w/2), y8(t*lArm,-w/2) w l ls  6,\
  x9(t*lArm, w/2), y9(t*lArm, w/2) w l ls 16,\
  x9(t*lArm,-w/2), y9(t*lArm,-w/2) w l ls  6




