FROM node:12
RUN mkdir -p /usr/src/app
COPY . /usr/src/app
# Reinstall bcrypt to pull correct binary for linux
RUN rm -Rf /usr/src/app/component/node_modules/bcrypt/lib && cd /usr/src/app/component/node_modules/bcrypt && /usr/src/app/component/node_modules/@mapbox/node-pre-gyp/bin/node-pre-gyp install --update-binary --fallback-to-build
WORKDIR /usr/src/app/component
ENTRYPOINT [ "node", "/usr/src/app/component/dist/index.js" ]