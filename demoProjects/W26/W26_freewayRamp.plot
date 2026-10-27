gnuplot W26_freewayRamp.gnu
#for ext in . .harm. .real. .funddias.; do
for ext in .; do
  echo "making W26_freewayRamp${ext}eps"
  fig2dev -L eps W26_freewayRamp${ext}fig W26_freewayRamp${ext}eps 
done
#gv --orientation=PORTRAIT W26_freewayRamp.harm.eps &
#gv --orientation=PORTRAIT W26_freewayRamp.eps &
#evince W26_freewayRamp.eps &
#gv --orientation=PORTRAIT W26_freewayRamp.real.eps &
#gv --orientation=PORTRAIT W26_freewayRamp.funddias.eps &

