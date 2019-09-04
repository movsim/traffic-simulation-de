#!/bin/bash

for i in 1 2 3 4 5 6 7 9; do
    cp Tempo80svg.fig Tempo${i}0svg.fig
    perl -i -p -e "s/80\\\\001/${i}0\\\\001/g" Tempo${i}0svg.fig
    fig2dev -L svg Tempo${i}0svg.fig Tempo${i}0svg.svg
    echo "generated Tempo${i}0svg.fig, .svg from Tempo80svg.fig"
done

for i in 1 2; do
    cp Tempo100svg.fig Tempo1${i}0svg.fig
    perl -i -p -e "s/100\\\\001/1${i}0\\\\001/g" Tempo1${i}0svg.fig
    fig2dev -L svg Tempo1${i}0svg.fig Tempo1${i}0svg.svg
    echo "generated Tempo1${i}0svg.fig, .svg from Tempo100svg.fig"
done

# leave following fig files unchanged and just export to svg
fig2dev -L svg Tempo80svg.fig Tempo80svg.svg
fig2dev -L svg Tempo100svg.fig Tempo100svg.svg
fig2dev -L svg Tempo00svg.fig Tempo00svg.svg
