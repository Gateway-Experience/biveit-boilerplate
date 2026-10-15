#!/bin/bash

pm2-runtime ecosystem.config.js --env production &

wait -n

exit $?
