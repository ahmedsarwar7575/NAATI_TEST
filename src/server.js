import { app } from "./app.js";
import { env } from "./config/env.js";
import { sequelize } from "./config/db.js";
import "./models/index.js";

// async function start() {
//   await sequelize.authenticate();
//   await sequelize.sync({ alter: true });

//   app.listen(env.port, () => {
//     console.log(`Server running on ${env.port}\n`);
//   });
// }

// start().catch((e) => {
//   process.stderr.write(`${e?.message || e}\n`);
//   process.exit(1);
// });

sequelize.sync().then(async () => {
  // await syncAssociations();
  app.listen(env.port, () => {
    console.log(`Server running on ${env.port}\n`);
  });
});
