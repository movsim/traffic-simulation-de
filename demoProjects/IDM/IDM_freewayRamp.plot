gnuplot IDM_freewayRamp.gnu
#for ext in . .harm. .real. .funddias.; do
for ext in .; do
  echo "making IDM_freewayRamp${ext}eps"
  fig2dev -L eps IDM_freewayRamp${ext}fig IDM_freewayRamp${ext}eps 
done
#gv --orientation=PORTRAIT IDM_freewayRamp.harm.eps &
#gv --orientation=PORTRAIT IDM_freewayRamp.eps &
#evince IDM_freewayRamp.eps &
#gv --orientation=PORTRAIT IDM_freewayRamp.real.eps &
#gv --orientation=PORTRAIT IDM_freewayRamp.funddias.eps &

