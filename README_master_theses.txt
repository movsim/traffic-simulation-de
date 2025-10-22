Information for use of the simulation in master theses and other theses

The simulation contains some specially prepared versions of some simulation scenarios which you can use for your coding and optimization project.

For this, you need to download the complete simulation code from my github repo https://github.com/movsim/traffic-simulation-de. Then, you start the simulations by loading the corresponding local html files in your browser. The files accessible to Master (and Bachelor) works have a suffix MA: rampMeteringMA.html  roadworksMA.html  roundaboutMA.html  routingMA.html  uphillMA.html.

In the corresponding JavaScript code, e.g., js/rampMeteringMA.js, you will find a section quite at the top starting with the comment "MA" and ending with the comment "end MA". At least at the beginning, you can just stick to this small section and you need not to touch any other files. Typically, this section begins with variables and functions controlling the simulation automatically rather than via the interactive elements in order to get a clear test case. Then, you will find variables for the control specification and the actual control function with a basic implementation to start with and hints to define it for a real optimization. Finally, you can change the output which you may use for assessing your control result. Typically, the simulation stops if no vehicle is in the system and gives a time stamp (the faster, the better) and there is an optional file output, e.g., for plotting the trajectories with external tools.

