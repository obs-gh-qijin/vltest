#!/bin/bash

for i in {1..10000000}
do
    curl localhost:64740/hello
    sleep 3
    echo "hello $i times"
done   
