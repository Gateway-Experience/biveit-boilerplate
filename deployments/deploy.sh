#!/bin/bash

# Variables
HOST=mathtestprod
DOCKER_NAME="TODO: dockername"
DOMAIN="TODO: app.domain"
AWS_ACCOUNT_NUMBER="TODO: ecr account number"
PORTS=(3009)

ECR_IMAGE="${AWS_ACCOUNT_NUMBER}.dkr.ecr.ap-southeast-1.amazonaws.com/${DOCKER_NAME}"

PORTS_PARAM=""
# Loop through the array elements
for port in "${PORTS[@]}"; do
  PORTS_PARAM+=" -p ${port}:${port} "
done

DEPLOY_COMMANDS="
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_NUMBER}.dkr.ecr.ap-southeast-1.amazonaws.com &&
docker images -q --filter \"dangling=true\" | xargs docker rmi;
docker pull ${ECR_IMAGE}:latest &&
docker stop $DOCKER_NAME || true &&
docker rm $DOCKER_NAME || true &&
docker run -d ${PORTS_PARAM} --name $DOCKER_NAME ${ECR_IMAGE}:latest
"

deploy_frontend() {
    (cd frontend && npm run build)
    ssh $HOST "rm -r /home/ubuntu/www/${DOMAIN}.pre"
    ssh $HOST "rm -r /home/ubuntu/www/${DOMAIN}.bak"
    ssh $HOST "cp -r /home/ubuntu/www/${DOMAIN} /home/ubuntu/www/${DOMAIN}.bak"
    scp -r frontend/dist $HOST:/home/ubuntu/www/${DOMAIN}.pre
    ssh $HOST "rm -r /home/ubuntu/www/${DOMAIN}"
    ssh $HOST "mv /home/ubuntu/www/${DOMAIN}.pre /home/ubuntu/www/${DOMAIN}"
}

deploy_backend() {
    aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_NUMBER}.dkr.ecr.ap-southeast-1.amazonaws.com

    # docker rmi $DOCKER_NAME $ECR_IMAGE
    docker build -f deployments/Dockerfile -t $DOCKER_NAME .
    docker tag ${DOCKER_NAME}:latest ${ECR_IMAGE}:latest
    docker push ${ECR_IMAGE}:latest

    # Execute commands on EC2 instance
    ssh $HOST "$DEPLOY_COMMANDS"
}

if [ "$#" -eq 0 ]; then
    deploy_frontend
    deploy_backend
    exit
fi

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --frontend)
            deploy_frontend
            ;;
        --backend)
            deploy_backend
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 --frontend | --backend"
            exit 1
            ;;
    esac
    shift
done

