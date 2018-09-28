//##################################
// transversal dynamics during lane change 
// (fraction<1: starts at fraction*laneStart+(1-fraction)*laneEnd)
//##################################

var dt_LC=4; // duration of a lane change (4)

function get_v(dt_afterLC, laneStart, laneEnd, fraction){
    var acc_v=fraction*4./(dt_LC*dt_LC); // [lanes/s^2]
    var dt=(dt_afterLC<0.5*dt_LC) ? dt_afterLC : dt_LC-dt_afterLC;
    var dv = (dt_afterLC<0.5*dt_LC) 
	? (1-fraction) + fraction*0.5*acc_v*dt*dt
	: (1-fraction) +fraction*(1- 0.5*acc_v*dt*dt);
    return (dt_afterLC>dt_LC) ? laneEnd : laneStart+dv*(laneEnd-laneStart);
}

// lateral speed in lanes/s (lateral angle=arctan (laneWidth*dvdt/speed)

function get_dvdt(dt_afterLC, laneStart, laneEnd, speed, fraction){
    var acc_v=fraction*4./(dt_LC*dt_LC);
    var dt=(dt_afterLC<0.5*dt_LC) ? dt_afterLC : dt_LC-dt_afterLC;
    return (dt_afterLC>dt_LC) ? 0 : acc_v*dt*(laneEnd-laneStart);
}
