#! /bin/bash

if (($#!=2)); then
    echo "Usage: extractLeaderFollower.sh followerID trajectoryData.txt"
    echo "the trajectory data need to be created with the download feature"
    echo "of traffic-simulation.de first"
    echo "example:"
    echo ""
    echo "extractLeaderFollower.sh 213 road1_tstart13_tend27.txt > yourfile"
    echo ""
    echo "extracts from road1_tstart13_tend27.txt the follower 213"
    echo "(which may have several leaders due to active and passive LC)"
    echo "and redirects the standard output to yourfile"
 exit
fi
head -1 ${2}
grep -P "^([0-9]+).([0-9]+)\t${1}" ${2}
