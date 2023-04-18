


/**
######################################################################
 projection 3d physical coordinates => 2d pixel coordinates
 in the "pinhole model" giving [0,0] pixel coordinates 
 in shooting direction (perp to e1Sensor and e2Sensor)

 xPix=rPix.e1Sensor = f*nPix/36mm * (dr . e1Sensor)/(dr . nShoot)
 yPix=rPix.e2Sensor = f*nPix/36mm * (dr . e2Sensor)/(dr . nShoot)
 e2Sensor = nShoot X e1Sensor   ['.' = scalar product, 'X'=cross product]

 valid in arbitrary physical coordinates 
 and for all six camera degrees of freedom.

 Notice1:  projection onto the sensor edges e1Sensor,e2Sensor
 automatically selects the component of the distance vector 
 perpendicular to the shooting direction, so no need to calculate drPerp

 Notice2: dr.nShoot=drParallel should be >0; otherwise object behind 
 the camera

######################################################################

@param dr=[dx,dy,dz]     3d-distance vector [m]: dr= r_object - r_camera
@param nShoot=[nx,ny,nz] shooting direction (need not to be normalized)
@param rotation          rotation [rad] of the camera around its 
                         shooting axis (0: landscape, pi/2: portrait rotated
                         anticlockwise)
@param f                 focal length [mm] for 24mmX36mm-film reference
@param nPix              pixel number [pix] of the larger image side
@return                  [xPix, yPix, successFlag]  (successFlag=false
                         if object is too close or behind camera) 
*/

//!! check if rotation->cosrotation,sinrotation significantly faster

//function proj3d_coordPix(dr, nShoot, rotation, f, nPix){
function proj3d_coordPix(dr, nShoot, cosrot, sinrot, f, nPix){

    //normalize shooting direction and direction of camera coordinate 1
    // (in-place change of array reference nShoot but harmless)

    var norm=Math.sqrt(nShoot[0]*nShoot[0]+nShoot[1]*nShoot[1]
		       +nShoot[2]*nShoot[2]);
    for(var i=0; i<3; i++){
	nShoot[i]/=norm;
    }

    // assume at first a horizontally held camera (rotation=0, 
    // horizontal edge e1Sensor has no z coordinate) and rotate 
    // the camera later on by rotating the pixel coordinates

    var normEdge1=Math.sqrt(nShoot[0]*nShoot[0]+nShoot[1]*nShoot[1]);
    var e1Sensor=[nShoot[1]/normEdge1, -nShoot[0]/normEdge1, 0];

    // calculate vertical (yPixel) camera/sensor  edge  in the
    // direction of increasing yPix by the cross product 

    var e2Sensor=[]; 

    e2Sensor[0]=nShoot[1]*e1Sensor[2] - nShoot[2]*e1Sensor[1];
    e2Sensor[1]=nShoot[2]*e1Sensor[0] - nShoot[0]*e1Sensor[2];
    e2Sensor[2]=nShoot[0]*e1Sensor[1] - nShoot[1]*e1Sensor[0];

 
    // calculate object distance parallel  to shooting direction
    // and test if object projection is sufficiently far outside of
    // the screen or object is behind the camera; if so, return  [0,0]
    // !!cos(angle)=drParLen/drLen, tan(angle)=36/2/f

    var drParLen=0;
    for(var i=0; i<3; i++){
	drParLen+=dr[i]*nShoot[i]; //can be negative if object behind camera
    }
    var drLen=Math.sqrt(dr[0]*dr[0]+dr[1]*dr[1]+dr[2]*dr[2]);
    if(drParLen/drLen<0.5){ // !!cos(angle)=drParLen/drLen, tan(angle)=36/2/f
 	//console.log("transform3d: dr=",dr," Warning: drParLen/drLen<=0.5");
	return [0,0,false];
    }




    // calculate scaling factor [pixel/m] for a 24X36mm film reference

    var scale=f*nPix/(36*drParLen);


    // calculate pixel coordinates of horizontal camera 
    // with the above pinhole formulas

    var xPix=0; for (var i=0;i<3; i++){xPix +=scale*dr[i]*e1Sensor[i];}
    var yPix=0; for (var i=0;i<3; i++){yPix +=scale*dr[i]*e2Sensor[i];}

    // rotate camera/sensor anticlockwise, i.e., rotate pixels clockwise

    //var cosrot=Math.cos(rotation);
    //var sinrot=Math.sin(rotation);
    var xPixRot= cosrot*xPix+sinrot*yPix;
    var yPixRot=-sinrot*xPix+cosrot*yPix;

    if(false){
	console.log("\nproj3d_coordPix: dr=",dr,
		    "\n  nShoot=  ",nShoot,
		    "\n  cosrot",parseFloat(cosrot).toFixed(2),
		    "\n  sinrot",parseFloat(sinrot).toFixed(2),
		    "\n  f",parseFloat(f).toFixed(0),
		    "\n  nPix",parseFloat(nPix).toFixed(0),
		    "\n  e1Sensor=",e1Sensor,
		    "\n  e2Sensor=",e2Sensor,
		    "\n  drLen=  ",parseFloat(drLen).toFixed(1),
		    "\n  drParLen=  ",parseFloat(drParLen).toFixed(1),
                    "\n  scale[Pix/m]=",parseFloat().toFixed(2),
		    "\n  final: xPix=",parseFloat(xPixRot).toFixed(0),
		    " yPix=",parseFloat(yPixRot).toFixed(0)
		   );
    }
    return [xPixRot,yPixRot,true];
}// proj3d_coordPix



/**
######################################################################
 inverse projection (xPix, yPix) -> dr=(dx,dy,dz=given) 
 from 2d pixel coordinates to 3d object distance vector
 assuming dz=z_object - z_camera is a given fixed value

######################################################################

@param xPix,yPix         pixel coords, xPix=yPix=0 in shooting direction
@param dz                fixed vertical distance z_object-z_camera
@param nShoot=[nx,ny,nz] shooting direction (need not to be normalized)
@param rotation          rotation [rad] of the camera around its 
                         shooting axis (0: landscape, pi/2: portrait rotated
                         anticlockwise)
@param f                 focal length [mm] for 24mmX36mm-film reference
@param nPix              pixel number [pix] of the larger image side
@return                  [distance vector dx,dy,dz] from input 
*/

function proj3d_inverse(xPix, yPix, dz, nShoot, rotation, f, nPix){

    //normalize shooting direction and direction of camera coordinate 1
    // (in-place change of array reference nShoot but harmless)

    var norm=Math.sqrt(nShoot[0]*nShoot[0]+nShoot[1]*nShoot[1]
		       +nShoot[2]*nShoot[2]);
    for(var i=0; i<3; i++){
	nShoot[i]/=norm;
    }


    // calculate sensor edges of horizontally held camera 
    // as in proj3d_coordPix !!! externalize as separate helper function!!


    var normEdge1=Math.sqrt(nShoot[0]*nShoot[0]+nShoot[1]*nShoot[1]);
    var e1Sensor=[nShoot[1]/normEdge1, -nShoot[0]/normEdge1, 0];

    var e2Sensor=[]; 
    e2Sensor[0]=nShoot[1]*e1Sensor[2] - nShoot[2]*e1Sensor[1];
    e2Sensor[1]=nShoot[2]*e1Sensor[0] - nShoot[0]*e1Sensor[2];
    e2Sensor[2]=nShoot[0]*e1Sensor[1] - nShoot[1]*e1Sensor[0];


    // start bei rotating camera to horizontal such that 
    // sensor edge e1 has no z component 

    var cosrot=Math.cos(rotation);
    var sinrot=Math.sin(rotation);
    var xPixHoriz= cosrot*xPix-sinrot*yPix;
    var yPixHoriz=+sinrot*xPix+cosrot*yPix;

    // calculate coefficients of 2X2 eq system A (dx,dy)=b

    var scale=f*nPix/36;

    var a11=xPixHoriz*nShoot[0] - scale*e1Sensor[0];
    var a12=xPixHoriz*nShoot[1] - scale*e1Sensor[1];
    var a21=yPixHoriz*nShoot[0] - scale*e2Sensor[0];
    var a22=yPixHoriz*nShoot[1] - scale*e2Sensor[1];

    var b1=dz * (scale*e1Sensor[2] - xPixHoriz*nShoot[2]);
    var b2=dz * (scale*e2Sensor[2] - yPixHoriz*nShoot[2]);

    // solve linear system and return results

    var dy=(a21*b1-a11*b2)/(a21*a12-a11*a22);
    var dx=(b1-a12*dy)/a11;
    return [dx,dy,dz];


}







//######################################################################
// helper method to get correct sensor edge 1 of camera (must be normal to nShoot)
// Correct, if needed adopting the "least-impact strategy"
// @return: corrected e1Sensor
//######################################################################

// !! bug if e1SensorIn has nonzere z coordinate! (but no longer used)

function checkCorrectSensorEdge1(nShoot,e1SensorIn){
    var e1Sensor=[];
    for (var i=0; i<3; i++){ // deep copying
	e1Sensor[i]=e1SensorIn[i];
    }
    
    var res=nShoot[0]*e1Sensor[0]+nShoot[1]*e1Sensor[1]+nShoot[2]*e1Sensor[2];
    if(Math.abs(res)>1e-6){
	var imax=0;
	var absmax=Math.abs(nShoot[0]);
	for(var i=1; i<3; i++){
	    if(Math.abs(nShoot[i])>absmax){
		imax=i;
		absmax=Math.abs(nShoot[i]);
	    }
	}
	e1Sensor[imax] -= res/nShoot[imax];
	console.log("checkCorrectSensorEdge1: camera edge e1sensor was not",
		    " perpendicular to nShoot.",
		    "\n corrected component ",imax,
		    " by an amount ", -res/nShoot[imax],
                    " resulting in",
		    "\n  ",e1Sensor);
    }

    // normalize e1Sensor and return

    var norm=Math.sqrt(e1Sensor[0]*e1Sensor[0]+e1Sensor[1]*e1Sensor[1]
		       +e1Sensor[2]*e1Sensor[2]);
    for(var i=0; i<3; i++){
	e1Sensor[i]=e1Sensor[i]/=norm;
    }

    return e1Sensor;
}



/**
######################################################################
 calculates the affine transform 
 (a00,a01,a10,a11,translX,translY) for images representing
 object surfaces projected onto the sensor of a camera (pinhole model)

 the translatory component is zero for objects in the shooting direction

 valid in arbitrary physical coordinates 
 and for all six camera degrees of freedom. See also 
 docu for function proj3d_coordPix below


@param dr0=[dx0,dy0,dz0] distance vector dr0=r0-r_camera[m]; r0 is the corner 
                         of the object/surface with img pix coordinates [0,0]
@param dr1               physical distance vector[m] of the surface corner 
                         with img pixel coords [nPix1,0]
@param dr2               physical distance vector[m] of the surface corner 
                         with img pixel coords [0,nPix2]
@param nPix1,nPix2       pixel dimensions[pix] of the two edges 
                         dr1-dr0, dr2-dr0
@param nShoot=[nx,ny,nz] shooting direction (need not to be normalized)
@param cosrot,sinrot     cos and sin of the rotation of the camera around its 
                         shooting axis (rotation=0: landscape, 
                         rotation=pi/2: portrait rotated anticlockwise)
@param f                 focal length[mm] for 24mmX36mm-film reference
@param screenSize         pixel number[pix] of the larger screen side
@return                  the six-parameter affine transform matrix 
                         pixImg->pixScreen and, as seventh return value
                         arr[6], the success flag for regular completion
*/
 

function affineTransformImage(dr0, dr1, dr2, nPix1, nPix2, nShoot, 
			      cosrot,sinrot, f, screenSize){

    // the two object edges in increasing xPix and yPix (=pix1,pix2) direction
    
    var e1=[dr1[0]-dr0[0], dr1[1]-dr0[1], dr1[2]-dr0[2]];
    var e2=[dr2[0]-dr0[0], dr2[1]-dr0[1], dr2[2]-dr0[2]];
  
    // distance surface center - camera (dr=dr0+0.5*(dr1-dr0+dr2-dr0)=0.5*(dr1+dr2)
 
    var dr=[0.5*(dr1[0]+dr2[0]), 
	    0.5*(dr1[1]+dr2[1]),
	    0.5*(dr1[2]+dr2[2])];

    // points near the center to calculate difference quotient

    var eps=0.01;
    var dr1loc=[dr[0]+eps*e1[0], dr[1]+eps*e1[1], dr[2]+eps*e1[2]];
    var dr2loc=[dr[0]+eps*e2[0], dr[1]+eps*e2[1], dr[2]+eps*e2[2]];

    //console.log("affineTransformImage: dr0=",dr0," dr1=",dr1," dr2=",dr2);

    // calculate coordPix -> translational part of transform
    // calculate coordPix[12] -> differential projections to get the 
    // non-translational elements of transform


    var projResults=proj3d_coordPix(dr, nShoot,cosrot,sinrot,f,screenSize);

    var projResults1=proj3d_coordPix(dr1loc,nShoot,cosrot,sinrot,f,screenSize);
    var projResults2=proj3d_coordPix(dr2loc,nShoot,cosrot,sinrot,f,screenSize);

    var coordPix=projResults;
    var coordPix1=projResults1;
    var coordPix2=projResults2;

    var affTraf00=1/nPix1 * (coordPix1[0]-coordPix[0])/eps;
    var affTraf01=1/nPix1 * (coordPix1[1]-coordPix[1])/eps;
    var affTraf10=1/nPix2 * (coordPix2[0]-coordPix[0])/eps;
    var affTraf11=1/nPix2 * (coordPix2[1]-coordPix[1])/eps;
    var successFlag=projResults[2] && projResults1[2] && projResults2[2];

    return [affTraf00,affTraf01,affTraf10,affTraf11,
	    coordPix[0],coordPix[1],successFlag];
}


/*
affineTransformGraphics is as affineTransformImage but specialized for 
(html5 canvas) graphics such as fillRect which are drawn 
on a virtual surface at distance dr [physical coordinates]
from the camera with edge direction vectors [physical coordinates] e1 and e2
corresponding to the x and y directions of the graphics context.  
Notice that here, (0,0) of the graphics context 
does not denote the pixels of 
the left top cormer of the image but the center of the image

@param dr         distance vector [dr0x,dr0y,dr0z] in physical units [m]
                  of center of surface to the camera
@param e1         direction [e1x,e1y,e1z] of the first physical surface edge
                  corresponds to "screen x" after affineTransform
                  (needs not to be normalized)
@param e2         same for the "screen y" coordinate after affineTransform
                  (at present, order e1,e2 does not matter)
@param scale      how many pixels of the graphics commands correspond
                  to one meter of the physical surface [Pixels/m]
                  (set to 1 if pixel commands directly in meter)
@param nShoot     shooting direction [nx,ny,nz] (need not to be normalized)
@param rotation   rotation [rad] of the camera around its shooting axis
                  (0: landscape, pi/2: portrait rotated anticlockwise)
@param f          focal length[mm] for 24mmX36mm-film reference
@param screenSize pixel number[pix] of the larger screen side
@return           the six-parameter affine transform matrix  
                  draw cmds -> pixels on screen and, as seventh return value
                  arr[6], the success flag for regular completion
*/

function affineTransformGraphics(dr, e1, e2,  scale, nShoot, rotation, f, 
				 screenSize ){

    //console.log("affineTransformGraphics: dr=",dr);

    // normalize the direction vectors e1 and e2

    var e1abs=Math.sqrt(e1[0]*e1[0]+e1[1]*e1[1]+e1[2]*e1[2]);
    for (var i=0; i<3; i++){e1[i] /= e1abs;}

    var e2abs=Math.sqrt(e2[0]*e2[0]+e2[1]*e2[1]+e2[2]*e2[2]);
    for (var i=0; i<3; i++){e2[i] /= e2abs;}

    // distance from camera of points that are the physical equivalent
    // of 1 pixel off the center in the xPix and yPix direction 
    // of the graphical commands to calculate aff transform 
    // from the small differences

    var eps=1./scale; 
    var dr1=[dr[0]+eps*e1[0], dr[1]+eps*e1[1], dr[2]+eps*e1[2]];
    var dr2=[dr[0]+eps*e2[0], dr[1]+eps*e2[1], dr[2]+eps*e2[2]];

    // calculate screenPix -> translational part of affine transform
    // and screenPix1, screenPix2 to get the non-translational elements

    var cosrot=Math.cos(rotation);
    var sinrot=Math.sin(rotation);

    var projCenter=proj3d_coordPix(dr, nShoot,cosrot,sinrot,f,screenSize);
    var proj1     =proj3d_coordPix(dr1,nShoot,cosrot,sinrot,f,screenSize);
    var proj2     =proj3d_coordPix(dr2,nShoot,cosrot,sinrot,f,screenSize);

    var screenPixCenter=projCenter;
    var screenPix1=proj1;
    var screenPix2=proj2;

    var affTraf00=(screenPix1[0]-screenPixCenter[0]);
    var affTraf01=(screenPix1[1]-screenPixCenter[1]);
    var affTraf10=(screenPix2[0]-screenPixCenter[0]);
    var affTraf11=(screenPix2[1]-screenPixCenter[1]);

    var successFlag=projCenter[2] && proj1[2] && proj2[2];


    if(false){
	console.log("in transform3d.affineTransformGraphics:",
		    " scale="," screenSize=",screenSize);
	console.log("e1=",e1," e2=",e2);
	console.log("dr1=",dr1," dr2=",dr2);
	console.log("screenPixCenter=",screenPixCenter,
		    "\n screenPix1=",screenPix1,
		    "\n screenPix2=",screenPix2);
	aff=[affTraf00,affTraf01,affTraf10,affTraf11,
	     screenPixCenter[0],screenPixCenter[1]];
	console.log("affine trafo = ",aff);
    
    }
    return [affTraf00,affTraf01,affTraf10,affTraf11,
	    screenPixCenter[0],screenPixCenter[1],successFlag];
}

