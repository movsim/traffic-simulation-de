
// yr 0 (bottom), 1 (top), opposite to pixel coordinates

function displayText(str_text,textsize_inp, xr_inp, yr_inp){

  var textsize=(typeof(textsize_inp) === "undefined")
      ? 0.025*canvas.height : Math.max(textsize_inp,0.010*canvas.height);
  var xr=(typeof(xr_inp) === "undefined") ? 0.5 : xr_inp
  var yr=(typeof(yr_inp) === "undefined") ? 0.5 : yr_inp
  //if(textsize<5}{textsize=5;}
  ctx.setTransform(1,0,0,1,0,0); 

  ctx.font=textsize+'px Arial';

  var str_width=0.55*str_text.length*textsize;
  var str_height=1.2*textsize;
  var str_xlb=xr*canvas.width-0.5*str_width;
  var str_ylt=(1-yr)*canvas.height-0.5*str_height; 
  ctx.fillStyle="rgb(255,255,255)";
  ctx.fillRect(str_xlb,str_ylt,str_width,str_height);
  ctx.fillStyle="rgb(0,0,0)";
  ctx.fillText(str_text, str_xlb+0.2*textsize, str_ylt+0.95*textsize);
  console.log("in displayText: str_text=",str_text,
	      " str_xlb+0.2*textsize=",str_xlb+0.2*textsize,
	      " str_ylt+0.95*textsize=",str_ylt+0.95*textsize,
	      " yr=",yr," str_height=",str_height," canvas.height=",canvas.height);
}
