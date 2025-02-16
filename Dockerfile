FROM rust:1.75-slim-bookworm as builder

WORKDIR /app
COPY . .

RUN cargo build --release

FROM node:20-slim

WORKDIR /app
COPY --from=builder /app/target/release/ninja /usr/local/bin/
COPY src-frontend /app

RUN npm install
EXPOSE 3000

CMD ["npm", "start"]
