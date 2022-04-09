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

      //if((itime==182)&&(vehicle.id==211)){
      if(false){
        console.log("end update_v_dvdt_optical: laneStart=",laneStart,
		    " laneEnd=",laneEnd," dt_LC=",dt_LC,
		    " dt_afterLC=",dt_afterLC,
		    " v=",vehicle.v, " dvdt=",vehicle.dvdt);
      }
    }
}




// ###################################################################
// precalculates the six stitching point arrays
// @param x0,y0: beginning of trajectory (in [m]; x: left, y: up)
// @param phi0: initial heading (cos phi0,sin phi0)
// @param du[]: array of arc lengths (last not needed; just goes beyond)
// @param curv: array of curvatures 1/r (positive if left turning)

// @return: populates the six arrays up[], phip[], xp[], yp[], xc[], yc[]
// ###################################################################


function traj_precalc(x0,y0,phi0,du,curv){

  var debug=false;
  if(debug){
    console.log(
      "in traj_precalc: x0=",x0," y0=",y0," phi0=",phi0,
      "\n  du=",du,
      "\n  curv=",curv);
  }

  
  var up=[]; // arc length at the stitching points (always lower-u end)
  var phip=[];
  var xp=[]; // stitching point coordinates
  var yp=[];
  var xc=[]; // arc circle center between u[i] and u[i+1] 
  var yc=[]; // or infty at last stitching point since du[du.length-1] not used
  
  xp[0]=x0; yp[0]=y0; up[0]=0; phip[0]=phi0;
  
  for (var i=0; i<du.length; i++){
    up[i+1]=up[i]+du[i];
    phip[i+1]=phip[i]+curv[i]*du[i];
    var x=0;
    var straightSegm=(Math.abs(curv[i])<1e-6); // straight segment
    var r=(straightSegm) ? 1e6 : 1./curv[i];
    
    if(straightSegm){
      xp[i+1]=xp[i]+du[i]*Math.cos(phip[i]);
      yp[i+1]=yp[i]+du[i]*Math.sin(phip[i]);
      xc[i]=1e6; // not used
      yc[i]=1e6;
    }

    // arc segment
    
    else{
      xc[i]=xp[i]   - r*Math.sin(phip[i]);
      yc[i]=yp[i]   + r*Math.cos(phip[i]);
      xp[i+1]=xc[i] + r*Math.sin(phip[i+1]);
      yp[i+1]=yc[i] - r*Math.cos(phip[i+1]);
    }

    if(debug){
      console.log("i=",i,
		  " straightSegm=",straightSegm,
		  " r=",r.toFixed(0),
		  " up[i+1]=",up[i+1].toFixed(0),
		  " phip[i+1]=",phip[i+1].toFixed(2),
		  " xp[i+1]=",xp[i+1].toFixed(0),
		  " yp[i+1]=",yp[i+1].toFixed(0),
		  " xc[i]=",xc[i].toFixed(0),
		  " yc[i]=",yc[i].toFixed(0),
		  "");
    }
		  

  }
  
  var trajSpec={u: up, phi: phip, x: xp, y: yp, xCenter: xc, yCenter: yc};
  return trajSpec;
}
  
// new format called, e.g.,
// coords=trajFromSpec(u,trajP); xPhys=coords[0], ...

function trajFromSpec(u,trajP){
  
  // find segment iSegm
  // circle centers xc,yc have as many elements as du and curv from input
  // xp,yp,up,phip one more => take xc or yc as array upper bound
  
  var iSegm=0;
  while((u>trajP.u[iSegm+1])&&(iSegm+1<trajP.xCenter.length)){iSegm++;} 

  var curv=(trajP.phi[iSegm+1]-trajP.phi[iSegm])
    /(trajP.u[iSegm+1]-trajP.u[iSegm]);
  var straightSegm=(Math.abs(curv)<1e-6);
  var r=(straightSegm) ? 1e6 : 1./curv; // with sign
  var x=(straightSegm)
      ? trajP.x[iSegm] + (u-trajP.u[iSegm])*Math.cos(trajP.phi[iSegm])
      : trajP.xCenter[iSegm]
      + r*Math.sin(trajP.phi[iSegm]+curv*(u-trajP.u[iSegm]));
  var y=(straightSegm)
      ? trajP.y[iSegm] + (u-trajP.u[iSegm])*Math.sin(trajP.phi[iSegm])
      : trajP.yCenter[iSegm]
      - r*Math.cos(trajP.phi[iSegm]+curv*(u-trajP.u[iSegm]));

  return [x,y];
}



// old format called, e.g.,
// coords=[trajFromSpec_x(u,trajP),trajFromSpec_y(u,trajP)]
// or xPhys=trajFromSpec_x(u,trajP)

function trajFromSpec_x(u,trajP){
  
  var iSegm=0;
  while((u>trajP.u[iSegm+1])&&(iSegm+1<trajP.xCenter.length)){iSegm++;} 

  var curv=(trajP.phi[iSegm+1]-trajP.phi[iSegm])
    /(trajP.u[iSegm+1]-trajP.u[iSegm]);
  var straightSegm=(Math.abs(curv)<1e-6);
  var r=(straightSegm) ? 1e6 : 1./curv; // with sign

  var x=(straightSegm)
      ? trajP.x[iSegm] + (u-trajP.u[iSegm])*Math.cos(trajP.phi[iSegm])
      : trajP.xCenter[iSegm]
      + r*Math.sin(trajP.phi[iSegm]+curv*(u-trajP.u[iSegm]));

  return x;
}

function trajFromSpec_y(u,trajP){
  
  var iSegm=0;
  while((u>trajP.u[iSegm+1])&&(iSegm+1<trajP.xCenter.length)){iSegm++;} 

  var curv=(trajP.phi[iSegm+1]-trajP.phi[iSegm])
    /(trajP.u[iSegm+1]-trajP.u[iSegm]);
  var straightSegm=(Math.abs(curv)<1e-6);
  var r=(straightSegm) ? 1e6 : 1./curv; // with sign

  var y=(straightSegm)
      ? trajP.y[iSegm] + (u-trajP.u[iSegm])*Math.sin(trajP.phi[iSegm])
      : trajP.yCenter[iSegm]
      - r*Math.cos(trajP.phi[iSegm]+curv*(u-trajP.u[iSegm]));

  return y;
}

			       
  








