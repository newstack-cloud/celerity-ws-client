FROM dhi.io/node:24-debian13-dev

WORKDIR /app

RUN npm install ws typescript tsx

COPY server.ts .

EXPOSE 9876

USER node

CMD ["npx", "tsx", "server.ts"]
