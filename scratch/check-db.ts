import { db } from "../src/db";
import { tenants, users } from "../src/db/schema";

async function check() {
  try {
    const allTenants = await db.select().from(tenants);
    console.log("Tenants:", allTenants);
    const allUsers = await db.select().from(users);
    console.log("Users:", allUsers);
  } catch (e) {
    console.error("DB Error:", e);
  }
}

check();
