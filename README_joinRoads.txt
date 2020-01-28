
Dear Sbouktif team,

thanks for your interest in my work.

In fact what you need when joining two roundabouts is a joining method joining the outflow of the upstream road to the inflow of the downstream road. While a direct joining method to be implemented in  the road pseudoclass does not yet exist (many thanks for the hint, anyway, I will implement one in the next version), there are two possibilities to do that with the present code.

Method 1: Use one outgoing arm of the first roundabout directly as ingoing arm of the second roundabout.

Assume you want to create a second 4-way roundabout connecting the
outgoing link 1 of the roundabout implemented in roundabout.js. This
is arm[1] (outgoing arms have uneven numbers) going to the east
(horizontally to the right). This arm will then simultaneously be the
west inflowing arm of the new roundabout whose center is to the east
(right) of the old roundabout. In the same way, the outgoing west arm
of the new intersection will be the incoming east arm arm[0] of
roundabout.js


Procedure Method 1: 
===================

(1) define mainroad2 to be the ring of the second roundabout. Set its geometry trajRing2_x(u)=trajRing_x(u)+dx, trajRing2_y(u)=trajRing_y(u) as that of the first ring, only dx to the east (dx>0).

(2) define the new arms arm[8+i], i=0..7, in analogy to the arms arm[i], only increase the associated traj_x function by dx. However, do not define arm[8+4] (ingoing from the west) since this is identical to arm[1] (outgoing east arm from the first intersection. Do also not define arm[8+5] (outgoing to the west) since this is identical to arm [0] (ingoing to the first roundabout from the east).

(3a) remove the source from arm [0] since it will now get its traffic from roundabout 2.

(3b) Add at the end of  arm[1] a merge to mainroad2 (the ring of the new roundabout) similarly to the merges of the new arms arm[8+0], arm[8+2], and arm[8+6]. You are done.


Procedure Method 2
===================

(1) as in Procedure 1.

(2) define all 8 new arms arm[8+i], i=0,..., 7 in analogy to arm[i].

(3a) Do not define a source for arm[8+4] but instead couple it to arm[1] by adding, in each timestep,  a call to the function arm[1].mergeDiverge(arm[8+4], ...) defining as merging region, e.g., the last 20 m of arm[1]. In this way, the  outflow of arm[1] is the new source of arm[8+4].

(3b) Couple arm[8+5] to arm[0] in the same way by removing the source of arm[0] and calling  arm[8+5].mergeDiverge(arm[0], ...) in each timestep. You are done


===========================================================

we are beginners and we want to make a small simulation on a network of 4 roundabout and 1 intersection. your code is documented but we could not join two roundabout in the way that the cars getting out from one roundabout enter into the other and vice versa? can you please help by telling how we can do it? thank a lot

