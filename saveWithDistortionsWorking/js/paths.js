//##################################
// transversal dynamics during lane change 
// (fraction<1: starts at fraction*laneStart+(1-fraction)*laneEnd)
//##################################

//var dt_LC=4; // duration of a lane change (4)


function update_v_dvdt_optical(vehicle){

    // ego vehicles are updated separately, obstacles not at all


    if( (vehicle.id!=1) && (vehicle.isRegularVeh)){

        var laneFraction=vehicle.fracLaneOptical;
        var laneStart=vehicle.laneOld;
        var laneEnd=vehicle.lane;
        var speed=vehicle.speed;
	var dt_LC=vehicle.dt_LC;
        var dt_afterLC=vehicle.dt_afterLC;

        // fractional optical lane 

        var acc_v=laneFraction*4./(dt_LC*dt_LC); // [lanes/s^2]
        var dt=(dt_afterLC<0.5*dt_LC) ? dt_afterLC : dt_LC-dt_afterLC;
        var dv = (dt_afterLC<0.5*dt_LC)
            ? (1-laneFraction) + 0.5*acc_v*dt*dt
            : 1- 0.5*acc_v*dt*dt;
        vehicle.v= (dt_afterLC>dt_LC)
            ? laneEnd : laneStart+dv*(laneEnd-laneStart);

        // optical lateral velocity component

        vehicle.dvdt=(dt_afterLC>dt_LC) ? 0 : acc_v*dt*(laneEnd-laneStart);
      if(false){
        console.log("update_v_dvdt_optical: laneStart=",laneStart,
		    " laneEnd=",laneEnd," dt_LC=",dt_LC,
		    " dt_afterLC=",dt_afterLC,
		    " v=",vehicle.v, " dvdt=",vehicle.dvdt);
      }
    }
}
