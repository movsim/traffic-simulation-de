
// ####################################################################
// just track a given vehicle in the network
// ####################################################################

function debugVeh(id,network){
  for(var ir=0; ir<network.length; ir++){
    for(var i=0; i<network[ir].veh.length; i++){
      if(network[ir].veh[i].id==id){
	var veh=network[ir].veh[i];
	var leadVeh=network[ir].veh[veh.iLead];
	var s=leadVeh.u-leadVeh.len-veh.u;
        console.log("time=",time.toFixed(2),
		    //"itime="+itime,
		    "vehId="+veh.id,
		    "route="+veh.route,
		    "roadId="+network[ir].roadID,
		    "type="+veh.type,
		   // "route="+veh.route,
		    "u="+veh.u.toFixed(1),
		    "s="+s.toFixed(1),
		    "roadLen-u="+(network[ir].roadLen-veh.u).toFixed(1),
		    "lane="+veh.lane,
		    "v="+veh.v.toFixed(2),
		    "speed="+veh.speed.toFixed(1),
		    "acc="+veh.acc.toFixed(1),
		    "bBiasRight="+veh.LCModel.bBiasRight,
		    "dt_afterLC="+veh.dt_afterLC.toFixed(1),
		     // " veh="+veh,
		     "");
	}
    }
  }
}




// ####################################################################
// helper pseudoclass for crash detection using the physical coordinates
// of the traj* functions of the network elements
// ####################################################################


function CrashInfo(){
  
  this.crashFactor=0.5; // <1=> some grazing accidents ignored
  
  this.crashParner1_ID=-9999; // to avoid repeated alerts of the same crash
  this.crashParner2_ID=-9999; // check the ID of the "old crash partners

}


CrashInfo.prototype.checkForCrashes=function(network){
  //console.log("\nCheck for crashes, time=",time.toFixed(2),":");
  for(var ir1=0; ir1<network.length; ir1++){
    var road1=network[ir1];
    for(var i1=0; i1<road1.veh.length; i1++){
      var veh1=road1.veh[i1];
      if(veh1.isRegularVeh()){
	
        var traj1=road1.getTraj(veh1);
	var uc1Phys=veh1.u-0.5*veh1.len;
	var vc1Phys=road1.laneWidth*(veh1.v-0.5*(road1.nLanes-1));
	var phi1=road1.get_phi(uc1Phys,traj1);
	var cosphi1=Math.cos(phi1);
	var sinphi1=Math.sin(phi1);
	var xc1=traj1[0](uc1Phys) + vc1Phys*Math.sin(phi1); // center
	var yc1=traj1[1](uc1Phys) - vc1Phys*Math.cos(phi1);
	var L1=veh1.len;
	var W1=veh1.width;
        for(var ir2=0; ir2<network.length; ir2++){
	  var road2=network[ir2];
	  for(var i2=0; i2<network[ir2].veh.length; i2++){
	    var veh2=network[ir2].veh[i2];
	  
	    if((veh2.isRegularVeh())&&(veh1.id<veh2.id)){ // always id1<id2
	    
              var traj2=road2.getTraj(veh2);
	      var uc2Phys=veh2.u-0.5*veh2.len;
	      var vc2Phys=road2.laneWidth*(veh2.v-0.5*(road2.nLanes-1));
	      var phi2=road2.get_phi(uc2Phys,traj2);
	      var xc2=traj2[0](uc2Phys) + vc2Phys*Math.sin(phi2);//center
	      var yc2=traj2[1](uc2Phys) - vc2Phys*Math.cos(phi2);
	      var L2=veh2.len;
	      var W2=veh2.width;

	      var crash=false;
	      
              // preliminary filter
	      var dist2=Math.pow(xc2-xc1,2)+Math.pow(yc2-yc1,2);
	      if(dist2<0.25*(Math.pow(L1+L2,2)+Math.pow(W1+W2,2))){
		//console.log("checkForCrashes: inside preliminary filter");

		// transform coordinates such that x1=y1=phi1=0
		// (x2,y2)=coords rotated by -phi1 and centered at (xc1,yc1)

		var dx2=xc2-xc1;
		var dy2=yc2-yc1;
		var x2= dx2*cosphi1+dy2*sinphi1;
		var y2=-dx2*sinphi1+dy2*cosphi1;

		// find four corners of veh 2 in the transformed system
		// [leftFront, leftBack, rightBack, rightFront]

		var cosdphi=Math.cos(phi2-phi1);
	        var sindphi=Math.sin(phi2-phi1);

		var x2corn=[]; var y2corn=[];
		x2corn[0]=x2+0.5*( L2*cosdphi-W2*sindphi);
		y2corn[0]=y2+0.5*( W2*cosdphi+L2*sindphi);
		x2corn[1]=x2+0.5*(-L2*cosdphi-W2*sindphi);
		y2corn[1]=y2+0.5*( W2*cosdphi-L2*sindphi);
		x2corn[2]=x2+0.5*(-L2*cosdphi+W2*sindphi);
		y2corn[2]=y2+0.5*(-W2*cosdphi-L2*sindphi);
		x2corn[3]=x2+0.5*(+L2*cosdphi+W2*sindphi);
		y2corn[3]=y2+0.5*(-W2*cosdphi+L2*sindphi);

		// crash if any corner (x2corn[i],y2corn[i])
		// is inside vehicle 1 (neglects crashes of sides instead of
		// corners of veh2 but probably negligible)
		
		for(var i=0; i<x2corn.length; i++){
		  crash=(crash||
			 ((Math.abs(x2corn[i])<this.crashFactor*0.5*L1)
			  &&(Math.abs(y2corn[i])<this.crashFactor*0.5*W1)));
		}

		// debug debug function


		if(true&&crash){
		  console.log("\nt=",time.toFixed(2),
			      " crash=",crash,
			      "id1=",veh1.id,
			      "id2=",veh2.id,
			      " L1=",L1," W1=",W1,
			      " L2=",L2," W2=",W2,
			      " x2=",x2," y2=",y2,
			      "");
		  var corner2=["LF","LB","RB","RF"];
		  for(var i=0; i<x2corn.length; i++){
		    console.log("corner2=",corner2[i],
				" x2corn[i]=",x2corn[i].toFixed(1),
				" y2corn[i]=",y2corn[i].toFixed(1),
				" inside=",
				((Math.abs(x2corn[i])<this.crashFactor*0.5*L1)
				 &&(Math.abs(y2corn[i])<this.crashFactor*0.5*W1)),
				"");
		  }
		}
		
	      } // preliminary filter excluding crashes
		

              //if(crash||((veh1.id==224)&&(veh2.id==225))){// always id1<id2
              if(crash){// always id1<id2
		console.log(" t=",time.toFixed(2),
			    "vehs",veh1.id," and",veh2.id,":",
			    //"uc1Phys=",uc1Phys.toFixed(1),
			    //"uc2Phys=",uc2Phys.toFixed(1),
			    //"vc1Phys=",vc1Phys.toFixed(1),
			   // "vc2Phys=",vc2Phys.toFixed(1),
			   // "lane1=",veh1.lane,
			   // "lane2=",veh2.lane,
			    "xc1=",xc1.toFixed(1),
			    "xc2=",xc2.toFixed(1),
			    "yc1=",yc1.toFixed(1),
			    "yc2=",yc2.toFixed(1),
			    "phi1=",phi1.toFixed(1),
			    "phi2=",phi2.toFixed(1),

			    " crash=",crash,
			   // "road1=",road1.roadID,
			   // "road2=",road2.roadID,
			    //"traj2=",traj2,
			    "");
	      }
	      
	      if(crash){
		console.log("crash of vehs "+veh1.id+" and "+veh2.id);
		if( !( (veh1.id==this.crashParner1_ID) // always id1<id2
		       &&(veh2.id==this.crashParner2_ID))
		){
		  this.crashParner1_ID=veh1.id;
		  this.crashParner2_ID=veh2.id;
		  alert("crash of veh "+veh1.id+" on road"+road1.roadID
			+", u="+veh1.u.toFixed(2)+"\n with "+veh2.id
			+" on road"+road2.roadID+", u="+veh2.u.toFixed(2));
		}
	      }
	    }
	  }
	}
	  
	  
      }
    }
  }
}


  
