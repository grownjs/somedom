FROM node:10

RUN mkdir /var/lib/app
RUN npm i -g npm@^6
RUN npm i -g node-wait-for-it

COPY package*.json /var/lib/app/
WORKDIR /var/lib/app
RUN npm ci

COPY ./ /var/lib/app
RUN npm run build

COPY ./docker/scripts /home/docker/

ENTRYPOINT ['true']
