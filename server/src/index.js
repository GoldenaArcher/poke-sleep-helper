import app from "./app.js";
import { initDb } from "./db.js";

const PORT = process.env.PORT || 4000;

initDb()
  .then(() => {
    console.log("SQLite initialized");
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("SQLite initialization error", error);
    process.exitCode = 1;
  });
