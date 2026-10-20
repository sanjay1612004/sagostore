# MongoDB Atlas setup

1. Create a MongoDB Atlas account and a **development project**. Create an M0 free shared cluster in a region reasonably close to the intended Oracle region.
2. Create a database user with `readWrite` access only to `tamiltrade_dev`; generate its password in your password manager. Database users and Atlas console users are different.
3. Add only your development public IP to the network access list. Avoid a permanent `0.0.0.0/0` allowlist.
4. Copy the SRV connection string, URL-encode username/password characters, and choose `tamiltrade_dev` as the database name. Set it in `server/.env`.
5. Generate different JWT secrets and start the API. `/health/ready` should return `{"status":"ready"}`. Registration creates the owner and business together in a MongoDB transaction. If a transaction is rejected, check cluster state, credentials and connectivity rather than falling back to non-atomic writes.
6. Create a separate **production project/cluster**, production database `tamiltrade_prod`, and production-scoped user. Add the Oracle VM's reserved public egress IP to its allowlist. Do not point integration tests at production.

Atlas free-tier capacity and available features should be checked in the actual account before launch. The application uses ordinary transactions and indexes, not paid Atlas-specific features. Local test replicas do not replace Atlas in production.

Official setup reference: [Atlas free cluster deployment](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).
