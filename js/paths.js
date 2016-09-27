//##################################
// transversal dynamics during lane change
//##################################


function get_v(dt_afterLC, dt_LC, laneStart, laneEnd){
    var acc_v=4./(dt_LC*dt_LC);
    var dt=(dt_afterLC<0.5*dt_LC) ? dt_afterLC : dt_LC-dt_afterLC;
    var dv = (dt_afterLC<0.5*dt_LC) ? 0.5*acc_v*dt*dt : 1- 0.5*acc_v*dt*dt;
    return (dt_afterLC>dt_LC) ? laneEnd : laneStart+dv*(laneEnd-laneStart);
}

// arctan angle with resp to vehicle axis 

function get_dvdu(dt_afterLC, dt_LC, laneStart, laneEnd, speed){
    var acc_v=4./(dt_LC*dt_LC);
    var dt=(dt_afterLC<0.5*dt_LC) ? dt_afterLC : dt_LC-dt_afterLC;
    var dv = (dt_afterLC<0.5*dt_LC) ? 0.5*acc_v*dt*dt : 1- 0.5*acc_v*dt*dt;
    return (dt_afterLC>dt_LC) ? 0 : acc_v*dt*(laneEnd-laneStart);
}
